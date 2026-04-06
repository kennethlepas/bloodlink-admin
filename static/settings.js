/**
 * Super Admin Settings Module
 * Manages platform configuration, admin profile, notification preferences, and security.
 */
(function () {
    'use strict';

    const SETTINGS_DOC = 'platformConfig';

    const elements = {
        tabs: document.querySelectorAll('.settings-tab'),
        panes: document.querySelectorAll('.settings-pane'),
        platformForm: document.getElementById('platformSettingsForm'),
        profileForm: document.getElementById('adminProfileForm')
    };

    /**
     * Initialize the settings page
     */
    window.initializePage = async function () {
        console.log('⚙️ Initializing Super Admin Settings...');
        setupTabs();
        await Promise.all([
            loadPlatformSettings(),
            loadAdminProfile(),
            loadNotificationSettings(),
            loadSessionInfo()
        ]);
        setupEventListeners();
        console.log('✅ Settings initialized');
    };

    // ─── Tab Management ───

    function setupTabs() {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                elements.panes.forEach(p => p.classList.remove('active'));
                const pane = document.getElementById(`pane-${target}`);
                if (pane) pane.classList.add('active');
            });
        });
    }

    // ─── Platform Settings ───

    async function loadPlatformSettings() {
        try {
            const doc = await firestore.collection('settings').doc(SETTINGS_DOC).get();
            if (doc.exists) {
                const data = doc.data();
                setVal('platformName', data.platformName);
                setVal('supportEmail', data.supportEmail);
                setVal('supportPhone', data.supportPhone);
                setVal('platformRegion', data.platformRegion);
                setVal('requestExpiryDays', data.requestExpiryDays);
                setVal('maxActiveRequests', data.maxActiveRequests);
                setVal('defaultPriority', data.defaultPriority);
                setVal('requireApproval', data.requireApproval);
                setVal('verificationMode', data.verificationMode);
                setVal('minDonorAge', data.minDonorAge);
            }
        } catch (error) {
            console.error('Error loading platform settings:', error);
        }
    }

    async function savePlatformSettings(e) {
        e.preventDefault();
        const btn = document.getElementById('savePlatformBtn');
        toggleBtnSpinner(btn, true);

        const data = {
            platformName: getVal('platformName'),
            supportEmail: getVal('supportEmail'),
            supportPhone: getVal('supportPhone'),
            platformRegion: getVal('platformRegion'),
            requestExpiryDays: parseInt(getVal('requestExpiryDays')) || 7,
            maxActiveRequests: parseInt(getVal('maxActiveRequests')) || 5,
            defaultPriority: getVal('defaultPriority'),
            requireApproval: getVal('requireApproval'),
            verificationMode: getVal('verificationMode'),
            minDonorAge: parseInt(getVal('minDonorAge')) || 18,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.email || 'admin'
        };

        try {
            await firestore.collection('settings').doc(SETTINGS_DOC).set(data, { merge: true });
            window.utils.showNotification('Platform settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving platform settings:', error);
            window.utils.showNotification('Failed to save platform settings', 'error');
        } finally {
            toggleBtnSpinner(btn, false);
        }
    }

    // ─── Admin Profile ───

    async function loadAdminProfile() {
        const user = auth.currentUser;
        if (!user) return;

        setVal('adminDisplayName', user.displayName || '');
        setVal('adminEmail', user.email);

        // Get admin data from Firestore
        try {
            const doc = await firestore.collection('admins').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.displayName) setVal('adminDisplayName', data.displayName);
                if (data.role) setVal('adminRole', data.role === 'super_admin' ? 'Super Admin' : data.role);
                if (data.createdAt) {
                    const date = new Date(data.createdAt);
                    setVal('adminCreatedAt', date.toLocaleDateString('en-KE', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    }));
                }
            }
        } catch (error) {
            console.error('Error loading admin profile:', error);
        }
    }

    async function saveAdminProfile(e) {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        toggleBtnSpinner(btn, true);

        const displayName = getVal('adminDisplayName');

        try {
            // Update Firebase Auth profile
            await auth.currentUser.updateProfile({ displayName });

            // Update Firestore admin doc
            await firestore.collection('admins').doc(auth.currentUser.uid).set({
                displayName,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            window.utils.showNotification('Profile updated successfully', 'success');

            // Update sidebar
            const nameEl = document.getElementById('userName');
            if (nameEl) nameEl.textContent = displayName;
        } catch (error) {
            console.error('Error saving profile:', error);
            window.utils.showNotification('Failed to update profile', 'error');
        } finally {
            toggleBtnSpinner(btn, false);
        }
    }

    // ─── Notification Settings ───

    async function loadNotificationSettings() {
        try {
            const doc = await firestore.collection('settings').doc('notificationPrefs').get();
            if (doc.exists) {
                const data = doc.data();
                setChecked('notifNewRequests', data.newRequests !== false);
                setChecked('notifVerifications', data.verifications !== false);
                setChecked('notifCriticalStock', data.criticalStock !== false);
                setChecked('notifNewHospitals', data.newHospitals !== false);
                setChecked('notifReferrals', data.referrals || false);
                setChecked('notifReviews', data.reviews || false);
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }

    async function saveNotificationSettings() {
        const btn = document.getElementById('saveNotifSettingsBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const data = {
            newRequests: isChecked('notifNewRequests'),
            verifications: isChecked('notifVerifications'),
            criticalStock: isChecked('notifCriticalStock'),
            newHospitals: isChecked('notifNewHospitals'),
            referrals: isChecked('notifReferrals'),
            reviews: isChecked('notifReviews'),
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.email || 'admin'
        };

        try {
            await firestore.collection('settings').doc('notificationPrefs').set(data, { merge: true });
            window.utils.showNotification('Notification settings saved', 'success');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            window.utils.showNotification('Failed to save notification settings', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Notification Settings';
        }
    }

    // ─── Security ───

    function loadSessionInfo() {
        const user = auth.currentUser;
        if (!user) return;

        setElText('sessionEmail', user.email);

        if (user.metadata?.lastSignInTime) {
            const date = new Date(user.metadata.lastSignInTime);
            setElText('sessionLastLogin', date.toLocaleString('en-KE', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }));
        }

        const provider = user.providerData?.[0]?.providerId || 'password';
        setElText('sessionProvider', provider === 'password' ? 'Email/Password' : provider);
    }

    async function updatePassword() {
        const currentPwd = getVal('currentPassword');
        const newPwd = getVal('newPassword');
        const confirmPwd = getVal('confirmPassword');

        if (!currentPwd || !newPwd || !confirmPwd) {
            window.utils.showNotification('Please fill in all password fields', 'error');
            return;
        }

        if (newPwd !== confirmPwd) {
            window.utils.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPwd.length < 8) {
            window.utils.showNotification('Password must be at least 8 characters', 'error');
            return;
        }

        const btn = document.getElementById('updatePasswordBtn');
        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthCredential.credential(user.email, currentPwd);
            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(newPwd);

            window.utils.showNotification('Password updated successfully', 'success');

            // Clear fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            console.error('Password update error:', error);
            if (error.code === 'auth/wrong-password') {
                window.utils.showNotification('Current password is incorrect', 'error');
            } else {
                window.utils.showNotification('Failed to update password: ' + error.message, 'error');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Update Password';
        }
    }

    // ─── Danger Zone ───

    async function exportAllData() {
        const btn = document.getElementById('exportDataBtn');
        btn.disabled = true;
        btn.textContent = 'Exporting...';

        try {
            const collections = ['hospitals', 'bloodRequests', 'referrals', 'donors', 'admins'];
            const exportData = {};

            for (const coll of collections) {
                const snapshot = await firestore.collection(coll).get();
                exportData[coll] = [];
                snapshot.forEach(doc => {
                    exportData[coll].push({ id: doc.id, ...doc.data() });
                });
            }

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bloodlink-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            window.utils.showNotification('Data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            window.utils.showNotification('Failed to export data', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Export Data';
        }
    }

    async function clearAllNotifications() {
        if (!confirm('Are you sure you want to delete ALL read notifications? This cannot be undone.')) return;

        const btn = document.getElementById('clearNotificationsBtn');
        btn.disabled = true;
        btn.textContent = 'Clearing...';

        try {
            const snapshot = await firestore.collection('notifications')
                .where('read', '==', true)
                .get();

            const batch = firestore.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            window.utils.showNotification(`Cleared ${snapshot.size} read notifications`, 'success');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            window.utils.showNotification('Failed to clear notifications', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Clear All';
        }
    }

    async function purgeExpiredRequests() {
        if (!confirm('Are you sure you want to permanently remove expired/rejected requests older than 30 days? This cannot be undone.')) return;

        const btn = document.getElementById('purgeRequestsBtn');
        btn.disabled = true;
        btn.textContent = 'Purging...';

        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const snapshot = await firestore.collection('bloodRequests')
                .where('status', 'in', ['expired', 'rejected'])
                .get();

            const batch = firestore.batch();
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt ? new Date(data.createdAt) : null;
                if (createdAt && createdAt < thirtyDaysAgo) {
                    batch.delete(doc.ref);
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                window.utils.showNotification(`Purged ${count} expired/rejected requests`, 'success');
            } else {
                window.utils.showNotification('No old expired/rejected requests found', 'info');
            }
        } catch (error) {
            console.error('Error purging requests:', error);
            window.utils.showNotification('Failed to purge requests', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Purge';
        }
    }

    // ─── Event Listeners ───

    function setupEventListeners() {
        // Platform settings form
        if (elements.platformForm) {
            elements.platformForm.addEventListener('submit', savePlatformSettings);
        }

        // Admin profile form
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', saveAdminProfile);
        }

        // Notification settings
        const notifBtn = document.getElementById('saveNotifSettingsBtn');
        if (notifBtn) notifBtn.addEventListener('click', saveNotificationSettings);

        // Security
        const pwdBtn = document.getElementById('updatePasswordBtn');
        if (pwdBtn) pwdBtn.addEventListener('click', updatePassword);

        // Danger zone
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportAllData);

        const clearBtn = document.getElementById('clearNotificationsBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearAllNotifications);

        const purgeBtn = document.getElementById('purgeRequestsBtn');
        if (purgeBtn) purgeBtn.addEventListener('click', purgeExpiredRequests);
    }

    // ─── Helpers ───

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    function setVal(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) el.value = value;
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '—';
    }

    function isChecked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    }

    function setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    function toggleBtnSpinner(btn, show) {
        if (!btn) return;
        const spinner = btn.querySelector('.btn-spinner');
        btn.disabled = show;
        if (spinner) spinner.classList.toggle('hidden', !show);
    }

})();
