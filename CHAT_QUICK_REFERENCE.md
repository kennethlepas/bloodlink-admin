# BloodLink Chat - Quick Reference

## Chat ID Format
```
uid1___uid2              (admin to hospital)
uid1___uid2___donor      (with donor)
uid1___uid2___requester  (with requester)
```

## Message Schema
```javascript
{
  id: "{chatId}_{timestamp}",
  chatId: "uid1___uid2___donor",
  senderId: "uid1",
  senderName: "John Doe",
  receiverId: "uid2",
  message: "Hello!",  // ✅ Use 'message' NOT 'text'
  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  isRead: false,
  type: "text"
}
```

## Chat Schema
```javascript
{
  id: "uid1___uid2___donor",
  participants: ["uid1", "uid2"],
  participantNames: { "uid1": "Admin", "uid2": "User" },
  participantTypes: { "uid1": "super_admin", "uid2": "donor" },
  chatRole: "donor",  // or "requester" or null
  lastMessage: "Hello!",
  lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
  unreadCount: { "uid1": 0, "uid2": 2 },
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}
```

## Key Functions

### Generate Chat ID
```javascript
function canonicalChatId(idA, idB, role) {
  const sorted = [idA, idB].sort().join('___');
  return role ? `${sorted}___${role}` : sorted;
}
```

### Send Message
```javascript
await firestore.collection('messages').doc(msgId).set({
  id: msgId,
  chatId: chatId,
  senderId: myId,
  senderName: myName,
  receiverId: targetId,
  message: text,  // ✅ Correct field
  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  isRead: false,
  type: 'text'
});

await firestore.collection('chats').doc(chatId).update({
  lastMessage: text,
  lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  [`unreadCount.${targetId}`]: firebase.firestore.FieldValue.increment(1)
});
```

### Listen to Messages
```javascript
firestore.collection('messages')
  .where('chatId', '==', chatId)
  .orderBy('timestamp', 'asc')
  .limitToLast(100)
  .onSnapshot(snap => {
    // Render messages
  });
```

### Mark as Read
```javascript
// Reset chat unread count
await firestore.collection('chats').doc(chatId).update({
  [`unreadCount.${myId}`]: 0
});

// Mark individual messages
const unread = await firestore.collection('messages')
  .where('chatId', '==', chatId)
  .where('receiverId', '==', myId)
  .where('isRead', '==', false).get();

const batch = firestore.batch();
unread.forEach(m => batch.update(m.ref, { isRead: true }));
await batch.commit();
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Messages not received | Check `message` field (not `text`) |
| Can't find chat | Verify canonical ID format |
| Unread not updating | Use `FieldValue.increment(1)` |
| Duplicate contacts | Check UID deduplication in `loadContacts()` |
| Listener errors | Unsubscribe old listener before creating new one |

## Console Log Indicators

- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📇 Loading contacts
- 📡 Listening/subscribing
- 📨 Data received
- 📤 Sending message
- 🆔 ID information
- 🔄 Migration in progress
- ✨ Creating new resource

## Files Modified
- `/static/chat.js` - Super Admin
- `/static/hospital/chat.js` - Hospital Admin

## Testing
1. Open browser console (F12)
2. Navigate to /chat (super admin) or /hospital/chat (hospital admin)
3. Watch for console logs showing initialization
4. Send test message from mobile app
5. Verify message appears on admin
6. Reply from admin
7. Verify reply appears on mobile app
