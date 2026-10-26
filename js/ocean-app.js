/**
 * The Ocean Gym - Core Interactive Application Logic
 * Manages Members, Coaches, Bookings, Reviews, Community Feed & Live Chat
 * Supports LocalStorage persistence with optional Supabase Cloud Sync
 */

(function (window) {
    'use strict';

    const STORAGE_KEY_MEMBERS = 'theocean_members';
    const STORAGE_KEY_COACHES = 'theocean_coaches';
    const STORAGE_KEY_APPLICATIONS = 'theocean_coach_applications';
    const STORAGE_KEY_BOOKINGS = 'theocean_bookings';
    const STORAGE_KEY_REVIEWS = 'theocean_reviews';
    const STORAGE_KEY_POSTS = 'theocean_community_posts';
    const STORAGE_KEY_CHATS = 'theocean_chats';
    const STORAGE_KEY_REGISTRATIONS = 'theocean_registrations';
    const STORAGE_KEY_CURRENT_USER = 'theocean_current_user';

    // Initial default Coaches
    const DEFAULT_COACHES = [
        {
            id: 'coach-hai',
            name: 'ANH HẢI',
            role: 'HEAD COACH',
            desc: 'Chuyên giảm mỡ & cải thiện thể trạng toàn diện',
            exp: '8 năm kinh nghiệm',
            cert: 'CF-L1, CSCS International',
            img: '../assets/images/coach-hai.jpg',
            phone: '0901888111',
            email: 'hai.headcoach@theocean.vn',
            status: 'active'
        },
        {
            id: 'coach-thao',
            name: 'CHỊ THẢO',
            role: 'STRENGTH COACH',
            desc: 'Tăng cơ, cải thiện tỷ lệ và sức mạnh tối đa',
            exp: '6 năm kinh nghiệm',
            cert: 'Powerlifting Coach, NASM-CPT',
            img: '../assets/images/coach-thao.jpg',
            phone: '0902888222',
            email: 'thao.strength@theocean.vn',
            status: 'active'
        },
        {
            id: 'coach-huy',
            name: 'ANH HUY',
            role: 'REHAB COACH',
            desc: 'Phục hồi chấn thương & sửa sai lệch tư thế cột sống',
            exp: '9 năm kinh nghiệm',
            cert: 'Corrective Exercise Specialist (CES), FMS',
            img: '../assets/images/coach-huy.jpg',
            phone: '0903888333',
            email: 'huy.rehab@theocean.vn',
            status: 'active'
        }
    ];

    // Initial default community posts
    const DEFAULT_POSTS = [
        {
            id: 'post-1',
            authorName: 'Hoàng Nam (Hội viên VIP)',
            authorRole: 'member',
            authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            time: '2 giờ trước',
            content: 'Hôm nay buổi tập chân cùng Coach Hải phê thực sự! Deadlift chạm mốc 160kg sau 3 tháng theo giáo án. Không gian tầng 1 sàn chống xóc ném tạ cực đã tay.',
            image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
            likes: 18,
            liked: false,
            comments: [
                { user: 'Coach Hải', text: 'Form hôm nay khóa hông rất chuẩn, tuần sau tăng volume nhé!' }
            ]
        },
        {
            id: 'post-2',
            authorName: 'Minh Thư (Hội viên Transform)',
            authorRole: 'member',
            authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
            time: 'Hôm qua lúc 19:30',
            content: 'Tập xong lên tầng 4 xông hơi đá muối Himalayan và ngâm bồn lạnh Recovery là combo hoàn hảo nhất để hồi phục sau ngày làm việc mệt mỏi ✨ Thích sự yên tĩnh ở The Ocean ghê!',
            image: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&auto=format&fit=crop&q=80',
            likes: 27,
            liked: true,
            comments: []
        }
    ];

    // Initial Gym Reviews
    const DEFAULT_REVIEWS = [
        {
            id: 'rev-1',
            userName: 'Khánh Nguyễn',
            rating: 5,
            target: 'gym',
            targetName: 'Phòng Gym The Ocean',
            comment: 'Tôi tập ở đây 6 tháng rồi thấy form cơ bắp rõ, ít khi phải đợi máy và không bị cảm giác chen chúc như phòng tập thường. Máy móc Hammer Strength xịn xò!',
            image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80',
            date: '10/10/2026'
        },
        {
            id: 'rev-2',
            userName: 'Linh Trần',
            rating: 5,
            target: 'coach',
            targetName: 'Coach Thảo',
            comment: 'Coach Thảo siêu nhiệt tình và kỹ tính từng centimet. Lưng gù và đau mỏi vai gáy của mình cải thiện rõ rệt chỉ sau 1 tháng.',
            image: '',
            date: '12/10/2026'
        }
    ];

    // Helper functions for storage
    function loadStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.warn('Storage read failed:', e);
            return defaultValue;
        }
    }

    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Storage write failed:', e);
        }
    }

    async function accountApiRequest(path, options = {}) {
        const response = await fetch(path, {
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

    // Core Ocean Store
    const OceanApp = {
        // Data getters
        getCoaches() {
            let coaches = loadStorage(STORAGE_KEY_COACHES, null);
            if (!coaches) {
                coaches = [...DEFAULT_COACHES];
                saveStorage(STORAGE_KEY_COACHES, coaches);
            }
            return coaches;
        },

        saveCoaches(coaches) {
            saveStorage(STORAGE_KEY_COACHES, coaches);
            window.dispatchEvent(new CustomEvent('ocean:coaches-updated', { detail: coaches }));
        },

        getCoachById(id) {
            return this.getCoaches().find(c => c.id === id && c.status !== 'inactive');
        },

        getMembers() {
            return loadStorage(STORAGE_KEY_MEMBERS, []);
        },

        saveMembers(members) {
            saveStorage(STORAGE_KEY_MEMBERS, members);
            window.dispatchEvent(new CustomEvent('ocean:members-updated', { detail: members }));
        },

        getCoachApplications() {
            return loadStorage(STORAGE_KEY_APPLICATIONS, []);
        },

        saveCoachApplications(apps) {
            saveStorage(STORAGE_KEY_APPLICATIONS, apps);
            window.dispatchEvent(new CustomEvent('ocean:applications-updated', { detail: apps }));
        },

        getBookings() {
            return loadStorage(STORAGE_KEY_BOOKINGS, []);
        },

        saveBookings(bookings) {
            saveStorage(STORAGE_KEY_BOOKINGS, bookings);
            window.dispatchEvent(new CustomEvent('ocean:bookings-updated', { detail: bookings }));
        },

        getRegistrations() {
            let regs = loadStorage(STORAGE_KEY_REGISTRATIONS, null);
            if (!regs || !regs.length) {
                regs = [
                    { id: 'lead-1', name: 'Tiết Lê', phone: '0909007774', goal: 'unspecified', submittedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
                    { id: 'lead-2', name: 'Nguyen Duc Dai Duong', phone: '0917451448', goal: 'muscle_gain', submittedAt: new Date(Date.now() - 3600000 * 5).toISOString() },
                    { id: 'lead-3', name: 'Trần Minh Quang', phone: '0988112233', goal: 'fat_loss', submittedAt: new Date(Date.now() - 3600000 * 12).toISOString() }
                ];
                saveStorage(STORAGE_KEY_REGISTRATIONS, regs);
            }
            return regs;
        },

        saveRegistration(lead) {
            const regs = this.getRegistrations();
            const newLead = {
                id: 'lead-' + Date.now(),
                name: lead.name,
                phone: lead.phone,
                goal: lead.goal || 'unspecified',
                submittedAt: new Date().toISOString()
            };
            regs.unshift(newLead);
            saveStorage(STORAGE_KEY_REGISTRATIONS, regs);
            window.dispatchEvent(new CustomEvent('ocean:registrations-updated', { detail: regs }));
            return newLead;
        },

        getReviews() {
            let reviews = loadStorage(STORAGE_KEY_REVIEWS, null);
            if (!reviews) {
                reviews = [...DEFAULT_REVIEWS];
                saveStorage(STORAGE_KEY_REVIEWS, reviews);
            }
            return reviews;
        },

        saveReviews(reviews) {
            saveStorage(STORAGE_KEY_REVIEWS, reviews);
            window.dispatchEvent(new CustomEvent('ocean:reviews-updated', { detail: reviews }));
        },

        getPosts() {
            let posts = loadStorage(STORAGE_KEY_POSTS, null);
            if (!posts) {
                posts = [...DEFAULT_POSTS];
                saveStorage(STORAGE_KEY_POSTS, posts);
            }
            return posts;
        },

        savePosts(posts) {
            saveStorage(STORAGE_KEY_POSTS, posts);
            window.dispatchEvent(new CustomEvent('ocean:posts-updated', { detail: posts }));
        },

        getChats() {
            return loadStorage(STORAGE_KEY_CHATS, [
                {
                    id: 'msg-welcome',
                    senderId: 'admin',
                    senderName: 'Lễ tân The Ocean Gym',
                    senderRole: 'admin',
                    targetId: 'all',
                    text: 'Chào mừng bạn đến với The Ocean Gym! Đội ngũ tư vấn và các Coach luôn sẵn sàng hỗ trợ bạn.',
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        },

        saveChats(chats) {
            saveStorage(STORAGE_KEY_CHATS, chats);
            window.dispatchEvent(new CustomEvent('ocean:chats-updated', { detail: chats }));
        },

        // Auth Management
        getCurrentUser() {
            return loadStorage(STORAGE_KEY_CURRENT_USER, null);
        },

        setCurrentUser(user) {
            saveStorage(STORAGE_KEY_CURRENT_USER, user);
            window.dispatchEvent(new CustomEvent('ocean:auth-changed', { detail: user }));
        },

        async logout() {
            try {
                await accountApiRequest('/api/accounts/logout', { method: 'POST' });
            } finally {
                localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
                window.dispatchEvent(new CustomEvent('ocean:auth-changed', { detail: null }));
            }
        },

        async restoreAccountSession() {
            const result = await accountApiRequest('/api/accounts/session');
            this.setCurrentUser(result.authenticated ? result.user : null);
            return result;
        },

        async fetchPublicCoaches() {
            const coaches = await accountApiRequest('/api/public/coaches');
            if (coaches.length || localStorage.getItem('theocean_cloud_accounts_migrated_v1') === 'true') {
                this.saveCoaches(coaches);
            }
            return coaches;
        },

        async syncLegacyAccounts() {
            if (localStorage.getItem('theocean_cloud_accounts_migrated_v1') === 'true') {
                return { accounts: 0, applications: 0 };
            }
            const accountsByRole = [
                ['members', this.getMembers()],
                ['coaches', this.getCoaches()]
            ];
            let imported = 0;
            for (const [resource, accounts] of accountsByRole) {
                for (let index = 0; index < accounts.length; index += 3) {
                    const result = await accountApiRequest(`/api/admin/accounts/${resource}/import`, {
                        method: 'POST',
                        body: JSON.stringify({ accounts: accounts.slice(index, index + 3) })
                    });
                    if (result.conflicts && result.conflicts.length) {
                        const usernames = result.conflicts.map(account => account.username).join(', ');
                        throw new Error(`Tên đăng nhập đã được tài khoản khác sử dụng (${usernames}). Dữ liệu cũ vẫn còn trên thiết bị này.`);
                    }
                    imported += result.imported || 0;
                }
            }
            const applications = this.getCoachApplications();
            let importedApplications = 0;
            for (let index = 0; index < applications.length; index += 3) {
                const result = await accountApiRequest('/api/admin/coach-applications/import', {
                    method: 'POST',
                    body: JSON.stringify({ applications: applications.slice(index, index + 3) })
                });
                importedApplications += result.imported || 0;
            }
            localStorage.setItem('theocean_cloud_accounts_migrated_v1', 'true');
            for (const key of [STORAGE_KEY_MEMBERS, STORAGE_KEY_COACHES]) {
                const accounts = loadStorage(key, []);
                for (const account of accounts) delete account.password;
                saveStorage(key, accounts);
            }
            for (const application of applications) {
                if (application.accountCreated) delete application.accountCreated.password;
            }
            this.saveCoachApplications(applications);
            return { accounts: imported, applications: importedApplications };
        },

        async updateAccountCredentials(userId, role, currentPassword, updates) {
            const currentUser = this.getCurrentUser();
            if (!currentUser || currentUser.id !== userId || currentUser.role !== role) {
                return { success: false, error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' };
            }

            const newUsername = (updates.username || '').trim();
            const newPassword = (updates.password || '').trim();
            if (!newUsername && !newPassword) {
                return { success: false, error: 'Vui lòng nhập tên đăng nhập hoặc mật khẩu mới.' };
            }
            if (newUsername && !/^[a-zA-Z0-9._-]{3,30}$/.test(newUsername)) {
                return { success: false, error: 'Tên đăng nhập phải có 3–30 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.' };
            }
            if (newPassword && newPassword.length < 8) {
                return { success: false, error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' };
            }

            try {
                const result = await accountApiRequest('/api/accounts/credentials', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, username: newUsername, password: newPassword })
                });
                this.setCurrentUser(result.user);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // Login Logic
        async login(username, password, role) {
            try {
                const result = await accountApiRequest('/api/accounts/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password, role })
                });
                if (!result.admin) this.setCurrentUser(result.user);
                return result;
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // Coach Application by Public User
        async submitCoachApplication(data) {
            return await accountApiRequest('/api/coach-applications', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        // Booking creation by visitors and members
        async getAccountBookings() {
            const bookings = await accountApiRequest('/api/accounts/bookings');
            return bookings.map(booking => ({
                id: booking.id,
                memberId: booking.memberId,
                memberName: booking.memberName,
                memberPhone: booking.memberPhone,
                coachId: booking.coachId,
                coachName: booking.coachName,
                date: booking.date,
                timeSlot: booking.timeSlot,
                note: booking.note || '',
                status: booking.status,
                createdAt: booking.createdAt
            }));
        },

        async bookSession(bookingData) {
            let user = this.getCurrentUser();
            if (user) {
                const session = await this.restoreAccountSession();
                user = session.authenticated ? session.user : null;
                if (!user) {
                    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại trước khi đặt lịch.');
                }
            }
            if (user && user.role === 'coach') {
                throw new Error('Phiên hiện tại đang đăng nhập vai trò huấn luyện viên. Hãy đăng xuất rồi đăng nhập lại bằng tab Hội viên để đặt lịch.');
            }
            const booking = await accountApiRequest(
                user ? '/api/accounts/bookings' : '/api/public/bookings',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        coachId: bookingData.coachId,
                        date: bookingData.date,
                        timeSlot: bookingData.timeSlot,
                        note: bookingData.note || '',
                        memberName: bookingData.memberName,
                        memberPhone: bookingData.memberPhone
                    })
                }
            );
            const bookings = this.getBookings();
            bookings.unshift(booking);
            this.saveBookings(bookings);
            return booking;
        },

        async updateBookingStatus(bookingId, status) {
            const booking = await accountApiRequest(`/api/accounts/bookings/${encodeURIComponent(bookingId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            const bookings = this.getBookings();
            const localBooking = bookings.find(item => item.id === booking.id);
            if (localBooking) localBooking.status = booking.status;
            this.saveBookings(bookings);
            return booking;
        },

        // Reviews
        addReview(reviewData) {
            const reviews = this.getReviews();
            const newReview = {
                id: 'rev_' + Date.now(),
                userName: reviewData.userName,
                userAvatar: reviewData.userAvatar || '',
                rating: Number(reviewData.rating) || 5,
                target: reviewData.target || 'gym', // 'gym' | 'coach'
                targetName: reviewData.targetName || 'Phòng Gym The Ocean',
                comment: reviewData.comment,
                image: reviewData.image || '',
                date: new Intl.DateTimeFormat('vi-VN').format(new Date())
            };
            reviews.unshift(newReview);
            this.saveReviews(reviews);
            return newReview;
        },

        // Community Posts
        addPost(postData) {
            const posts = this.getPosts();
            const newPost = {
                id: 'post_' + Date.now(),
                authorName: postData.authorName,
                authorRole: postData.authorRole || 'member',
                authorAvatar: postData.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
                time: 'Vừa xong',
                content: postData.content,
                image: postData.image || '',
                likes: 0,
                liked: false,
                comments: []
            };
            posts.unshift(newPost);
            this.savePosts(posts);
            return newPost;
        },

        toggleLikePost(postId) {
            const posts = this.getPosts();
            const post = posts.find(p => p.id === postId);
            if (post) {
                post.liked = !post.liked;
                post.likes += post.liked ? 1 : -1;
                this.savePosts(posts);
            }
        },

        addCommentPost(postId, user, text) {
            const posts = this.getPosts();
            const post = posts.find(p => p.id === postId);
            if (post && text.trim()) {
                post.comments.push({ user, text: text.trim() });
                this.savePosts(posts);
            }
        },

        // Chat
        sendMessage(senderUser, text, targetId = 'all') {
            const chats = this.getChats();
            const newMsg = {
                id: 'msg_' + Date.now(),
                senderId: senderUser.id,
                senderName: senderUser.name,
                senderRole: senderUser.role,
                targetId: targetId,
                text: text,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            };
            chats.push(newMsg);
            this.saveChats(chats);
            return newMsg;
        },

        async getChatConversations() {
            return await accountApiRequest('/api/accounts/conversations');
        },

        async getChatMessages(conversationId) {
            return await accountApiRequest(
                `/api/accounts/conversations/${encodeURIComponent(conversationId)}/messages`
            );
        },

        async sendChatMessage(conversationId, text) {
            return await accountApiRequest(
                `/api/accounts/conversations/${encodeURIComponent(conversationId)}/messages`,
                {
                    method: 'POST',
                    body: JSON.stringify({ text })
                }
            );
        },

        // Update Coach Profile (by Coach login)
        async updateCoachProfile(coachId, updateData) {
            const result = await accountApiRequest('/api/accounts/coach-profile', {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            });
            const coaches = this.getCoaches();
            const index = coaches.findIndex(coach => coach.id === coachId);
            const coach = result.coach;
            if (index === -1) coaches.push(coach);
            else coaches[index] = coach;

            this.saveCoaches(coaches);
            return coach;
        }
    };

    window.OceanApp = OceanApp;
})(window);
