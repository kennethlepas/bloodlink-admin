// User Management Module
(function () {
    'use strict';

    // State
    let allUsers = [];
    let deleteUserId = null;

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('usersTableBody'),
        searchInput: document.getElementById('usersSearch'),
        userTypeFilter: document.getElementById('userTypeFilter'),
        userStatusFilter: document.getElementById('userStatusFilter'),
        deleteModal: document.getElementById('deleteModal'),
        deleteUserName: document.getElementById('deleteUserName'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        addAdminBtn: document.getElementById('addAdminBtn'),
        addAdminModal: document.getElementById('addAdminModal'),
        addAdminForm: document.getElementById('addAdminForm')
    };

    // Secondary Firebase App for creating users without logging out
    let secondaryApp;
    function getSecondaryApp() {
        if (secondaryApp) return secondaryApp;
        if (!window.firebaseConfig) return null;

        try {
            secondaryApp = firebase.initializeApp(window.firebaseConfig, 'SecondaryApp');
        } catch (e) {
            secondaryApp = firebase.app('SecondaryApp');
        }
        return secondaryApp;
    }

    // Initialize
    window.initializePage = function () {
        console.log('Initializing user management page...');
        setupEventListeners();
        return loadUsers();
    };

    // Setup event listeners
    function setupEventListeners() {
        elements.searchInput.addEventListener('input', window.utils.debounce(renderUsers, 300));
        elements.userTypeFilter.addEventListener('change', renderUsers);
        elements.userStatusFilter.addEventListener('change', renderUsers);

        elements.confirmDeleteBtn.addEventListener('click', async () => {
            if (deleteUserId) {
                await deleteUser(deleteUserId);
                closeDeleteModal();
            }
        });

        elements.addAdminBtn?.addEventListener('click', () => {
            elements.addAdminModal.style.display = 'flex';
        });

        elements.addAdminForm?.addEventListener('submit', handleAddAdmin);
    }

    // Load users from Firestore
    function loadUsers() {
        return new Promise((resolve) => {
            // Using 'users' collection as the master record for Donors and Requesters
            firestore.collection('users').onSnapshot(snapshot => {
                allUsers = [];

                snapshot.forEach(doc => {
                    allUsers.push({ id: doc.id, ...doc.data() });
                });

                console.log('All users loaded:', allUsers.length);
                renderUsers();
                resolve();
            }, error => {
                console.error('Error loading users:', error);
                window.utils.showNotification('Error loading users', 'error');
                resolve();
            });
        });
    }

    // Render users table
    function renderUsers() {
        const searchTerm = elements.searchInput.value.toLowerCase();
        const typeFilter = elements.userTypeFilter.value;
        const statusFilter = elements.userStatusFilter.value;

        let filtered = allUsers;

        // Role filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(user => user.userType === typeFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            const isActive = statusFilter === 'active';
            filtered = filtered.filter(user => (user.isActive === undefined ? true : user.isActive) === isActive);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(user => {
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                const email = (user.email || '').toLowerCase();
                const phone = (user.phoneNumber || '').toLowerCase();
                const role = (user.userType || '').toLowerCase();

                return fullName.includes(searchTerm) ||
                    email.includes(searchTerm) ||
                    phone.includes(searchTerm) ||
                    role.includes(searchTerm);
            });
        }

        // Empty state
        if (filtered.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <p>No users found matching your criteria</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by joined date (descending)
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        elements.tableBody.innerHTML = filtered.map(user => {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
            const role = user.userType ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1) : 'User';
            const roleClass = user.userType === 'donor' ? 'badge-a-pos' : 'badge-b-pos';
            // Status logic
            const isActive = user.isActive === undefined ? true : user.isActive;
            const statusClass = isActive ? 'status-verified' : 'status-critical';
            const statusText = isActive ? 'Active' : 'Revoked';

            // Verification logic
            const verStatus = user.verificationStatus || 'unsubmitted';
            const verColors = {
                approved: 'status-verified',
                pending: 'status-pending',
                rejected: 'status-critical',
                unsubmitted: 'status-unsubmitted'
            };
            const verClass = verColors[verStatus] || 'status-unsubmitted';
            const verText = verStatus.charAt(0).toUpperCase() + verStatus.slice(1);

            const joinedDate = window.utils.formatDate(user.createdAt);
            const phone = window.utils.formatPhoneNumber(user.phoneNumber);
            const bloodType = user.bloodType || 'N/A';

            return `
                <tr>
                    <td>
                        <div class="table-cell-flex">
                            <div class="avatar-initial-sm">
                                ${fullName.charAt(0).toUpperCase()}
                            </div>
                            <div class="cell-info">
                                <span class="cell-main">${fullName}</span>
                                <span class="cell-sub">ID: ${user.id.substring(0, 8)}...</span>
                            </div>
                        </div>
                    </td>
                    <td class="cell-info">
                        <span class="cell-main">${user.email || 'N/A'}</span>
                        <span class="cell-sub">${phone}</span>
                    </td>
                    <td>
                        <span class="blood-type-badge ${roleClass}" style="min-width: 80px; text-align: center;">
                            ${role}
                        </span>
                    </td>
                    <td>
                        <span class="blood-type-badge ${window.utils.getBloodTypeClass(bloodType)}">
                            ${bloodType}
                        </span>
                    </td>
                    <td>${joinedDate}</td>
                    <td>
                        <span class="status-badge ${verClass}">${verText}</span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            ${isActive ? `
                                <button class="action-btn action-btn-danger"
                                    onclick="window.toggleUserStatus('${user.id}', false, '${fullName.replace(/'/g, "\\'")}')">
                                    🚫 Revoke
                                </button>
                            ` : `
                                <button class="action-btn action-btn-success"
                                    onclick="window.toggleUserStatus('${user.id}', true, '${fullName.replace(/'/g, "\\'")}')">
                                    🔓 Activate
                                </button>
                            `}
                            <button class="action-btn" style="background: #FEF2F2; color: #DC2626; border-color: #FECACA;"
                                onclick="window.openDeleteModal('${user.id}', '${fullName.replace(/'/g, "\\'")}')">
                                🗑️ Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Toggle user active status
    window.toggleUserStatus = async function (uid, newStatus, name) {
        const action = newStatus ? 'Reactivate' : 'Revoke access for';
        if (!window.utils.confirmAction(`${action} ${name}?`)) return;

        try {
            await firestore.collection('users').doc(uid).update({
                isActive: newStatus,
                updatedAt: new Date().toISOString()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateUser(uid, {
                    action: newStatus ? 'activated' : 'revoked',
                    userName: name,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`User ${newStatus ? 'activated' : 'revoked'} successfully`);
        } catch (error) {
            console.error('Error updating user status:', error);
            window.utils.showNotification('Failed to update user status', 'error');
        }
    };

    // Modal management
    window.openDeleteModal = function (uid, name) {
        deleteUserId = uid;
        elements.deleteUserName.textContent = name;
        elements.deleteModal.style.display = 'flex';
    };

    window.closeDeleteModal = function () {
        elements.deleteModal.style.display = 'none';
        deleteUserId = null;
    };

    window.closeAddAdminModal = function () {
        elements.addAdminModal.style.display = 'none';
        elements.addAdminForm.reset();
    };

    async function handleAddAdmin(e) {
        e.preventDefault();
        const btn = document.getElementById('btnSubmitAdmin');
        const name = document.getElementById('adminName').value.trim();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        if (!name || !email || !password) return;

        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            const secondaryApp = getSecondaryApp();
            if (!secondaryApp) throw new Error('Firebase configuration missing');

            // 1. Create in Firebase Auth using secondary app
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            // 2. Sign out of secondary app immediately to be safe
            await secondaryApp.auth().signOut();

            const emailKey = email.replace(/\./g, ',');
            const timestamp = new Date().toISOString();

            // 3. Create master user record
            const userData = {
                id: emailKey,
                uid: uid,
                email: email,
                firstName: name.split(' ')[0],
                lastName: name.split(' ').slice(1).join(' '),
                userType: 'super_admin',
                role: 'super_admin',
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            await firestore.collection('users').doc(emailKey).set(userData);

            // 4. Create specialized admin record for auth.js verification
            await firestore.collection('admins').doc(emailKey).set({
                id: emailKey,
                uid: uid,
                email: email,
                name: name,
                role: 'super_admin',
                createdAt: timestamp
            });

            // 5. Log audit event
            if (window.auditLogs) {
                window.auditLogs.log('create_admin', 'user', uid, {
                    adminEmail: email,
                    adminName: name
                });
            }

            window.utils.showNotification(`Admin account created for ${name}`, 'success');
            window.closeAddAdminModal();

        } catch (error) {
            console.error('Error creating admin:', error);
            window.utils.showNotification('Failed to create admin: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    }

    // Delete user entirely from Firestore
    async function deleteUser(uid) {
        showDeleteLoading(true);
        try {
            console.log(`Starting entire deletion for user: ${uid}`);

            // 1. Find all related records
            const collections = [
                { name: 'verification_requests', field: 'userId' },
                { name: 'bloodRequests', field: 'requesterId' },
                { name: 'acceptedRequests', field: 'donorId' },
                { name: 'acceptedRequests', field: 'requesterId' },
                { name: 'notifications', field: 'userId' },
                { name: 'donations', field: 'donorId' }
            ];

            const deletePromises = [];

            // Master user record
            deletePromises.push(firestore.collection('users').doc(uid).delete());

            // Related records in other collections
            for (const coll of collections) {
                const results = await firestore.collection(coll.name).where(coll.field, '==', uid).get();
                results.forEach(doc => {
                    deletePromises.push(doc.ref.delete());
                });
            }

            await Promise.all(deletePromises);
            console.log(`Successfully deleted ${deletePromises.length} records for user ${uid}`);

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.deleteUser(uid, {
                    userName: elements.deleteUserName.textContent,
                    recordsDeleted: deletePromises.length,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification('User and all associated data deleted from Firestore.');
            window.utils.showNotification('Note: Deleting from Firestore does not delete the Firebase Auth account. Please delete it from the Firebase Console if needed.', 'warning');
        } catch (error) {
            console.error('Error in entire user deletion:', error);
            window.utils.showNotification('Failed to complete entire deletion: ' + error.message, 'error');
        } finally {
            showDeleteLoading(false);
        }
    }

    function showDeleteLoading(busy) {
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.disabled = busy;
            elements.confirmDeleteBtn.textContent = busy ? 'Deleting Everything...' : 'Delete Permanently';
        }
    }

})();
