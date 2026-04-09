# Blood Bank Inventory Synchronization

## Overview
This document describes the bidirectional synchronization system between Super Admin and Hospital Admin for blood bank inventory management.

## Architecture

### Data Flow
```
Super Admin Panel ←→ RTDB (Realtime Database) ←→ Sync Service ←→ Firestore ←→ Hospital Admin Panel
```

### Primary Data Sources
- **Super Admin**: Uses Firebase Realtime Database (RTDB) as the master source
  - Path: `bloodBanks/{bankId}/inventory`
  - Structure: `{ bloodType: { units: number, lastUpdated: timestamp } }`

- **Hospital Admin**: Uses Firestore as the master source
  - Path: `hospitals/{emailKey}/inventory/{bloodType}`
  - Structure: `{ units: number, lastUpdated: serverTimestamp, updatedBy: email }`

## Synchronization Mechanism

### 1. **Inventory Sync Service** (`inventory-sync-service.js`)
A unified service that manages bidirectional synchronization with the following features:

#### Key Features:
- ✅ **Bidirectional Sync**: RTDB ↔ Firestore
- ✅ **Conflict Resolution**: Three strategies available
- ✅ **Real-time Listeners**: Automatic sync on changes
- ✅ **Debouncing**: Prevents rapid successive updates
- ✅ **Sync Status Notifications**: Visual feedback
- ✅ **Error Handling**: Graceful degradation
- ✅ **Audit Trail Integration**: Logs all sync operations

#### Conflict Resolution Strategies:
1. **latest_wins** (default): Most recent timestamp wins
2. **super_admin_wins**: Super Admin updates take priority
3. **hospital_wins**: Hospital Admin updates take priority

### 2. **Super Admin Updates** (`super_admin_hospitals.html`)

When Super Admin saves inventory:
```javascript
1. Update RTDB (master for Super Admin)
   ├─ bloodBanks/{bankId}/inventory
   └─ bloodBanks/{bankId}/updatedAt

2. Sync to Firestore (for Hospital Admin visibility)
   ├─ Check if hospital exists in Firestore
   ├─ Batch write to hospitals/{emailKey}/inventory/{bloodType}
   ├─ Apply conflict resolution if needed
   └─ Start real-time sync listeners

3. Log audit trail
   └─ Record inventory update with sync metadata
```

### 3. **Hospital Admin Updates** (`hospital/hospital-admin.js`)

When Hospital Admin saves inventory:
```javascript
1. Update Firestore (master for Hospital Admin)
   ├─ hospitals/{emailKey}/inventory/{bloodType}
   └─ Include updatedBy and serverTimestamp

2. Sync to RTDB (for Super Admin visibility)
   ├─ Update bloodBanks/{bankId}/inventory
   ├─ Update bloodBanks/{bankId}/updatedAt
   └─ Mark lastSyncFrom: 'hospital_admin'

3. Start real-time sync listeners
   └─ Ensures future changes are synchronized

4. Log audit trail
   └─ Record with syncedToRTDB flag
```

## Real-Time Synchronization

### How It Works:
1. **RTDB Listener** (Super Admin changes):
   - Listens to `bloodBanks/{bankId}/inventory`
   - On change → syncs to Firestore
   - Debounced to prevent rapid updates (1s delay)

2. **Firestore Listener** (Hospital Admin changes):
   - Listens to each `hospitals/{emailKey}/inventory/{bloodType}`
   - On change → syncs to RTDB
   - Debounced to prevent rapid updates (1s delay)

3. **Automatic Start**:
   - Sync starts when inventory is saved
   - Continues until page is closed or manually stopped

### Listener Lifecycle:
```javascript
// Start sync (called automatically on save)
InventorySyncService.startSync(hospitalEmail, bankId);

// Stop sync (called on page unload or manually)
InventorySyncService.stopSync(hospitalEmail, bankId);

// Force immediate sync
InventorySyncService.forceSync(hospitalEmail, bankId, 'both');
```

## Conflict Resolution

### Scenario:
Both Super Admin and Hospital Admin update inventory at the same time.

### Resolution Process:
```javascript
1. Fetch current state from both sources
2. Compare timestamps for each blood type
3. Apply conflict resolution strategy
4. Write resolved state to both databases
5. Log conflict resolution in metadata
```

### Example:
```javascript
// Super Admin sets A+ to 50 units at 10:00:05
// Hospital Admin sets A+ to 45 units at 10:00:03

// With 'latest_wins' strategy:
// Result: A+ = 50 units (Super Admin's value wins)

// With 'hospital_wins' strategy:
// Result: A+ = 45 units (Hospital Admin's value wins)

// With 'super_admin_wins' strategy:
// Result: A+ = 50 units (Super Admin's value wins)
```

### Changing Strategy:
```javascript
InventorySyncService.setConflictResolution('super_admin_wins');
```

## Error Handling

### Graceful Degradation:
1. **Firestore Unavailable**: 
   - RTDB update succeeds
   - Firestore sync skipped with warning
   - Super Admin sees success message

2. **RTDB Unavailable**:
   - Firestore update succeeds
   - RTDB sync skipped with warning
   - Hospital Admin sees success message

3. **Network Errors**:
   - Retried automatically (Firebase SDK handles this)
   - Failed sync logged but doesn't block operation
   - Next save will retry sync

### Error Messages:
```javascript
// Warning (non-critical)
"⚠️ Firestore sync failed (non-critical): ..."

// Error (operation failed)
"❌ Inventory update failed: ..."
```

## Monitoring & Debugging

### Check Sync Status:
```javascript
const status = InventorySyncService.getSyncStatus();
console.log(status);
// {
//   activeListeners: 2,
//   pendingSyncs: 0,
//   syncInProgress: 0,
//   lastSyncTime: { ... },
//   conflictResolution: 'latest_wins',
//   updateHistorySize: 5
// }
```

### View Sync History:
```javascript
const history = InventorySyncService.getSyncHistory();
console.log(history);
// [
//   { source: 'super_admin', inventory: {...}, timestamp: 1234567890 },
//   { source: 'hospital_admin', inventory: {...}, timestamp: 1234567880 }
// ]
```

### Listen to Sync Events:
```javascript
window.addEventListener('inventorySync', (event) => {
    const { status, message, timestamp } = event.detail;
    console.log(`Sync ${status}: ${message}`);
});
```

## Testing the Synchronization

### Test 1: Super Admin → Hospital Admin Sync
1. Open Super Admin panel (`/blood-banks`)
2. Open Hospital Admin panel (`/hospital/dashboard`)
3. Super Admin edits inventory and saves
4. Verify:
   - ✅ RTDB updated immediately
   - ✅ Firestore updated within 1-2 seconds
   - ✅ Hospital Admin sees updated values on refresh
   - ✅ Console shows: "✅ RTDB → Firestore sync completed"

### Test 2: Hospital Admin → Super Admin Sync
1. Open both admin panels
2. Hospital Admin edits inventory and saves
3. Verify:
   - ✅ Firestore updated immediately
   - ✅ RTDB updated within 1-2 seconds
   - ✅ Super Admin sees updated values on refresh
   - ✅ Console shows: "✅ Firestore → RTDB sync completed"

### Test 3: Conflict Resolution
1. Open both admin panels
2. Super Admin sets A+ to 100 units
3. Immediately, Hospital Admin sets A+ to 50 units
4. Check console for conflict resolution message
5. Verify resolved value based on strategy:
   - `latest_wins`: Should be 100 (if Super Admin was later)
   - `super_admin_wins`: Should be 100
   - `hospital_wins`: Should be 50

### Test 4: Real-Time Sync
1. Open both admin panels
2. Super Admin saves inventory
3. Real-time sync listener should start
4. Hospital Admin saves inventory
5. Should automatically sync to RTDB
6. Verify both databases are in sync

## Data Structure

### RTDB Structure:
```json
{
  "bloodBanks": {
    "bankId123": {
      "name": "Example Hospital",
      "email": "hospital@example.com",
      "inventory": {
        "A+": { "units": 50, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "A-": { "units": 20, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "B+": { "units": 30, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "B-": { "units": 15, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "AB+": { "units": 10, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "AB-": { "units": 5, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "O+": { "units": 40, "lastUpdated": "2026-04-09T10:00:00.000Z" },
        "O-": { "units": 25, "lastUpdated": "2026-04-09T10:00:00.000Z" }
      },
      "updatedAt": 1712664000000,
      "lastSyncFrom": "super_admin"
    }
  }
}
```

### Firestore Structure:
```
hospitals/
  hospital,example,com/
    inventory/
      A+/:
        units: 50
        lastUpdated: Timestamp(2026-04-09T10:00:00.000Z)
        updatedBy: "hospital@example.com"
        syncedFrom: "rtdb"
        lastSyncAt: "2026-04-09T10:00:00.000Z"
        conflictResolved: "latest_wins"
      A-/:
        units: 20
        lastUpdated: Timestamp(2026-04-09T10:00:00.000Z)
        updatedBy: "hospital@example.com"
        syncedFrom: "rtdb"
        lastSyncAt: "2026-04-09T10:00:00.000Z"
        conflictResolved: "latest_wins"
      // ... other blood types
```

## Performance Considerations

### Debouncing:
- 1-second debounce prevents rapid successive syncs
- Allows multiple UI updates to batch into single sync

### Batch Operations:
- Firestore uses batch writes for all 8 blood types
- RTDB uses single update operation
- Ensures atomic updates

### Memory Management:
- Update history limited to 50 entries
- Oldest entries cleaned up automatically
- Listeners cleaned up on page unload

## Troubleshooting

### Sync Not Working:
1. Check browser console for errors
2. Verify both Firebase and Firestore are initialized
3. Check if hospital exists in Firestore
4. Verify `currentBankId` is set correctly
5. Check `InventorySyncService.getSyncStatus()`

### Inventory Not Updating:
1. Verify network connection
2. Check Firebase security rules
3. Ensure hospital email matches between RTDB and Firestore
4. Check if sync listeners are active

### Multiple Updates Overriding:
1. Check conflict resolution strategy
2. Review sync history: `InventorySyncService.getSyncHistory()`
3. Consider changing strategy if one admin should have priority

## Future Enhancements

- [ ] Offline support with queue-based sync
- [ ] Manual conflict resolution UI
- [ ] Sync status indicator in UI
- [ ] Sync delay configuration
- [ ] Bulk sync operations for multiple hospitals
- [ ] Sync analytics and reporting

## Related Files

- `/static/inventory-sync-service.js` - Core sync service
- `/templates/super_admin_hospitals.html` - Super Admin inventory management
- `/static/hospital/hospital-admin.js` - Hospital Admin inventory management
- `/templates/base.html` - Includes sync service globally

## Support

For issues or questions about the synchronization system:
1. Check browser console for error messages
2. Review sync status and history
3. Test with provided test scenarios
4. Check Firebase Console for database state
