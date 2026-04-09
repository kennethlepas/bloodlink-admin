// ============================================================
// BloodLink — Super Admin Chat Module  (chat.js)
// Refined: canonical chatId, real-time onSnapshot, message field,
//        no duplicate contacts, consistent UID identity,
//        improved contact discovery, robust error handling
// ============================================================
(function () {
  'use strict';

  let state = {
    myId: null,           // always auth.currentUser.uid
    myName: 'BloodLink HQ',
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
    
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return;
    }
    
    state.myId = auth.currentUser.uid;
    state.myName = auth.currentUser.displayName || 'BloodLink HQ';

    if (!state.myId) { 
      console.error('No auth UID'); 
      return; 
    }

    console.log('✅ Initialized with UID:', state.myId);
    setupListeners();
    await loadContacts();
    subscribeToMyChats();          // real-time unread badge updates

    // Auto-select contact from URL parameter
    const p = new URLSearchParams(window.location.search);
    if (p.has('targetId')) {
      const targetId = p.get('targetId');
      const targetName = p.get('targetName') || 'User';
      console.log('📍 Auto-selecting contact from URL:', targetId, targetName);
      selectContact(targetId, targetName);
    } else if (state.contacts.length > 0) {
      const first = state.contacts[0];
      console.log('📍 Auto-selecting first contact:', first.name);
      selectContact(first.id, first.name);
    }
  };

  // ─── Canonical chat ID (matches mobile app exactly) ─────────
  // Format: uid1___uid2 or uid1___uid2___donor/requester
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
      console.log('📇 Loading contacts...');
      const myEmail = auth.currentUser?.email;
      const seen = new Set([state.myId]);   // deduplicate by UID
      const contacts = [];

      const addContact = (uid, data, typeOverride) => {
        if (!uid || uid === state.myId || seen.has(uid)) return;
        if (data.email === myEmail) return;
        seen.add(uid);
        const isAdmin = data.userType === 'admin' || data.userType === 'super_admin';
        const contact = {
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
        };
        contacts.push(contact);
        console.log('  ➕ Added contact:', contact.name, '(', contact.type, ')');
      };

      // Load hospital admins and super admins
      try {
        const adminsSnap = await firestore.collection('users')
          .where('userType', 'in', ['hospital', 'admin', 'super_admin'])
          .get();
        console.log('  🏢 Found', adminsSnap.size, 'hospital/admin users');
        adminsSnap.forEach(d => addContact(d.data().uid || d.id, d.data()));
      } catch (err) {
        console.warn('  ⚠️ Failed to load hospital/admin users:', err);
      }

      // Load active donors and requesters
      try {
        const usersSnap = await firestore.collection('users')
          .where('userType', 'in', ['donor', 'requester'])
          .where('isActive', '==', true)
          .limit(200)
          .get();
        console.log('  👥 Found', usersSnap.size, 'active donors/requesters');
        usersSnap.forEach(d => addContact(d.data().uid || d.id, d.data()));
      } catch (err) {
        console.warn('  ⚠️ Failed to load donors/requesters:', err);
      }

      // Discover any extra participants from existing chats
      await discoverFromChats(seen, contacts);

      state.contacts = contacts;
      await enrichFromChats();
      sortContacts();
      renderContacts();
      console.log('✅ Loaded', contacts.length, 'contacts total');
    } catch (err) {
      console.error('❌ loadContacts error', err);
    }
  }

  // Pull any chat participant not already in contacts list
  async function discoverFromChats(seen, contacts) {
    console.log('  🔍 Discovering chat participants...');
    try {
      const snap = await firestore.collection('chats')
        .where('participants', 'array-contains', state.myId)
        .get();

      console.log('    Found', snap.size, 'existing chats');
      snap.forEach(doc => {
        const d = doc.data();
        (d.participants || []).forEach(pid => {
          if (seen.has(pid) || pid === state.myId) return;
          seen.add(pid);
          const name = d.participantNames?.[pid] || 'Unknown';
          const type = d.participantTypes?.[pid] || 'user';
          contacts.push({
            id: pid, 
            name, 
            type,
            isAdmin: false, 
            email: '',
            unreadCount: d.unreadCount?.[state.myId] || 0,
            lastMsgTime: d.lastMessageTime || null,
          });
          console.log('    ➕ Discovered from chat:', name, '(', type, ')');
        });
      });
    } catch (err) {
      console.warn('    ⚠️ Failed to discover from chats:', err);
    }
  }

  // Overwrite unread + lastMsgTime from chats the admin is in
  async function enrichFromChats() {
    console.log('  📊 Enriching contacts with chat data...');
    try {
      const snap = await firestore.collection('chats')
        .where('participants', 'array-contains', state.myId)
        .get();

      let enriched = 0;
      snap.forEach(doc => {
        const d = doc.data();
        const otherId = (d.participants || []).find(p => p !== state.myId);
        if (!otherId) return;
        const c = state.contacts.find(x => x.id === otherId);
        if (c) {
          c.unreadCount = d.unreadCount?.[state.myId] || 0;
          c.lastMsgTime = d.lastMessageTime || d.updatedAt || null;
          enriched++;
        }
      });
      console.log('    Enriched', enriched, 'contacts with chat data');
    } catch (err) {
      console.warn('    ⚠️ Failed to enrich from chats:', err);
    }
  }

  // Real-time subscription → update unread badges live
  function subscribeToMyChats() {
    console.log('📡 Subscribing to chat updates...');
    if (state.chatListener) state.chatListener();
    state.chatListener = firestore.collection('chats')
      .where('participants', 'array-contains', state.myId)
      .onSnapshot(snap => {
        console.log('📨 Chat update received,', snap.size, 'chats');
        snap.docChanges().forEach(change => {
          const d = change.doc.data();
          const otherId = (d.participants || []).find(p => p !== state.myId);
          if (!otherId) return;
          
          let c = state.contacts.find(x => x.id === otherId);
          if (!c) {
            // New chat discovered - add contact
            const name = d.participantNames?.[otherId] || 'Unknown';
            const type = d.participantTypes?.[otherId] || 'user';
            c = {
              id: otherId,
              name,
              type,
              isAdmin: false,
              email: '',
              unreadCount: d.unreadCount?.[state.myId] || 0,
              lastMsgTime: d.lastMessageTime || d.updatedAt || null,
            };
            state.contacts.push(c);
            console.log('  ➕ New chat contact discovered:', name);
          } else {
            c.unreadCount = d.unreadCount?.[state.myId] || 0;
            c.lastMsgTime = d.lastMessageTime || d.updatedAt || null;
          }
        });
        sortContacts();
        renderContacts();
      }, err => {
        console.error('❌ Chat subscription error:', err);
      });
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
    if (!targetId || !state.myId || targetId === state.myId) {
      console.warn('⚠️ Invalid contact selection:', { targetId, myId: state.myId });
      return;
    }

    console.log('💬 Selecting contact:', targetName, '(', targetId, ')');

    const contact = state.contacts.find(c => c.id === targetId);
    const targetType = contact?.type || 'user';
    const role = (targetType === 'donor' || targetType === 'requester') ? targetType : null;
    const chatId = canonicalChatId(state.myId, targetId, role);

    console.log('  🆔 Chat ID:', chatId);
    console.log('  📋 Role:', role, 'Type:', targetType);

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
        console.log('  🆕 Chat doc does not exist, checking for legacy chats...');
        
        // Look for a legacy chat by participants array
        const legacySnap = await firestore.collection('chats')
          .where('participants', 'array-contains', state.myId)
          .get();
        
        let legacy = null;
        legacySnap.forEach(d => {
          const data = d.data();
          if ((data.participants || []).includes(targetId) && d.id !== chatId) {
            legacy = d;
          }
        });

        if (legacy) {
          console.log('  🔄 Migrating legacy chat:', legacy.id, '→', chatId);
          // Migrate legacy → canonical
          const legacyData = legacy.data();
          await chatRef.set({
            ...legacyData,
            id: chatId,
            participants: [state.myId, targetId],
            participantNames: {
              ...(legacyData.participantNames || {}),
              [state.myId]: state.myName,
              [targetId]: targetName,
            },
            participantTypes: { 
              ...(legacyData.participantTypes || {}),
              [state.myId]: 'super_admin', 
              [targetId]: targetType 
            },
            chatRole: role,
          });
          
          // Remap all messages from old chatId
          const oldMsgs = await firestore.collection('messages')
            .where('chatId', '==', legacy.id)
            .get();
          if (!oldMsgs.empty) {
            console.log('  📝 Remapping', oldMsgs.size, 'messages to new chatId');
            const batch = firestore.batch();
            oldMsgs.forEach(m => batch.update(m.ref, { chatId }));
            await batch.commit();
          }
        } else {
          console.log('  ✨ Creating fresh chat');
          // Fresh chat - use server timestamps for consistency
          const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
          await chatRef.set({
            id: chatId,
            participants: [state.myId, targetId],
            participantNames: { 
              [state.myId]: state.myName, 
              [targetId]: targetName 
            },
            participantTypes: { 
              [state.myId]: 'super_admin', 
              [targetId]: targetType 
            },
            chatRole: role,
            lastMessage: '',
            lastMessageTime: serverTimestamp,
            unreadCount: { 
              [state.myId]: 0, 
              [targetId]: 0 
            },
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        }
      } else {
        console.log('  ✅ Chat doc exists');
      }

      // Reset my unread count
      await chatRef.update({ 
        [`unreadCount.${state.myId}`]: 0 
      }).catch(err => console.warn('  ⚠️ Failed to reset unread:', err));

      // Mark individual messages read
      const unread = await firestore.collection('messages')
        .where('chatId', '==', chatId)
        .where('receiverId', '==', state.myId)
        .where('isRead', '==', false)
        .get();
      
      if (!unread.empty) {
        console.log('  📖 Marking', unread.size, 'messages as read');
        const b = firestore.batch();
        unread.forEach(m => b.update(m.ref, { isRead: true }));
        await b.commit();
      }

      // Update local unread badge to 0 immediately
      if (contact) { 
        contact.unreadCount = 0; 
        renderContacts(); 
      }

      console.log('  ✅ Chat opened successfully');
      listenForMessages(chatId);
    } catch (e) {
      console.error('❌ selectContact error', e);
      if (window.utils?.showNotification) {
        window.utils.showNotification('Failed to open chat', 'error');
      }
    }
  }

  // ─── Real-time message listener ──────────────────────────────
  function listenForMessages(chatId) {
    console.log('📡 Listening to messages for chat:', chatId);
    if (state.msgListener) {
      console.log('  🔄 Removing old listener');
      state.msgListener();
    }
    
    state.msgListener = firestore.collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('timestamp', 'asc')
      .limitToLast(100)
      .onSnapshot(snap => {
        console.log('  📨 Messages update:', snap.docs.length, 'messages');
        renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => {
        console.error('❌ Message listener error:', err);
      });
  }

  // ─── Render messages ─────────────────────────────────────────
  function renderMessages(messages) {
    const win = el.chatWindow();
    if (!win) return;
    
    if (messages.length === 0) {
      win.innerHTML = `
        <div class="chat-placeholder">
          <div class="placeholder-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Start the conversation!</p>
        </div>`;
      return;
    }

    win.innerHTML = messages.map(m => {
      const isMe = m.senderId === state.myId;
      // Always use 'message' field (matches mobile app schema)
      const text = m.message || m.text || '';
      const time = fmtTime(m.timestamp);
      
      return `<div class="message ${isMe ? 'sent' : 'received'}">
        <div class="message-content">
          ${!isMe ? `<span class="message-sender">${esc(m.senderName || '')}</span>` : ''}
          ${esc(text)}
          <span class="message-time">${time}</span>
        </div>
      </div>`;
    }).join('');
    
    // Auto-scroll to bottom
    win.scrollTop = win.scrollHeight;
  }

  // ─── Send a message ──────────────────────────────────────────
  async function sendMessage(text) {
    if (!state.activeChatId || !state.activeContactId) {
      console.warn('⚠️ No active chat');
      return;
    }
    
    const input = el.chatInput();
    if (input) input.value = '';

    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const msgId = `${state.activeChatId}_${Date.now()}`;
    const myName = state.myName || 'BloodLink HQ';

    console.log('📤 Sending message:', text.substring(0, 30) + '...');
    console.log('  🆔 Message ID:', msgId);
    console.log('  📬 Receiver:', state.activeContactId);

    try {
      // Write to messages collection (same schema as mobile)
      await firestore.collection('messages').doc(msgId).set({
        id: msgId,
        chatId: state.activeChatId,
        senderId: state.myId,
        senderName: myName,
        receiverId: state.activeContactId,
        message: text,          // 'message' field matches mobile app
        timestamp: ts,
        isRead: false,
        type: 'text',
      });

      console.log('  ✅ Message written to Firestore');

      // Update chat metadata
      await firestore.collection('chats').doc(state.activeChatId).update({
        lastMessage: text,
        lastMessageTime: ts,
        updatedAt: ts,
        [`unreadCount.${state.activeContactId}`]: firebase.firestore.FieldValue.increment(1),
      });

      console.log('  ✅ Chat metadata updated');

      // Create notification for the receiver
      const notifRef = firestore.collection('notifications').doc();
      const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
      await notifRef.set({
        id: notifRef.id,
        userId: state.activeContactId,
        type: 'new_message',
        title: `New message from ${myName}`,
        message: text.length > 50 ? text.substring(0, 47) + '...' : text,
        data: { 
          chatId: state.activeChatId, 
          senderId: state.myId, 
          senderName: myName 
        },
        isRead: false,
        timestamp: serverTimestamp,  // ✅ Use server timestamp (logical time)
      }).catch(err => console.warn('  ⚠️ Failed to create notification:', err));

      console.log('  ✅ Notification created');
    } catch (e) {
      console.error('❌ sendMessage error', e);
      if (window.utils?.showNotification) {
        window.utils.showNotification('Failed to send message', 'error');
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────
  // Safe timestamp formatter - handles Firestore serverTimestamp properly
  function fmtTime(v) {
    if (!v) return '';
    
    try {
      // Handle Firestore Timestamp objects
      if (v.toDate) {
        const d = v.toDate();
        // Check if date is valid
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Handle ISO string or milliseconds
      if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v);
        // Check if date is valid
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Handle Firestore {seconds, nanoseconds} format
      if (v.seconds) {
        const d = new Date(v.seconds * 1000);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      return '';
    } catch (err) {
      console.warn('⚠️ Invalid timestamp:', v);
      return '';
    }
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