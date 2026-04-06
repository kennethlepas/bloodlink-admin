// Referrals Management Module - Listing & Status Updates
(function () {
    'use strict';

    let state = {
        currentHospitalId: null,
        myHospital: null,
        activeTab: 'inbox',
        inboxList: [],
        outboxList: [],
        allHospitals: [],
        inboxListener: null,
        outboxListener: null,
        activeChatListener: null,
        currentReferralId: null,
        activeChatId: null,
        loading: true
    };

    function generateChatId(idA, idB) {
        return [idA, idB].sort().join('___');
    }

    const elements = {
        tableBody: document.getElementById('referralsTable'),
        tabInbox: document.getElementById('tabInbox'),
        tabOutbox: document.getElementById('tabOutbox'),
        badgeInbox: document.getElementById('badgeInbox'),
        badgeOutbox: document.getElementById('badgeOutbox'),
        badgeInboxTab: document.getElementById('badgeInboxTab'),
        resultCount: document.getElementById('resultCount'),
        searchInput: document.getElementById('referralSearch'),
        filterStatus: document.getElementById('filterStatus'),
        filterBlood: document.getElementById('filterBlood'),
        filterUrgency: document.getElementById('filterUrgency'),
        exportBtn: document.getElementById('exportBtn'),
        chatInput: document.getElementById('chatInput'),
        btnSendChat: document.getElementById('btnSendChat'),
        chatMessageList: document.getElementById('chatMessageList')
    };

    window.initializePage = async function () {
        console.log('🔗 Initializing Referrals List Module...');

        // Use global hospitalData from hospital/base.html
        if (window.hospitalData) {
            state.currentHospitalId = window.hospitalData.id || window.hospitalData.facilityCode;
            state.myHospital = window.hospitalData;
        }

        // Safety timeout for loading state
        setTimeout(() => {
            if (state.loading) {
                console.warn('⏱ Referral data fetch timed out. Showing empty state.');
                state.loading = false;
                renderTable();
            }
        }, 5000);

        if (!state.currentHospitalId) {
            console.warn('Waiting for hospital data...');
            setTimeout(window.initializePage, 500);
            return;
        }

        setupEventListeners();

        subscribeInbox();
        subscribeOutbox();

        console.log('✅ Referrals List Module ready');

        // Handle URL parameters (e.g., from Hospital Directory)
        const params = new URLSearchParams(window.location.search);
        const targetCode = params.get('to');
        if (targetCode) {
            openNewReferralModal(targetCode);
        }
    };

    function setupEventListeners() {
        if (elements.tabInbox) elements.tabInbox.onclick = () => switchTab('inbox');
        if (elements.tabOutbox) elements.tabOutbox.onclick = () => switchTab('outbox');

        const filterHandler = () => renderTable();
        [elements.searchInput, elements.filterStatus, elements.filterBlood, elements.filterUrgency].forEach(el => {
            if (el) {
                el.addEventListener('input', filterHandler);
                el.addEventListener('change', filterHandler);
            }
        });

        if (elements.exportBtn) elements.exportBtn.onclick = exportCSV;
        if (elements.btnSendChat) elements.btnSendChat.onclick = sendChatMessage;
        if (elements.chatInput) {
            elements.chatInput.onkeypress = (e) => {
                if (e.key === 'Enter') sendChatMessage();
            };
        }
    }

    function subscribeInbox() {
        if (state.inboxListener) state.inboxListener();

        const myIdentifiers = [
            state.currentHospitalId,
            state.myHospital?.name,
            state.myHospital?.facilityCode,
            state.myHospital?.code
        ].filter(Boolean);

        state.inboxListener = firestore.collection('hospital_referrals')
            .where('toHospitalId', 'in', myIdentifiers)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                state.inboxList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                state.loading = false;
                if (state.activeTab === 'inbox') renderTable();
                updateStats();
            }, err => {
                console.error('Inbox subscribe error:', err);
                state.loading = false;
                renderTable();
            });
    }

    function subscribeOutbox() {
        if (state.outboxListener) state.outboxListener();

        const myIdentifiers = [
            state.currentHospitalId,
            state.myHospital?.name,
            state.myHospital?.facilityCode,
            state.myHospital?.code
        ].filter(Boolean);

        state.outboxListener = firestore.collection('hospital_referrals')
            .where('fromHospitalId', 'in', myIdentifiers)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                state.outboxList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                state.loading = false;
                if (state.activeTab === 'outbox') renderTable();
                updateStats();
            }, err => {
                console.error('Outbox subscribe error:', err);
                state.loading = false;
                renderTable();
            });
    }

    function switchTab(tab) {
        state.activeTab = tab;
        elements.tabInbox?.classList.toggle('active', tab === 'inbox');
        elements.tabOutbox?.classList.toggle('active', tab === 'outbox');
        if (document.getElementById('thPeer')) {
            document.getElementById('thPeer').textContent = tab === 'inbox' ? 'From' : 'To';
        }
        renderTable();
    }

    function updateStats() {
        if (elements.badgeInbox) elements.badgeInbox.textContent = state.inboxList.length;
        if (elements.badgeOutbox) elements.badgeOutbox.textContent = state.outboxList.length;

        const pendingCount = state.inboxList.filter(r => r.status === 'pending').length;
        if (elements.badgeInboxTab) {
            elements.badgeInboxTab.textContent = pendingCount;
            elements.badgeInboxTab.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
    }

    function renderTable() {
        const tableBody = document.getElementById('referralsTable'); // Corrected ID
        if (!tableBody) return;
        const search = elements.searchInput?.value.toLowerCase() || '';
        const fStatus = elements.filterStatus?.value || 'all';
        const fBlood = elements.filterBlood?.value || 'all';
        const fUrg = elements.filterUrgency?.value || 'all';

        const rows = state.activeTab === 'inbox' ? state.inboxList : state.outboxList;

        let filtered = rows.filter(r => {
            const matchS = fStatus === 'all' || r.status === fStatus;
            const matchB = fBlood === 'all' || r.bloodType === fBlood || fBlood === 'All Blood Types';
            const matchU = fUrg === 'all' || r.urgency === fUrg;
            const matchQ = !search ||
                (r.patientName || '').toLowerCase().includes(search) ||
                (r.bloodType || '').toLowerCase().includes(search) ||
                (state.activeTab === 'inbox' ? (r.fromHospitalName || '') : (r.toHospitalName || '')).toLowerCase().includes(search);
            return matchS && matchB && matchU && matchQ;
        });

        if (elements.resultCount) elements.resultCount.textContent = `${filtered.length} results`;

        if (!elements.tableBody) return;

        if (state.loading) {
            elements.tableBody.innerHTML = `
                <tr class="skeleton-row"><td colspan="9"><div class="skeleton" style="height:52px;margin:4px 0;border-radius:8px;opacity:0.6;"></div></td></tr>
                <tr class="skeleton-row"><td colspan="9"><div class="skeleton" style="height:52px;margin:4px 0;border-radius:8px;opacity:0.4;"></div></td></tr>
                <tr class="skeleton-row"><td colspan="9"><div class="skeleton" style="height:52px;margin:4px 0;border-radius:8px;opacity:0.2;"></div></td></tr>
            `;
            return;
        }

        if (filtered.length === 0) {
            const isFiltering = search || fStatus !== 'all' || fBlood !== 'all' || fUrg !== 'all';
            const msg = isFiltering
                ? `No referrals found matching "${escapeHtml(search || fStatus || fBlood || fUrg)}"`
                : `No ${state.activeTab} referrals yet.`;
            elements.tableBody.innerHTML = `<tr><td colspan="9" class="empty-row" style="text-align:center;padding:60px;color:rgba(255,255,255,0.3);font-size:14px;">${msg}</td></tr>`;
            return;
        }

        elements.tableBody.innerHTML = filtered.map(r => {
            const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-KE') : (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—');
            const urgClass = `urg-${r.urgency || 'standard'}`;
            const stClass = `dot-${r.status || 'pending'}`;
            const peer = state.activeTab === 'inbox' ? (r.fromHospitalName || 'Unknown') : (r.toHospitalName || 'Unknown');

            return `
                <tr class="clickable-row" onclick="viewReferralDetail('${r.id}')">
                    <td><span class="id-chip">${r.id.slice(-6).toUpperCase()}</span></td>
                    <td>
                        <div class="person-cell">
                            <span class="person-name">${escapeHtml(r.patientName)}</span>
                            <span class="person-sub">${state.activeTab === 'inbox' ? 'From' : 'To'}: ${escapeHtml(peer)}</span>
                        </div>
                    </td>
                    <td><span class="blood-badge">${r.bloodType || '?'}</span></td>
                    <td><span class="urg-badge ${urgClass}">${(r.urgency || 'standard').toUpperCase()}</span></td>
                    <td class="hide-mobile">${escapeHtml((r.reason || '').substring(0, 40))}${r.reason?.length > 40 ? '...' : ''}</td>
                    <td>${date}</td>
                    <td>
                        <span class="status-dot ${stClass}"></span>
                        <span class="status-label">${r.status}</span>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="event.stopPropagation(); viewReferralDetail('${r.id}', true)">💬</button>
                    </td>
                    <td>
                        <div class="action-row" onclick="event.stopPropagation()">
                            <button class="btn-icon" title="View details" onclick="viewReferralDetail('${r.id}')">👁</button>
                            ${state.activeTab === 'inbox' && r.status === 'pending' ? `
                                <button class="btn-icon green" title="Accept" onclick="updateReferralStatus('${r.id}', 'accepted')">✔</button>
                                <button class="btn-icon red" title="Decline" onclick="updateReferralStatus('${r.id}', 'declined')">✖</button>
                            ` : ''}
                            ${state.activeTab === 'inbox' && r.status === 'accepted' ? `
                                <button class="btn-icon blue" title="Mark complete" onclick="updateReferralStatus('${r.id}', 'completed')">🎯</button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.updateReferralStatus = async function (id, status) {
        try {
            await firestore.collection('hospital_referrals').doc(id).update({
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.logActionEvent(
                    `update_referral_status`,
                    'blood_request',
                    id,
                    { newStatus: status, hospitalName: state.myHospital?.name }
                );
            }

            // Post system message to chat
            await firestore.collection('hospital_referrals').doc(id).collection('messages').add({
                text: `Referral ${status} by ${state.myHospital?.name}`,
                type: 'system',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            window.utils.showNotification(`Referral marked as ${status}`, 'success');

            // 🏆 New: Trigger notification for the other side (patient/hospital)
            try {
                // To trigger mobile notification, we add a doc to the 'notifications' collection
                // The mobile app should have a listener or we can use the createNotification pattern
                // Since this is JS, we use firestore directly
                const referralSnap = await firestore.collection('hospital_referrals').doc(id).get();
                const refData = referralSnap.data();

                // Determine recipient: If I am receiving, notify sender. If I am sender, notify receiver.
                // But specifically for hospital referrals, the PATIENT also needs to know.
                // And the OTHER hospital needs to know.

                const recId = status === 'pending' ? refData.toHospitalId : refData.fromHospitalId;

                await firestore.collection('notifications').add({
                    userId: recId,
                    type: 'system_alert',
                    title: `Referral ${status.toUpperCase()}`,
                    message: `Referral for ${refData.patientName} has been ${status} by ${state.myHospital?.name}`,
                    data: { referralId: id, status },
                    isRead: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (notifErr) {
                console.warn('Failed to send referral update notification:', notifErr);
            }

            closeReferralDetail();
        } catch (e) {
            console.error('updateStatus:', e);
            window.utils.showNotification('Failed to update status', 'error');
        }
    };

    window.viewReferralDetail = function (id) {
        const list = [...state.inboxList, ...state.outboxList];
        const r = list.find(x => x.id === id);
        if (!r) return;

        const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '—';
        const modal = document.getElementById('referralDetailModal');
        const content = document.getElementById('referralDetailContent');
        const actions = document.getElementById('referralDetailActions');
        const subtitle = document.getElementById('detailSubtitle');

        if (subtitle) subtitle.textContent = `ID: ${r.id.toUpperCase()}`;

        content.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px;">
                <div>
                    <h4 style="color:rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase;">Medical Info</h4>
                    <p><strong>Patient:</strong> ${escapeHtml(r.patientName)}</p>
                    <p><strong>Blood Type:</strong> ${r.bloodType}</p>
                    <p><strong>Units:</strong> ${r.units || 'N/A'}</p>
                    <p><strong>Urgency:</strong> <span class="urg-badge urg-${r.urgency}">${r.urgency.toUpperCase()}</span></p>
                </div>
                <div>
                    <h4 style="color:rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase;">Routing</h4>
                    <p><strong>From:</strong> ${escapeHtml(r.fromHospitalName)}</p>
                    <p><strong>To:</strong> ${escapeHtml(r.toHospitalName)}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Status:</strong> <span class="status-label">${r.status.toUpperCase()}</span></p>
                </div>
                <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 10px;">
                    <h4 style="color:rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase;">Reason / Clinical Notes</h4>
                    <p>${escapeHtml(r.reason)}</p>
                    ${r.notes ? `<p style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><strong>Notes:</strong> ${escapeHtml(r.notes)}</p>` : ''}
                </div>
            </div>
        `;

        const isInbox = r.toHospitalId === state.currentHospitalId || r.toHospitalName === state.myHospital?.name;

        actions.innerHTML = `
            <button class="btn-secondary" onclick="closeReferralDetail()">Close</button>
            ${isInbox && r.status === 'pending' ? `
                <button class="btn-danger" onclick="updateReferralStatus('${id}', 'declined')">Decline</button>
                <button class="btn-primary" onclick="updateReferralStatus('${id}', 'accepted')">Accept Referral</button>
            ` : ''}
            ${statusActions(r, isInbox)}
        `;

        modal.classList.remove('hidden');

        // Load Chat
        state.currentReferralId = id;
        loadReferralChat(id);
    };

    function statusActions(r, isInbox) {
        if (isInbox && r.status === 'accepted') {
            return `<button class="btn-primary" style="background:#8B5CF6;" onclick="updateReferralStatus('${r.id}', 'completed')">Mark Completed</button>`;
        }
        return '';
    }

    // ========== Chat Logic ==========

    async function loadReferralChat(referralId) {
        if (state.activeChatListener) state.activeChatListener();

        const list = [...state.inboxList, ...state.outboxList];
        const r = list.find(x => x.id === referralId);
        if (!r) return;

        const otherId = r.fromHospitalId === state.currentHospitalId ? r.toHospitalId : r.fromHospitalId;
        state.activeChatId = generateChatId(state.currentHospitalId, otherId);

        const chatList = elements.chatMessageList;
        if (chatList) chatList.innerHTML = '<div class="chat-loading">Loading discussion...</div>';

        // Listen to global messages collection filtered by referralId
        state.activeChatListener = firestore.collection('messages')
            .where('chatId', '==', state.activeChatId)
            .where('referralId', '==', referralId)
            .orderBy('timestamp', 'asc')
            .onSnapshot(snap => {
                if (!chatList) return;

                if (snap.empty) {
                    chatList.innerHTML = '<div class="chat-empty">No messages yet. Start the coordination below.</div>';
                    return;
                }

                chatList.innerHTML = snap.docs.map(doc => {
                    const m = doc.data();
                    const isMe = m.senderId === state.currentHospitalId;
                    const time = m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    if (m.type === 'system') {
                        return `<div class="chat-system"><em>${escapeHtml(m.message || m.text)}</em></div>`;
                    }

                    return `
                        <div class="chat-bubble-wrap ${isMe ? 'sent' : 'received'}">
                            <div class="chat-sender-name">${escapeHtml(m.senderName)}</div>
                            <div class="chat-bubble">${escapeHtml(m.message || m.text)}</div>
                            <div class="chat-time">${time}</div>
                        </div>
                    `;
                }).join('');

                chatList.scrollTop = chatList.scrollHeight;
            });
    }

    async function sendChatMessage() {
        const text = elements.chatInput.value.trim();
        if (!text || !state.currentReferralId || !state.activeChatId) return;

        elements.chatInput.value = '';

        try {
            const list = [...state.inboxList, ...state.outboxList];
            const r = list.find(x => x.id === state.currentReferralId);
            const otherId = r.fromHospitalId === state.currentHospitalId ? r.toHospitalId : r.fromHospitalId;
            const otherName = r.fromHospitalId === state.currentHospitalId ? r.toHospitalName : r.fromHospitalName;

            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const messageId = `msg_${state.activeChatId}_${Date.now()}`;

            // 1. Send to global messages collection
            await firestore.collection('messages').doc(messageId).set({
                id: messageId,
                chatId: state.activeChatId,
                referralId: state.currentReferralId,
                senderId: state.currentHospitalId || 'unknown',
                senderName: state.myHospital?.name || 'Admin',
                receiverId: otherId,
                message: text,
                timestamp: timestamp,
                isRead: false,
                type: 'text'
            });

            // 2. Ensure chat doc exists and update metadata
            await firestore.collection('chats').doc(state.activeChatId).set({
                id: state.activeChatId,
                participants: [state.currentHospitalId, otherId],
                participantNames: {
                    [state.currentHospitalId]: state.myHospital?.name || 'Admin',
                    [otherId]: otherName
                },
                lastMessage: text,
                lastMessageTime: timestamp,
                updatedAt: timestamp,
                referralId: state.currentReferralId // Link last referral
            }, { merge: true });

            // 3. Update unread count for other party
            await firestore.collection('chats').doc(state.activeChatId).update({
                [`unreadCount.${otherId}`]: firebase.firestore.FieldValue.increment(1)
            });

        } catch (err) {
            console.error('Chat error:', err);
            window.utils.showNotification('Failed to send message', 'error');
        }
    }

    // ========== New Referral Logic ==========

    window.openNewReferralModal = async function (prefillTargetCode = null) {
        const modal = document.getElementById('newReferralModal');
        const select = document.getElementById('targetHospital');

        if (!modal || !select) return;

        // Load hospitals if needed
        if (state.allHospitals.length === 0) {
            try {
                const snap = await firestore.collection('hospitals').get();
                state.allHospitals = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(h => h.facilityCode !== state.myHospital?.facilityCode);

                select.innerHTML = '<option value="">Select a hospital...</option>' +
                    state.allHospitals.map(h => `<option value="${h.facilityCode}">${h.name} (${h.county})</option>`).join('');
            } catch (err) {
                console.error('Hospitals fetch error:', err);
            }
        }

        if (prefillTargetCode) {
            select.value = prefillTargetCode;
        }

        modal.classList.remove('hidden');
    };

    window.closeNewReferralModal = function () {
        document.getElementById('newReferralModal').classList.add('hidden');
        document.getElementById('newReferralForm').reset();
    };

    window.handleReferralSubmit = async function (e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitReferral');
        btn.disabled = true;
        btn.textContent = 'Initiating...';

        const targetCode = document.getElementById('targetHospital').value;
        const targetHospital = state.allHospitals.find(h => h.facilityCode === targetCode);

        const data = {
            patientName: document.getElementById('patientName').value,
            bloodType: document.getElementById('bloodType').value,
            units: parseInt(document.getElementById('units').value),
            urgency: document.getElementById('urgency').value,
            reason: document.getElementById('reason').value,
            toHospitalId: targetCode,
            toHospitalName: targetHospital?.name || 'Unknown',
            fromHospitalId: state.currentHospitalId,
            fromHospitalName: state.myHospital?.name || 'Unknown',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const initialMsg = document.getElementById('initialMessage').value.trim();

        try {
            const ref = await firestore.collection('hospital_referrals').add(data);
            const referralId = ref.id;

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.logActionEvent(
                    'initiate_referral',
                    'blood_request',
                    referralId,
                    {
                        patientName: data.patientName,
                        toHospital: data.toHospitalName,
                        fromHospital: data.fromHospitalName,
                        bloodType: data.bloodType
                    }
                );
            }
            const chatId = generateChatId(data.fromHospitalId, data.toHospitalId);

            // Helper to send message to global collection
            const sendGlobal = async (text, type = 'text', senderId = null, senderName = null) => {
                const mid = `msg_${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                await firestore.collection('messages').doc(mid).set({
                    id: mid,
                    chatId: chatId,
                    referralId: referralId,
                    senderId: senderId || data.fromHospitalId,
                    senderName: senderName || data.fromHospitalName,
                    receiverId: data.toHospitalId,
                    message: text,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    type: type
                });
            };

            // 1. Add initial system message to global messages
            await sendGlobal(`Referral initiated by ${data.fromHospitalName}`, 'system');

            // 2. Add clinical reason as first message if provided
            if (data.reason) {
                await sendGlobal(`Clinical Reason: ${data.reason}`);
            }

            if (initialMsg) {
                await sendGlobal(initialMsg);
            }

            // 3. Ensure chat metadata exists
            await firestore.collection('chats').doc(chatId).set({
                id: chatId,
                participants: [data.fromHospitalId, data.toHospitalId],
                participantNames: {
                    [data.fromHospitalId]: data.fromHospitalName,
                    [data.toHospitalId]: data.toHospitalName
                },
                lastMessage: initialMsg || `Referral initiated for ${data.patientName}`,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                referralId: referralId
            }, { merge: true });

            // 4. Update unread count for receiver
            await firestore.collection('chats').doc(chatId).update({
                [`unreadCount.${data.toHospitalId}`]: firebase.firestore.FieldValue.increment(1)
            });

            window.utils.showNotification('Referral sent successfully!', 'success');
            closeNewReferralModal();
            viewReferralDetail(referralId);
        } catch (err) {
            console.error('Referral error:', err);
            window.utils.showNotification('Failed to send referral', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Initiate Referral';
        }
    };

    window.closeReferralDetail = function () {
        document.getElementById('referralDetailModal').classList.add('hidden');
    };

    function exportCSV() {
        const rows = state.activeTab === 'inbox' ? state.inboxList : state.outboxList;
        if (rows.length === 0) {
            window.utils.showNotification('No data to export', 'info');
            return;
        }
        const headers = ['ID', 'Patient', 'Blood Type', 'Urgency', 'From', 'To', 'Status', 'Date', 'Reason'];
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => [
                r.id,
                `"${r.patientName}"`,
                r.bloodType,
                r.urgency,
                `"${r.fromHospitalName}"`,
                `"${r.toHospitalName}"`,
                r.status,
                r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : '',
                `"${(r.reason || '').replace(/"/g, '""')}"`
            ].join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `referrals_${state.activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
