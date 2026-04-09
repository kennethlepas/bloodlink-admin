# Notification System Refinement

## Overview
Complete refinement of the notification system for both Super Admin and Hospital Admin to ensure reliable notification delivery, proper filtering, and enhanced user experience.

---

## ✅ What Was Fixed

### 1. **Super Admin Notifications** (`/notifications`)
- ✅ **Receives ALL system notifications** - No filtering by default
- ✅ **Real-time listener** with proper cleanup on page unload
- ✅ **Enhanced notification types** - Better icon mapping for all types
- ✅ **Improved click handlers** - Navigate to correct sections based on notification type
- ✅ **Mark all as read** - Batch update with user feedback
- ✅ **Delete notifications** - Remove old/read notifications
- ✅ **Relative timestamps** - "Just now", "5m ago", "2h ago", etc.
- ✅ **XSS protection** - HTML escaping for all user-generated content
- ✅ **Error handling** - Fallback for Firestore index issues
- ✅ **Badge updates** - Real-time unread count with 99+ overflow

### 2. **Hospital Admin Notifications** (`/hospital/notifications`)
- ✅ **Hospital-specific filtering** - Only sees notifications for their facility
- ✅ **Multi-identifier matching** - Uses hospital ID, email, facilityCode, etc.
- ✅ **Real-time listener** with proper cleanup
- ✅ **Enhanced notification types** - Including inventory alerts
- ✅ **Improved click handlers** - Navigate to hospital-specific sections
- ✅ **Mark all as read** - Batch update with feedback
- ✅ **Delete notifications** - Remove old notifications
- ✅ **Safe timestamps** - No "Invalid Date" errors
- ✅ **Error handling** - Fallback for query issues

---

## 🔧 Key Improvements

### Notification Query Building

#### Super Admin
```javascript
// Super admin sees ALL notifications
let query = firestore.collection('notifications');
// No where clause - receives everything
```

#### Hospital Admin
```javascript
// Hospital admin sees ONLY their facility's notifications
const hospitalIdentifiers = [
    hospital.id,
    hospital.facilityCode,
    hospital.code,
    hospital.email,
    hospital.hospitalId,
    hospital.uid
].filter(Boolean);

// Use 'in' operator for multi-field matching (max 10)
query = query.where('recipientId', 'in', uniqueIdentifiers.slice(0, 10));
```

### Notification Schema

```javascript
{
    id: "auto-generated",
    recipientId: "hospital-id-or-email-or-admin",  // Who receives it
    type: "new_message" | "blood_request" | "verification" | "referral" | "system_alert",
    title: "New message from BloodLink HQ",
    message: "Thank you for your donation...",
    data: {
        chatId: "uid1___uid2",
        senderId: "uid1",
        senderName: "BloodLink HQ",
        requestId: "...",
        referralId: "..."
    },
    isRead: false,
    timestamp: Firestore Timestamp,  // ✅ Logical time
    timestampISO: "2024-01-15T10:30:00.000Z",  // Fallback
    createdAt: Firestore Timestamp
}
```

---

## 🎯 Notification Types & Icons

| Type | Icon | Description |
|------|------|-------------|
| `new_message`, `chat` | 💬 | Chat message received |
| `blood_request`, `request` | 🩸 | Blood request created/updated |
| `request_accepted`, `accept` | ✅ | Request accepted |
| `request_rejected`, `reject` | ❌ | Request rejected |
| `verify_donation`, `donor_verification` | 🛡️ | Donor verification |
| `system_alert`, `alert` | ⚠️ | System alert |
| `referral` | 🔗 | Referral created/updated |
| `donor` | 🩸 | Donor-related |
| `error` | ❌ | Error occurred |
| `warning` | ⚠️ | Warning |
| `inventory` | 📦 | Inventory update (hospital only) |
| Default | 🔔 | Other notifications |

---

## 🔄 Real-Time Listener

### Setup
```javascript
function setupNotificationListener() {
    // Unsubscribe from previous listener
    if (unsubscribeListener) {
        unsubscribeListener();
    }

    const query = buildNotificationQuery();

    unsubscribeListener = query
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            // Update notifications
            allNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderNotifications();
            updateBadge();
        }, (error) => {
            // Handle errors with fallback
            if (error.code === 'failed-precondition') {
                // Fallback: fetch without orderBy
            } else {
                showError(error.message);
            }
        });
}
```

### Cleanup
```javascript
window.addEventListener('beforeunload', () => {
    if (unsubscribeListener) {
        unsubscribeListener();
    }
});
```

---

## 📊 Notification Features

### 1. **Filtering**
- **All** - Show all notifications
- **Unread** - Show only unread notifications
- **Verifications** - Filter verification notifications
- **Requests** - Filter blood request notifications
- **System** - Filter system alerts

### 2. **Search**
- Search by title, message, or type
- Real-time filtering as you type

### 3. **Actions**
- **Mark as read** - Individual or batch
- **View Details** - Navigate to relevant section
- **Delete** - Remove read notifications

### 4. **Badge**
- Shows unread count
- Updates in real-time
- Shows "99+" for overflow

---

## 🎨 UI Enhancements

### Relative Timestamps
```javascript
function formatDate(timestamp) {
    // "Just now" (< 1 minute)
    // "5m ago" (< 1 hour)
    // "2h ago" (< 24 hours)
    // "3d ago" (< 7 days)
    // "Jan 15, 10:30 AM" (older)
}
```

### XSS Protection
```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeData(data) {
    return JSON.stringify(data).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

### Enhanced Click Handlers
```javascript
window.handleNotificationClick = async (id, type, data) => {
    await window.markAsRead(id);
    
    const prefix = isHospitalAdmin ? '/hospital' : '';

    if (type === 'new_message' || type === 'chat') {
        // Navigate to chat
        window.location.href = `${prefix}/chat?targetId=...&targetName=...`;
    } else if (type?.includes('verify')) {
        window.location.href = `${prefix}/verifications`;
    } else if (type?.includes('request')) {
        window.location.href = `${prefix}/requests?id=${data.requestId}`;
    } else if (type?.includes('referral')) {
        window.location.href = `${prefix}/referrals?id=${data.referralId}`;
    }
    // ... more handlers
};
```

---

## 🐛 Error Handling

### Firestore Index Issues
```javascript
onSnapshot((snapshot) => {
    // Success
}, (error) => {
    if (error.code === 'failed-precondition' || error.code === 'invalid-argument') {
        // Fallback: fetch without orderBy and sort client-side
        buildNotificationQuery()
            .limit(100)
            .get()
            .then(snapshot => {
                allNotifications.sort((a, b) => timeB - timeA);
                renderNotifications();
                updateBadge();
            });
    } else {
        showError(error.message);
    }
});
```

### Missing Identifiers
```javascript
if (uniqueIdentifiers.length === 0) {
    console.warn('⚠️ No hospital identifiers found');
    if (user?.uid) {
        query = query.where('recipientId', '==', user.uid);
    }
}
```

---

## 📝 How Notifications Are Created

### From Chat (Admin Side)
```javascript
// When admin sends message
const notifRef = firestore.collection('notifications').doc();
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

await notifRef.set({
    id: notifRef.id,
    userId: receiverId,
    recipientId: receiverId,  // Can be hospital ID, email, etc.
    type: 'new_message',
    title: `New message from ${senderName}`,
    message: text.length > 50 ? text.substring(0, 47) + '...' : text,
    data: {
        chatId: chatId,
        senderId: senderId,
        senderName: senderName
    },
    isRead: false,
    timestamp: serverTimestamp  // ✅ Logical time
});
```

### From Mobile App
```typescript
// From database.ts in mobile app
await createNotification({
    userId: receiverId,
    type: 'new_message',
    title: `New message from ${senderName}`,
    message: message.length > 50 ? `${message.substring(0, 47)}...` : message,
    data: { chatId, senderId, senderName },
    isRead: false,
    timestamp: serverTimestamp()
});
```

---

## 🧪 Testing Checklist

### Super Admin Notifications
- [ ] Navigate to `/notifications`
- [ ] Verify all notifications appear (no filtering)
- [ ] Send message from mobile app to admin
- [ ] Verify notification appears in real-time
- [ ] Click notification - verify navigates to chat
- [ ] Click "Mark All as Read" - verify all marked read
- [ ] Verify badge updates
- [ ] Test filters: All, Unread, Verifications, Requests, System
- [ ] Test search functionality
- [ ] Delete a read notification
- [ ] Verify timestamps show relative time ("5m ago")
- [ ] Check console for errors (should be none)

### Hospital Admin Notifications
- [ ] Navigate to `/hospital/notifications`
- [ ] Verify ONLY hospital-specific notifications appear
- [ ] Verify NO notifications from other hospitals
- [ ] Send message to hospital from mobile app
- [ ] Verify notification appears in real-time
- [ ] Click notification - verify navigates to hospital chat
- [ ] Click "Mark All as Read" - verify all marked read
- [ ] Verify badge updates
- [ ] Test filters: All, Unread, Requests, System
- [ ] Test search functionality
- [ ] Delete a read notification
- [ ] Verify timestamps show relative time
- [ ] Check console for errors (should be none)

### Cross-Platform
- [ ] Send message from mobile app to admin
- [ ] Verify notification appears on admin side
- [ ] Reply from admin
- [ ] Verify notification appears on mobile app
- [ ] Repeat for hospital admin
- [ ] Verify `recipientId` matches correctly

---

## 📋 Files Modified

1. ✅ `/static/notifications.js` - Super Admin notifications (complete rewrite)
2. ✅ `/static/hospital/notifications.js` - Hospital Admin notifications (complete rewrite)
3. ✅ `/templates/notifications.html` - Template (unchanged)
4. ✅ `/templates/hospital/notifications.html` - Template (unchanged)

---

## ✨ Summary

| Feature | Super Admin | Hospital Admin |
|---------|-------------|----------------|
| **Notification Scope** | ALL notifications | Hospital-specific only |
| **Query Filter** | None (sees all) | `recipientId in [hospital identifiers]` |
| **Real-Time Updates** | ✅ onSnapshot | ✅ onSnapshot |
| **Auto-Cleanup** | ✅ beforeunload | ✅ beforeunload |
| **Error Fallback** | ✅ Client-side sort | ✅ Client-side sort |
| **Filters** | All, Unread, Verifications, Requests, System | All, Unread, Requests, System |
| **Search** | ✅ Title, message, type | ✅ Title, message, type |
| **Mark All Read** | ✅ Batch update | ✅ Batch update |
| **Delete** | ✅ Individual delete | ✅ Individual delete |
| **Relative Timestamps** | ✅ Just now, 5m ago, etc. | ✅ Just now, 5m ago, etc. |
| **XSS Protection** | ✅ HTML escaping | ✅ HTML escaping |
| **Badge** | ✅ Real-time unread count | ✅ Real-time unread count |
| **Click Handlers** | ✅ Smart navigation | ✅ Smart navigation |
| **Console Logging** | ✅ Debug logs | ✅ Debug logs |

---

## 🚀 Next Steps

1. **Test both notification systems** with real messages
2. **Monitor console** for any errors during testing
3. **Verify real-time updates** work correctly
4. **Test mark all as read** functionality
5. **Verify click handlers** navigate to correct pages
6. **Check badge updates** in real-time
7. **Test error handling** by temporarily breaking query

---

*Refinement completed: April 9, 2026*
*Status: ✅ Ready for testing*
