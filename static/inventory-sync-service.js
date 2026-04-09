/**
 * Inventory Sync Service
 * Provides bidirectional synchronization between Super Admin (RTDB) and Hospital Admin (Firestore)
 * Handles conflict resolution, real-time updates, and error recovery
 */

(function () {
    'use strict';

    // Sync state tracking
    const syncState = {
        listeners: {},
        pendingSyncs: new Map(),
        lastSyncTime: {},
        conflictResolution: 'latest_wins', // Can be 'latest_wins', 'super_admin_wins', 'hospital_wins'
        syncInProgress: new Set(),
        updateHistory: new Map() // Track recent updates for conflict resolution
    };

    const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    /**
     * Resolve conflicts between competing updates
     * @param {Object} current - Current inventory state
     * @param {Object} incoming - Incoming inventory update
     * @param {string} source - Source of incoming update
     * @returns {Object} Resolved inventory
     */
    function resolveConflict(current, incoming, source) {
        const resolved = {};
        const now = Date.now();

        BLOOD_TYPES.forEach(type => {
            const currentValue = current[type] || { units: 0, lastUpdated: 0 };
            const incomingValue = incoming[type] || { units: 0, lastUpdated: now };

            // Get timestamps for comparison
            const currentTime = typeof currentValue.lastUpdated === 'object' 
                ? new Date(currentValue.lastUpdated).getTime() 
                : typeof currentValue.lastUpdated === 'string' 
                    ? new Date(currentValue.lastUpdated).getTime() 
                    : currentValue.lastUpdated;

            const incomingTime = typeof incomingValue.lastUpdated === 'object'
                ? new Date(incomingValue.lastUpdated).getTime()
                : typeof incomingValue.lastUpdated === 'string'
                    ? new Date(incomingValue.lastUpdated).getTime()
                    : incomingValue.lastUpdated;

            // Apply conflict resolution strategy
            switch (syncState.conflictResolution) {
                case 'super_admin_wins':
                    resolved[type] = source === 'super_admin' ? incomingValue : currentValue;
                    break;

                case 'hospital_wins':
                    resolved[type] = source === 'hospital_admin' ? incomingValue : currentValue;
                    break;

                case 'latest_wins':
                default:
                    resolved[type] = incomingTime >= currentTime ? incomingValue : currentValue;
                    break;
            }
        });

        return resolved;
    }

    /**
     * Track update in history for conflict resolution
     */
    function trackUpdate(source, inventory) {
        const historyKey = `${source}_${Date.now()}`;
        syncState.updateHistory.set(historyKey, {
            source,
            inventory,
            timestamp: Date.now()
        });

        // Keep only last 50 updates to prevent memory leaks
        if (syncState.updateHistory.size > 50) {
            const oldestKeys = Array.from(syncState.updateHistory.keys()).slice(0, 10);
            oldestKeys.forEach(key => syncState.updateHistory.delete(key));
        }
    }

    /**
     * Initialize the sync service
     */
    window.InventorySyncService = {
        /**
         * Start real-time sync listeners for inventory changes
         * @param {string} hospitalEmail - Hospital email to listen for
         * @param {string} bankId - RTDB bank ID
         */
        startSync: function (hospitalEmail, bankId) {
            const emailKey = hospitalEmail.replace(/\./g, ',');

            // Stop existing listeners if any
            this.stopSync(hospitalEmail, bankId);

            console.log(`🔄 Starting inventory sync for ${hospitalEmail} (bank: ${bankId})`);

            // Listen to RTDB changes (Super Admin updates)
            if (window.database && bankId) {
                const rtdbRef = window.database.ref(`bloodBanks/${bankId}/inventory`);
                const rtdbListener = rtdbRef.on('value', (snapshot) => {
                    const rtdbInventory = snapshot.val() || {};
                    console.log('📡 RTDB inventory changed:', rtdbInventory);
                    this.syncFromRTDBToFirestore(emailKey, rtdbInventory, 'super_admin');
                }, (error) => {
                    console.error('❌ RTDB sync listener error:', error);
                });

                syncState.listeners[`${hospitalEmail}_rtdb`] = { ref: rtdbRef, listener: rtdbListener };
            }

            // Listen to Firestore changes (Hospital Admin updates)
            if (window.firestore && emailKey) {
                this.listenToFirestoreChanges(emailKey, bankId);
            }
        },

        /**
         * Stop sync listeners
         * @param {string} hospitalEmail - Hospital email
         * @param {string} bankId - RTDB bank ID
         */
        stopSync: function (hospitalEmail, bankId) {
            const emailKey = hospitalEmail.replace(/\./g, ',');
            const rtdbKey = `${hospitalEmail}_rtdb`;
            const firestoreKey = `${emailKey}_firestore`;

            if (syncState.listeners[rtdbKey] && window.database) {
                try {
                    syncState.listeners[rtdbKey].ref.off(syncState.listeners[rtdbKey].listener);
                    console.log(`⏹️ Stopped RTDB listener for ${hospitalEmail}`);
                } catch (e) {
                    console.error('Error stopping RTDB listener:', e);
                }
                delete syncState.listeners[rtdbKey];
            }

            if (syncState.listeners[firestoreKey]) {
                try {
                    syncState.listeners[firestoreKey].unsubscribe();
                    console.log(`⏹️ Stopped Firestore listener for ${emailKey}`);
                } catch (e) {
                    console.error('Error stopping Firestore listener:', e);
                }
                delete syncState.listeners[firestoreKey];
            }
        },

        /**
         * Sync inventory from RTDB to Firestore
         * @param {string} emailKey - Firestore email key
         * @param {Object} rtdbInventory - RTDB inventory data
         * @param {string} source - Source of update ('super_admin' or 'hospital_admin')
         */
        syncFromRTDBToFirestore: async function (emailKey, rtdbInventory, source = 'super_admin') {
            if (!window.firestore || !emailKey) {
                console.warn('⚠️ Firestore not available for sync');
                return;
            }

            // Check if hospital exists in Firestore
            try {
                const hospitalDoc = await window.firestore.collection('hospitals').doc(emailKey).get();
                if (!hospitalDoc.exists) {
                    console.log(`ℹ️ Hospital ${emailKey} not in Firestore, skipping RTDB->Firestore sync`);
                    return;
                }
            } catch (error) {
                console.error('❌ Error checking hospital in Firestore:', error);
                return;
            }

            // Check if sync is already in progress
            const syncKey = `rtdb_to_firestore_${emailKey}`;
            if (syncState.syncInProgress.has(syncKey)) {
                console.log('⏳ Sync already in progress, skipping');
                return;
            }

            syncState.syncInProgress.add(syncKey);

            try {
                // Fetch current Firestore inventory for conflict resolution
                const currentFirestoreInventory = {};
                const fetchPromises = BLOOD_TYPES.map(async (type) => {
                    const docRef = window.firestore.collection('hospitals')
                        .doc(emailKey)
                        .collection('inventory')
                        .doc(type);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        currentFirestoreInventory[type] = doc.data();
                    }
                });
                await Promise.all(fetchPromises);

                // Apply conflict resolution
                const resolvedInventory = resolveConflict(
                    currentFirestoreInventory,
                    rtdbInventory,
                    source
                );

                // Track this update
                trackUpdate(source, resolvedInventory);

                // Batch write to Firestore
                const batch = window.firestore.batch();
                const timestamp = new Date().toISOString();

                BLOOD_TYPES.forEach(type => {
                    const resolvedData = resolvedInventory[type] || { units: 0, lastUpdated: timestamp };
                    const invRef = window.firestore.collection('hospitals')
                        .doc(emailKey)
                        .collection('inventory')
                        .doc(type);

                    batch.set(invRef, {
                        units: resolvedData.units || 0,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: source,
                        syncedFrom: 'rtdb',
                        lastSyncAt: timestamp,
                        conflictResolved: syncState.conflictResolution
                    }, { merge: true });
                });

                await batch.commit();
                console.log(`✅ RTDB → Firestore sync completed for ${emailKey} (${syncState.conflictResolution})`);

                // Update last sync time
                syncState.lastSyncTime[syncKey] = Date.now();

                // Notify UI of sync completion
                this.notifySyncStatus('success', 'RTDB → Firestore sync completed');

            } catch (error) {
                console.error('❌ RTDB → Firestore sync failed:', error);
                this.notifySyncStatus('error', 'RTDB → Firestore sync failed: ' + error.message);
            } finally {
                syncState.syncInProgress.delete(syncKey);
            }
        },

        /**
         * Sync inventory from Firestore to RTDB
         * @param {string} emailKey - Firestore email key
         * @param {string} bankId - RTDB bank ID
         * @param {string} source - Source of update ('hospital_admin' or 'super_admin')
         */
        syncFromFirestoreToRTDB: async function (emailKey, bankId, source = 'hospital_admin') {
            if (!window.database || !bankId) {
                console.warn('⚠️ RTDB not available for sync');
                return;
            }

            const syncKey = `firestore_to_rtdb_${bankId}`;
            if (syncState.syncInProgress.has(syncKey)) {
                console.log('⏳ Sync already in progress, skipping');
                return;
            }

            syncState.syncInProgress.add(syncKey);

            try {
                // Fetch current RTDB inventory for conflict resolution
                const rtdbSnapshot = await window.database.ref(`bloodBanks/${bankId}/inventory`).once('value');
                const currentRTDBInventory = rtdbSnapshot.val() || {};

                // Fetch all blood type inventories from Firestore
                const firestoreInventory = {};
                const promises = BLOOD_TYPES.map(async (type) => {
                    const docRef = window.firestore.collection('hospitals')
                        .doc(emailKey)
                        .collection('inventory')
                        .doc(type);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        firestoreInventory[type] = doc.data();
                    }
                });

                await Promise.all(promises);

                // Apply conflict resolution
                const resolvedInventory = resolveConflict(
                    currentRTDBInventory,
                    firestoreInventory,
                    source
                );

                // Track this update
                trackUpdate(source, resolvedInventory);

                // Prepare RTDB update
                const rtdbUpdates = {};
                const timestamp = new Date().toISOString();

                BLOOD_TYPES.forEach(type => {
                    const resolvedData = resolvedInventory[type] || { units: 0, lastUpdated: timestamp };
                    rtdbUpdates[`${type}/units`] = resolvedData.units || 0;
                    rtdbUpdates[`${type}/lastUpdated`] = resolvedData.lastUpdated?.toDate?.()?.toISOString() || 
                                                       typeof resolvedData.lastUpdated === 'string' ? resolvedData.lastUpdated : timestamp;
                });

                // Update RTDB
                await window.database.ref(`bloodBanks/${bankId}/inventory`).update(rtdbUpdates);
                await window.database.ref(`bloodBanks/${bankId}`).update({
                    updatedAt: timestamp,
                    lastSyncFrom: source,
                    conflictResolution: syncState.conflictResolution
                });

                console.log(`✅ Firestore → RTDB sync completed for bank ${bankId} (${syncState.conflictResolution})`);
                syncState.lastSyncTime[syncKey] = Date.now();

                // Notify UI of sync completion
                this.notifySyncStatus('success', 'Firestore → RTDB sync completed');

            } catch (error) {
                console.error('❌ Firestore → RTDB sync failed:', error);
                this.notifySyncStatus('error', 'Firestore → RTDB sync failed: ' + error.message);
            } finally {
                syncState.syncInProgress.delete(syncKey);
            }
        },

        /**
         * Listen to Firestore inventory changes
         * @param {string} emailKey - Firestore email key
         * @param {string} bankId - RTDB bank ID
         */
        listenToFirestoreChanges: function (emailKey, bankId) {
            if (!window.firestore) return;

            // Listen to each blood type document
            const unsubscribes = BLOOD_TYPES.map(type => {
                const docRef = window.firestore.collection('hospitals')
                    .doc(emailKey)
                    .collection('inventory')
                    .doc(type);

                return docRef.onSnapshot((doc) => {
                    if (doc.exists) {
                        console.log(`📡 Firestore inventory changed for ${type}:`, doc.data());
                        // Sync to RTDB after a debounce period
                        this.debounceSyncToRTDB(emailKey, bankId, 'hospital_admin');
                    }
                }, (error) => {
                    console.error(`❌ Firestore snapshot error for ${type}:`, error);
                });
            });

            const firestoreKey = `${emailKey}_firestore`;
            syncState.listeners[firestoreKey] = {
                unsubscribes,
                unsubscribe: () => unsubscribes.forEach(unsub => unsub())
            };
        },

        /**
         * Debounced sync to RTDB to avoid multiple rapid updates
         */
        debounceTimers: {},
        debounceSyncToRTDB: function (emailKey, bankId, source) {
            const key = `${emailKey}_${bankId}`;
            if (this.debounceTimers[key]) {
                clearTimeout(this.debounceTimers[key]);
            }

            this.debounceTimers[key] = setTimeout(() => {
                this.syncFromFirestoreToRTDB(emailKey, bankId, source);
                delete this.debounceTimers[key];
            }, 1000); // 1 second debounce
        },

        /**
         * Force immediate sync in both directions
         * @param {string} hospitalEmail - Hospital email
         * @param {string} bankId - RTDB bank ID
         * @param {string} direction - 'both', 'rtdb_to_firestore', 'firestore_to_rtdb'
         */
        forceSync: async function (hospitalEmail, bankId, direction = 'both') {
            const emailKey = hospitalEmail.replace(/\./g, ',');

            console.log(`🔄 Force syncing inventory for ${hospitalEmail} (direction: ${direction})`);

            if (direction === 'both' || direction === 'rtdb_to_firestore') {
                if (window.database && bankId) {
                    const snapshot = await window.database.ref(`bloodBanks/${bankId}/inventory`).once('value');
                    const rtdbInventory = snapshot.val() || {};
                    await this.syncFromRTDBToFirestore(emailKey, rtdbInventory, 'super_admin');
                }
            }

            if (direction === 'both' || direction === 'firestore_to_rtdb') {
                await this.syncFromFirestoreToRTDB(emailKey, bankId, 'hospital_admin');
            }

            console.log(`✅ Force sync completed for ${hospitalEmail}`);
        },

        /**
         * Get sync status
         */
        getSyncStatus: function () {
            return {
                activeListeners: Object.keys(syncState.listeners).length,
                pendingSyncs: syncState.pendingSyncs.size,
                syncInProgress: syncState.syncInProgress.size,
                lastSyncTime: syncState.lastSyncTime,
                conflictResolution: syncState.conflictResolution,
                updateHistorySize: syncState.updateHistory.size
            };
        },

        /**
         * Notify UI of sync status
         */
        notifySyncStatus: function (status, message) {
            // Dispatch custom event for UI components to listen to
            const event = new CustomEvent('inventorySync', {
                detail: { status, message, timestamp: Date.now() }
            });
            window.dispatchEvent(event);

            console.log(`📡 Sync Event [${status}]: ${message}`);
        },

        /**
         * Set conflict resolution strategy
         */
        setConflictResolution: function (strategy) {
            if (['latest_wins', 'super_admin_wins', 'hospital_wins'].includes(strategy)) {
                syncState.conflictResolution = strategy;
                console.log(`✅ Conflict resolution strategy set to: ${strategy}`);
            } else {
                console.warn('⚠️ Invalid conflict resolution strategy:', strategy);
            }
        },

        /**
         * Get recent update history
         */
        getSyncHistory: function () {
            return Array.from(syncState.updateHistory.values()).sort((a, b) => b.timestamp - a.timestamp);
        },

        /**
         * Clear sync history
         */
        clearSyncHistory: function () {
            syncState.updateHistory.clear();
            console.log('🗑️ Sync history cleared');
        },

        /**
         * Cleanup all listeners
         */
        cleanup: function () {
            Object.keys(syncState.listeners).forEach(key => {
                if (syncState.listeners[key].unsubscribe) {
                    syncState.listeners[key].unsubscribe();
                }
            });
            syncState.listeners = {};
            syncState.pendingSyncs.clear();
            Object.keys(this.debounceTimers).forEach(key => {
                clearTimeout(this.debounceTimers[key]);
                delete this.debounceTimers[key];
            });
        }
    };

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        window.InventorySyncService.cleanup();
    });

    console.log('✅ Inventory Sync Service loaded');
})();
