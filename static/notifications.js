document.addEventListener('DOMContentLoaded', () => {
    const listElement = document.getElementById('notificationsList');
    const badgeElement = document.getElementById('notificationBadge');
    const filterChips = document.querySelectorAll('.filter-chip');
    const searchInput = document.getElementById('notificationSearch');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    let currentFilter = 'all';
    let searchQuery = '';
    let allNotifications = [];
    let unsubscribeListener = null;

    // Get current user and role
    const hospital = window.hospitalData;
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    const isHospitalAdmin = !!(hospital || (user && user.role === 'hospital_admin'));
    const isSuperAdmin = !!(user && user.role === 'super_admin');

    console.log('🔔 Initializing notifications...', {
        isHospitalAdmin,
        isSuperAdmin,
        hospital: hospital?.name || hospital?.hospitalName,
        userEmail: user?.email
    });

    /**
     * Build the notification query based on user role
     */
    function buildNotificationQuery() {
        let query = firestore.collection('notifications');

        if (isHospitalAdmin) {
            // Hospital admin sees notifications specific to their hospital
            const currentFac = hospital || user;
            const hospitalIdentifiers = [];

            // Collect all possible identifiers for this hospital
            if (currentFac.id) hospitalIdentifiers.push(currentFac.id);
            if (currentFac.facilityCode) hospitalIdentifiers.push(currentFac.facilityCode);
            if (currentFac.code) hospitalIdentifiers.push(currentFac.code);
            if (currentFac.email) hospitalIdentifiers.push(currentFac.email);
            if (currentFac.hospitalId) hospitalIdentifiers.push(currentFac.hospitalId);
            if (currentFac.uid) hospitalIdentifiers.push(currentFac.uid);

            // Remove duplicates
            const uniqueIdentifiers = [...new Set(hospitalIdentifiers)].filter(Boolean);

            console.log('🏥 Hospital identifiers for notifications:', uniqueIdentifiers);

            if (uniqueIdentifiers.length > 0) {
                // Use 'in' operator for multi-field matching (up to 10 items)
                // recipientId can be: hospitalId, hospitalEmail, or facilityCode
                query = query.where('recipientId', 'in', uniqueIdentifiers.slice(0, 10));
                console.log('✅ Query: recipientId in', uniqueIdentifiers);
            } else {
                console.warn('⚠️ No hospital identifiers found - falling back to userId filter');
                if (user?.uid) {
                    query = query.where('recipientId', '==', user.uid);
                }
            }
        } else if (isSuperAdmin) {
            // Super admin sees:
            // 1. Notifications with recipientId = 'admin' or 'super_admin'
            // 2. Notifications with userId = their UID
            // 3. All system-wide notifications (no filter)
            console.log('🛡️ Super Admin: Loading all notifications');
            // No where clause - super admin sees all
        }

        return query;
    }

    /**
     * Setup real-time notification listener
     */
    function setupNotificationListener() {
        // Unsubscribe from previous listener if exists
        if (unsubscribeListener) {
            console.log('🔄 Unsubscribing from previous notification listener');
            unsubscribeListener();
        }

        const query = buildNotificationQuery();

        unsubscribeListener = query
            .orderBy('timestamp', 'desc')
            .limit(100)
            .onSnapshot((snapshot) => {
                console.log(`📬 Received ${snapshot.docs.length} notifications`);
                allNotifications = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    allNotifications.push({
                        id: doc.id,
                        ...data,
                        // Normalize timestamp to ensure it exists
                        timestamp: data.timestamp || data.createdAt || data.timestampISO
                    });
                });

                renderNotifications();
                updateBadge();
            }, (error) => {
                console.error("❌ Error fetching notifications: ", error);

                // Handle specific Firestore errors
                if (error.code === 'failed-precondition' || error.code === 'invalid-argument') {
                    console.warn('⚠️ Query index issue - loading without orderBy');
                    // Fallback: fetch without orderBy and sort client-side
                    buildNotificationQuery()
                        .limit(100)
                        .get()
                        .then(snapshot => {
                            allNotifications = [];
                            snapshot.forEach(doc => {
                                allNotifications.push({
                                    id: doc.id,
                                    ...doc.data()
                                });
                            });
                            // Sort client-side
                            allNotifications.sort((a, b) => {
                                const timeA = a.timestamp?.toDate?.() || new Date(a.timestampISO || 0);
                                const timeB = b.timestamp?.toDate?.() || new Date(b.timestampISO || 0);
                                return timeB - timeA;
                            });
                            renderNotifications();
                            updateBadge();
                        })
                        .catch(err => {
                            console.error('❌ Fallback query also failed:', err);
                            showError(error.message);
                        });
                } else {
                    showError(error.message);
                }
            });
    }

    /**
     * Show error state
     */
    function showError(message) {
        if (listElement) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <p>Error loading notifications</p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">${message || 'Unknown error'}</p>
                    <button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Render notifications list
     */
    function renderNotifications() {
        if (!listElement) return;

        let filtered = allNotifications;

        // Apply Status Filter
        if (currentFilter === 'unread') {
            filtered = filtered.filter(n => !n.isRead);
        } else if (currentFilter !== 'all') {
            filtered = filtered.filter(n =>
                n.type === currentFilter ||
                (currentFilter === 'verifications' && (n.type?.includes('verify') || n.type?.includes('verification'))) ||
                (currentFilter === 'requests' && (n.type?.includes('request') || n.type?.includes('blood')))
            );
        }

        // Apply Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(n =>
                (n.title || '').toLowerCase().includes(query) ||
                (n.message || '').toLowerCase().includes(query) ||
                (n.type || '').toLowerCase().includes(query)
            );
        }

        if (filtered.length === 0) {
            const message = allNotifications.length === 0
                ? "No notifications yet."
                : "No notifications found matching your filters.";
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
                        <span class="notification-title">${escapeHtml(n.title || 'Notification')}</span>
                        <span class="notification-time">${formatDate(n.timestamp)}</span>
                    </div>
                    <p class="notification-message">${escapeHtml(n.message || '')}</p>
                    ${n.type === 'new_message' ? `
                        <span style="font-size: 10px; color: var(--primary); margin-top: 4px;">💬 Chat Message</span>
                    ` : ''}
                    <div class="notification-actions">
                        ${!n.isRead ? `<button class="text-btn mark-read" onclick="window.markAsRead('${n.id}')">Mark as read</button>` : ''}
                        <button class="text-btn view-details" onclick="window.handleNotificationClick('${n.id}', '${n.type}', ${escapeData(n.data || {})})">View Details</button>
                        ${n.isRead ? `<button class="text-btn delete-notif" onclick="window.deleteNotification('${n.id}')" style="color: #ef4444;">Delete</button>` : ''}

                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Update notification badge
     */
    function updateBadge() {
        if (!badgeElement) return;

        const unreadCount = allNotifications.filter(n => !n.isRead).length;

        if (unreadCount > 0) {
            badgeElement.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badgeElement.classList.remove('hidden');
        } else {
            badgeElement.classList.add('hidden');
        }
    }

    /**
     * Get icon for notification type
     */
    function getIconForType(type) {
        if (!type) return '🔔';

        const typeStr = type.toLowerCase();

        if (typeStr.includes('message') || typeStr.includes('chat')) return '💬';
        if (typeStr.includes('request') || typeStr.includes('blood')) return '🩸';
        if (typeStr.includes('accept')) return '✅';
        if (typeStr.includes('reject')) return '❌';
        if (typeStr.includes('verify')) return '🛡️';
        if (typeStr.includes('system') || typeStr.includes('alert')) return '⚠️';
        if (typeStr.includes('referral')) return '🔗';
        if (typeStr.includes('donor')) return '🩸';
        if (typeStr.includes('error')) return '❌';
        if (typeStr.includes('warning')) return '⚠️';

        return '🔔';
    }

    /**
     * Format date safely (logical time)
     */
    function formatDate(timestamp) {
        if (!timestamp) return '';

        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

            if (isNaN(date.getTime())) return 'Invalid date';

            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;

            return date.toLocaleString('en-KE', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (err) {
            console.warn('⚠️ Invalid timestamp:', timestamp);
            return '';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape data for JSON embedding
     */
    function escapeData(data) {
        return JSON.stringify(data).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            try {
                const unreadIds = allNotifications.filter(n => !n.isRead).map(n => n.id);

                if (unreadIds.length === 0) {
                    if (window.utils?.showNotification) {
                        window.utils.showNotification('No unread notifications', 'info');
                    }
                    return;
                }

                const batch = firestore.batch();
                unreadIds.forEach(id => {
                    const docRef = firestore.collection('notifications').doc(id);
                    batch.update(docRef, { isRead: true });
                });

                await batch.commit();

                if (window.utils?.showNotification) {
                    window.utils.showNotification(`Marked ${unreadIds.length} notifications as read`, 'success');
                }
            } catch (error) {
                console.error('Error marking all as read:', error);
                if (window.utils?.showNotification) {
                    window.utils.showNotification('Failed to mark as read', 'error');
                }
            }
        });
    }

    // Global functions for click handlers in HTML strings
    window.markAsRead = async (id) => {
        try {
            await firestore.collection('notifications').doc(id).update({ isRead: true });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    window.deleteNotification = async (id) => {
        if (!confirm('Delete this notification?')) return;

        try {
            await firestore.collection('notifications').doc(id).delete();
            if (window.utils?.showNotification) {
                window.utils.showNotification('Notification deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
            if (window.utils?.showNotification) {
                window.utils.showNotification('Failed to delete notification', 'error');
            }
        }
    };

    window.handleNotificationClick = async (id, type, data) => {
        // Mark as read first
        await window.markAsRead(id);

        const prefix = isHospitalAdmin ? '/hospital' : '';

        console.log('🔔 Notification clicked:', { type, data, prefix });

        // Handle different notification types
        if (type === 'new_message' || type === 'chat') {
            // Navigate to chat with the sender
            const targetId = data.senderId || data.userId || data.chatId;
            const targetName = data.senderName || data.name || 'Contact';
            if (targetId) {
                window.location.href = `${prefix}/chat?targetId=${targetId}&targetName=${encodeURIComponent(targetName)}`;
            }
        } else if (type?.includes('verify') || type?.includes('verification')) {
            window.location.href = `${prefix}/verifications`;
        } else if (type?.includes('request') || type?.includes('blood')) {
            const requestId = data.requestId || data.id;
            if (requestId) {
                window.location.href = `${prefix}/requests?id=${requestId}`;
            } else {
                window.location.href = `${prefix}/requests`;
            }
        } else if (type?.includes('referral')) {
            const referralId = data.referralId || data.id;
            if (referralId) {
                window.location.href = `${prefix}/referrals?id=${referralId}`;
            } else {
                window.location.href = `${prefix}/referrals`;
            }
        } else if (type?.includes('donor')) {
            window.location.href = `${prefix}/donors`;
        } else if (data.requestId) {
            window.location.href = `${prefix}/requests?id=${data.requestId}`;
        } else if (data.referralId) {
            window.location.href = `${prefix}/referrals?id=${data.referralId}`;
        } else if (data.link) {
            // Use direct link if provided
            window.location.href = data.link.startsWith('http') ? data.link : `${prefix}${data.link}`;
        }
    };

    // Initialize the listener
    setupNotificationListener();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (unsubscribeListener) {
            unsubscribeListener();
        }
    });

    console.log('✅ Notifications initialized successfully');
});
