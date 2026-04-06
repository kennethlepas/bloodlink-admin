// ==================== BOOKINGS MANAGEMENT MODULE ====================
(function () {
    'use strict';

    let currentHospital = null;
    let allDonorBookings = [];
    let allRecipientBookings = [];
    let allBroadcastRequests = [];
    let rejectTarget = null; // { id, type: 'donor'|'recipient' }

    // Helper to get hospital context consistently
    function getHospitalContext() {
        if (!currentHospital) return null;
        return {
            id: currentHospital.id,
            code: currentHospital.facilityCode || currentHospital.code || '',
            name: currentHospital.hospitalName || currentHospital.name || 'Hospital Admin'
        };
    }

    // ── Init ──────────────────────────────────────────────────────────
    window.initializePage = async function () {
        console.log('📅 Initializing Bookings Management...');

        // Wait for hospitalData to be available (set by auth.js)
        const checkData = setInterval(() => {
            if (window.hospitalData) {
                clearInterval(checkData);
                currentHospital = window.hospitalData;
                console.log('🏥 Hospital context established:', currentHospital.name || currentHospital.id);

                // Initial load
                loadDonorBookings();
                loadRecipientBookings();
                loadBroadcastRequests();
                updateStats();
            }
        }, 300);

        // Safety timeout
        setTimeout(() => clearInterval(checkData), 10000);
    };

    // ── Tab switching ─────────────────────────────────────────────────
    window.switchTab = function (tab) {
        // Update tab buttons active state
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        // Hide all sections
        const sections = ['donorSection', 'recipientSection', 'broadcastSection'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Show selected section
        if (tab === 'donor') {
            const btn = document.querySelector('.tab-btn[onclick*="donor"]');
            if (btn) btn.classList.add('active');
            document.getElementById('donorSection')?.classList.remove('hidden');
            loadDonorBookings();
        } else if (tab === 'recipient') {
            const btn = document.querySelector('.tab-btn[onclick*="recipient"]');
            if (btn) btn.classList.add('active');
            document.getElementById('recipientSection')?.classList.remove('hidden');
            loadRecipientBookings();
        } else if (tab === 'broadcast') {
            const btn = document.querySelector('.tab-btn[onclick*="broadcast"]');
            if (btn) btn.classList.add('active');
            document.getElementById('broadcastSection')?.classList.remove('hidden');
            loadBroadcastRequests();
        }
    };

    // ── Load Donor Bookings ───────────────────────────────────────────
    window.loadDonorBookings = function () {
        const list = document.getElementById('donorBookingsList');
        if (!list) return;

        const ctx = getHospitalContext();
        if (!ctx) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔒</div><p>Access denied: Hospital context missing.</p></div>`;
            return;
        }

        console.log('🔍 Fetching donor bookings for:', ctx.code || ctx.id);

        // Use a more robust query that checks both code and ID to handle legacy/missing fields
        const baseRef = firestore.collection('donorBookings');
        let query;

        // Preferred: Query by Hospital Code
        if (ctx.code) {
            query = baseRef.where('hospitalCode', '==', ctx.code).orderBy('scheduledDate', 'desc');
        } else {
            // Fallback: Query by Hospital ID (Email Key)
            query = baseRef.where('hospitalId', '==', ctx.id).orderBy('scheduledDate', 'desc');
        }

        query.onSnapshot(snap => {
            // If code query was empty but we have an ID, try ID query as fallback (only if code was used)
            if (snap.empty && ctx.code && ctx.id) {
                console.log('ℹ️ No bookings found for code, trying fallback to ID...');
                baseRef.where('hospitalId', '==', ctx.id).orderBy('scheduledDate', 'desc').get().then(fallbackSnap => {
                    if (!fallbackSnap.empty) {
                        allDonorBookings = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        filterDonorBookings();
                        updateStats();
                    } else {
                        allDonorBookings = [];
                        renderDonorBookings([]);
                        updateStats();
                    }
                });
                return;
            }

            allDonorBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            filterDonorBookings();
            updateStats();
        }, err => {
            console.error('Donor bookings sync error:', err);
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Error loading bookings: ${err.message}</p></div>`;
        });
    };

    window.filterDonorBookings = function () {
        const status = document.getElementById('donorStatusFilter')?.value || 'all';
        const search = document.getElementById('donorSearch')?.value.toLowerCase().trim() || '';

        let filtered = [...allDonorBookings];
        if (status !== 'all') {
            filtered = filtered.filter(b => b.status === status);
        }
        if (search) {
            filtered = filtered.filter(b =>
                (b.donorName && b.donorName.toLowerCase().includes(search)) ||
                (b.bookingId && b.bookingId.toLowerCase().includes(search)) ||
                (b.donorPhone && b.donorPhone.includes(search))
            );
        }
        renderDonorBookings(filtered);
    };

    function renderDonorBookings(bookings) {
        const grid = document.getElementById('donorBookingsList');
        if (!grid) return;

        if (bookings.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p>No donor appointments found.</p></div>`;
            return;
        }

        grid.innerHTML = bookings.map(b => `
            <div class="booking-card status-${b.status || 'pending'}">
                <div class="booking-header">
                    <div class="booking-info">
                        <div class="booking-name">${esc(b.donorName || 'Unknown Donor')}</div>
                        <div class="booking-id">${esc(b.bookingId || b.id.slice(0, 8))}</div>
                    </div>
                    <div class="blood-badge">${esc(b.bloodType || 'N/A')}</div>
                </div>
                <div class="booking-details">
                    <div class="detail-row">
                        <span class="detail-icon">📅</span>
                        <span class="detail-text">${esc(b.scheduledDate || 'TBD')} at ${esc(b.scheduledTime || 'TBD')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">📞</span>
                        <span class="detail-text">${esc(b.donorPhone || 'N/A')}</span>
                    </div>
                    ${b.notes ? `<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-text">${esc(b.notes)}</span></div>` : ''}
                </div>
                <div class="booking-actions">
                    <span class="status-badge status-${b.status || 'pending'}">${b.status || 'pending'}</span>
                    ${b.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="confirmBooking('${b.id}', 'donor')">Confirm</button>
                        <button class="btn btn-danger" onclick="openRejectModal('${b.id}', 'donor')">Reject</button>
                    ` : ''}
                    ${b.status === 'confirmed' ? `
                        <button class="btn btn-success" onclick="completeBooking('${b.id}', 'donor')">Complete</button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="startChatWithUser('${b.donorId}', '${esc(b.donorName || 'Donor')}')">💬 Chat</button>
                </div>
                ${b.rejectionReason ? `<div class="rejection-reason">❌ ${esc(b.rejectionReason)}</div>` : ''}
            </div>
        `).join('');
    }

    // ── Load Recipient Bookings ───────────────────────────────────────
    window.loadRecipientBookings = function () {
        const list = document.getElementById('recipientBookingsList');
        if (!list) return;

        const ctx = getHospitalContext();
        if (!ctx) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔒</div><p>Access denied: Hospital context missing.</p></div>`;
            return;
        }

        console.log('🔍 Fetching recipient bookings for:', ctx.code || ctx.id);

        const baseRef = firestore.collection('recipientBookings');
        let query;

        if (ctx.code) {
            query = baseRef.where('hospitalCode', '==', ctx.code).orderBy('scheduledDate', 'desc');
        } else {
            query = baseRef.where('hospitalId', '==', ctx.id).orderBy('scheduledDate', 'desc');
        }

        query.onSnapshot(snap => {
            if (snap.empty && ctx.code && ctx.id) {
                baseRef.where('hospitalId', '==', ctx.id).orderBy('scheduledDate', 'desc').get().then(fallbackSnap => {
                    if (!fallbackSnap.empty) {
                        allRecipientBookings = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        filterRecipientBookings();
                        updateStats();
                    } else {
                        allRecipientBookings = [];
                        renderRecipientBookings([]);
                        updateStats();
                    }
                });
                return;
            }

            allRecipientBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            filterRecipientBookings();
            updateStats();
        }, err => {
            console.error('Recipient bookings sync error:', err);
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Error loading bookings: ${err.message}</p></div>`;
        });
    };

    window.filterRecipientBookings = function () {
        const status = document.getElementById('recipientStatusFilter')?.value || 'all';
        const search = document.getElementById('recipientSearch')?.value.toLowerCase().trim() || '';

        let filtered = [...allRecipientBookings];
        if (status !== 'all') {
            filtered = filtered.filter(b => b.status === status);
        }
        if (search) {
            filtered = filtered.filter(b =>
                (b.requesterName && b.requesterName.toLowerCase().includes(search)) ||
                (b.patientName && b.patientName.toLowerCase().includes(search)) ||
                (b.bookingId && b.bookingId.toLowerCase().includes(search))
            );
        }
        renderRecipientBookings(filtered);
    };

    function renderRecipientBookings(bookings) {
        const grid = document.getElementById('recipientBookingsList');
        if (!grid) return;

        if (bookings.length === 0) {
            grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏥</div><p>No recipient appointments found.</p></div>`;
            return;
        }

        grid.innerHTML = bookings.map(b => `
            <div class="booking-card status-${b.status || 'pending'}">
                <div class="booking-header">
                    <div class="booking-info">
                        <div class="booking-name">${esc(b.requesterName || 'Unknown Requester')}</div>
                        <div class="booking-id">${esc(b.bookingId || b.id.slice(0, 8))}</div>
                    </div>
                    <div class="blood-badge">${esc(b.bloodType || 'N/A')}</div>
                </div>
                <div class="booking-details">
                    <div class="detail-row">
                        <span class="detail-icon">👤</span>
                        <span class="detail-text">Patient: ${esc(b.patientName || 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">📅</span>
                        <span class="detail-text">${esc(b.scheduledDate || 'TBD')} at ${esc(b.scheduledTime || 'TBD')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">🩸</span>
                        <span class="detail-text">${b.unitsNeeded || 1} unit(s) needed</span>
                    </div>
                    ${b.notes ? `<div class="detail-row"><span class="detail-icon">📝</span><span class="detail-text">${esc(b.notes)}</span></div>` : ''}
                </div>
                <div class="booking-actions">
                    <span class="status-badge status-${b.status || 'pending'}">${b.status || 'pending'}</span>
                    ${b.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="confirmBooking('${b.id}', 'recipient')">Confirm</button>
                        <button class="btn btn-danger" onclick="openRejectModal('${b.id}', 'recipient')">Reject</button>
                    ` : ''}
                    ${b.status === 'confirmed' ? `
                        <button class="btn btn-warning" onclick="updateBookingStatusTo('${b.id}', 'recipient', 'processing')">Start Processing</button>
                    ` : ''}
                    ${b.status === 'processing' ? `
                        <button class="btn btn-primary" onclick="updateBookingStatusTo('${b.id}', 'recipient', 'ready')">Mark Ready</button>
                    ` : ''}
                    ${b.status === 'ready' ? `
                        <button class="btn btn-success" onclick="completeBooking('${b.id}', 'recipient')">Mark Fulfilled</button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="startChatWithUser('${b.requesterId}', '${esc(b.requesterName || 'Requester')}')">💬 Chat</button>
                </div>
                ${b.rejectionReason ? `<div class="rejection-reason">❌ ${esc(b.rejectionReason)}</div>` : ''}
            </div>
        `).join('');
    }

    // ── Load Broadcast Requests ───────────────────────────────────────
    window.loadBroadcastRequests = function () {
        const container = document.getElementById('broadcastRequestsList');
        if (!container) return;

        const ctx = getHospitalContext();
        if (!ctx) return;

        let query = firestore.collection('bloodRequests')
            .where('origin', '==', 'hospital_admin');

        // Filter by either code or ID
        if (ctx.code) {
            query = query.where('hospitalCode', '==', ctx.code);
        } else {
            query = query.where('hospitalId', '==', ctx.id);
        }

        query.orderBy('createdAt', 'desc').onSnapshot(snap => {
            allBroadcastRequests = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString()
                };
            });
            renderBroadcastRequests(allBroadcastRequests);
            updateStats();
        }, err => {
            console.error('Broadcast sync error:', err);
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Error loading broadcasts: ${err.message}</p></div>`;
        });
    };

    function renderBroadcastRequests(requests) {
        const container = document.getElementById('broadcastRequestsList');
        if (!container) return;

        if (requests.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📢</div><p>No broadcast requests found.</p></div>`;
            return;
        }

        container.innerHTML = requests.map(r => `
            <div class="booking-card status-${r.status || 'pending'}">
                <div class="booking-header">
                    <div class="booking-info">
                        <div class="booking-name">${esc(r.bloodType)} Blood Request</div>
                        <div class="booking-id">${esc(r.id.slice(0, 8))}...</div>
                    </div>
                    <div class="blood-badge urgency-${r.urgencyLevel || 'moderate'}">${esc(r.urgencyLevel || 'moderate')}</div>
                </div>
                <div class="booking-details">
                    <div class="detail-row">
                        <span class="detail-icon">🩸</span>
                        <span class="detail-text">${r.unitsNeeded || 1} units needed</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">📅</span>
                        <span class="detail-text">Created: ${new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="booking-actions">
                    <span class="status-badge status-${r.status || 'pending'}">${r.status || 'pending'}</span>
                    ${r.status === 'pending' ? `
                        <button class="btn btn-danger" onclick="cancelBroadcast('${r.id}')">Cancel</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // ── Action Functions ──────────────────────────────────────────────
    window.confirmBooking = async function (id, type) {
        try {
            const collection = type === 'donor' ? 'donorBookings' : 'recipientBookings';
            const now = new Date().toISOString();

            await firestore.collection(collection).doc(id).update({
                status: 'confirmed',
                confirmedAt: now,
                verifiedBy: currentHospital?.name || 'Hospital Admin',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log audit event
            if (window.auditLogs?.actions?.approveRequest) {
                window.auditLogs.actions.approveRequest(id, {
                    type: type,
                    hospitalName: currentHospital?.name,
                    action: 'confirm_booking'
                });
            }

            // Trigger notification
            const booking = type === 'donor' ? allDonorBookings.find(b => b.id === id) : allRecipientBookings.find(b => b.id === id);
            if (booking) {
                const userId = type === 'donor' ? booking.donorId : booking.requesterId;
                await createBookingNotification(userId, 'booking_confirmed', 'Appointment Confirmed! ✅',
                    `Your ${type === 'donor' ? 'donation' : 'transfusion'} appointment has been confirmed by ${currentHospital?.name || 'the hospital'}.`);
            }

            showNotification('Booking confirmed successfully', 'success');
        } catch (error) {
            console.error('Confirm error:', error);
            showNotification('Failed to confirm booking', 'error');
        }
    };

    window.completeBooking = async function (id, type) {
        try {
            const collection = type === 'donor' ? 'donorBookings' : 'recipientBookings';
            const newStatus = type === 'recipient' ? 'fulfilled' : 'completed';

            await firestore.collection(collection).doc(id).update({
                status: newStatus,
                completedAt: new Date().toISOString(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log audit event
            if (window.auditLogs?.logActionEvent) {
                window.auditLogs.logActionEvent(`complete_${type}_booking`, 'blood_request', id, {
                    hospitalName: currentHospital?.name,
                    status: newStatus
                });
            }

            showNotification(`Booking marked as ${newStatus}`, 'success');
        } catch (error) {
            console.error('Complete error:', error);
            showNotification('Failed to complete booking', 'error');
        }
    };

    window.updateBookingStatusTo = async function (id, type, newStatus) {
        try {
            const collection = type === 'donor' ? 'donorBookings' : 'recipientBookings';
            await firestore.collection(collection).doc(id).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log audit event
            if (window.auditLogs?.logActionEvent) {
                window.auditLogs.logActionEvent(`update_${type}_status`, 'blood_request', id, {
                    newStatus: newStatus,
                    hospitalName: currentHospital?.name
                });
            }

            showNotification(`Status updated to ${newStatus}`, 'success');
        } catch (error) {
            console.error('Status update error:', error);
            showNotification('Failed to update status', 'error');
        }
    };

    window.openRejectModal = function (id, type) {
        rejectTarget = { id, type };
        const modal = document.getElementById('rejectModal');
        const reasonInput = document.getElementById('rejectReason');
        if (reasonInput) reasonInput.value = '';
        if (modal) modal.classList.add('show');
    };

    window.closeRejectModal = function () {
        rejectTarget = null;
        document.getElementById('rejectModal')?.classList.remove('show');
    };

    window.confirmReject = async function () {
        if (!rejectTarget) return;
        const reason = document.getElementById('rejectReason')?.value.trim();
        if (!reason) {
            showNotification('Please provide a rejection reason', 'warning');
            return;
        }

        try {
            const collection = rejectTarget.type === 'donor' ? 'donorBookings' : 'recipientBookings';
            await firestore.collection(collection).doc(rejectTarget.id).update({
                status: 'rejected',
                rejectionReason: reason,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log audit event
            if (window.auditLogs?.actions?.rejectRequest) {
                window.auditLogs.actions.rejectRequest(rejectTarget.id, {
                    type: rejectTarget.type,
                    reason: reason,
                    hospitalName: currentHospital?.name
                });
            }

            closeRejectModal();
            showNotification('Booking rejected', 'success');
        } catch (error) {
            console.error('Reject error:', error);
            showNotification('Failed to reject booking', 'error');
        }
    };

    window.createBroadcastRequest = async function () {
        const bloodType = document.getElementById('broadcastBloodType')?.value;
        const units = parseInt(document.getElementById('broadcastUnits')?.value) || 1;
        const urgency = document.getElementById('broadcastUrgency')?.value;
        const notes = document.getElementById('broadcastNotes')?.value.trim();

        if (!currentHospital) return;

        try {
            const ctx = getHospitalContext();
            const requestData = {
                requesterId: ctx.id,
                requesterName: ctx.name,
                patientName: `Hospital Request - ${ctx.name}`,
                bloodType: bloodType,
                unitsNeeded: units,
                urgencyLevel: urgency,
                hospitalName: ctx.name,
                hospitalId: ctx.id,
                hospitalCode: ctx.code,
                notes: notes || `Blood needed at ${ctx.name}`,
                status: 'pending',
                verificationStatus: 'approved',
                origin: 'hospital_admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const docRef = await firestore.collection('bloodRequests').add(requestData);
            await docRef.update({ id: docRef.id });

            // Log audit event
            if (window.auditLogs?.actions?.createBroadcastRequest) {
                window.auditLogs.actions.createBroadcastRequest(docRef.id, {
                    bloodType, units, urgency, hospitalName: ctx.name
                });
            }

            // Reset form
            if (document.getElementById('broadcastUnits')) document.getElementById('broadcastUnits').value = '1';
            if (document.getElementById('broadcastNotes')) document.getElementById('broadcastNotes').value = '';

            showNotification('Broadcast request created! Matching donors have been notified.', 'success');
        } catch (error) {
            console.error('Broadcast error:', error);
            showNotification('Failed to create broadcast', 'error');
        }
    };

    window.cancelBroadcast = async function (requestId) {
        try {
            await firestore.collection('bloodRequests').doc(requestId).update({
                status: 'cancelled',
                updatedAt: new Date().toISOString()
            });

            if (window.auditLogs?.actions?.cancelBroadcast) {
                window.auditLogs.actions.cancelBroadcast(requestId, { hospitalName: currentHospital?.name });
            }

            showNotification('Broadcast cancelled', 'success');
        } catch (error) {
            console.error('Cancel broadcast error:', error);
            showNotification('Failed to cancel broadcast', 'error');
        }
    };

    window.startChatWithUser = function (userId, userName) {
        if (!userId) {
            showNotification('User ID not available', 'error');
            return;
        }
        window.location.href = `/hospital/chat?targetId=${userId}&targetName=${encodeURIComponent(userName)}`;
    };

    // ── Helpers ───────────────────────────────────────────────────────
    function showNotification(message, type = 'info') {
        if (window.utils?.showNotification) {
            window.utils.showNotification(message, type);
        } else {
            console.log(`[Notification] ${type}: ${message}`);
            // Fallback to simple alert if utils not available (shouldn't happen)
            if (type === 'error') alert(message);
        }
    }

    async function createBookingNotification(userId, type, title, message) {
        if (!userId) return;
        try {
            const notifRef = firestore.collection('notifications').doc();
            await notifRef.set({
                id: notifRef.id,
                recipientId: userId,
                type: type,
                title: title,
                message: message,
                isRead: false,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.warn('Silent notification failure:', err);
        }
    }

    function updateStats() {
        const donorTotal = allDonorBookings.length;
        const recipientTotal = allRecipientBookings.length;
        const pending = allDonorBookings.filter(b => b.status === 'pending').length +
            allRecipientBookings.filter(b => b.status === 'pending').length;
        const completed = allDonorBookings.filter(b => b.status === 'completed').length +
            allRecipientBookings.filter(b => b.status === 'fulfilled').length;

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('statDonorTotal', donorTotal);
        el('statRecipientTotal', recipientTotal);
        el('statPending', pending);
        el('statCompleted', completed);
        el('donorCount', donorTotal);
        el('recipientCount', recipientTotal);
        el('broadcastCount', allBroadcastRequests.length);
    }

    function esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // Handle early initialization if auth is already ready
    if (window.hospitalData) {
        window.initializePage();
    }

})();
