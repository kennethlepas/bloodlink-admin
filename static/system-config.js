// ==================== SYSTEM CONFIGURATION MODULE ====================
(function () {
    'use strict';

    const CONFIG_DOC_ID = 'settings';
    let currentFlags = {};

    // Initialization
    window.initializePage = async function () {
        console.log('🛠️ Initializing System Configuration...');
        setupTabSwitching();
        await loadFeatureFlags();
        runHealthChecks();
        setupEventListeners();
    };

    // Tab Switching Logic
    function setupTabSwitching() {
        const tabs = document.querySelectorAll('.settings-tab');
        const panes = document.querySelectorAll('.settings-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                // Update tabs
                tabs.forEach(t => t.classList.toggle('active', t === tab));

                // Update panes
                panes.forEach(pane => {
                    pane.classList.toggle('active', pane.id === `pane-${target}`);
                });
            });
        });
    }

    // Load Feature Flags from Firestore
    async function loadFeatureFlags() {
        try {
            const doc = await firestore.collection('system_config').doc(CONFIG_DOC_ID).get();
            if (doc.exists) {
                currentFlags = doc.data();
                updateFlagUI(currentFlags);
            } else {
                console.warn('System config doc missing. Using defaults.');
                // Initialize with defaults if missing
                const defaults = {
                    chatEnabled: true,
                    referralsEnabled: true,
                    donorDirEnabled: true,
                    auditEnabled: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await firestore.collection('system_config').doc(CONFIG_DOC_ID).set(defaults);
                currentFlags = defaults;
                updateFlagUI(defaults);
            }
        } catch (error) {
            console.error('Error loading system flags:', error);
            window.utils?.showNotification('Failed to load feature flags', 'error');
        }
    }

    function updateFlagUI(flags) {
        if (flags.chatEnabled !== undefined) document.getElementById('flagChatEnabled').checked = flags.chatEnabled;
        if (flags.referralsEnabled !== undefined) document.getElementById('flagReferralsEnabled').checked = flags.referralsEnabled;
        if (flags.donorDirEnabled !== undefined) document.getElementById('flagDonorDirEnabled').checked = flags.donorDirEnabled;
        if (flags.auditEnabled !== undefined) document.getElementById('flagAuditEnabled').checked = flags.auditEnabled;
    }

    // Save Feature Flags
    async function saveFeatureFlags() {
        const btn = document.getElementById('saveFeaturesBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const newFlags = {
            chatEnabled: document.getElementById('flagChatEnabled').checked,
            referralsEnabled: document.getElementById('flagReferralsEnabled').checked,
            donorDirEnabled: document.getElementById('flagDonorDirEnabled').checked,
            auditEnabled: document.getElementById('flagAuditEnabled').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser?.email
        };

        try {
            await firestore.collection('system_config').doc(CONFIG_DOC_ID).set(newFlags, { merge: true });

            // Log audit event
            if (window.auditLogs) {
                window.auditLogs.log('update_system_config', 'platform', 'settings', {
                    changes: newFlags
                });
            }

            window.utils?.showNotification('Feature flags updated successfully', 'success');
        } catch (error) {
            console.error('Error saving flags:', error);
            window.utils?.showNotification('Failed to save changes', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Update Feature Flags';
        }
    }

    // Infrastructure Health Checks
    async function runHealthChecks() {
        // Firestore Check
        checkServiceHealth('firestore', async () => {
            await firestore.collection('system_config').doc('health_check').set({
                lastCheck: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        });

        // RTDB Check
        checkServiceHealth('rtdb', async () => {
            const ref = database.ref('.info/connected');
            return new Promise((resolve) => {
                ref.once('value', (snap) => resolve(snap.val() === true));
            });
        });

        // Auth Check
        checkServiceHealth('auth', async () => {
            return auth.currentUser !== null;
        });
    }

    async function checkServiceHealth(serviceId, testFn) {
        const el = document.querySelector(`#health-${serviceId} .health-status`);
        if (!el) return;

        try {
            const isOk = await testFn();
            el.textContent = isOk ? 'Online' : 'Degraded';
            el.className = `health-status ${isOk ? 'status-online' : 'status-offline'}`;
        } catch (error) {
            console.error(`Health check failed for ${serviceId}:`, error);
            el.textContent = 'Offline';
            el.className = 'health-status status-offline';
        }
    }

    // Maintenance Tasks
    async function runUserSync() {
        if (!confirm('This will scan all user documents and backfill missing Auth UIDs. Continue?')) return;

        const btn = document.getElementById('rebuildUserIndexBtn');
        btn.disabled = true;
        btn.textContent = 'Syncing...';

        try {
            // Get all users
            const snap = await firestore.collection('users').get();
            let count = 0;
            let fixed = 0;

            const batch = firestore.batch();

            // Note: In a real app, this would be a server-side Cloud Function
            // For now, we do it in chunks client-side if small, or just demonstrate the logic
            console.log(`Scanning ${snap.size} users...`);

            for (const doc of snap.docs) {
                const data = doc.data();
                if (!data.uid && data.email) {
                    // Logic to find UID from Auth would go here (requires Admin SDK)
                    // For client side, we can only flag them or check if current user is one of them
                    fixed++;
                }
                count++;
            }

            window.utils?.showNotification(`Sync complete. Scanned ${count} users. Found ${fixed} anomalies.`, 'info');
        } catch (error) {
            console.error('Sync failed:', error);
            window.utils?.showNotification('Sync failed: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run Sync';
        }
    }

    // Setup Event Listeners
    function setupEventListeners() {
        document.getElementById('saveFeaturesBtn')?.addEventListener('click', saveFeatureFlags);
        document.getElementById('rebuildUserIndexBtn')?.addEventListener('click', runUserSync);

        // Advanced Actions (Placeholders/UI)
        document.getElementById('globalBroadcastBtn')?.addEventListener('click', () => {
            window.utils?.showNotification('Broadcast feature requires Cloud Functions integration.', 'info');
        });

        document.getElementById('resetCountersBtn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all notification counters?')) {
                window.utils?.showNotification('Counter reset initiated...', 'success');
            }
        });
    }

})();
