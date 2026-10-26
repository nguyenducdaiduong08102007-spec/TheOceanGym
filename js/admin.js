const adminScreen = document.getElementById('admin-screen');
const revenueModal = document.getElementById('revenue-modal');
const revenueForm = document.getElementById('revenue-form');
const revenueError = document.getElementById('revenue-error');
const monthFormatter = new Intl.DateTimeFormat('vi-VN', { month: 'short', year: 'numeric' });
let remoteCoachApplications = [];
let remoteRegistrations = null;
let adminChatConversations = [];
let activeAdminConversationId = '';

function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(value);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
    }
    if (!response.ok) throw new Error(result.error || 'Yêu cầu không thành công.');
    return result;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

// Admin Tab Navigation
window.switchAdminTab = function(tabId) {
    document.querySelectorAll('.admin-tab').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.style.background = 'var(--brand)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
        } else {
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.color = 'var(--muted)';
            btn.style.border = '1px solid var(--border)';
        }
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        if (content.id === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
};

function renderRevenueChart(months) {
    const chart = document.getElementById('revenueChart');
    if (!chart) return;
    chart.replaceChildren();
    const maximum = Math.max(0, ...months.map((item) => item.amount));

    for (const item of months) {
        const monthDate = new Date(`${item.month}-01T12:00:00`);
        const column = document.createElement('div');
        column.className = 'bar-column';
        const wrap = document.createElement('div');
        wrap.className = 'bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'bar';
        const percentage = maximum > 0 ? (item.amount / maximum) * 100 : 0;
        bar.style.height = `${percentage}%`;
        if (item.amount === 0) bar.style.minHeight = '0';
        bar.setAttribute('aria-label', `${monthFormatter.format(monthDate)}: ${formatCurrency(item.amount)}`);
        wrap.appendChild(bar);

        const value = document.createElement('div');
        value.className = 'bar-value';
        value.textContent = formatCurrency(item.amount);
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = monthFormatter.format(monthDate);
        column.append(wrap, value, label);
        chart.appendChild(column);
    }
}

function goalLabel(goal) {
    const labels = {
        fat_loss: 'Giảm mỡ',
        muscle_gain: 'Tăng cơ',
        general_health: 'Sức khỏe tổng thể',
        cardio: 'Chạy bộ / cardio',
        unspecified: 'Chưa ghi mục tiêu'
    };
    return labels[goal] || goal || labels.unspecified;
}

// Render Leads with "+ Cấp tài khoản" button
function renderRegistrations(registrations) {
    const body = document.getElementById('registrationsTable');
    if (!body) return;
    body.replaceChildren();

    const list = Array.isArray(registrations) ? registrations : [];
    if (Array.isArray(registrations)) remoteRegistrations = registrations;
    if (!list.length) {
        const row = document.createElement('tr');
        const message = document.createElement('td');
        message.colSpan = 5;
        message.style.cssText = 'text-align: center; color: var(--muted); padding: 24px;';
        message.textContent = 'Không còn yêu cầu tư vấn mới cần xử lý.';
        row.appendChild(message);
        body.appendChild(row);
        return;
    }

    for (const registration of list) {
        const row = document.createElement('tr');
        
        const name = document.createElement('td');
        const nameLabel = document.createElement('strong');
        nameLabel.textContent = registration.name;
        name.appendChild(nameLabel);
        
        const goal = document.createElement('td');
        goal.textContent = goalLabel(registration.goal);
        
        const phoneCell = document.createElement('td');
        const phone = document.createElement('a');
        phone.href = `tel:${registration.phone}`;
        phone.textContent = registration.phone;
        phone.style.color = 'var(--cyan)';
        phoneCell.appendChild(phone);
        
        const date = document.createElement('td');
        date.textContent = new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(registration.submittedAt));

        const actionCell = document.createElement('td');
        const provisionBtn = document.createElement('button');
        provisionBtn.type = 'button';
        provisionBtn.className = 'primary-btn';
        provisionBtn.style.padding = '6px 12px';
        provisionBtn.style.fontSize = '10px';
        provisionBtn.style.background = 'linear-gradient(135deg, #e50914, #ff3b30)';
        provisionBtn.textContent = '🔑 Cấp tài khoản';
        provisionBtn.onclick = () => openProvisionMemberModal(registration);
        actionCell.appendChild(provisionBtn);

        row.append(name, goal, phoneCell, date, actionCell);
        body.appendChild(row);
    }
}

function renderGoals(goals) {
    const list = document.getElementById('packageList');
    if (!list) return;
    list.replaceChildren();

    if (!goals || !goals.length) {
        const defaultGoals = [
            { goal: 'muscle_gain', count: 12 },
            { goal: 'fat_loss', count: 9 },
            { goal: 'general_health', count: 5 }
        ];
        goals = defaultGoals;
    }

    const maximum = Math.max(1, ...goals.map((item) => item.count));
    for (const item of goals) {
        const row = document.createElement('div');
        row.className = 'package-item';
        const summary = document.createElement('div');
        summary.className = 'package-row';
        const title = document.createElement('span');
        title.textContent = goalLabel(item.goal);
        const count = document.createElement('strong');
        count.textContent = `${item.count} yêu cầu`;
        summary.append(title, count);

        const progress = document.createElement('div');
        progress.className = 'progress';
        const bar = document.createElement('span');
        bar.style.width = `${(item.count / maximum) * 100}%`;
        progress.appendChild(bar);
        row.append(summary, progress);
        list.appendChild(row);
    }
}

// Render Active Provisioned Members Table
async function renderActiveMembers() {
    const body = document.getElementById('activeMembersTable');
    if (!body || !window.OceanApp) return;
    body.replaceChildren();

    let members;
    try {
        members = await apiRequest('/api/admin/accounts/members');
    } catch (error) {
        const row = document.createElement('tr');
        const message = document.createElement('td');
        message.colSpan = 8;
        message.style.cssText = 'text-align: center; color: #f87171; padding: 24px;';
        message.textContent = `Không tải được tài khoản từ máy chủ: ${error.message}`;
        row.appendChild(message);
        body.appendChild(row);
        return;
    }
    if (!members.length) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" style="text-align: center; color: var(--muted); padding: 24px;">Chưa có học viên nào được cấp tài khoản. Bấm "Cấp tài khoản" ở bảng trên khi khách chốt gói!</td>`;
        body.appendChild(row);
        return;
    }

    for (const member of members) {
        const row = document.createElement('tr');
        const isActive = member.status !== 'inactive';
        const name = escapeHtml(member.name);
        const phone = escapeHtml(member.phone);
        row.innerHTML = `
            <td><strong>${name}</strong></td>
            <td><a href="tel:${phone}" style="color: var(--cyan);">${phone}</a></td>
            <td><span class="tag" style="background: rgba(229,9,20,0.15); color: #ff8080; border-color: rgba(229,9,20,0.4);">${escapeHtml(member.plan || 'Gói Chốt')}</span></td>
            <td><code>${escapeHtml(member.username)}</code></td>
            <td><span style="color: var(--muted);">Đã mã hóa</span></td>
            <td>${new Date(member.createdAt).toLocaleDateString('vi-VN')}</td>
            <td><span class="status-pill" style="padding: 4px 8px; font-size: 10px; ${isActive ? '' : 'color: var(--brand);'}"><span class="status-dot" style="${isActive ? '' : 'background: var(--brand); box-shadow: none;'}"></span> ${isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}</span></td>
            <td></td>
        `;
        const actions = row.lastElementChild;
        actions.classList.add('account-actions-cell');
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'secondary-btn';
        toggleButton.style.cssText = 'padding: 7px 10px; font-size: 10px; margin-right: 6px;';
        toggleButton.textContent = isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại';
        toggleButton.addEventListener('click', () => toggleAccountStatus('member', member.id, isActive));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'secondary-btn';
        deleteButton.style.cssText = 'padding: 7px 10px; font-size: 10px; color: #f87171;';
        deleteButton.textContent = 'Xóa';
        deleteButton.addEventListener('click', () => deleteAccount('member', member.id, member.name));
        actions.append(toggleButton, deleteButton);
        body.appendChild(row);
    }
}

async function toggleAccountStatus(role, accountId, isActive) {
    try {
        await apiRequest(`/api/admin/accounts/${role === 'member' ? 'members' : 'coaches'}/${encodeURIComponent(accountId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: isActive ? 'inactive' : 'active' })
        });
        if (role === 'member') await renderActiveMembers();
        else await renderAdminCoaches();
    } catch (error) {
        alert(`Không thể cập nhật tài khoản: ${error.message}`);
    }
}

async function deleteAccount(role, accountId, name) {
    const type = role === 'member' ? 'hội viên' : 'huấn luyện viên';
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${type} "${name}"? Thao tác này không thể hoàn tác.`)) return;

    try {
        await apiRequest(`/api/admin/accounts/${role === 'member' ? 'members' : 'coaches'}/${encodeURIComponent(accountId)}`, {
            method: 'DELETE'
        });
        if (role === 'member') await renderActiveMembers();
        else await renderAdminCoaches();
    } catch (error) {
        alert(`Không thể xóa tài khoản: ${error.message}`);
    }
}

// Member Provisioning Logic
window.generateRandomMemberPassword = function() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let pass = 'TO';
    for (let i = 0; i < 6; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    document.getElementById('prov-password').value = pass;
};

window.openProvisionMemberModal = function(lead) {
    const modal = document.getElementById('provision-member-modal');
    modal.classList.remove('hidden');
    document.getElementById('prov-reg-id').value = lead.id || '';
    document.getElementById('prov-name').value = lead.name || '';
    document.getElementById('prov-phone').value = lead.phone || '';
    const cleanPhone = (lead.phone || '').replace(/\D/g, '');
    document.getElementById('prov-username').value = cleanPhone ? `member_${cleanPhone}` : `member_${Date.now().toString().slice(-4)}`;
    generateRandomMemberPassword();
};

window.openManualCreateMemberModal = function() {
    openProvisionMemberModal({ name: '', phone: '', goal: 'unspecified' });
};

window.closeProvisionMemberModal = function() {
    document.getElementById('provision-member-modal').classList.add('hidden');
};

window.handleProvisionMemberSubmit = async function(e) {
    e.preventDefault();
    if (!window.OceanApp) return;

    const name = document.getElementById('prov-name').value.trim();
    const phone = document.getElementById('prov-phone').value.trim();
    const plan = document.getElementById('prov-plan').value;
    const username = document.getElementById('prov-username').value.trim();
    const password = document.getElementById('prov-password').value.trim();

    let created;
    try {
        created = await apiRequest('/api/admin/accounts/members', {
            method: 'POST',
            body: JSON.stringify({ name, phone, plan, username, password })
        });
    } catch (error) {
        alert(`Không thể tạo tài khoản: ${error.message}`);
        return;
    }

    closeProvisionMemberModal();
    await renderActiveMembers();
    if (created.consultationsClosed && Array.isArray(remoteRegistrations)) {
        const phoneDigits = phone.replace(/\D/g, '');
        remoteRegistrations = remoteRegistrations.filter(registration =>
            registration.phone.replace(/\D/g, '') !== phoneDigits
        );
        renderRegistrations(remoteRegistrations);
    }
    if (!created.consultationsClosed) {
        alert('Tài khoản đã được tạo nhưng chưa đánh dấu được yêu cầu tư vấn là hoàn tất. Hãy chạy lại schema mới trên Supabase, sau đó làm mới dashboard.');
    }
    try {
        const dashboard = await apiRequest('/api/admin/dashboard');
        document.getElementById('registrationCount').textContent = String(dashboard.registrationsTotal);
        document.getElementById('todayRegistrations').textContent = String(dashboard.registrationsToday);
        renderRegistrations(dashboard.recentRegistrations);
        renderGoals(dashboard.registrationGoals);
    } catch (error) {
        alert(`Tài khoản đã được tạo, nhưng không làm mới được danh sách yêu cầu tư vấn: ${error.message}`);
    }

    const message = `[THE OCEAN GYM - THỦ ĐỨC]
Chào ${name}!
Ban Quản trị xin gửi thông tin tài khoản hội viên The Ocean Gym của bạn:
- Gói tập: ${plan}
- Link đăng nhập: https://theoceangym.netlify.app/html/index.html
- Tên đăng nhập: ${created.credentials.username}
- Mật khẩu: ${created.credentials.password}

Bạn có thể đăng nhập để đặt lịch tập với Huấn luyện viên, xem lịch tập, đánh giá và tham gia mạng xã hội cộng đồng The Ocean Gym. Hân hạnh đồng hành cùng bạn!`;

    showCredentialMessage(message, 'hội viên');
};

function showCredentialMessage(message, recipientType) {
    document.getElementById('credential-popup-title').textContent = `Cấp tài khoản ${recipientType} thành công!`;
    document.getElementById('credential-popup-description').textContent =
        `Sao chép tin nhắn bên dưới để gửi cho ${recipientType} qua Zalo / SMS:`;
    document.getElementById('credentialCopyText').value = message;
    document.getElementById('credential-popup-modal').classList.remove('hidden');
}

window.closeCredentialModal = function() {
    document.getElementById('credential-popup-modal').classList.add('hidden');
};

window.copyCredentialText = async function() {
    const text = document.getElementById('credentialCopyText');
    text.select();
    text.setSelectionRange(0, text.value.length);
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text.value);
        } else if (!document.execCommand('copy')) {
            throw new Error('Trình duyệt không hỗ trợ sao chép tự động. Nội dung đã được chọn để bạn sao chép thủ công.');
        }
        alert('Đã sao chép tin nhắn tài khoản. Bạn có thể dán và gửi qua Zalo / SMS.');
    } catch (error) {
        alert(error.message || 'Không thể sao chép tự động. Nội dung đã được chọn để bạn sao chép thủ công.');
    }
};

// Render Coach Applications & Approval
async function renderCoachApplications() {
    const body = document.getElementById('coachApplicationsTable');
    const badge = document.getElementById('pendingCoachCount');
    if (!body || !window.OceanApp) return;
    body.replaceChildren();

    let apps;
    try {
        apps = await apiRequest('/api/admin/coach-applications');
        remoteCoachApplications = apps;
    } catch (error) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.style.cssText = 'text-align: center; color: #f87171; padding: 24px;';
        cell.textContent = `Không tải được hồ sơ từ máy chủ: ${error.message}`;
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    const pending = apps.filter(a => a.status === 'pending');
    if (badge) badge.textContent = `${pending.length} chờ duyệt`;

    if (!apps.length) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">Chưa có đơn ứng tuyển Huấn luyện viên nào từ website.</td>`;
        body.appendChild(row);
        return;
    }

    for (const app of apps) {
        const row = document.createElement('tr');
        const isApproved = app.status === 'approved';
        const isRejected = app.status === 'rejected';
        const isProvisioning = app.status === 'provisioning';
        const imageUrl = /^(https?:\/\/|\.\.?\/assets\/)/i.test(app.image || '')
            ? escapeHtml(app.image)
            : '../assets/images/coach-hai.jpg';
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${imageUrl}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover;" />
                    <div>
                        <strong>${escapeHtml(app.name)}</strong>
                        <div style="font-size: 11px; color: var(--muted);">${escapeHtml(app.email || 'Chưa có email')}</div>
                    </div>
                </div>
            </td>
            <td><span class="tag">${escapeHtml(app.roleApplied)}</span></td>
            <td>
                <div style="font-size: 13px;">${escapeHtml(app.exp)}</div>
                <div style="font-size: 11px; color: var(--cyan);">${escapeHtml(app.cert || 'Chưa cập nhật chứng chỉ')}</div>
            </td>
            <td><a href="tel:${escapeHtml(app.phone)}" style="color: var(--cyan);">${escapeHtml(app.phone)}</a></td>
            <td>${new Date(app.appliedAt).toLocaleDateString('vi-VN')}</td>
            <td>
                ${isApproved 
                    ? `<span style="color: var(--green); font-size: 12px; font-weight: 700;">✓ Đã cấp tài khoản (${escapeHtml(app.accountCreated ? app.accountCreated.username : 'Đã duyệt')})</span>`
                    : isRejected
                        ? '<span style="color: var(--muted); font-size: 12px;">Đã từ chối</span>'
                        : isProvisioning
                        ? '<span style="color: var(--cyan); font-size: 12px;">Đang xử lý cấp tài khoản...</span>'
                        : '<button type="button" class="primary-btn" style="background: var(--green); padding: 6px 12px; font-size: 10px;">✓ Duyệt & Cấp TK</button>'
                }
            </td>
        `;
        const approveButton = row.querySelector('button');
        if (approveButton) approveButton.addEventListener('click', () => openApproveCoachModal(app.id));
        body.appendChild(row);
    }
}

// Render Official Coaches
async function renderAdminCoaches() {
    const container = document.getElementById('adminCoachesList');
    if (!container || !window.OceanApp) return;
    container.replaceChildren();

    let coaches;
    try {
        coaches = await apiRequest('/api/admin/accounts/coaches');
    } catch (error) {
        const message = document.createElement('p');
        message.style.color = '#f87171';
        message.textContent = `Không tải được tài khoản từ máy chủ: ${error.message}`;
        container.appendChild(message);
        return;
    }
    if (!coaches.length) {
        const emptyState = document.createElement('p');
        emptyState.style.color = 'var(--muted)';
        emptyState.textContent = 'Chưa có tài khoản huấn luyện viên nào.';
        container.appendChild(emptyState);
        return;
    }

    for (const coach of coaches) {
        const isActive = coach.status !== 'inactive';
        const imageUrl = /^(https?:\/\/|\.\.?\/assets\/)/i.test(coach.img || '')
            ? escapeHtml(coach.img)
            : '../assets/images/coach-hai.jpg';
        const card = document.createElement('div');
        card.className = 'panel';
        card.style.padding = '16px';
        card.innerHTML = `
            <div style="display: flex; gap: 14px; align-items: center;">
                <img src="${imageUrl}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border);" />
                <div>
                    <span class="tag" style="margin-bottom: 4px;">${escapeHtml(coach.role)}</span>
                    <h3 style="margin: 0; font-size: 1.1rem;">${escapeHtml(coach.name)}</h3>
                    <p style="margin: 2px 0 0; font-size: 12px; color: var(--muted);">${escapeHtml(coach.exp)} • ${escapeHtml(coach.cert || 'Chứng chỉ gym')}</p>
                </div>
            </div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);">
                <span>Username: <code style="color: #fff;">${escapeHtml(coach.username || coach.id)}</code></span>
                <span>Đã mã hóa</span>
            </div>
        `;
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px;';
        const status = document.createElement('span');
        status.className = 'status-pill';
        status.style.cssText = `padding: 4px 8px; font-size: 10px; ${isActive ? '' : 'color: var(--brand);'}`;
        status.innerHTML = `<span class="status-dot" style="${isActive ? '' : 'background: var(--brand); box-shadow: none;'}"></span> ${isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}`;

        const buttons = document.createElement('div');
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'secondary-btn';
        toggleButton.style.cssText = 'padding: 7px 10px; font-size: 10px; margin-right: 6px;';
        toggleButton.textContent = isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại';
        toggleButton.addEventListener('click', () => toggleAccountStatus('coach', coach.id, isActive));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'secondary-btn';
        deleteButton.style.cssText = 'padding: 7px 10px; font-size: 10px; color: #f87171;';
        deleteButton.textContent = 'Xóa';
        deleteButton.addEventListener('click', () => deleteAccount('coach', coach.id, coach.name));
        buttons.append(toggleButton, deleteButton);
        actions.append(status, buttons);
        card.appendChild(actions);
        container.appendChild(card);
    }
}

window.openApproveCoachModal = function(appId) {
    const app = remoteCoachApplications.find(application => application.id === appId);
    if (!app) return;

    document.getElementById('app-coach-id').value = app.id;
    document.getElementById('app-coach-name').value = app.name;
    document.getElementById('app-coach-role').value = app.roleApplied;
    document.getElementById('app-coach-cert').value = `${app.exp} • ${app.cert || 'Đang cập nhật'}`;
    document.getElementById('approve-coach-modal').classList.remove('hidden');
};

window.closeApproveCoachModal = function() {
    document.getElementById('approve-coach-modal').classList.add('hidden');
};

window.handleApproveCoachSubmit = async function(e) {
    e.preventDefault();
    const appId = document.getElementById('app-coach-id').value;
    const pass = document.getElementById('app-coach-password').value.trim();
    const submitButton = e.submitter;
    if (submitButton) submitButton.disabled = true;

    try {
        const app = remoteCoachApplications.find(application => application.id === appId);
        if (!app) throw new Error('Không tìm thấy đơn ứng tuyển.');
        const res = await apiRequest(`/api/admin/coach-applications/${encodeURIComponent(appId)}/approve`, {
            method: 'POST',
            body: JSON.stringify({ password: pass })
        });
        closeApproveCoachModal();
        await renderCoachApplications();
        await renderAdminCoaches();
        const message = `[THE OCEAN GYM - THỦ ĐỨC]
Chào Huấn luyện viên ${res.account.name}!
Ban Quản trị gửi thông tin tài khoản đăng nhập cổng Huấn luyện viên The Ocean Gym:
- Link đăng nhập: https://theoceangym.netlify.app/html/index.html
- Chọn vai trò: Huấn Luyện Viên
- Tên đăng nhập: ${res.credentials.username}
- Mật khẩu: ${res.credentials.password}

Sau khi đăng nhập, anh/chị có thể xem học viên đặt lịch, quản lý ca dạy và cập nhật hồ sơ huấn luyện viên. Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.`;
        showCredentialMessage(message, 'huấn luyện viên');
    } catch (err) {
        alert(`Không thể cấp tài khoản huấn luyện viên: ${err.message}`);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
};

// Render PT Bookings
function renderAdminBookings() {
    const body = document.getElementById('adminBookingsTable');
    const badge = document.getElementById('bookingCountBadge');
    if (!body || !window.OceanApp) return;
    body.replaceChildren();

    const bookings = OceanApp.getBookings();
    if (badge) badge.textContent = `${bookings.length} ca tập`;

    if (!bookings.length) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; color: var(--muted); padding: 24px;">Chưa có ca đặt lịch nào từ học viên.</td>`;
        body.appendChild(row);
        return;
    }

    for (const b of bookings) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${b.memberName}</strong></td>
            <td><a href="tel:${b.memberPhone}" style="color: var(--cyan);">${b.memberPhone}</a></td>
            <td><span class="tag" style="background: rgba(56,189,248,0.15); color: var(--cyan); border-color: rgba(56,189,248,0.3);">${b.coachName}</span></td>
            <td><strong>${b.date}</strong></td>
            <td><span style="color: #fff; font-weight: 700;">${b.timeSlot}</span></td>
            <td><span style="color: var(--muted); font-size: 12px;">${b.note || 'Không có ghi chú'}</span></td>
            <td><span class="status-pill" style="padding: 4px 8px; font-size: 10px; color: var(--green); border-color: rgba(34,197,94,0.4);"><span class="status-dot"></span> Đã xác nhận</span></td>
        `;
        body.appendChild(row);
    }
}

// Render Reviews & Posts
function renderAdminReviews() {
    const container = document.getElementById('adminReviewsList');
    if (!container || !window.OceanApp) return;
    container.replaceChildren();

    const reviews = OceanApp.getReviews();
    for (const r of reviews) {
        const div = document.createElement('div');
        div.className = 'package-item';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                <div>
                    <strong>${r.userName}</strong>
                    <span style="color: #facc15; margin-left: 8px;">${'★'.repeat(r.rating)}</span>
                    <span style="font-size: 11px; color: var(--muted); margin-left: 6px;">(${r.target === 'gym' ? 'Phòng Gym' : r.targetName})</span>
                </div>
                <span style="font-size: 11px; color: var(--muted);">${r.date}</span>
            </div>
            <p style="margin: 0; font-size: 13px; color: #e5e5e5; line-height: 1.5;">${r.comment}</p>
            ${r.image ? `<img src="${r.image}" style="width: 100px; height: 70px; object-fit: cover; border-radius: 8px; margin-top: 8px; border: 1px solid var(--border);" />` : ''}
        `;
        container.appendChild(div);
    }
}

function renderAdminPosts() {
    const container = document.getElementById('adminCommunityPostsList');
    if (!container || !window.OceanApp) return;
    container.replaceChildren();

    const posts = OceanApp.getPosts();
    for (const p of posts) {
        const div = document.createElement('div');
        div.className = 'package-item';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <strong>${p.authorName}</strong>
                <span style="font-size: 11px; color: var(--muted);">${p.time}</span>
            </div>
            <p style="margin: 0; font-size: 13px; color: #e5e5e5; line-height: 1.5;">${p.content}</p>
            <div style="margin-top: 8px; font-size: 11px; color: var(--muted); display: flex; gap: 14px;">
                <span>❤️ ${p.likes} yêu thích</span>
                <span>💬 ${p.comments.length} bình luận</span>
            </div>
        `;
        container.appendChild(div);
    }
}

// Admin Live Chat
async function renderAdminChat() {
    const container = document.getElementById('adminChatMessages');
    const conversationsContainer = document.getElementById('adminChatConversations');
    if (!container || !conversationsContainer) return;
    conversationsContainer.textContent = 'Đang tải hộp thư...';
    try {
        adminChatConversations = await apiRequest('/api/admin/chat/conversations');
    } catch (error) {
        conversationsContainer.textContent = `Không tải được hộp thư: ${error.message}`;
        container.replaceChildren();
        return;
    }

    if (!adminChatConversations.some(conversation => conversation.id === activeAdminConversationId)) {
        activeAdminConversationId = adminChatConversations[0]?.id || '';
    }

    conversationsContainer.replaceChildren();
    if (!adminChatConversations.length) {
        conversationsContainer.textContent = 'Chưa có tin nhắn. Hội thoại sẽ xuất hiện khi hội viên hoặc HLV nhắn cho Admin.';
    }
    for (const conversation of adminChatConversations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText = `display: block; width: 100%; text-align: left; padding: 11px; margin-bottom: 6px; border: 1px solid ${conversation.id === activeAdminConversationId ? 'var(--brand)' : 'var(--border)'}; border-radius: 10px; background: ${conversation.id === activeAdminConversationId ? 'rgba(229,9,20,0.12)' : 'rgba(255,255,255,0.03)'}; color: var(--text); cursor: pointer;`;
        const title = document.createElement('strong');
        title.style.cssText = 'display: block; font-size: 12px; overflow-wrap: anywhere;';
        title.textContent = conversation.partnerName;
        const preview = document.createElement('span');
        preview.style.cssText = 'display: block; margin-top: 5px; color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        preview.textContent = conversation.updatedAt
            ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(conversation.updatedAt))
            : 'Chưa có tin nhắn';
        button.append(title, preview);
        button.addEventListener('click', async () => {
            activeAdminConversationId = conversation.id;
            await renderAdminChat();
        });
        conversationsContainer.appendChild(button);
    }

    const input = document.getElementById('adminChatInput');
    const submit = document.querySelector('#adminChatForm button[type="submit"]');
    input.disabled = !activeAdminConversationId;
    submit.disabled = !activeAdminConversationId;
    container.replaceChildren();
    if (!activeAdminConversationId) {
        container.textContent = 'Chọn một hội thoại ở danh sách bên trái để đọc và trả lời tin nhắn.';
        return;
    }

    try {
        const messages = await apiRequest(`/api/admin/chat/conversations/${encodeURIComponent(activeAdminConversationId)}/messages`);
        for (const message of messages) {
            const isFromAdmin = message.senderRole === 'admin';
            const msgDiv = document.createElement('div');
            msgDiv.style.cssText = `align-self: ${isFromAdmin ? 'flex-end' : 'flex-start'}; max-width: 85%; background: ${isFromAdmin ? 'linear-gradient(135deg, #e50914, #b91c1c)' : 'rgba(255,255,255,0.08)'}; color: #fff; padding: 10px 14px; border-radius: 14px; border: 1px solid ${isFromAdmin ? 'transparent' : 'var(--border)'};`;
            const meta = document.createElement('div');
            meta.style.cssText = 'font-size: 10px; font-weight: 700; opacity: 0.85; margin-bottom: 2px;';
            const date = message.sentAt ? new Date(message.sentAt) : new Date();
            meta.textContent = `${message.senderName} (${message.senderRole.toUpperCase()}) • ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
            const content = document.createElement('div');
            content.style.cssText = 'font-size: 13px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere;';
            content.textContent = message.text;
            msgDiv.append(meta, content);
            container.appendChild(msgDiv);
        }
        if (!messages.length) container.textContent = 'Chưa có tin nhắn trong hội thoại này.';
    } catch (error) {
        container.textContent = `Không tải được tin nhắn: ${error.message}`;
    }
    container.scrollTop = container.scrollHeight;
}

window.handleAdminSendMessage = async function(e) {
    e.preventDefault();
    const input = document.getElementById('adminChatInput');
    const text = input.value.trim();
    if (!text || !activeAdminConversationId) return;
    const submit = e.submitter;
    if (submit) submit.disabled = true;
    try {
        await apiRequest(`/api/admin/chat/conversations/${encodeURIComponent(activeAdminConversationId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        input.value = '';
        await renderAdminChat();
    } catch (error) {
        alert(`Không gửi được tin nhắn: ${error.message}`);
    } finally {
        if (submit) submit.disabled = !activeAdminConversationId;
    }
};

async function renderDashboard() {
    let migrationResult = { accounts: 0, applications: 0 };
    try {
        migrationResult = await OceanApp.syncLegacyAccounts();
    } catch (error) {
        alert(`Không thể đồng bộ dữ liệu tài khoản cũ lên cơ sở dữ liệu. Dữ liệu trên thiết bị chưa bị thay đổi.\n${error.message}`);
    }
    if (migrationResult.accounts + migrationResult.applications > 0) {
        alert(`Đã chuyển ${migrationResult.accounts} tài khoản và ${migrationResult.applications} hồ sơ ứng tuyển cũ lên cơ sở dữ liệu dùng chung. Hãy kiểm tra lại các danh sách.`);
    }

    let data;
    let dashboardError;
    try {
        data = await apiRequest('/api/admin/dashboard');
    } catch (error) {
        dashboardError = error;
    }

    if (dashboardError) {
        remoteRegistrations = null;
        for (const id of ['monthlyRevenue', 'registrationCount', 'todayRegistrations']) {
            document.getElementById(id).textContent = '—';
        }
        document.getElementById('chart-period').textContent = 'Không tải được dữ liệu';
        document.getElementById('revenueChart').replaceChildren();
        const body = document.getElementById('registrationsTable');
        body.replaceChildren();
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.style.cssText = 'text-align: center; color: #f87171; padding: 24px;';
        cell.textContent = `Không tải được dữ liệu dashboard: ${dashboardError.message}`;
        row.appendChild(cell);
        body.appendChild(row);
        document.getElementById('packageList').replaceChildren();
    } else {
        document.getElementById('monthlyRevenue').textContent = formatCurrency(data.revenueCurrentMonth);
        document.getElementById('registrationCount').textContent = String(data.registrationsTotal);
        document.getElementById('todayRegistrations').textContent = String(data.registrationsToday);
        const now = new Date();
        document.getElementById('currentMonthLabel').textContent = new Intl.DateTimeFormat('vi-VN', {
            month: 'long',
            year: 'numeric'
        }).format(now);

        if (data.revenueByMonth && data.revenueByMonth.length) {
            document.getElementById('chart-period').textContent =
                `${monthFormatter.format(new Date(`${data.revenueByMonth[0].month}-01T12:00:00`))} – ${monthFormatter.format(now)}`;
            renderRevenueChart(data.revenueByMonth);
        } else {
            document.getElementById('revenueChart').replaceChildren();
        }
        renderRegistrations(data.recentRegistrations);
        renderGoals(data.registrationGoals);
    }

    renderActiveMembers();
    renderCoachApplications();
    renderAdminCoaches();
    renderAdminBookings();
    renderAdminReviews();
    renderAdminPosts();
    renderAdminChat();
}

// Listen to OceanApp Events
window.addEventListener('ocean:members-updated', renderActiveMembers);
window.addEventListener('ocean:applications-updated', renderCoachApplications);
window.addEventListener('ocean:coaches-updated', renderAdminCoaches);
window.addEventListener('ocean:bookings-updated', renderAdminBookings);
window.addEventListener('ocean:reviews-updated', renderAdminReviews);
window.addEventListener('ocean:posts-updated', renderAdminPosts);
window.addEventListener('ocean:chats-updated', renderAdminChat);
window.addEventListener('ocean:registrations-updated', () => renderDashboard());

window.setInterval(() => {
    const chatTab = document.getElementById('tab-chat');
    if (!adminScreen.classList.contains('hidden') && chatTab && !chatTab.classList.contains('hidden')) {
        renderAdminChat();
    }
}, 5000);

document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await apiRequest('/api/admin/logout', { method: 'POST' });
        window.location.replace('../index.html');
    } catch (error) {
        alert(`Không thể đăng xuất: ${error.message}`);
    }
});

document.getElementById('add-revenue-btn').addEventListener('click', () => {
    revenueError.style.display = 'none';
    revenueError.textContent = '';
    revenueForm.reset();
    revenueModal.classList.remove('hidden');
    document.getElementById('revenue-amount').focus();
});

function closeRevenueModal() {
    revenueModal.classList.add('hidden');
}

document.getElementById('cancel-revenue-btn').addEventListener('click', closeRevenueModal);
revenueModal.addEventListener('click', (event) => {
    if (event.target === revenueModal) closeRevenueModal();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeRevenueModal();
});

revenueForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = revenueForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    revenueError.style.display = 'none';
    try {
        await apiRequest('/api/admin/revenue', {
            method: 'POST',
            body: JSON.stringify({ amount: Number(revenueForm.elements.amount.value) })
        });
        closeRevenueModal();
        await renderDashboard();
    } catch (error) {
        revenueError.textContent = error.message;
        revenueError.style.display = 'block';
    } finally {
        submit.disabled = false;
    }
});

(async function initializeAdmin() {
    try {
        const session = await apiRequest('/api/admin/session');
        if (!session.authenticated) {
            window.location.replace('../index.html');
            return;
        }
        adminScreen.classList.remove('hidden');
        await renderDashboard();
    } catch (error) {
        console.error('Không thể kiểm tra phiên quản trị:', error);
        window.location.replace('../index.html');
    }
})();
