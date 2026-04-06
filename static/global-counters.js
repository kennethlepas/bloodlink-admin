// Global Sidebar Counters - Syncs badges for Notifications and Verifications
(function () {
    'use strict';

    let notificationListener = null;
    let donorVerListener = null;
    let requestVerListener = null;
    let disputeListener = null;
    let ticketListener = null;

    const elements = {
        notiBadge: document.getElementById('notificationBadge'),
        verBadge: document.getElementById('verificationBadge'),
        ticketBadge: document.getElementById('ticketBadge')
    };


    let counts = {
        notifications: 0,
        donorVers: 0,
        requestVers: 0,
        disputes: 0,
        tickets: 0
    };


    function updateUI() {
        // Notifications Badge
        if (elements.notiBadge) {
            if (counts.notifications > 0) {
                elements.notiBadge.textContent = counts.notifications > 99 ? '99+' : counts.notifications;
                elements.notiBadge.classList.remove('hidden');
            } else {
                elements.notiBadge.classList.add('hidden');
            }
        }

        // Verifications Badge (Total of Donors + Requests + Disputes)
        if (elements.verBadge) {
            const totalVer = counts.donorVers + counts.requestVers + counts.disputes;
            if (totalVer > 0) {
                elements.verBadge.textContent = totalVer > 99 ? '99+' : totalVer;
                elements.verBadge.classList.remove('hidden');
            } else {
                elements.verBadge.classList.add('hidden');
            }
        }
        // Support Tickets Badge (Only open tickets)
        if (elements.ticketBadge) {
            if (counts.tickets > 0) {
                elements.ticketBadge.textContent = counts.tickets > 99 ? '99+' : counts.tickets;
                elements.ticketBadge.classList.remove('hidden');
            } else {
                elements.ticketBadge.classList.add('hidden');
            }
        }
    }


    function initListeners() {
        // Wait for auth to be fully ready and hospitalData to be populated
        const interval = setInterval(() => {
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            if (user && user.role) {
                clearInterval(interval);
                setupCounters(user);
            }
        }, 500);

        // Safety timeout
        setTimeout(() => clearInterval(interval), 10000);
    }

    function setupCounters(user) {
        console.log('Initializing global sidebar counters for role:', user.role);
        const hospital = window.hospitalData;

        // 1. Unread Notifications (Role-Aware)
        let notificationsQuery = firestore.collection('notifications').where('isRead', '==', false);

        if (user.role === 'hospital_admin') {
            const currentFac = hospital || user;
            const hospitalId = currentFac.facilityCode || currentFac.code || currentFac.id;
            console.log('Filtering sidebar notifications for hospital:', hospitalId);
            notificationsQuery = notificationsQuery.where('recipientId', '==', hospitalId);
        }

        notificationListener = notificationsQuery.onSnapshot(snap => {
            counts.notifications = snap.size;
            updateUI();
        }, err => console.error('Count error (noti):', err));

        // Remaining counters are Super Admin only
        if (user.role === 'super_admin') {
            // 2. Pending Donor Verifications
            donorVerListener = firestore.collection('verification_requests')
                .where('userType', '==', 'donor')
                .where('status', '==', 'pending')
                .onSnapshot(snap => {
                    counts.donorVers = snap.size;
                    updateUI();
                }, err => console.error('Count error (donorVer):', err));

            // 3. Pending Blood Request Verifications
            requestVerListener = firestore.collection('bloodRequests')
                .where('verificationStatus', '==', 'pending')
                .onSnapshot(snap => {
                    counts.requestVers = snap.size;
                    updateUI();
                }, err => console.error('Count error (reqVer):', err));

            // 4. Active Donation Disputes
            disputeListener = firestore.collection('acceptedRequests')
                .where('status', '==', 'disputed')
                .onSnapshot(snap => {
                    counts.disputes = snap.size;
                    updateUI();
                }, err => console.error('Count error (dispute):', err));

            // 5. Open Support Tickets
            ticketListener = firestore.collection('tickets')
                .where('status', '==', 'open')
                .onSnapshot(snap => {
                    counts.tickets = snap.size;
                    updateUI();
                }, err => console.error('Count error (ticket):', err));
        }
    }


    // Initialize when auth is ready or DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initListeners);
    } else {
        initListeners();
    }

    // Cleanup on window unload (optional for SPAs, helpful for multi-page)
    window.addEventListener('unload', () => {
        if (notificationListener) notificationListener();
        if (donorVerListener) donorVerListener();
        if (requestVerListener) requestVerListener();
        if (disputeListener) disputeListener();
        if (ticketListener) ticketListener();
    });


})();
