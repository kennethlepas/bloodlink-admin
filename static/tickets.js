/**
 * Support Tickets (Disputes & Inquiries) Module
 * Handles real-time ticket management for Super Admins.
 */
(function () {
    'use strict';

    let allTickets = [];
    let activeTicket = null;
    let messageListener = null;

    // DOM Elements
    let elements = {
        list: null,
        detail: null,
        search: null,
        statusFilter: null
    };

    // Initialize
    window.initializeTickets = async function () {
        console.log('🎫 Initializing Support Tickets System...');
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase is not defined! Check script loading order.');
            return;
        }

        // Update elements mapping
        elements.list = document.getElementById('ticketList');
        elements.detail = document.getElementById('ticketDetailView');
        elements.search = document.getElementById('ticketSearch');
        elements.statusFilter = document.getElementById('statusFilter');

        setupEventListeners();
        listenForTickets();
        updateTicketBadge();

        // Check for URL parameters (Automated Dispute Flow)
        const params = new URLSearchParams(window.location.search);
        if (params.get('autoOpen') === 'true') {
            const entityId = params.get('entityId');
            const entityType = params.get('entityType');
            openNewTicketModal(entityId, entityType);
        }

        // Hide loader once initial setup is done
        if (window.hidePageLoader) {
            window.hidePageLoader();
        }
    };

    function setupEventListeners() {
        const searchInput = document.getElementById('ticketSearch');
        const statusSelect = document.getElementById('statusFilter');

        if (searchInput) {
            searchInput.addEventListener('input', filterTickets);
        }
        if (statusSelect) {
            statusSelect.addEventListener('change', filterTickets);
        }
    }

    // Modal Logic
    window.openNewTicketModal = function (entityId = null, entityType = null) {
        console.log('🔓 Opening New Ticket Modal (Entity:', entityId, 'Type:', entityType, ')');
        const modal = document.getElementById('newTicketModal');
        if (!modal) {
            console.error('❌ Could not find newTicketModal element');
            return;
        }

        modal.classList.add('show');
        const form = document.getElementById('newTicketForm');
        if (form) form.reset();

        const relatedIdInput = document.getElementById('relatedEntityId');
        const relatedTypeInput = document.getElementById('relatedEntityType');
        const ticketTypeSelect = document.getElementById('ticketType');
        const disputeFields = document.getElementById('disputeFields');
        const subjectInput = document.getElementById('ticketSubject');

        if (entityId && relatedIdInput && relatedTypeInput && ticketTypeSelect && disputeFields) {
            ticketTypeSelect.value = 'dispute';
            disputeFields.classList.remove('hidden');
            relatedIdInput.value = entityId;
            relatedTypeInput.value = entityType || 'booking';
            if (subjectInput) {
                subjectInput.value = `Dispute regarding ${entityType || 'booking'} #${entityId.substring(0, 8)}`;
            }
        }
    };

    window.closeNewTicketModal = function () {
        document.getElementById('newTicketModal').classList.remove('show');
    };

    window.toggleDisputeFields = function (type) {
        const fields = document.getElementById('disputeFields');
        if (type === 'dispute') {
            fields.classList.remove('hidden');
        } else {
            fields.classList.add('hidden');
        }
    };

    window.submitNewTicket = async function () {
        const form = document.getElementById('newTicketForm');
        const submitBtn = document.querySelector('#newTicketModal .btn-primary');

        const type = document.getElementById('ticketType').value;
        const subject = document.getElementById('ticketSubject').value.trim();
        const priority = document.getElementById('ticketPriority').value;
        const targetUser = document.getElementById('targetUser').value.trim();
        const initialMsg = document.getElementById('initialMsg').value.trim();
        const entityId = document.getElementById('relatedEntityId').value.trim();
        const entityType = document.getElementById('relatedEntityType').value;

        if (!subject || !targetUser || !initialMsg) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            const batch = firestore.batch();
            const ticketRef = firestore.collection('tickets').doc();
            const msgRef = firestore.collection('ticketMessages').doc();
            const myName = auth.currentUser?.displayName || 'Super Admin';

            const ticketData = {
                id: ticketRef.id,
                type,
                subject,
                priority,
                status: 'open',
                userName: targetUser, // Ideally resolve to actual name later
                userEmail: targetUser.includes('@') ? targetUser : '',
                userId: targetUser.includes('@') ? '' : targetUser,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: initialMsg,
                isReadByUser: true, // Started by admin
                isResolved: false
            };

            if (type === 'dispute' && entityId) {
                ticketData.relatedEntityId = entityId;
                ticketData.relatedEntityType = entityType || 'booking';
            }

            batch.set(ticketRef, ticketData);

            batch.set(msgRef, {
                id: msgRef.id,
                ticketId: ticketRef.id,
                message: initialMsg,
                senderId: auth.currentUser.uid,
                senderName: myName,
                senderType: 'admin',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isRead: false
            });

            await batch.commit();

            showNotification('Support ticket created successfully', 'success');
            closeNewTicketModal();
            window.selectTicket(ticketRef.id);

        } catch (error) {
            console.error('Error creating ticket:', error);
            showNotification('Failed to create ticket', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Ticket';
        }
    };

    function listenForTickets() {
        // Listen for all tickets
        firestore.collection('tickets')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                filterTickets();
                updateTicketBadge();
            }, error => {
                console.error('Error listening for tickets:', error);
                elements.list.innerHTML = `<div class="error-state">Failed to load tickets: ${error.message}</div>`;
            });
    }

    function filterTickets() {
        const term = elements.search?.value.toLowerCase() || '';
        const status = elements.statusFilter?.value || 'all';

        let filtered = allTickets;

        if (status !== 'all') {
            filtered = filtered.filter(t => t.status === status);
        }

        if (term) {
            filtered = filtered.filter(t =>
                t.subject?.toLowerCase().includes(term) ||
                t.id.toLowerCase().includes(term) ||
                t.userName?.toLowerCase().includes(term)
            );
        }

        renderTicketList(filtered);
    }

    function renderTicketList(tickets) {
        if (tickets.length === 0) {
            elements.list.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center;">No tickets found matching filters.</div>';
            return;
        }

        elements.list.innerHTML = tickets.map(ticket => {
            const isActive = activeTicket?.id === ticket.id;
            const statusClass = ticket.status.toLowerCase();
            const date = ticket.createdAt ? formatRelativeDate(ticket.createdAt) : 'Just now';

            return `
                <div class="ticket-item ${isActive ? 'active' : ''}" onclick="window.selectTicket('${ticket.id}')">
                    <div class="ticket-item-header">
                        <span class="ticket-id">#${ticket.id.substring(0, 8)}</span>
                        <span class="badge badge-status ${statusClass}" style="transform: scale(0.8);">${ticket.status.replace('_', ' ')}</span>
                    </div>
                    <div class="ticket-subject">${ticket.subject || 'No Subject'}</div>
                    <div class="ticket-meta">
                        <span class="meta-priority priority-${ticket.priority?.toLowerCase() || 'medium'}">• ${ticket.priority || 'Medium'}</span>
                        <span class="meta-time">${date}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.selectTicket = async function (id) {
        const ticket = allTickets.find(t => t.id === id);
        if (!ticket) return;

        activeTicket = ticket;
        renderTicketList(allTickets); // Update active state in list

        // Render detailed view from template
        const template = document.getElementById('ticketDetailTemplate');
        const clone = template.content.cloneNode(true);

        // Fill data
        clone.querySelector('#viewSubject').textContent = ticket.subject;

        const statusEl = clone.querySelector('#viewStatus');
        statusEl.textContent = ticket.status.replace('_', ' ').toUpperCase();
        statusEl.className = `badge badge-status ${ticket.status.toLowerCase()}`;

        clone.querySelector('#viewPriority').textContent = ticket.priority;
        clone.querySelector('#viewType').textContent = ticket.type;

        clone.querySelector('#viewUserName').textContent = ticket.userName || 'Anonymous';
        clone.querySelector('#viewUserEmail').textContent = ticket.userEmail || '-';
        clone.querySelector('#viewUserPhone').textContent = ticket.userPhone || '-';

        // Check for related entity
        const entitySection = clone.querySelector('#relatedEntitySection');
        if (ticket.relatedEntityId) {
            entitySection.style.display = 'block';
            const entityDetails = clone.querySelector('#entityDetails');
            entityDetails.innerHTML = `
                <div class="meta-row">
                    <span class="meta-label">Type</span>
                    <span class="meta-value">${ticket.relatedEntityType || 'Record'}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">ID</span>
                    <span class="meta-value" style="font-family: monospace; font-size: 11px;">#${ticket.relatedEntityId.substring(0, 12)}</span>
                </div>
            `;

            clone.querySelector('#viewEntityBtn').onclick = () => viewRelatedRecord(ticket);
        } else {
            entitySection.style.display = 'none';
        }

        // Setup Actions
        const assignBtn = clone.querySelector('#assignBtn');
        if (ticket.assignedAdminId === auth.currentUser?.uid) {
            assignBtn.textContent = 'Assigned to You';
            assignBtn.disabled = true;
            assignBtn.style.opacity = '0.7';
        } else if (ticket.assignedAdminId) {
            assignBtn.textContent = `Assigned to Admin`;
            assignBtn.disabled = true;
        }

        elements.detail.innerHTML = '';
        elements.detail.appendChild(clone);

        // Load Messages
        listenForMessages(id);
        loadAuditLog(id);
    };

    function listenForMessages(ticketId) {
        if (messageListener) messageListener();

        const msgList = document.getElementById('messageList');

        messageListener = firestore.collection('ticketMessages')
            .where('ticketId', '==', ticketId)
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => doc.data());
                renderMessages(messages);
            });
    }

    function renderMessages(messages) {
        const msgList = document.getElementById('messageList');
        if (!msgList) return;

        if (messages.length === 0) {
            msgList.innerHTML = '<div style="margin: auto; color: var(--text-secondary); font-size: 13px;">No messages yet.</div>';
            return;
        }

        msgList.innerHTML = messages.map(msg => {
            const isAdmin = msg.senderType === 'admin';
            const time = msg.createdAt ? formatTime(msg.createdAt) : 'Just now';
            return `
                <div class="message ${isAdmin ? 'admin' : 'user'}">
                    <div class="message-info">${msg.senderName || (isAdmin ? 'Admin' : 'User')} • ${time}</div>
                    <div class="message-content">${escapeHtml(msg.message)}</div>
                </div>
            `;
        }).join('');

        msgList.scrollTop = msgList.scrollHeight;
    }

    window.handleReply = async function () {
        const textarea = document.getElementById('replyText');
        const statusSelect = document.getElementById('updateStatusTo');
        const text = textarea?.value.trim();

        if (!text || !activeTicket) return;

        try {
            const batch = firestore.batch();
            const msgRef = firestore.collection('ticketMessages').doc();
            const myName = auth.currentUser?.displayName || 'Super Admin';

            // 1. Add message
            batch.set(msgRef, {
                id: msgRef.id,
                ticketId: activeTicket.id,
                message: text,
                senderId: auth.currentUser.uid,
                senderName: myName,
                senderType: 'admin',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isRead: false
            });

            // 2. Update ticket metadata
            const updateData = {
                lastMessage: text,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isReadByUser: false
            };

            const newStatus = statusSelect.value;
            if (newStatus !== 'no_change') {
                updateData.status = newStatus;

                // Add to audit log
                const auditRef = firestore.collection('ticketAuditLogs').doc();
                batch.set(auditRef, {
                    id: auditRef.id,
                    ticketId: activeTicket.id,
                    action: 'STATUS_CHANGE',
                    from: activeTicket.status,
                    to: newStatus,
                    adminId: auth.currentUser.uid,
                    adminName: myName,
                    notes: `Status changed to ${newStatus}`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            batch.update(firestore.collection('tickets').doc(activeTicket.id), updateData);

            await batch.commit();
            textarea.value = '';
            showNotification('Reply sent successfully', 'success');

            // If status changed to resolved, maybe highlight it
            if (newStatus === 'resolved') {
                showNotification('Ticket marked as resolved', 'success');
            }

        } catch (error) {
            console.error('Error sending reply:', error);
            showNotification('Failed to send reply', 'error');
        }
    };

    window.assignToMe = async function (id) {
        try {
            await firestore.collection('tickets').doc(id).update({
                assignedAdminId: auth.currentUser.uid,
                assignedAdminName: auth.currentUser.displayName || 'Super Admin',
                status: 'under_review',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showNotification('Ticket assigned to you', 'success');
        } catch (error) {
            console.error('Error assigning ticket:', error);
            showNotification('Failed to assign ticket', 'error');
        }
    };

    async function loadAuditLog(id) {
        const auditEl = document.getElementById('auditLog');
        if (!auditEl) return;

        try {
            const snap = await firestore.collection('ticketAuditLogs')
                .where('ticketId', '==', id)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            if (snap.empty) {
                auditEl.innerHTML = 'No recent activity recorded.';
                return;
            }

            auditEl.innerHTML = snap.docs.map(doc => {
                const data = doc.data();
                const time = data.createdAt ? formatRelativeDate(data.createdAt) : 'Just now';
                return `<div style="margin-bottom: 8px;"><strong>${data.action}</strong> by ${data.adminName || 'Admin'}<br><span style="color: grey;">${data.notes || ''} • ${time}</span></div>`;
            }).join('');
        } catch (e) { console.warn('Audit log load error:', e); }
    }

    function viewRelatedRecord(ticket) {
        if (!ticket.relatedEntityId) return;

        let path = '';
        if (ticket.relatedEntityType === 'blood_request') {
            path = `/requests?search=${ticket.relatedEntityId}`;
        } else if (ticket.relatedEntityType === 'accepted_request' || ticket.relatedEntityType === 'booking') {
            path = `/bookings?search=${ticket.relatedEntityId}`;
        } else if (ticket.relatedEntityType === 'user' || ticket.relatedEntityType === 'donor') {
            path = `/users?search=${ticket.relatedEntityId}`;
        }

        if (path) window.location.href = path;
    }

    async function updateTicketBadge() {
        const badge = document.getElementById('ticketBadge');
        if (!badge) return;

        const openCount = allTickets.filter(t => t.status === 'open').length;
        if (openCount > 0) {
            badge.textContent = openCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // Helpers
    function formatTime(val) {
        if (!val) return '';
        const d = val.toDate ? val.toDate() : new Date(val);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatRelativeDate(val) {
        if (!val) return '';
        const d = val.toDate ? val.toDate() : new Date(val);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return d.toLocaleDateString();
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
