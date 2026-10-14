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

    // Core Ocean Store
    const OceanApp = {
        // Data getters
        getCoaches() {
            let coaches = loadStorage(STORAGE_KEY_COACHES, null);
            if (!coaches || !coaches.length) {
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
            return this.getCoaches().find(c => c.id === id);
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

        logout() {
            localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
            window.dispatchEvent(new CustomEvent('ocean:auth-changed', { detail: null }));
        },

        // Login Logic
        login(username, password) {
            const cleanUser = (username || '').trim().toLowerCase();
            const cleanPass = (password || '').trim();

            // 1. Check Members
            const members = this.getMembers();
            const matchedMember = members.find(m =>
                (m.username.toLowerCase() === cleanUser || m.phone === cleanUser || (m.email && m.email.toLowerCase() === cleanUser)) &&
                m.password === cleanPass
            );
            if (matchedMember) {
                const userObj = {
                    id: matchedMember.id,
                    username: matchedMember.username,
                    name: matchedMember.name,
                    phone: matchedMember.phone,
                    role: 'member',
                    plan: matchedMember.plan || 'Gói Hội viên',
                    avatar: matchedMember.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                };
                this.setCurrentUser(userObj);
                return { success: true, user: userObj };
            }

            // 2. Check Coaches
            const coaches = this.getCoaches();
            const matchedCoach = coaches.find(c =>
                (c.id.toLowerCase() === cleanUser || (c.phone && c.phone === cleanUser) || (c.email && c.email.toLowerCase() === cleanUser)) &&
                (c.password === cleanPass || cleanPass === 'coach123') // Default fallback password for initial coaches
            );
            if (matchedCoach) {
                const userObj = {
                    id: matchedCoach.id,
                    username: matchedCoach.id,
                    name: matchedCoach.name,
                    phone: matchedCoach.phone || '',
                    role: 'coach',
                    coachRole: matchedCoach.role,
                    cert: matchedCoach.cert,
                    avatar: matchedCoach.img
                };
                this.setCurrentUser(userObj);
                return { success: true, user: userObj };
            }

            return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
        },

        // Member Creation by Admin
        createMemberAccount(data) {
            const members = this.getMembers();
            // Generate clean username from phone or name
            const username = data.username || `member_${(data.phone || '').replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
            const password = data.password || Math.random().toString(36).slice(-8);

            const newMember = {
                id: 'mem_' + Date.now(),
                name: data.name,
                phone: data.phone,
                goal: data.goal || 'Tăng cơ giảm mỡ',
                plan: data.plan || 'Gói Chốt Thành Công',
                username: username,
                password: password,
                createdAt: new Date().toISOString(),
                status: 'active'
            };

            members.push(newMember);
            this.saveMembers(members);
            return newMember;
        },

        // Coach Application by Public User
        submitCoachApplication(data) {
            const apps = this.getCoachApplications();
            const newApp = {
                id: 'app_' + Date.now(),
                name: data.name,
                phone: data.phone,
                email: data.email,
                roleApplied: data.role || 'Huấn luyện viên Thể hình',
                exp: data.exp || '2 năm kinh nghiệm',
                cert: data.cert || '',
                intro: data.intro || '',
                image: data.image || 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80',
                status: 'pending', // 'pending' | 'approved' | 'rejected'
                appliedAt: new Date().toISOString()
            };
            apps.unshift(newApp);
            this.saveCoachApplications(apps);
            return newApp;
        },

        // Coach Approval & Account Provisioning by Admin
        approveCoachApplication(appId, customPassword) {
            const apps = this.getCoachApplications();
            const app = apps.find(a => a.id === appId);
            if (!app) throw new Error('Không tìm thấy đơn ứng tuyển.');

            const coaches = this.getCoaches();
            const coachId = 'coach-' + (app.phone ? app.phone.slice(-4) : Math.floor(1000 + Math.random() * 9000));
            const password = customPassword || 'coach123';

            const newCoach = {
                id: coachId,
                name: app.name,
                role: app.roleApplied,
                desc: app.intro || 'Huấn luyện viên The Ocean Gym',
                exp: app.exp,
                cert: app.cert,
                img: app.image,
                phone: app.phone,
                email: app.email,
                password: password,
                status: 'active'
            };

            coaches.push(newCoach);
            this.saveCoaches(coaches);

            // Update application status
            app.status = 'approved';
            app.coachId = coachId;
            app.accountCreated = {
                username: coachId,
                password: password
            };
            this.saveCoachApplications(apps);

            return { coach: newCoach, credentials: app.accountCreated };
        },

        // Booking creation by Member
        bookSession(bookingData) {
            const bookings = this.getBookings();
            const newBooking = {
                id: 'book_' + Date.now(),
                memberId: bookingData.memberId,
                memberName: bookingData.memberName,
                memberPhone: bookingData.memberPhone,
                coachId: bookingData.coachId,
                coachName: bookingData.coachName,
                date: bookingData.date,
                timeSlot: bookingData.timeSlot,
                note: bookingData.note || '',
                status: 'confirmed', // 'confirmed' | 'completed' | 'cancelled'
                createdAt: new Date().toISOString()
            };
            bookings.unshift(newBooking);
            this.saveBookings(bookings);
            return newBooking;
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

        // Update Coach Profile (by Coach login)
        updateCoachProfile(coachId, updateData) {
            const coaches = this.getCoaches();
            const coach = coaches.find(c => c.id === coachId);
            if (!coach) throw new Error('Không tìm thấy huấn luyện viên.');

            if (updateData.cert !== undefined) coach.cert = updateData.cert;
            if (updateData.exp !== undefined) coach.exp = updateData.exp;
            if (updateData.desc !== undefined) coach.desc = updateData.desc;
            if (updateData.role !== undefined) coach.role = updateData.role;
            if (updateData.img !== undefined) coach.img = updateData.img;
            if (updateData.phone !== undefined) coach.phone = updateData.phone;

            this.saveCoaches(coaches);
            return coach;
        }
    };

    window.OceanApp = OceanApp;
})(window);
