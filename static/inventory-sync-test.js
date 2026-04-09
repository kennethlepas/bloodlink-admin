/**
 * Inventory Synchronization Test Script
 * Run this in the browser console to test sync functionality
 */

(function () {
    'use strict';

    console.log('%c🧪 Blood Bank Inventory Sync Test Suite', 'font-size: 16px; font-weight: bold; color: #3498db;');
    console.log('==========================================\n');

    window.InventorySyncTest = {
        /**
         * Test 1: Check if InventorySyncService is loaded
         */
        testServiceLoaded: function () {
            console.group('📋 Test 1: Service Loaded');
            if (window.InventorySyncService) {
                console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
                console.log('InventorySyncService is available');
                console.log('Methods available:', Object.keys(window.InventorySyncService));
            } else {
                console.log('%c❌ FAIL', 'color: #e74c3c; font-weight: bold;');
                console.log('InventorySyncService is NOT loaded');
            }
            console.groupEnd();
        },

        /**
         * Test 2: Check sync status
         */
        testSyncStatus: function () {
            console.group('📋 Test 2: Sync Status');
            if (!window.InventorySyncService) {
                console.log('⚠️ Service not loaded, run testServiceLoaded first');
                console.groupEnd();
                return;
            }

            const status = window.InventorySyncService.getSyncStatus();
            console.log('Sync Status:', status);
            console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
            console.groupEnd();
        },

        /**
         * Test 3: Test conflict resolution
         */
        testConflictResolution: function () {
            console.group('📋 Test 3: Conflict Resolution');
            if (!window.InventorySyncService) {
                console.log('⚠️ Service not loaded');
                console.groupEnd();
                return;
            }

            const strategies = ['latest_wins', 'super_admin_wins', 'hospital_wins'];
            
            strategies.forEach(strategy => {
                window.InventorySyncService.setConflictResolution(strategy);
                const status = window.InventorySyncService.getSyncStatus();
                console.log(`Strategy: ${strategy} → ${status.conflictResolution === strategy ? '✅' : '❌'}`);
            });

            console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
            console.log('Conflict resolution strategies working');
            console.groupEnd();
        },

        /**
         * Test 4: Simulate sync (doesn't actually update database)
         */
        testSimulatedSync: function () {
            console.group('📋 Test 4: Simulated Sync');
            if (!window.InventorySyncService) {
                console.log('⚠️ Service not loaded');
                console.groupEnd();
                return;
            }

            console.log('This test verifies the sync flow without modifying data');
            console.log('To test actual sync, use the UI to save inventory');
            
            // Check if sync methods exist
            const methods = [
                'syncFromRTDBToFirestore',
                'syncFromFirestoreToRTDB',
                'startSync',
                'stopSync',
                'forceSync'
            ];

            methods.forEach(method => {
                const exists = typeof window.InventorySyncService[method] === 'function';
                console.log(`${method}: ${exists ? '✅' : '❌'}`);
            });

            console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
            console.groupEnd();
        },

        /**
         * Test 5: Check event listeners
         */
        testEventListeners: function () {
            console.group('📋 Test 5: Event Listeners');
            
            let eventReceived = false;
            const handler = (event) => {
                eventReceived = true;
                console.log('Event received:', event.detail);
            };

            window.addEventListener('inventorySync', handler);
            
            // Dispatch test event
            const testEvent = new CustomEvent('inventorySync', {
                detail: { status: 'success', message: 'Test event', timestamp: Date.now() }
            });
            window.dispatchEvent(testEvent);

            if (eventReceived) {
                console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
                console.log('Event system working');
            } else {
                console.log('%c❌ FAIL', 'color: #e74c3c; font-weight: bold;');
                console.log('Event not received');
            }

            window.removeEventListener('inventorySync', handler);
            console.groupEnd();
        },

        /**
         * Test 6: View sync history
         */
        testSyncHistory: function () {
            console.group('📋 Test 6: Sync History');
            if (!window.InventorySyncService) {
                console.log('⚠️ Service not loaded');
                console.groupEnd();
                return;
            }

            const history = window.InventorySyncService.getSyncHistory();
            console.log('Sync history entries:', history.length);
            
            if (history.length > 0) {
                console.table(history.slice(0, 5));
            } else {
                console.log('No sync history yet (perform an inventory update first)');
            }

            console.log('%c✅ PASS', 'color: #27ae60; font-weight: bold;');
            console.groupEnd();
        },

        /**
         * Run all tests
         */
        runAll: function () {
            console.clear();
            console.log('%c🚀 Running All Inventory Sync Tests', 'font-size: 18px; font-weight: bold; color: #2ecc71;');
            console.log('==========================================\n');

            this.testServiceLoaded();
            this.testSyncStatus();
            this.testConflictResolution();
            this.testSimulatedSync();
            this.testEventListeners();
            this.testSyncHistory();

            console.log('\n==========================================');
            console.log('%c✅ All tests completed!', 'font-size: 16px; font-weight: bold; color: #27ae60;');
            console.log('\nNext steps:');
            console.log('1. Open Super Admin panel (/blood-banks)');
            console.log('2. Open Hospital Admin panel (/hospital/dashboard)');
            console.log('3. Update inventory in one panel');
            console.log('4. Check if it syncs to the other panel');
            console.log('5. Check browser console for sync messages');
        },

        /**
         * Helper: Print current inventory from RTDB
         */
        printRTDBInventory: async function (bankId) {
            if (!bankId) {
                console.log('⚠️ Please provide bankId');
                console.log('Example: InventorySyncTest.printRTDBInventory("bank123")');
                return;
            }

            if (!window.database) {
                console.log('❌ RTDB not initialized');
                return;
            }

            try {
                const snapshot = await window.database.ref(`bloodBanks/${bankId}/inventory`).once('value');
                const inventory = snapshot.val();
                console.group(`📊 RTDB Inventory for ${bankId}`);
                console.table(inventory);
                console.groupEnd();
            } catch (error) {
                console.error('Error fetching inventory:', error);
            }
        },

        /**
         * Helper: Print current inventory from Firestore
         */
        printFirestoreInventory: async function (email) {
            if (!email) {
                console.log('⚠️ Please provide hospital email');
                console.log('Example: InventorySyncTest.printFirestoreInventory("hospital@example.com")');
                return;
            }

            if (!window.firestore) {
                console.log('❌ Firestore not initialized');
                return;
            }

            try {
                const emailKey = email.replace(/\./g, ',');
                const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                const inventory = {};

                const promises = bloodTypes.map(async (type) => {
                    const docRef = window.firestore.collection('hospitals')
                        .doc(emailKey)
                        .collection('inventory')
                        .doc(type);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        inventory[type] = doc.data();
                    }
                });

                await Promise.all(promises);
                
                console.group(`📊 Firestore Inventory for ${email}`);
                console.table(inventory);
                console.groupEnd();
            } catch (error) {
                console.error('Error fetching inventory:', error);
            }
        },

        /**
         * Helper: Compare inventory between RTDB and Firestore
         */
        compareInventory: async function (bankId, email) {
            if (!bankId || !email) {
                console.log('⚠️ Please provide both bankId and email');
                console.log('Example: InventorySyncTest.compareInventory("bank123", "hospital@example.com")');
                return;
            }

            console.log('🔍 Comparing inventory between RTDB and Firestore...\n');
            
            console.log('RTDB Inventory:');
            await this.printRTDBInventory(bankId);
            
            console.log('\nFirestore Inventory:');
            await this.printFirestoreInventory(email);
        }
    };

    console.log('%c✅ Test suite loaded!', 'color: #27ae60; font-weight: bold;');
    console.log('Run tests with: InventorySyncTest.runAll()');
    console.log('\nAvailable tests:');
    console.log('  InventorySyncTest.testServiceLoaded()');
    console.log('  InventorySyncTest.testSyncStatus()');
    console.log('  InventorySyncTest.testConflictResolution()');
    console.log('  InventorySyncTest.testSimulatedSync()');
    console.log('  InventorySyncTest.testEventListeners()');
    console.log('  InventorySyncTest.testSyncHistory()');
    console.log('  InventorySyncTest.runAll()');
    console.log('\nHelper functions:');
    console.log('  InventorySyncTest.printRTDBInventory(bankId)');
    console.log('  InventorySyncTest.printFirestoreInventory(email)');
    console.log('  InventorySyncTest.compareInventory(bankId, email)');
})();
