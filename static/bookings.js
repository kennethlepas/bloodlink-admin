// ==================== SUPER ADMIN BOOKINGS MANAGEMENT ====================
(function () {
    'use strict';

    let allDonorBookings = [];
    let allRecipientBookings = [];

    // ── Init ──────────────────────────────────────────────────────────
    window.initializePage = async function () {
        console.log('📅 Initializing Super Admin Bookings...');
        loadDonorBookings();
        loadRecipientBookings();
    };

    // ── Tab switching ─────────────────────────────────────────────────
    window.switchTab = function (tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('donorSection').classList.add('hidden');
        document.getElementById('recipientSection').classList.add('hidden');

        if (tab === 'donor') {
            document.getElementById('tabDonor').classList.add('active');
            document.getElementById('donorSection').classList.remove('hidden');
        } else if (tab === 'recipient') {
            document.getElementById('tabRecipient').classList.add('active');
            document.getElementById('recipientSection').classList.remove('hidden');
        }
    };

    // ── Load Donor Bookings ───────────────────────────────────────────
    window.loadDonorBookings = function () {
        const list = document.getElementById('donorBookingsList');
        if (!list) return;

        firestore.collection('donorBookings')
            .orderBy('scheduledDate', 'desc')
            .limit(100)
            .onSnapshot(snap => {
                allDonorBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                filterDonorBookings();
                updateStats();
            }, err => {
                console.error('Donor bookings error:', err);
                list.innerHTML = `<p class="error-text" style="grid-column:1/-1;">Failed to load: ${err.message}</p>`;
            });
    };

    window.filterDonorBookings = function () {
        const status = document.getElementById('donorStatusFilter')?.value || 'all';
        const filtered = status === 'all' ? allDonorBookings : allDonorBookings.filter(b => b.status === status);
        renderDonorBookings(filtered);
    };

    function renderDonorBookings(bookings) {
        const grid = document.getElementById('donorBookingsList');
        if (!grid) return;

        if (bookings.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📅</div><p>No donor appointments found.</p></div>`;
            return;
        }

        grid.innerHTML = bookings.map(b => `
            <div class="booking-card status-${b.status}">
                <div class="booking-status-label status-${b.status}">${b.status}</div>
                <div class="booking-header">
                    <span class="booking-name">${esc(b.donorName)}</span>
                    <span class="booking-id-label">${esc(b.bookingId || b.id)}</span>
                    <div class="hospital-label">🏥 ${esc(b.hospitalName || 'Unknown Hospital')}</div>
                    <span class="blood-type-badge">${esc(b.bloodType)}</span>
                </div>
                <div class="booking-details">
                    <div class="detail-item">📅 ${esc(b.scheduledDate)}</div>
                    <div class="detail-item">⏰ ${esc(b.scheduledTime)}</div>
                    <div class="detail-item">📞 ${esc(b.donorPhone || 'N/A')}</div>
                </div>
                ${b.rejectionReason ? `<div class="rejection-reason">❌ ${esc(b.rejectionReason)}</div>` : ''}
            </div>
        `).join('');
    }

    // ── Load Recipient Bookings ───────────────────────────────────────
    window.loadRecipientBookings = function () {
        const list = document.getElementById('recipientBookingsList');
        if (!list) return;

        firestore.collection('recipientBookings')
            .orderBy('scheduledDate', 'desc')
            .limit(100)
            .onSnapshot(snap => {
                allRecipientBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                filterRecipientBookings();
                updateStats();
            }, err => {
                console.error('Recipient bookings error:', err);
                list.innerHTML = `<p class="error-text" style="grid-column:1/-1;">Failed to load: ${err.message}</p>`;
            });
    };

    window.filterRecipientBookings = function () {
        const status = document.getElementById('recipientStatusFilter')?.value || 'all';
        const filtered = status === 'all' ? allRecipientBookings : allRecipientBookings.filter(b => b.status === status);
        renderRecipientBookings(filtered);
    };

    function renderRecipientBookings(bookings) {
        const grid = document.getElementById('recipientBookingsList');
        if (!grid) return;

        if (bookings.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🏥</div><p>No recipient appointments found.</p></div>`;
            return;
        }

        grid.innerHTML = bookings.map(b => `
            <div class="booking-card status-${b.status}">
                <div class="booking-status-label status-${b.status}">${b.status}</div>
                <div class="booking-header">
                    <span class="booking-name">${esc(b.requesterName)}</span>
                    <span class="booking-id-label">${esc(b.bookingId || b.id)}</span>
                    <div class="hospital-label">🏥 ${esc(b.hospitalName || 'Unknown Hospital')}</div>
                    <span class="blood-type-badge">${esc(b.bloodType)}</span>
                    ${b.bloodComponent ? `<span class="blood-type-badge" style="background:#3b82f6;">${esc(b.bloodComponent)}</span>` : ''}
                </div>
                <div class="booking-details">
                    <div class="detail-item">📅 ${esc(b.scheduledDate)}</div>
                    <div class="detail-item">⏰ ${esc(b.scheduledTime)}</div>
                    <div class="detail-item">📞 ${esc(b.requesterPhone || 'N/A')}</div>
                    ${b.patientName ? `<div class="detail-item">👤 Patient: ${esc(b.patientName)}</div>` : ''}
                    ${b.unitsNeeded ? `<div class="detail-item">🩸 ${b.unitsNeeded} unit(s) needed</div>` : ''}
                </div>
                ${b.rejectionReason ? `<div class="rejection-reason">❌ ${esc(b.rejectionReason)}</div>` : ''}
            </div>
        `).join('');
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function updateStats() {
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('statDonorTotal', allDonorBookings.length);
        el('statRecipientTotal', allRecipientBookings.length);
        el('statPending',
            allDonorBookings.filter(b => b.status === 'pending').length +
            allRecipientBookings.filter(b => b.status === 'pending').length
        );
        el('statCompleted',
            allDonorBookings.filter(b => b.status === 'completed' || b.status === 'fulfilled').length +
            allRecipientBookings.filter(b => b.status === 'completed' || b.status === 'fulfilled').length
        );
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    // Initial page load
    document.addEventListener('DOMContentLoaded', () => {
        if (window.initializePage) {
            // Check if we are on the bookings page
            if (window.location.pathname === '/bookings') {
                window.initializePage();
            }
        }
    });

})();
