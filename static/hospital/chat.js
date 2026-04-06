// ============================================================
// BloodLink — Hospital Admin Chat Module  (hospital/chat.js)
// Fixed: canonical chatId, real-time onSnapshot, message field,
//        hospital-scoped identity, isolated per-hospital contacts
// ============================================================
(function () {
  'use strict';

  let state = {
    myId: null,              // always auth.currentUser.uid (hospital's UID)
    myName: 'Hospital Admin',
    activeChatId: null,
    activeContactId: null,
    activeContactName: null,
    contacts: [],
    msgListener: null,
    chatListener: null,
    initialized: false,
  };

  const el = {
    chatWindow: () => document.getElementById('chatMessages'),
    chatInput: () => document.getElementById('chatInput'),
    sendBtn: () => document.getElementById('sendMessageBtn'),
    contactList: () => document.getElementById('chatContacts'),
    contactSearch: () => document.getElementById('contactSearch'),
  };

  // ─── Public init ────────────────────────────────────────────
  window.initializePage = window.initializeChat = async function () {
    console.log('🏥 Hospital Chat — init');
    state.myId = auth.currentUser?.uid;
    const h = window.hospitalData || {};
    state.myName = h.hospitalName || h.name || 'Hospital Admin';

    if (window.updateHospitalSidebar && window.hospitalData) {
      window.updateHospitalSidebar(window.hospitalData);
    }

    if (!state.myId) { console.error('No auth UID'); return; }

    setupListeners();
    await loadContacts();
    subscribeToMyChats();

    const p = new URLSearchParams(window.location.search);
    if (p.has('targetId') && p.has('targetName')) {
      selectContact(p.get('targetId'), p.get('targetName'));
    } else if (state.contacts.length > 0) {
      const first = state.contacts[0];
      selectContact(first.id, first.name);
    }
  };

  // ─── Canonical chat ID (matches mobile app exactly) ─────────
  function canonicalChatId(idA, idB, role) {
    const sorted = [idA, idB].sort().join('___');
    return role ? `${sorted}___${role}` : sorted;
  }

  // ─── Event listeners (run once) ─────────────────────────────
  function setupListeners() {
    if (state.initialized) return;
    state.initialized = true;

    el.sendBtn()?.addEventListener('click', () => {
      const text = el.chatInput()?.value.trim();
      if (text) sendMessage(text);
    });

    el.chatInput()?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = el.chatInput().value.trim();
        if (text) sendMessage(text);
      }
    });

    el.contactSearch()?.addEventListener('input', (e) => {
      renderContacts(e.target.value.toLowerCase().trim());
    });
  }

  // ─── Load contacts ───────────────────────────────────────────
  // Hospital admins see: super admins + users who have already
  // chatted with THIS hospital (discovered from chats collection).
  // They do NOT see other hospitals' contacts.
  async function loadContacts() {
    try {
      const seen = new Set([state.myId]);
      const contacts = [];

      // 1. Always include super admins
      const adminSnap = await firestore.collection('users')
        .where('userType', 'in', ['admin', 'super_admin']).get();
      adminSnap.forEach(d => {
        const data = d.data();
        const uid = data.uid || d.id;
        // Strict self-exclusion (UID and Email)
        if (uid === state.myId || data.email === auth.currentUser?.email) return;
        if (seen.has(uid)) return;
        seen.add(uid);
        contacts.push({
          id: uid,
          name: data.name || 'BloodLink HQ',
          type: data.userType,
          isAdmin: true,
          email: data.email || '',
          unreadCount: 0,
          lastMsgTime: null,
        });
      });

      // 2. Discover all users who have chatted with THIS hospital
      const chatsSnap = await firestore.collection('chats')
        .where('participants', 'array-contains', state.myId).get();

      chatsSnap.forEach(doc => {
        const d = doc.data();
        (d.participants || []).forEach(pid => {
          if (pid === state.myId || seen.has(pid)) return;
          seen.add(pid);
          const name = resolveContactName(pid, d);
          contacts.push({
            id: pid,
            name,
            type: d.participantTypes?.[pid] || 'user',
            isAdmin: false,
            email: '',
            unreadCount: d.unreadCount?.[state.myId] || 0,
            lastMsgTime: d.lastMessageTime || d.updatedAt || null,
          });
          // Background: try to resolve real name from Firestore
          firestore.collection('users').doc(pid).get().then(uDoc => {
            if (!uDoc.exists) return;
            const u = uDoc.data();
            const realName = `${u.firstName || ''} ${u.lastName || ''}`.trim()
              || u.name || u.displayName || u.email || '';
            if (realName) {
              const c = contacts.find(x => x.id === pid);
              if (c && realName !== c.name) { c.name = realName; renderContacts(); }
            }
          }).catch(() => { });
        });
      });

      state.contacts = contacts;
      sortContacts();
      renderContacts();
    } catch (err) {
      console.error('loadContacts error', err);
    }
  }

  function resolveContactName(pid, chatData) {
    return chatData.participantNames?.[pid] || 'User';
  }

  // Real-time subscription → update unread badges live
  function subscribeToMyChats() {
    if (state.chatListener) state.chatListener();
    state.chatListener = firestore.collection('chats')
      .where('participants', 'array-contains', state.myId)
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          const d = change.doc.data();
          const otherId = (d.participants || []).find(p => p !== state.myId);
          if (!otherId) return;

          let c = state.contacts.find(x => x.id === otherId);
          if (!c) {
            // New chat contact appeared — add to list
            const name = resolveContactName(otherId, d);
            c = {
              id: otherId, name,
              type: d.participantTypes?.[otherId] || 'user',
              isAdmin: false, email: '',
              unreadCount: 0, lastMsgTime: null,
            };
            state.contacts.push(c);
          }
          c.unreadCount = d.unreadCount?.[state.myId] || 0;
          c.lastMsgTime = d.lastMessageTime || d.updatedAt || null;
        });
        sortContacts();
        renderContacts();
      }, err => console.warn('chat subscription error', err));
  }

  function sortContacts() {
    state.contacts.sort((a, b) => {
      const ta = tsToMs(a.lastMsgTime), tb = tsToMs(b.lastMsgTime);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta && tb) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }

  function tsToMs(t) {
    if (!t) return 0;
    if (t.toDate) return t.toDate().getTime();
    return new Date(t).getTime();
  }

  // ─── Render contacts ─────────────────────────────────────────
  function renderContacts(filter = '') {
    const list = el.contactList();
    if (!list) return;
    const filtered = filter
      ? state.contacts.filter(c => c.name.toLowerCase().includes(filter) || c.id.includes(filter))
      : state.contacts;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No contacts</p></div>';
      return;
    }

    list.innerHTML = filtered.map(c => {
      const active = state.activeContactId === c.id;
      const badge = c.unreadCount > 0
        ? `<span class="unread-badge" style="background:#e74c3c;color:#fff;border-radius:50%;padding:2px 7px;font-size:11px;margin-left:6px;font-weight:bold;">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>`
        : '';
      const icon = c.isAdmin ? '🛡️' : c.name.charAt(0).toUpperCase();
      const sub = c.isAdmin ? 'System Administrator'
        : c.type === 'donor' ? 'Volunteer Donor'
          : c.type === 'requester' ? 'Blood Requester'
            : 'User';
      return `<div class="contact-item ${active ? 'active' : ''} ${c.unreadCount > 0 ? 'has-unread' : ''}"
          onclick="window.selectChatContact('${esc(c.id)}','${esc(c.name)}')">
        <div class="contact-avatar">${icon}</div>
        <div class="contact-info">
          <div class="contact-name">${esc(c.name)}${badge}</div>
          <div class="contact-status">${sub}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Public: select contact ──────────────────────────────────
  window.selectChatContact = selectContact;
  async function selectContact(targetId, targetName) {
    if (!targetId || !state.myId || targetId === state.myId) return;

    const contact = state.contacts.find(c => c.id === targetId);
    const targetType = contact?.type || 'user';
    const role = (targetType === 'donor' || targetType === 'requester') ? targetType : null;
    const chatId = canonicalChatId(state.myId, targetId, role);

    state.activeContactId = targetId;
    state.activeContactName = targetName;
    state.activeChatId = chatId;

    updateChatHeader(targetName);
    renderContacts();

    try {
      const chatRef = firestore.collection('chats').doc(chatId);
      const chatSnap = await chatRef.get();

      if (!chatSnap.exists) {
        // Look for legacy chat by participants array
        const legacySnap = await firestore.collection('chats')
          .where('participants', 'array-contains', state.myId).get();
        let legacy = null;
        legacySnap.forEach(d => {
          if ((d.data().participants || []).includes(targetId) && d.id !== chatId) legacy = d;
        });

        if (legacy) {
          // Migrate legacy → canonical ID
          await chatRef.set({
            ...legacy.data(),
            id: chatId,
            participants: [state.myId, targetId],
            participantNames: {
              ...(legacy.data().participantNames || {}),
              [state.myId]: state.myName,
              [targetId]: targetName,
            },
            participantTypes: { [state.myId]: 'hospital', [targetId]: targetType },
            chatRole: role,
          });
          // Remap messages
          const oldMsgs = await firestore.collection('messages')
            .where('chatId', '==', legacy.id).get();
          if (!oldMsgs.empty) {
            const batch = firestore.batch();
            oldMsgs.forEach(m => batch.update(m.ref, { chatId }));
            await batch.commit();
          }
        } else {
          // Fresh chat
          await chatRef.set({
            id: chatId,
            participants: [state.myId, targetId],
            participantNames: { [state.myId]: state.myName, [targetId]: targetName },
            participantTypes: { [state.myId]: 'hospital', [targetId]: targetType },
            chatRole: role,
            lastMessage: '',
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: { [state.myId]: 0, [targetId]: 0 },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // Reset my unread
      await chatRef.update({ [`unreadCount.${state.myId}`]: 0 }).catch(() => { });

      // Mark messages read
      const unread = await firestore.collection('messages')
        .where('chatId', '==', chatId)
        .where('receiverId', '==', state.myId)
        .where('isRead', '==', false).get();
      if (!unread.empty) {
        const b = firestore.batch();
        unread.forEach(m => b.update(m.ref, { isRead: true }));
        await b.commit();
      }

      if (contact) { contact.unreadCount = 0; renderContacts(); }

      listenForMessages(chatId);
    } catch (e) {
      console.error('selectContact error', e);
    }
  }

  // ─── Real-time message listener ──────────────────────────────
  function listenForMessages(chatId) {
    if (state.msgListener) state.msgListener();
    state.msgListener = firestore.collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('timestamp', 'asc')
      .limitToLast(100)
      .onSnapshot(snap => {
        renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => console.error('message listener error', err));
  }

  // ─── Render messages ─────────────────────────────────────────
  function renderMessages(messages) {
    const win = el.chatWindow();
    if (!win) return;
    win.innerHTML = messages.map(m => {
      const isMe = m.senderId === state.myId;
      const text = m.message || m.text || '';   // 'message' field matches mobile
      return `<div class="message ${isMe ? 'sent' : 'received'}">
        <div class="message-content">
          ${!isMe ? `<span class="message-sender">${esc(m.senderName || '')}</span>` : ''}
          ${esc(text)}
          <span class="message-time">${fmtTime(m.timestamp)}</span>
        </div>
      </div>`;
    }).join('');
    win.scrollTop = win.scrollHeight;
  }

  // ─── Send a message ──────────────────────────────────────────
  async function sendMessage(text) {
    if (!state.activeChatId || !state.activeContactId) return;
    const input = el.chatInput();
    if (input) input.value = '';

    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const msgId = `${state.activeChatId}_${Date.now()}`;

    try {
      await firestore.collection('messages').doc(msgId).set({
        id: msgId,
        chatId: state.activeChatId,
        senderId: state.myId,
        senderName: state.myName,
        receiverId: state.activeContactId,
        message: text,              // 'message' not 'text'
        timestamp: ts,
        isRead: false,
        type: 'text',
      });

      await firestore.collection('chats').doc(state.activeChatId).update({
        lastMessage: text,
        lastMessageTime: ts,
        updatedAt: ts,
        [`unreadCount.${state.activeContactId}`]: firebase.firestore.FieldValue.increment(1),
      });

      await notifRef.set({
        id: notifRef.id,
        recipientId: state.activeContactId,
        type: 'new_message',
        title: `New message from ${state.myName}`,
        message: text.length > 50 ? text.substring(0, 47) + '...' : text,
        data: { chatId: state.activeChatId, senderId: state.myId, senderName: state.myName },
        isRead: false,
        timestamp: new Date().toISOString(),
      }).catch(() => { });
    } catch (e) {
      console.error('sendMessage error', e);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────
  function fmtTime(v) {
    if (!v) return '';
    const d = v.toDate ? v.toDate() : new Date(v);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function updateChatHeader(name) {
    const h = document.querySelector('.chat-main .header-info h3');
    if (h) h.textContent = `Chat with ${name}`;
  }
})();