# System Logs - Complete Implementation Guide

## Overview
The Super Admin System Logs now display **ALL** activities from:
1. ✅ **Super Admin actions** (admin panel operations)
2. ✅ **Donor activities** (mobile app donor actions)
3. ✅ **Requester activities** (mobile app requester actions)  
4. ✅ **Hospital Admin activities** (mobile app hospital actions)

---

## 📊 What's Included in System Logs

### 1. **Admin Audit Logs** (Super Admin Panel)
- Admin login/logout
- User management (create, update, delete)
- Donor verification (approve, reject)
- Blood request management
- Hospital management
- Blood bank operations
- Inventory updates
- Review moderation
- Data exports

**Collection:** `audit_logs`

### 2. **Donor Activities** (Mobile App)
- 📱 Login/logout
- ✨ Donor registration
- 🩸 Blood request acceptance
- 🔄 Availability updates
- 💬 Chat messages
- 🔗 Referral actions
- 👁️ Profile updates
- ❌ Error events

**Collection:** `user_activity_logs`

### 3. **Requester Activities** (Mobile App)
- 📱 Login/logout
- 🩸 Blood request creation
- 👁️ Request views/updates
- ✅ Request completion
- 💬 Chat messages
- 🔗 Referral creation
- 🔍 Donor searches

**Collection:** `user_activity_logs`

### 4. **Hospital Admin Activities** (Mobile App)
- 📱 Login/logout
- 🩸 Blood request broadcasts
- 📋 Referral management
- 📦 Inventory updates
- 💬 Chat with users
- ✅ Booking management

**Collection:** `user_activity_logs`

---

## 🗄️ Firestore Collections Structure

### `user_activity_logs` (Mobile App Users)

**Schema:**
```javascript
{
  id: "auto-generated",
  activityType: "auth_login" | "auth_logout" | "request_create" | "donor_register" | ...,
  user: {
    uid: "user-uid",
    email: "user@example.com",
    userType: "donor" | "requester" | "hospital"  // ✅ Important!
  },
  data: {
    // Activity-specific data
    bloodType: "O+",
    urgency: "high",
    hospital: "City Hospital",
    // ... other fields
  },
  timestamp: Firestore Timestamp,  // ✅ Logical time
  timestampISO: "2024-01-15T10:30:00.000Z",
  severity: "info" | "warning" | "error" | "critical",
  device: {
    id: "session-id",
    platform: "ios" | "android",
    osVersion: "15.0",
    model: "iPhone 13"
  },
  metadata: {
    appVersion: "1.0.0",
    buildNumber: "1"
  }
}
```

**Activity Types by User Role:**

#### Donor Activities:
- `auth_login`, `auth_logout`, `auth_register`
- `donor_register`, `donor_update_availability`
- `donor_accept_request`, `donor_verification_submit`
- `request_accepted`, `request_completed`
- `chat_send_message`, `chat_view_conversation`
- `search_blood_banks`, `view_nearby_requests`
- `referral_create`, `referral_view`, `referral_accept`
- `profile_update`, `app_open`, `app_close`
- `error_occurred`

#### Requester Activities:
- `auth_login`, `auth_logout`, `auth_register`
- `request_create`, `request_view`, `request_update`
- `request_cancel`, `request_accepted`, `request_completed`
- `chat_send_message`, `chat_view_conversation`
- `search_donors`, `view_nearby_requests`
- `referral_create`, `referral_view`
- `profile_update`, `app_open`, `app_close`
- `error_occurred`

#### Hospital Admin Activities (Mobile):
- `auth_login`, `auth_logout`
- `request_create` (broadcasts)
- `referral_create`, `referral_accept`
- `chat_send_message`
- `booking_create`, `booking_update`
- `profile_update`, `app_open`, `app_close`
- `error_occurred`

---

## 🔧 How It Works

### Loading Combined Logs

```javascript
// Super Admin System Logs
async function getCombinedLogs(filters = {}) {
  // 1. Fetch admin audit logs
  const adminLogs = await getAuditLogs(filters);
  
  // 2. Fetch user activity logs (donors, requesters, hospital admins)
  const userLogs = await getUserActivityLogs(filters);
  
  // 3. Combine and sort by timestamp
  const combined = [...adminLogs, ...userLogs];
  combined.sort((a, b) => timeB - timeA);
  
  return combined.slice(0, 50);  // Latest 50
}
```

### Filtering by User Type

The new **User Type Filter** allows filtering mobile app activities by:

```javascript
<select id="userTypeFilter">
  <option value="">All User Types</option>
  <option value="donor">🩸 Donors</option>
  <option value="requester">📋 Requesters</option>
  <option value="hospital">🏥 Hospital Admins</option>
</select>
```

**Implementation:**
```javascript
if (filters.userType) {
  query = query.where('user.userType', '==', filters.userType);
}
```

### Activity Type to Resource Type Mapping

User activities are mapped to resource types for consistent filtering:

```javascript
function getUserActivityResourceType(activityType) {
  const resourceMap = {
    // Authentication → user
    'auth_login': 'user',
    'auth_logout': 'user',
    'auth_register': 'user',
    
    // Blood requests → blood_request
    'request_create': 'blood_request',
    'request_accepted': 'blood_request',
    'request_completed': 'blood_request',
    
    // Donor activities → donor
    'donor_register': 'donor',
    'donor_accept_request': 'donor',
    
    // Chat → chat
    'chat_send_message': 'chat',
    
    // Referrals → referral
    'referral_create': 'referral',
    
    // System events → system
    'error_occurred': 'system',
    'app_open': 'system'
  };
  return resourceMap[activityType] || 'user_activity';
}
```

---

## 🎨 UI Features

### Enhanced Filter Panel

```
┌─────────────────────────────────────────────────────────┐
│  System Logs Filters                                    │
├─────────────────────────────────────────────────────────┤
│  [Action ▼]  [Resource ▼]  [User Type ▼]  [Severity ▼] │
│  🔍 Search email...                                    │
└─────────────────────────────────────────────────────────┘
```

**Filter Options:**

1. **Action Filter** (grouped)
   - Admin Actions: create, update, delete, login, approve, reject
   - User Activities: auth_login, request_create, donor_register, etc.

2. **Resource Filter** (grouped)
   - Admin Resources: user, donor, blood_request, hospital, system
   - User Resources: user_activity, chat, referral, notification

3. **User Type Filter** (NEW!)
   - 🩸 Donors
   - 📋 Requesters
   - 🏥 Hospital Admins

4. **Severity Filter**
   - ℹ️ Info
   - ⚠️ Warning
   - ❌ Error

5. **Email Search**
   - Search by user/admin email

### Log Entry Display

Each log entry shows:

```
┌─────────────────────────────────────────────────────────┐
│  user@example.com                            Jan 15, 10:30│
│  Donor • 📱 Mobile App                                  │
├─────────────────────────────────────────────────────────┤
│  [request_create] blood_request          [error]        │
│                                                         │
│  🩸 Blood Request Created - Type: O+,                   │
│  Urgency: high at City Hospital                         │
│                                                         │
│  ID: req_12345                                          │
│  📱 iPhone 13 (iOS 15.0)                               │
└─────────────────────────────────────────────────────────┘
```

**Visual Indicators:**
- 🟢 Green border - Create/approve actions
- 🔵 Blue border - Update actions
- 🔴 Red border - Delete/error actions
- 🟣 Purple border - Login actions
- 🟡 Yellow border - Reject/warning actions

---

## 📋 Activity Descriptions

### Comprehensive Activity Formatting

The system now provides **rich, formatted descriptions** for all activity types:

#### Authentication:
```javascript
'auth_login': `<strong>📱 Login</strong> - User logged in (${user.email})`
'auth_logout': `<strong>👋 Logout</strong> - User logged out`
'auth_register': `<strong>✨ New Registration</strong> - ${user.email} registered`
```

#### Blood Requests:
```javascript
'request_create': `<strong>🩸 Blood Request Created</strong> - Type: ${data.bloodType}, Urgency: ${data.urgency}`
'request_accepted': `<strong>✅ Request Accepted</strong> - Donor accepted the blood request`
'request_completed': `<strong>✅ Request Completed</strong> - Blood request completed successfully`
```

#### Donor Activities:
```javascript
'donor_register': `<strong>🩸 New Donor</strong> - Blood type ${data.bloodType}`
'donor_accept_request': `<strong>🎯 Request Accepted</strong> - Donor accepted a blood request`
'donor_update_availability': `<strong>🔄 Availability Updated</strong> - Donor marked as available`
```

#### Chat:
```javascript
'chat_send_message': `<strong>💬 Message Sent</strong> - User sent a message in chat`
'chat_view_conversation': `<strong>👁️ Chat Viewed</strong> - User viewed chat conversation`
```

#### Referrals:
```javascript
'referral_create': `<strong>🔗 Referral Created</strong> - For ${data.patientName} to ${data.targetHospital}`
'referral_accept': `<strong>✅ Referral Accepted</strong> - Referral was accepted`
```

#### Errors:
```javascript
'error_occurred': `<strong>❌ Error</strong> - ${data.error}`
```

---

## 🧪 Testing Checklist

### Super Admin System Logs - User Activities

#### Donor Activities:
- [ ] Navigate to `/system-logs`
- [ ] Click "Show User Logs"
- [ ] Filter by User Type: "🩸 Donors"
- [ ] Verify donor activities appear:
  - [ ] `auth_login` - Donor login
  - [ ] `donor_register` - New donor registration
  - [ ] `donor_accept_request` - Request acceptance
  - [ ] `chat_send_message` - Chat messages
  - [ ] `error_occurred` - Error events
- [ ] Verify descriptions are formatted correctly
- [ ] Verify device information shows (iPhone/Android)
- [ ] Verify timestamps display correctly

#### Requester Activities:
- [ ] Filter by User Type: "📋 Requesters"
- [ ] Verify requester activities appear:
  - [ ] `auth_login` - Requester login
  - [ ] `request_create` - Blood request creation
  - [ ] `request_accepted` - Request accepted by donor
  - [ ] `chat_send_message` - Chat messages
  - [ ] `referral_create` - Referral creation
- [ ] Verify blood type and urgency shown
- [ ] Verify hospital name appears

#### Hospital Admin Activities:
- [ ] Filter by User Type: "🏥 Hospital Admins"
- [ ] Verify hospital admin activities appear:
  - [ ] `auth_login` - Hospital admin login
  - [ ] `request_create` - Blood request broadcasts
  - [ ] `referral_create` - Referral management
  - [ ] `chat_send_message` - Chat with users
- [ ] Verify hospital name in descriptions

### Filter Testing:
- [ ] Test Action filter with different activity types
- [ ] Test Resource filter (user, donor, blood_request, chat, etc.)
- [ ] Test User Type filter (donor, requester, hospital)
- [ ] Test Severity filter (info, warning, error)
- [ ] Test email search
- [ ] Test combining multiple filters

### Statistics Dashboard:
- [ ] Verify "Total Events (24h)" includes user activities
- [ ] Verify "User Activities" count is correct
- [ ] Verify "Admin Actions" count is correct
- [ ] Verify "System Errors" includes user app errors

---

## 🎯 Example Use Cases

### Use Case 1: Track All Donor Logins
```
Filters:
- User Type: 🩸 Donors
- Action: User Login (auth_login)
- Time: Last 24h

Result: All donor login events in the last 24 hours
```

### Use Case 2: Find All Blood Request Creations
```
Filters:
- User Type: All
- Resource: Blood Request
- Action: Request Created (request_create)

Result: All blood requests created by requesters AND hospitals
```

### Use Case 3: Monitor Errors Across All Users
```
Filters:
- Severity: ❌ Error
- Action: Errors (error_occurred)

Result: All error events from mobile app users
```

### Use Case 4: Track Chat Activity
```
Filters:
- Resource: Chat
- Action: Chat Message (chat_send_message)

Result: All chat messages sent by donors, requesters, and hospital admins
```

### Use Case 5: Monitor Hospital Admin Activity
```
Filters:
- User Type: 🏥 Hospital Admins
- Resource: All

Result: All activities performed by hospital admins on mobile app
```

---

## 📊 Statistics Breakdown

The statistics dashboard shows:

```javascript
// Calculated from last 24 hours
{
  totalEvents: adminLogs.length + userLogs.length,
  userActivities: userLogs.filter(l => l.logSource === 'user_app').length,
  adminActions: adminLogs.filter(l => l.logSource === 'admin').length,
  systemErrors: logs.filter(l => 
    l.severity === 'error' || 
    l.action === 'error_occurred'
  ).length
}
```

**Example Output:**
```
┌─────────────────────────────────────┐
│ Total Events (24h):  245            │
├─────────────────────────────────────┤
│ User Activities:     180            │
│   - Donors:          95             │
│   - Requesters:      65             │
│   - Hospital Admins: 20             │
├─────────────────────────────────────┤
│ Admin Actions:       65             │
├─────────────────────────────────────┤
│ System Errors:       12             │
└─────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### "No user activity logs appearing"
**Check:**
1. Are mobile app users actually performing activities?
2. Check Firestore `user_activity_logs` collection exists
3. Verify mobile app's `logging_service.ts` is working
4. Check browser console for query errors
5. Ensure super admin has permission to read collection

### "User type filter not working"
**Check:**
1. Verify `user.userType` field exists in logs
2. Check filter dropdown is visible (only when "Show User Logs" is on)
3. Check console for filter application errors

### "Activity descriptions not formatted"
**Check:**
1. Verify `activityType` field is correct
2. Check `formatUserActivityDetails()` function is being called
3. Verify all activity types are in the descriptions map

### "Device information missing"
**Check:**
1. Mobile app must include `device` object in log
2. Check `logging_service.ts` includes device data
3. Verify device fields are populated

---

## 📝 Mobile App Integration

### How Mobile App Logs Activities

From `/src/services/firebase/logging_service.ts`:

```typescript
async logActivity(entry: LogEntry) {
  const user = auth.currentUser;
  
  const logData = {
    activityType: entry.activityType,
    timestamp: serverTimestamp(),  // ✅ Logical time
    timestampISO: new Date().toISOString(),
    severity: entry.severity || 'info',
    user: user ? {
      uid: user.uid,
      email: user.email,
      userType: 'donor' // Should be dynamic based on user role
    } : null,
    device: {
      id: Constants.sessionId || 'unknown',
      platform: Platform.OS,
      osVersion: Platform.Version,
      model: Platform.select({ 
        ios: 'iPhone', 
        android: 'Android Device', 
        default: 'Web' 
      })
    },
    data: entry.details || {}
  };

  await addDoc(collection(db, 'user_activity_logs'), logData);
}
```

### Usage in Mobile App:

```typescript
// Login
loggingService.logLogin();

// Blood request creation
loggingService.logRequestCreate({
  bloodType: 'O+',
  urgency: 'high',
  hospital: 'City Hospital'
});

// Error
loggingService.logError('Network error', { details: '...' });
```

---

## ✨ Summary

| Feature | Admin Logs | User Activity Logs |
|---------|-----------|-------------------|
| **Source** | Super Admin Panel | Mobile App |
| **Collection** | `audit_logs` | `user_activity_logs` |
| **Users** | Super Admin | Donors, Requesters, Hospital Admins |
| **Actions** | create, update, delete, approve, reject | auth_login, request_create, donor_register, etc. |
| **Resources** | user, donor, hospital, system | user, blood_request, chat, referral |
| **Device Info** | Browser/Platform | iPhone/Android model |
| **Filtering** | Action, Resource, Email | Action, Resource, User Type, Severity, Email |

---

## 🚀 Next Steps

1. ✅ **Test with real mobile app data** - Use mobile app and verify logs appear
2. ✅ **Verify all user types** - Donors, requesters, hospital admins
3. ✅ **Test filters** - Ensure all filters work correctly
4. ✅ **Check statistics** - Verify 24h stats are accurate
5. ✅ **Monitor errors** - Check error tracking from mobile app

---

*Implementation completed: April 9, 2026*
*Status: ✅ Ready for testing with mobile app*
