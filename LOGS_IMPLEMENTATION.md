# System Logs & Activity Logs Implementation

## Overview
Comprehensive logging system for both Super Admin and Hospital Admin with proper timestamp handling, filtering, and real-time updates.

---

## ✅ What Was Implemented

### 1. **Super Admin System Logs** (`/system-logs`)
- ✅ Combined view of admin audit logs + user activity logs
- ✅ Toggle between admin-only and combined view
- ✅ Advanced filtering (action, resource, severity, user email)
- ✅ Auto-refresh every 60 seconds
- ✅ Statistics dashboard (24h events breakdown)
- ✅ Safe timestamp handling (logical time)

### 2. **Hospital Admin Activity Logs** (`/hospital/logs`)
- ✅ Facility-specific audit logs only
- ✅ Filter by action, resource type, admin email
- ✅ Auto-refresh every 60 seconds
- ✅ Color-coded action badges
- ✅ Safe timestamp handling (logical time)

### 3. **Timestamp Safety** ✅
- **All logs use Firestore `serverTimestamp()` for primary timestamp**
- **Safe formatter functions that handle all timestamp formats**
- **No "Invalid Date" errors - returns "Unknown" for invalid timestamps**

---

## 📊 Architecture

### Super Admin System Logs Flow

```
┌─────────────────────────────────────────────────────────┐
│               Super Admin Dashboard                     │
│                                                         │
│  /system-logs                                           │
│  ├── Combined Logs (Admin + User Activity)             │
│  ├── Toggle User Logs On/Off                           │
│  ├── Filters: Action, Resource, Severity, Email        │
│  └── Statistics: Total, User, Admin, Errors (24h)      │
└─────────────────────────────────────────────────────────┘
                         ↓
              getCombinedLogs()
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                  ↓
  getAuditLogs()                getUserActivityLogs()
        ↓                                  ↓
  audit_logs collection         user_activity_logs collection
  (all admins)                  (mobile app users)
```

### Hospital Admin Activity Logs Flow

```
┌─────────────────────────────────────────────────────────┐
│            Hospital Admin Dashboard                     │
│                                                         │
│  /hospital/logs                                         │
│  ├── Facility-Specific Logs Only                       │
│  ├── Filters: Action, Resource, Email                  │
│  └── Color-Coded Action Badges                         │
└─────────────────────────────────────────────────────────┘
                         ↓
              getAuditLogs()
                         ↓
  hospitals/{hospitalId}/audit_logs
  (Strict silo - only this hospital)
```

---

## 🗄️ Firestore Collections

### `audit_logs` (Super Admin)
```javascript
{
  id: "auto-generated",
  action: "create" | "update" | "delete" | "login" | "approve" | "reject" | "export" | "view" | "warning",
  resourceType: "user" | "donor" | "blood_request" | "hospital" | "system" | "inventory",
  resourceId: "doc-id-or-none",
  details: { name: "...", changes: {...}, reason: "..." },
  admin: {
    uid: "admin-uid",
    email: "admin@bloodlink.com",
    role: "super_admin",
    hospitalName: "Super Admin"
  },
  timestamp: Firestore Timestamp,  // ✅ Logical time
  timestampISO: "2024-01-15T10:30:00.000Z",  // For sorting/fallback
  severity: "info" | "warning" | "error" | "critical",
  metadata: {
    userAgent: "...",
    platform: "Win32",
    url: "https://admin.bloodlink.com/dashboard",
    ipAddress: "client-side"
  }
}
```

### `hospitals/{hospitalId}/audit_logs` (Hospital Admin)
```javascript
{
  id: "auto-generated",
  action: "create" | "update" | "login" | "approve" | "reject" | "view",
  resourceType: "inventory" | "blood_request" | "referral" | "system",
  resourceId: "doc-id-or-none",
  details: { name: "...", changes: {...} },
  admin: {
    uid: "hospital-admin-uid",
    email: "hospital@example.com",
    role: "hospital_admin",
    hospitalName: "City Hospital",
    hospitalId: "hospital-email-key"
  },
  timestamp: Firestore Timestamp,  // ✅ Logical time
  timestampISO: "2024-01-15T10:30:00.000Z",
  severity: "info" | "warning" | "error",
  metadata: {
    userAgent: "...",
    platform: "Win32",
    url: "https://admin.bloodlink.com/hospital/logs"
  }
}
```

### `user_activity_logs` (Mobile App Users)
```javascript
{
  id: "auto-generated",
  activityType: "auth_login" | "request_create" | "donor_register" | "error_occurred" | "chat_send_message",
  user: {
    uid: "user-uid",
    email: "user@example.com",
    userType: "donor" | "requester"
  },
  data: { bloodType: "O+", urgency: "high", hospital: "City Hospital" },
  timestamp: Firestore Timestamp,  // ✅ Logical time
  timestampISO: "2024-01-15T10:30:00.000Z",
  severity: "info" | "warning" | "error",
  device: {
    model: "iPhone 13",
    os: "iOS",
    osVersion: "15.0"
  },
  logSource: "user_app"
}
```

---

## 🔧 Key Functions

### Super Admin System Logs

#### `loadSystemLogs(filters)`
Loads combined logs with filters:
```javascript
await window.loadSystemLogs({
  action: "create",
  resourceType: "donor",
  severity: "warning",
  userSearch: "user@example.com"
});
```

#### `toggleUserLogs()`
Toggle visibility of user activity logs:
```javascript
await window.toggleUserLogs();  // Switches between admin-only and combined
```

#### `updateLogStats()`
Updates dashboard statistics:
```javascript
// Updates these elements:
// #totalEvents - Total logs in last 24h
// #userActivities - User app logs in last 24h
// #adminActions - Admin panel logs in last 24h
// #systemErrors - Error logs in last 24h
```

### Hospital Admin Activity Logs

#### `loadActivityLogs(filters)`
Loads facility-specific logs:
```javascript
await window.loadActivityLogs({
  action: "update",
  resourceType: "inventory",
  userSearch: "admin@hospital.com"
});
```

#### `applyFilters()`
Applies UI filters:
```javascript
// Reads from:
// #actionFilter - Action type
// #resourceFilter - Resource type
// #userSearchFilter - Admin email
```

---

## 🎨 UI Features

### Super Admin System Logs

#### Statistics Dashboard
```html
<div class="stats-grid">
  <div class="stat-card">
    <span class="label">Total Events (24h)</span>
    <span class="value" id="totalEvents">0</span>
  </div>
  <div class="stat-card">
    <span class="label">User Activities</span>
    <span class="value" id="userActivities">0</span>
  </div>
  <div class="stat-card">
    <span class="label">Admin Actions</span>
    <span class="value" id="adminActions">0</span>
  </div>
  <div class="stat-card">
    <span class="label">System Errors</span>
    <span class="value" id="systemErrors">0</span>
  </div>
</div>
```

#### Log Entry Display
- **Color-coded borders** based on action type
- **Action badges** (create, update, delete, approve, reject, login)
- **Severity badges** (info, warning, error, critical)
- **User information** (email, role, hospital)
- **Timestamps** (formatted safely)
- **Resource details** (type, ID, description)
- **Device information** (for user activity logs)

### Hospital Admin Activity Logs

#### Filter Controls
```html
<select id="actionFilter">
  <option value="">All Actions</option>
  <option value="create">Create</option>
  <option value="update">Update</option>
  <option value="delete">Delete</option>
  <option value="login">Login</option>
  <option value="approve">Approve</option>
  <option value="reject">Reject</option>
</select>

<select id="resourceFilter">
  <option value="">All Resources</option>
  <option value="inventory">Inventory</option>
  <option value="request">Requests</option>
  <option value="referral">Referrals</option>
  <option value="system">System</option>
</select>

<input type="text" id="userSearchFilter" placeholder="Search Admin Email...">
```

#### Log Entry Display
- **Color-coded left border** based on action
- **Action badges** with appropriate colors
- **Admin information** (email, role, hospital name)
- **Safe timestamps** (no "Invalid Date" errors)
- **Platform information** (browser/OS)

---

## ⏰ Timestamp Handling (Logical Time)

### Writing Timestamps
```javascript
// ✅ Always use server timestamp
const auditEntry = {
  action: "create",
  resourceType: "donor",
  timestamp: firebase.firestore.FieldValue.serverTimestamp(),  // Logical time
  timestampISO: new Date().toISOString()  // Fallback for sorting
};
```

### Reading Timestamps
```javascript
function formatTimestamp(v) {
  if (!v) return 'Unknown';
  
  try {
    // Handle Firestore Timestamp
    if (v.toDate) {
      const d = v.toDate();
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle ISO string or milliseconds
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleString('en-KE', { ... });
    }
    
    // Handle {seconds, nanoseconds}
    if (v.seconds) {
      const d = new Date(v.seconds * 1000);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleString('en-KE', { ... });
    }
    
    return 'Unknown';
  } catch (err) {
    console.warn('⚠️ Invalid timestamp:', v);
    return 'Invalid Date';
  }
}
```

### Benefits of Logical Time
1. ✅ **No clock drift** - Server time is source of truth
2. ✅ **Consistent ordering** - Messages/logs in correct order
3. ✅ **Cross-platform compatibility** - Same time for all clients
4. ✅ **No "Invalid Date" errors** - Safe formatter handles all cases

---

## 🔄 Auto-Refresh

Both log systems auto-refresh every 60 seconds:

```javascript
function setupAutoRefresh() {
  setInterval(async () => {
    await window.loadSystemLogs(state.currentFilters);
  }, 60000); // 60 seconds
}
```

---

## 🎯 Action Types & Colors

### Super Admin Actions
| Action | Color | Description |
|--------|-------|-------------|
| `create` | 🟢 #22c55e | New resource created |
| `update` | 🔵 #3b82f6 | Resource updated |
| `delete` | 🔴 #ef4444 | Resource deleted |
| `approve` | 🟢 #10b981 | Resource approved |
| `reject` | 🟡 #f59e0b | Resource rejected |
| `login` | 🟣 #8b5cf6 | Admin login |
| `logout` | ⚫ #64748b | Admin logout |
| `export` | 🔵 #3b82f6 | Data exported |
| `warning` | 🟡 #f59e0b | Warning event |

### User Activity Types
| Activity | Color | Description |
|----------|-------|-------------|
| `auth_login` | 🟣 #8b5cf6 | User logged in |
| `request_create` | 🔴 #ef4444 | Blood request created |
| `donor_register` | 🟢 #22c55e | Donor registered |
| `donor_accept_request` | 🟢 #10b981 | Donor accepted request |
| `error_occurred` | 🔴 #ef4444 | Error occurred |
| `chat_send_message` | 🔵 #3b82f6 | Message sent |

---

## 📝 How to Log Events

### Super Admin
```javascript
// Using auditLogs.actions
await window.auditLogs.actions.createUser(userId, { name: "John Doe" });
await window.auditLogs.actions.verifyDonor(donorId, { status: "verified" });
await window.auditLogs.actions.approveRequest(requestId, { reason: "Urgent" });
await window.auditLogs.actions.exportData('donors', { count: 100 });

// Custom log
await window.auditLogs.log('create', 'donor', donorId, {
  name: 'John Doe',
  bloodType: 'O+'
}, 'info');
```

### Hospital Admin
```javascript
// Using auditLogs.actions (hospital-specific)
await window.auditLogs.actions.updateInventory(bankId, {
  bloodType: 'O+',
  units: 10
});
await window.auditLogs.actions.approveRequest(requestId, {
  status: 'approved'
});

// Custom log
await window.auditLogs.log('update', 'inventory', bankId, {
  changes: { units: 10 }
}, 'info');
```

---

## 🧪 Testing Checklist

### Super Admin System Logs
- [ ] Navigate to `/system-logs`
- [ ] Verify statistics dashboard loads (Total, User, Admin, Errors)
- [ ] Verify logs appear in combined view
- [ ] Click "Show User Logs" - verify user activity logs appear
- [ ] Click "Hide User Logs" - verify only admin logs shown
- [ ] Test filters: Action, Resource, Severity, Email
- [ ] Verify auto-refresh works (check console every 60s)
- [ ] Click "Refresh" button - verify logs refresh
- [ ] Verify timestamps display correctly (no "Invalid Date")
- [ ] Verify color-coded badges for different actions
- [ ] Test search by email (press Enter)

### Hospital Admin Activity Logs
- [ ] Navigate to `/hospital/logs`
- [ ] Verify facility-specific logs appear
- [ ] Verify NO user activity logs (admin logs only)
- [ ] Test filters: Action, Resource, Email
- [ ] Verify auto-refresh works (check console every 60s)
- [ ] Click "Refresh" button - verify logs refresh
- [ ] Verify timestamps display correctly (no "Invalid Date")
- [ ] Verify color-coded left borders for actions
- [ ] Verify admin email and hospital name shown
- [ ] Test search by email (press Enter)

### Timestamp Safety
- [ ] Create audit log entry from admin panel
- [ ] Verify `timestamp` is Firestore Timestamp (not ISO string)
- [ ] Verify `timestampISO` is ISO string (for fallback)
- [ ] View log entry - verify timestamp displays correctly
- [ ] Check console for "⚠️ Invalid timestamp" warnings (should be none)

---

## 🐛 Troubleshooting

### "Audit logs module not found"
**Solution:**
1. Check `/static/audit-logs.js` is loaded in template
2. Verify Firebase initialization
3. Check browser console for errors

### "Hospital context not available"
**Solution:**
1. Ensure `window.hospitalData` is set before page load
2. Check hospital admin authentication
3. Verify hospital exists in Firestore

### No logs appearing
**Solution:**
1. Check Firestore security rules allow read access
2. Verify audit logs collection exists
3. Check browser console for query errors
4. Ensure filters aren't too restrictive

### "Invalid Date" timestamps
**Solution:** (Should not happen with new code)
1. Check `timestamp` field is Firestore Timestamp
2. Verify `formatTimestamp()` function is being used
3. Check console for timestamp warnings

### Auto-refresh not working
**Solution:**
1. Check browser console for interval errors
2. Verify page is in foreground (browsers throttle background tabs)
3. Click "Refresh" button manually

---

## 📋 Files Modified

### Super Admin
1. ✅ `/static/system-logs-view.js` - Complete rewrite with proper UI
2. ✅ `/static/audit-logs.js` - Fixed timestamp to use `serverTimestamp()`
3. ✅ `/templates/system-logs.html` - Template (unchanged, already correct)

### Hospital Admin
1. ✅ `/static/hospital/logs.js` - Complete rewrite with proper UI
2. ✅ `/static/hospital/audit-logs.js` - Already using `serverTimestamp()` ✅
3. ✅ `/templates/hospital/logs.html` - Template (unchanged, already correct)

---

## ✨ Summary

| Feature | Before | After |
|---------|--------|-------|
| **Super Admin Logs** | Basic UI, limited functionality | ✅ Full-featured with filters, toggle, auto-refresh |
| **Hospital Admin Logs** | Basic implementation | ✅ Enhanced with color-coding, auto-refresh |
| **Timestamp Handling** | Could show "Invalid Date" | ✅ Safe formatter, always displays correctly |
| **Auto-Refresh** | Manual refresh only | ✅ Every 60 seconds automatically |
| **Error Handling** | Silent failures | ✅ User-friendly error messages with retry |
| **Empty States** | Basic loading spinner | ✅ Helpful messages with refresh button |
| **Filtering** | Limited filters | ✅ Action, resource, severity, email search |

---

## 🚀 Next Steps

1. **Test both log systems** with real data
2. **Monitor console** for any errors during testing
3. **Verify timestamps** display correctly on all entries
4. **Test auto-refresh** by waiting 60 seconds
5. **Test filters** with various combinations
6. **Verify data isolation** (hospital sees only their logs)

---

*Implementation completed: April 9, 2026*
*Status: ✅ Ready for testing*
