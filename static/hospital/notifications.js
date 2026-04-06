window.initializePage = async function () {
    const listElement = document.getElementById('notificationsList');
    const badgeElement = document.getElementById('notificationBadge');
    const filterChips = document.querySelectorAll('.filter-chip');
    const searchInput = document.getElementById('notificationSearch');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    let currentFilter = 'all';
    let searchQuery = '';

    let allNotifications = [];

    // Role-based filtering for notifications
    const hospital = window.hospitalData;
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    let query = firestore.collection('notifications');

    if (hospital || (user && user.role === 'hospital_admin')) {
        const currentFac = hospital || user;
        const hospitalId = currentFac.facilityCode || currentFac.code || currentFac.id;
        const hospitalEmail = currentFac.email;

        const identifiers = [];
        if (hospitalId && hospitalId !== '----') identifiers.push(hospitalId);
        if (hospitalEmail) identifiers.push(hospitalEmail);

        console.log('🔔 Notifications: Filtering for', identifiers);

        if (identifiers.length > 0) {
            // Use 'in' operator for multi-field matching (up to 10 items)
            query = query.where('recipientId', 'in', identifiers);
        } else {
            console.warn('⚠️ No hospital identifiers found for notification filtering');
        }
    } else if (user && user.role === 'super_admin') {
        // Super admin sees all or specifically targeted admin notifications
    }

    // Initialize Firestore listener
    query.orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            allNotifications = [];
            snapshot.forEach(doc => {
                allNotifications.push({ id: doc.id, ...doc.data() });
            });

            renderNotifications();
            updateBadge();
        }, (error) => {
            console.error("Error fetching notifications: ", error);
            if (listElement) {
                listElement.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">❌</div>
                        <p>Error loading notifications. ${error.message}</p>
                    </div>
                `;
            }
        });

    function renderNotifications() {
        if (!listElement) return;
        let filtered = allNotifications;

        // Apply Status Filter
        if (currentFilter === 'unread') {
            filtered = filtered.filter(n => !n.isRead);
        } else if (currentFilter !== 'all') {
            filtered = filtered.filter(n => n.type === currentFilter || (currentFilter === 'verifications' && n.type.includes('verify')));
        }

        // Apply Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(n =>
                (n.title || '').toLowerCase().includes(query) ||
                (n.message || '').toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            const message = allNotifications.length === 0 ? "No notifications yet." : "No notifications found matching your filters.";
            listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔔</div>
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        listElement.innerHTML = filtered.map(n => `
            <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-id="${n.id}">
                <div class="notification-icon">${getIconForType(n.type)}</div>
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-title">${n.title || 'Notification'}</span>
                        <span class="notification-time">${formatDate(n.timestamp)}</span>
                    </div>
                    <p class="notification-message">${n.message || ''}</p>
                    <div class="notification-actions">
                        ${!n.isRead ? `<button class="text-btn mark-read" onclick="window.markAsRead('${n.id}')">Mark as read</button>` : ''}
                        <button class="text-btn view-details" onclick="window.handleNotificationClick('${n.id}', '${n.type}', ${JSON.stringify(n.data || {}).replace(/"/g, '&quot;')})">View Details</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function updateBadge() {
        if (!badgeElement) return;
        const unreadCount = allNotifications.filter(n => !n.isRead).length;
        if (unreadCount > 0) {
            badgeElement.textContent = unreadCount;
            badgeElement.classList.remove('hidden');
        } else {
            badgeElement.classList.add('hidden');
        }
    }

    function getIconForType(type) {
        switch (type) {
            case 'blood_request': return '🩸';
            case 'request_accepted': return '✅';
            case 'verify_donation':
            case 'donor_verification': return '🛡️';
            case 'system_alert': return '⚠️';
            default: return '🔔';
        }
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-KE', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Event Listeners
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderNotifications();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderNotifications();
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            const unread = await firestore.collection('notifications').where('isRead', '==', false).get();
            const batch = firestore.batch();
            unread.forEach(doc => {
                batch.update(doc.ref, { isRead: true });
            });
            await batch.commit();
        });
    }

    // Global click handlers (since they are in HTML string)
    window.markAsRead = async (id) => {
        await firestore.collection('notifications').doc(id).update({ isRead: true });
    };

    window.handleNotificationClick = (id, type, data) => {
        window.markAsRead(id);
        const prefix = '/hospital';

        if (type.includes('verify')) {
            window.location.href = `${prefix}/verifications`;
        } else if (data.requestId) {
            window.location.href = `${prefix}/requests?id=${data.requestId}`;
        }
    };
};
