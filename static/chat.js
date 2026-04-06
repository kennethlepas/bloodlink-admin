// ============================================================
// BloodLink — Super Admin Chat Module  (chat.js)
// Fixed: canonical chatId, real-time onSnapshot, message field,
//        no duplicate contacts, consistent UID identity
// ============================================================
(function () {
  'use strict';

  let state = {
    myId: null,           // always auth.currentUser.uid
    activeChatId: null,
    activeContactId: null,
    activeContactName: null,
    contacts: [],
    msgListener: null,    // unsubscribe fn for message onSnapshot
    chatListener: null,   // unsubscribe fn for chats onSnapshot (unread)
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
  window.initializeChat = window.initializePage = async function () {
    console.log('🛡️ Super Admin Chat — init');
    state.myId = auth.currentUser?.uid;
    if (!state.myId) { console.error('No auth UID'); return; }

    setupListeners();
    await loadContacts();
    subscribeToMyChats();          // real-time unread badge updates

    const p = new URLSearchParams(window.location.search);
    if (p.has('targetId')) {
      selectContact(p.get('targetId'), p.get('targetName') || 'User');
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

  // ─── Load contacts (hospitals, admins, donors, requesters) ──
  async function loadContacts() {
    try {
      const myEmail = auth.currentUser?.email;
      const [adminsSnap, usersSnap] = await Promise.all([
        firestore.collection('users').where('userType', 'in', ['hospital', 'admin', 'super_admin']).get(),
        firestore.collection('users').where('userType', 'in', ['donor', 'requester']).where('isActive', '==', true).limit(200).get(),
      ]);

      const seen = new Set([state.myId]);   // deduplicate by UID
      const contacts = [];

      const addContact = (uid, data, typeOverride) => {
        if (!uid || uid === state.myId || seen.has(uid)) return;
        if (data.email === myEmail) return;
        seen.add(uid);
        const isAdmin = data.userType === 'admin' || data.userType === 'super_admin';
        contacts.push({
          id: uid,
          name: isAdmin
            ? (data.name || 'BloodLink Admin')
            : (data.hospitalName || data.name ||
              `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
              data.email || 'Unknown'),
          type: typeOverride || data.userType || 'user',
          isAdmin,
          email: data.email || '',
          unreadCount: 0,
          lastMsgTime: null,
        });
      };

      adminsSnap.forEach(d => addContact(d.data().uid || d.id, d.data()));
      usersSnap.forEach(d => addContact(d.data().uid || d.id, d.data()));

      // Discover any extra participants from existing chats
      await discoverFromChats(seen, contacts);

      state.contacts = contacts;
      await enrichFromChats();
      sortContacts();
      renderContacts();
    } catch (err) {
      console.error('loadContacts error', err);
    }
  }

  // Pull any chat participant not already in contacts list
  async function discoverFromChats(seen, contacts) {
    const snap = await firestore.collection('chats')
      .where('participants', 'array-contains', state.myId).get();

    snap.forEach(doc => {
      const d = doc.data();
      (d.participants || []).forEach(pid => {
        if (seen.has(pid) || pid === state.myId) return;
        seen.add(pid);
        const name = d.participantNames?.[pid] || 'Unknown';
        contacts.push({
          id: pid, name, type: d.participantTypes?.[pid] || 'user',
          isAdmin: false, email: '',
          unreadCount: d.unreadCount?.[state.myId] || 0,
          lastMsgTime: d.lastMessageTime || null,
        });
      });
    });
  }

  // Overwrite unread + lastMsgTime from chats the admin is in
  async function enrichFromChats() {
    const snap = await firestore.collection('chats')
      .where('participants', 'array-contains', state.myId).get();

    snap.forEach(doc => {
      const d = doc.data();
      const otherId = (d.participants || []).find(p => p !== state.myId);
      if (!otherId) return;
      const c = state.contacts.find(x => x.id === otherId);
      if (c) {
        c.unreadCount = d.unreadCount?.[state.myId] || 0;
        c.lastMsgTime = d.lastMessageTime || d.updatedAt || null;
      }
    });
  }

  // Real-time subscription → update unread badges live
  function subscribeToMyChats() {
    if (state.chatListener) state.chatListener();
    state.chatListener = firestore.collection('chats')
      .where('participants', 'array-contains', state.myId)
      .onSnapshot(snap => {
        snap.forEach(doc => {
          const d = doc.data();
          const otherId = (d.participants || []).find(p => p !== state.myId);
          if (!otherId) return;
          const c = state.contacts.find(x => x.id === otherId);
          if (c) {
            c.unreadCount = d.unreadCount?.[state.myId] || 0;
            c.lastMsgTime = d.lastMessageTime || d.updatedAt || null;
          }
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

  // ─── Render contacts list ────────────────────────────────────
  function renderContacts(filter = '') {
    const list = el.contactList();
    if (!list) return;
    const filtered = filter
      ? state.contacts.filter(c => c.name.toLowerCase().includes(filter) || c.id.includes(filter))
      : state.contacts;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No contacts found</p></div>';
      return;
    }

    list.innerHTML = filtered.map(c => {
      const active = state.activeContactId === c.id;
      const badge = c.unreadCount > 0
        ? `<span class="unread-badge" style="background:#e74c3c;color:#fff;border-radius:50%;padding:2px 7px;font-size:11px;margin-left:6px;font-weight:bold;">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>`
        : '';
      const icon = c.isAdmin ? '🛡️' : c.name.charAt(0).toUpperCase();
      const sub = c.isAdmin ? 'System Administrator'
        : c.type === 'hospital' ? 'Healthcare Facility'
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

  // ─── Public: select a contact and open the chat ──────────────
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
    renderContacts();      // highlight the active row

    try {
      // Ensure the chat doc exists at the canonical ID
      const chatRef = firestore.collection('chats').doc(chatId);
      const chatSnap = await chatRef.get();

      if (!chatSnap.exists) {
        // Look for a legacy chat by participants array
        const legacySnap = await firestore.collection('chats')
          .where('participants', 'array-contains', state.myId).get();
        let legacy = null;
        legacySnap.forEach(d => {
          if ((d.data().participants || []).includes(targetId) && d.id !== chatId) legacy = d;
        });

        if (legacy) {
          // Migrate legacy → canonical
          await chatRef.set({
            ...legacy.data(),
            id: chatId,
            participants: [state.myId, targetId],
            participantNames: {
              ...(legacy.data().participantNames || {}),
              [state.myId]: 'BloodLink HQ',
              [targetId]: targetName,
            },
            participantTypes: { [state.myId]: 'super_admin', [targetId]: targetType },
            chatRole: role,
          });
          // Remap all messages from old chatId
          const oldMsgs = await firestore.collection('messages').where('chatId', '==', legacy.id).get();
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
            participantNames: { [state.myId]: 'BloodLink HQ', [targetId]: targetName },
            participantTypes: { [state.myId]: 'super_admin', [targetId]: targetType },
            chatRole: role,
            lastMessage: '',
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: { [state.myId]: 0, [targetId]: 0 },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // Reset my unread count
      await chatRef.update({ [`unreadCount.${state.myId}`]: 0 }).catch(() => { });

      // Mark individual messages read
      const unread = await firestore.collection('messages')
        .where('chatId', '==', chatId)
        .where('receiverId', '==', state.myId)
        .where('isRead', '==', false).get();
      if (!unread.empty) {
        const b = firestore.batch();
        unread.forEach(m => b.update(m.ref, { isRead: true }));
        await b.commit();
      }

      // Update local unread badge to 0 immediately
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
      // Always use 'message' field (matches mobile app schema)
      const text = m.message || m.text || '';
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
    const myName = 'BloodLink HQ';

    try {
      // Write to messages collection (same schema as mobile)
      await firestore.collection('messages').doc(msgId).set({
        id: msgId,
        chatId: state.activeChatId,
        senderId: state.myId,
        senderName: myName,
        receiverId: state.activeContactId,
        message: text,          // 'message' not 'text'
        timestamp: ts,
        isRead: false,
        type: 'text',
      });

      // Update chat metadata
      await firestore.collection('chats').doc(state.activeChatId).update({
        lastMessage: text,
        lastMessageTime: ts,
        updatedAt: ts,
        [`unreadCount.${state.activeContactId}`]: firebase.firestore.FieldValue.increment(1),
      });

      // Notification for the receiver
      const notifRef = firestore.collection('notifications').doc();
      await notifRef.set({
        id: notifRef.id,
        userId: state.activeContactId,
        type: 'new_message',
        title: `New message from ${myName}`,
        message: text.length > 50 ? text.substring(0, 47) + '...' : text,
        data: { chatId: state.activeChatId, senderId: state.myId, senderName: myName },
        isRead: false,
        timestamp: new Date().toISOString(),
      }).catch(() => { });
    } catch (e) {
      console.error('sendMessage error', e);
      if (window.utils?.showNotification) window.utils.showNotification('Failed to send message', 'error');
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