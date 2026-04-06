// Authentication Module
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        initAuth();
    });

    // Global utility to update hospital branding across all pages
    window.updateHospitalSidebar = function (data) {
        const hospital = data || window.hospitalData || JSON.parse(localStorage.getItem('hospitalData'));
        if (!hospital) return;

        console.log('🏛️ Updating hospital sidebar branding for:', hospital.hospitalName || hospital.name);

        // Update sidebar branding (tagline)
        const hospitalNameDisplay = document.getElementById('hospitalNameDisplay');
        if (hospitalNameDisplay) hospitalNameDisplay.textContent = hospital.hospitalName || hospital.name || 'Hospital Admin';

        // Update facility code in sidebar footer
        const codeDisplay = document.getElementById('hospitalCodeDisplay');
        if (codeDisplay) {
            codeDisplay.innerHTML = `Code: <span style="color: var(--primary); font-weight: 700;">${hospital.facilityCode || hospital.code || '----'}</span>`;
        }

        // Update user profile areas
        const userName = document.getElementById('userName');
        if (userName) userName.textContent = hospital.hospitalName || hospital.name;

        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = hospital.email;

        const avatar = document.querySelector('.sidebar-footer .user-avatar');
        if (avatar) {
            const displayName = hospital.hospitalName || hospital.name || 'H';
            avatar.textContent = displayName.charAt(0).toUpperCase();
        }
    };

    function initAuth() {
        // --- 1. Immediate UI Recovery (from cache) ---
        // This prevents the "Loading..." flicker for logged-in users
        const cachedHospital = JSON.parse(localStorage.getItem('hospitalData'));
        const cachedRole = sessionStorage.getItem('userRole');

        if (cachedHospital && window.updateHospitalSidebar) {
            console.log('⚡ Immediate branding recovery from cache');
            window.updateHospitalSidebar(cachedHospital);
        }

        // State
        let currentUser = null;

        // DOM Elements
        const elements = {
            loading: document.getElementById('loading'),
            loginContainer: document.getElementById('loginContainer'),
            adminDashboard: document.getElementById('adminDashboard'),
            loginForm: document.getElementById('loginForm'),
            loginError: document.getElementById('loginError'),
            loginBtn: document.getElementById('loginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            userEmail: document.getElementById('userEmail'),
            userName: document.getElementById('userName'),
            userAvatar: document.querySelector('.user-avatar'),
            // Claim Modal Elements
            openClaimModal: document.getElementById('openClaimModal'),
            claimModal: document.getElementById('claimModal'),
            closeClaimModal: document.getElementById('closeClaimModal'),
            facilityCode: document.getElementById('facilityCode'),
            btnNextStep1: document.getElementById('btnNextStep1'),
            btnConfirmStep2: document.getElementById('btnConfirmStep2'),
            btnBackStep2: document.getElementById('btnBackStep2'),
            claimEmail: document.getElementById('claimEmail'),
            btnSendMagicLink: document.getElementById('btnSendMagicLink'),
            btnCloseClaimSuccess: document.getElementById('btnCloseClaimSuccess'),
            btnFinalizeAccount: document.getElementById('btnFinalizeAccount'),
            // Forgot Password Elements
            forgotPasswordLink: document.getElementById('forgotPasswordLink'),
            forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            closeForgotModal: document.getElementById('closeForgotModal'),
            resetEmail: document.getElementById('resetEmail'),
            btnSendResetLink: document.getElementById('btnSendResetLink'),
            resetPasswordBtn: document.getElementById('resetPasswordBtn'),
            hospitalNameDisplay: document.getElementById('hospitalNameDisplay')
        };

        // Check if we're on login page or dashboard page
        const isLoginPage = window.location.pathname === '/' || window.location.pathname === '/claim';

        // Sync Network Status
        function updateNetworkUI() {
            const badge = document.getElementById('networkStatus');
            if (!badge) return;

            badge.classList.remove('hidden');
            if (navigator.onLine) {
                badge.classList.remove('offline');
                badge.classList.add('online');
                badge.querySelector('.status-text').textContent = 'System Online';
            } else {
                badge.classList.remove('online');
                badge.classList.add('offline');
                badge.querySelector('.status-text').textContent = 'Offline Mode';
            }
        }

        window.addEventListener('online', updateNetworkUI);
        window.addEventListener('offline', updateNetworkUI);
        updateNetworkUI();

        // Authentication State Observer
        console.log('🛡️ Auth observer starting...');
        auth.onAuthStateChanged(async user => {
            console.log('👤 Auth state changed:', user ? 'Logged in' : 'Logged out');
            if (user) {
                try {
                    // Reset progress bar if exists
                    const progressFill = document.getElementById('pageLoadingBar');
                    if (progressFill) progressFill.style.width = '0%';

                    // Check role and lock status
                    const emailKey = user.email.replace(/\./g, ',');
                    let role = null;
                    let userData = null;

                    // 1. Check Super Admins
                    const adminSnapshot = await database.ref(`admins/${emailKey}`).once('value');
                    if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                        role = 'super_admin';
                        userData = { email: user.email, name: 'Super Admin' };
                    }

                    // 2. Check Hospital Admins (Only if not already Super Admin)
                    if (!role) {
                        const hospitalSnapshot = await firestore.collection('hospitals').doc(emailKey).get();
                        if (hospitalSnapshot.exists) {
                            const hData = hospitalSnapshot.data();
                            if (hData.locked) {
                                window.utils.showNotification('This account is locked. Please contact the Super Admin.', 'error');
                                await auth.signOut();
                                return;
                            }

                            role = 'hospital_admin';

                            // Set hospital context ONLY for hospital admins
                            const hospitalIdentity = { ...hData, id: hospitalSnapshot.id };
                            userData = { ...userData, ...hospitalIdentity };
                            window.hospitalData = hospitalIdentity;
                            localStorage.setItem('hospitalData', JSON.stringify(hospitalIdentity));
                            console.log('🏛️ Hospital context loaded for:', hospitalIdentity.hospitalName || hospitalIdentity.name);
                        }
                    } else {
                        // For Super Admins, ensure no hospital context exists
                        window.hospitalData = null;
                        localStorage.removeItem('hospitalData');
                        console.log('👑 Pure Super Admin context maintained');
                    }

                    if (role) {
                        currentUser = { ...user, role, ...userData };
                        window.userRole = role;
                        sessionStorage.setItem('userRole', role);

                        if (isLoginPage) {
                            const redirectUrl = role === 'hospital_admin' ? '/hospital/dashboard' : '/dashboard';
                            window.location.href = redirectUrl;
                            return;
                        }

                        // Route Protection: Prevent cross-portal access & redundant redirects
                        const path = window.location.pathname;
                        if (role === 'hospital_admin') {
                            // If ALREADY in hospital portal, do NOT redirect (prevents unprofessional flashes)
                            if (path.startsWith('/hospital')) {
                                console.log('🛡️ Portal access stable: No redirect needed');
                            } else {
                                const superAdminRoutes = ['/dashboard', '/users', '/requests', '/referrals', '/chat', '/reports', '/notifications', '/system-logs', '/verifications', '/settings'];
                                if (superAdminRoutes.includes(path) || path === '/') {
                                    if (path === "/chat") { window.location.href = "/hospital/chat"; return; }
                                    if (path === "/referrals") { window.location.href = "/hospital/referrals"; return; }
                                    window.location.href = "/hospital/dashboard";
                                    return;
                                }
                            }
                        } else if (role === 'super_admin') {
                            // Super Admins can access all routes for monitoring
                            if (path === '/') {
                                window.location.href = '/dashboard';
                                return;
                            }
                        }

                        // --- UI Initialization (runs for BOTH valid roles) ---

                        // Update UI with user info
                        if (elements.userEmail) elements.userEmail.textContent = user.email;
                        if (elements.userName) {
                            const displayName = userData.hospitalName || userData.name || user.email.split('@')[0];
                            elements.userName.textContent = displayName;
                            if (elements.userAvatar) {
                                elements.userAvatar.textContent = displayName.charAt(0).toUpperCase();
                                // Change WC if WC is hardcoded
                                if (elements.userAvatar.textContent === 'H' && displayName !== 'Hospital Name') {
                                    elements.userAvatar.textContent = displayName.charAt(0).toUpperCase();
                                }
                            }
                            if (elements.hospitalNameDisplay) {
                                if (role === 'hospital_admin') {
                                    elements.hospitalNameDisplay.textContent = userData.hospitalName || userData.name || 'Hospital Admin';
                                } else if (role === 'super_admin') {
                                    elements.hospitalNameDisplay.textContent = window.hospitalData ? (window.hospitalData.hospitalName || window.hospitalData.name) : 'Super Admin (Platform)';
                                }
                            }

                            // Specific hospital sidebar update
                            if (role === 'hospital_admin') {
                                const codeDisplay = document.getElementById('hospitalCodeDisplay');
                                if (codeDisplay) {
                                    codeDisplay.innerHTML = `Code: <span style="color: var(--primary); font-weight: 700;">${userData.facilityCode || userData.code || '----'}</span>`;
                                }
                                const userNameEl = document.getElementById('userName');
                                if (userNameEl) userNameEl.textContent = userData.hospitalName || userData.name;

                                const hospitalNameDisplay = document.getElementById('hospitalNameDisplay');
                                if (hospitalNameDisplay) hospitalNameDisplay.textContent = userData.hospitalName || userData.name || 'Hospital Admin';

                                const userEmailEl = document.getElementById('userEmail');
                                if (userEmailEl) userEmailEl.textContent = userData.email;
                            }
                        }

                        // Apply role-based visibility to sidebar
                        applyRoleVisibility(role);

                        // Show admin dashboard
                        if (elements.adminDashboard) elements.adminDashboard.classList.remove('hidden');

                        // Set hospital data globally and update sidebar branding
                        if (role === 'hospital_admin') {
                            window.hospitalData = userData;
                            localStorage.setItem('hospitalData', JSON.stringify(userData));
                            if (window.updateHospitalSidebar) {
                                window.updateHospitalSidebar(userData);
                            }
                        }

                        // Initialize page-specific functionality
                        if (window.initializePage) {
                            console.log('🔄 Calling module initialization...');
                            try {
                                await window.initializePage();
                            } catch (initError) {
                                console.error('Page initialization failed:', initError);
                            }
                        }

                        // Hide loading screen
                        setTimeout(() => {
                            if (elements.loading) {
                                elements.loading.style.opacity = '0';
                                setTimeout(() => {
                                    elements.loading.classList.add('hidden');
                                    elements.loading.style.opacity = '1';
                                }, 500);
                            }
                        }, 600);
                    } else {
                        console.log('Access denied: Unauthorized role');
                        if (elements.loading) elements.loading.classList.add('hidden');
                        if (elements.loginError && isLoginPage) {
                            elements.loginError.textContent = 'Access denied: Unauthorized account';
                            elements.loginError.classList.remove('hidden');
                        }
                        await auth.signOut();
                    }
                } catch (error) {
                    console.error('Auth check error:', error);
                    if (elements.loading) elements.loading.classList.add('hidden');
                    await auth.signOut();
                }
            } else {
                currentUser = null;
                if (elements.loading) elements.loading.classList.add('hidden');
                if (isLoginPage) {
                    if (elements.loginContainer) elements.loginContainer.classList.remove('hidden');

                    // Check for Magic Link Token in URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const token = urlParams.get('token');
                    if (token) {
                        handleMagicLinkActivation(token);
                    } else if (window.location.pathname === '/claim') {
                        // Automatically open claim modal if on /claim route
                        if (elements.claimModal) {
                            elements.claimModal.classList.add('show');
                            showClaimStep(1);
                        }
                    }
                } else {
                    window.location.href = '/';
                }
            }
        });

        // --- Hospital Claim Workflow Logic ---

        let claimData = {
            facilityCode: null,
            hospitalName: null,
            email: null,
            token: null
        };

        if (elements.openClaimModal) {
            console.log('✅ Claim link found, attaching listener...');
            elements.openClaimModal.addEventListener('click', (e) => {
                console.log('🖱️ Claim link clicked!');
                e.preventDefault();
                if (!elements.claimModal) return console.error('❌ Claim modal not found in DOM');
                elements.claimModal.classList.add('show');
                showClaimStep(1);
            });
        }

        if (elements.closeClaimModal) elements.closeClaimModal.onclick = () => elements.claimModal.classList.remove('show');

        // --- Forgot Password Logic ---
        if (elements.forgotPasswordLink) {
            elements.forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (elements.forgotPasswordModal) elements.forgotPasswordModal.classList.add('show');
            });
        }

        if (elements.closeForgotModal) {
            elements.closeForgotModal.onclick = () => {
                if (elements.forgotPasswordModal) elements.forgotPasswordModal.classList.remove('show');
            };
        }

        if (elements.btnSendResetLink) {
            elements.btnSendResetLink.onclick = async () => {
                const email = elements.resetEmail.value.trim();
                if (!email) return window.utils.showNotification('Please enter your email.', 'warning');

                elements.btnSendResetLink.disabled = true;
                elements.btnSendResetLink.textContent = 'Sending...';

                try {
                    await auth.sendPasswordResetEmail(email);
                    window.utils.showNotification('Reset link sent to your email!', 'success');
                    elements.forgotPasswordModal.classList.remove('show');
                } catch (err) {
                    window.utils.showNotification('Failed to send reset link: ' + err.message, 'error');
                } finally {
                    elements.btnSendResetLink.disabled = false;
                    elements.btnSendResetLink.textContent = 'Send Reset Link';
                }
            };
        }

        function showClaimStep(step) {
            document.querySelectorAll('.claim-step').forEach(s => s.classList.add('hidden'));
            const stepEl = document.getElementById(`claimStep${step === 'final' ? 'Final' : step}`);
            if (stepEl) stepEl.classList.remove('hidden');
        }

        // Step 1: Code Lookup
        if (elements.btnNextStep1) {
            elements.btnNextStep1.onclick = async () => {
                const code = elements.facilityCode.value.trim();
                if (!code) return window.utils.showNotification('Please enter a facility code.', 'warning');

                elements.btnNextStep1.disabled = true;
                elements.btnNextStep1.textContent = 'Searching...';

                try {
                    const response = await fetch('/static/kenya-hospitals.csv');
                    const csvText = await response.text();
                    const rows = csvText.split('\n').filter(r => r.trim()).slice(1);
                    const searchTerm = code.toLowerCase();

                    // Search by code (exact) or name (partial)
                    const hospital = rows.find(row => {
                        const cols = row.split(',').map(c => c.trim());
                        if (cols.length < 2) return false;
                        const fCode = cols[0];
                        const fName = cols[1].toLowerCase();
                        return fCode === searchTerm || fName.includes(searchTerm);
                    });

                    if (hospital) {
                        const cols = hospital.split(',').map(c => c.trim());
                        claimData.facilityCode = cols[0];
                        claimData.hospitalName = cols[1];

                        document.getElementById('previewHospitalName').textContent = cols[1];
                        document.getElementById('previewHospitalDetails').textContent = `Code: ${cols[0]} | ${cols[13] || 'Kenya'} County`;
                        showClaimStep(2);
                    } else {
                        window.utils.showNotification('Facility not found. Please check the code or name.', 'error');
                    }
                } catch (err) {
                    console.error('CSV Lookup error:', err);
                    window.utils.showNotification('Connection error while searching registry.', 'error');
                } finally {
                    elements.btnNextStep1.disabled = false;
                    elements.btnNextStep1.textContent = 'Lookup Facility';
                }
            };
        }

        if (elements.btnBackStep2) elements.btnBackStep2.onclick = () => showClaimStep(1);
        if (elements.btnConfirmStep2) elements.btnConfirmStep2.onclick = () => showClaimStep(3);

        // Step 3: Send Magic Link
        if (elements.btnSendMagicLink) {
            elements.btnSendMagicLink.onclick = async () => {
                const email = elements.claimEmail.value.trim();
                if (!email) return window.utils.showNotification('Please enter an official hospital email.', 'warning');

                elements.btnSendMagicLink.disabled = true;
                elements.btnSendMagicLink.textContent = 'Generating Link...';

                try {
                    // Check if facility is already claimed
                    const adminDoc = await firestore.collection('hospital_admins').doc(claimData.facilityCode).get();
                    if (adminDoc.exists && adminDoc.data().status === 'verified') {
                        return window.utils.showNotification('This facility has already been claimed.', 'warning');
                    }

                    // Generate secure token
                    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

                    // Store in Firestore activation queue
                    await firestore.collection('hospital_activations').doc(token).set({
                        facilityCode: claimData.facilityCode,
                        hospitalName: claimData.hospitalName,
                        email: email,
                        status: 'pending',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
                    });

                    // Link to 'hospital_admins' mapping
                    await firestore.collection('hospital_admins').doc(claimData.facilityCode).set({
                        email: email,
                        status: 'pending'
                    });

                    // SIMULATE SENDING EMAIL: Log magic link to console
                    const magicLink = `${window.location.origin}/?token=${token}`;
                    console.log('%c[SIMULATED EMAIL] Magic Link for ' + claimData.hospitalName + ':', 'color: #10B981; font-weight: bold;');
                    console.log(magicLink);

                    document.getElementById('sentEmailDisplay').textContent = email;
                    showClaimStep(4);
                    window.utils.showNotification('Activation link sent!', 'success');

                } catch (err) {
                    console.error('Activation error:', err);
                    window.utils.showNotification('Failed to generate link: ' + err.message, 'error');
                } finally {
                    elements.btnSendMagicLink.disabled = false;
                    elements.btnSendMagicLink.textContent = 'Send Activation Link';
                }
            };
        }

        if (elements.btnCloseClaimSuccess) elements.btnCloseClaimSuccess.onclick = () => elements.claimModal.classList.add('hidden');

        // --- Magic Link Activation Handling ---
        async function handleMagicLinkActivation(token) {
            if (elements.claimModal) elements.claimModal.classList.add('show');
            showClaimStep('final');

            try {
                const doc = await firestore.collection('hospital_activations').doc(token).get();
                if (!doc.exists) throw new Error('Invalid or expired activation link.');

                const data = doc.data();
                if (data.expiresAt < Date.now()) throw new Error('Activation link has expired.');

                claimData = { ...data, token: token };
                console.log('✅ Token validated for:', data.hospitalName);
                window.utils.showNotification('Token verified. Welcome!', 'success');

            } catch (err) {
                window.utils.showNotification(err.message, 'error');
                elements.claimModal.classList.add('hidden');
                window.history.replaceState({}, document.title, "/");
            }
        }

        // Finalize Account Setup
        if (elements.btnFinalizeAccount) {
            elements.btnFinalizeAccount.onclick = async () => {
                const pass = document.getElementById('finalPassword').value;
                const confirm = document.getElementById('confirmPassword').value;

                if (pass.length < 8) return alert('Password must be at least 8 characters.');
                if (pass !== confirm) return alert('Passwords do not match.');

                elements.btnFinalizeAccount.disabled = true;
                elements.btnFinalizeAccount.textContent = 'Finalizing...';

                try {
                    // 1. Create Firebase Auth User
                    const userCred = await auth.createUserWithEmailAndPassword(claimData.email, pass);
                    const emailKey = claimData.email.replace(/\./g, ',');

                    // 2. Create Hospital Profile (Admin collection)
                    await firestore.collection('hospitals').doc(emailKey).set({
                        name: claimData.hospitalName,
                        facilityCode: claimData.facilityCode,
                        email: claimData.email,
                        role: 'hospital_admin',
                        verify_status: 'approved',
                        locked: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // 2b. Create User Profile (Global collection for mobile app sync)
                    await firestore.collection('users').doc(emailKey).set({
                        id: emailKey,
                        uid: userCred.user.uid,
                        email: claimData.email,
                        hospitalName: claimData.hospitalName,
                        name: claimData.hospitalName,
                        facilityCode: claimData.facilityCode,
                        userType: 'hospital',
                        isActive: true,
                        role: 'hospital_admin',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // 3. Update Admin Mapping
                    await firestore.collection('hospital_admins').doc(claimData.facilityCode).update({
                        status: 'verified',
                        uid: userCred.user.uid
                    });

                    // 4. Cleanup token
                    await firestore.collection('hospital_activations').doc(claimData.token).delete();

                    window.utils.showNotification('Account setup complete!', 'success');
                    setTimeout(() => window.location.href = '/dashboard', 1500);

                } catch (err) {
                    console.error('Finalization error:', err);
                    window.utils.showNotification('Setup failed: ' + err.message, 'error');
                    elements.btnFinalizeAccount.disabled = false;
                    elements.btnFinalizeAccount.textContent = 'Complete Setup';
                }
            };
        }

        // Login Form Handler
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const emailKey = email.replace(/\./g, ',');

                elements.loginBtn.disabled = true;
                elements.loginBtn.innerHTML = '<span>Signing in...</span>';
                elements.loginError.classList.add('hidden');

                try {
                    // Check if already locked (with offline fallback)
                    if (navigator.onLine) {
                        const lockCheck = await firestore.collection('hospitals').doc(emailKey).get();
                        if (lockCheck.exists && lockCheck.data().locked) {
                            throw { code: 'auth/account-locked' };
                        }
                    } else {
                        window.utils.showNotification('You are currently offline. Login may use cached data.', 'warning');
                    }

                    await auth.signInWithEmailAndPassword(email, password);
                    if (navigator.onLine) await database.ref(`auth_attempts/${emailKey}`).remove();
                } catch (error) {
                    console.error('Login error:', error);
                    let errorMessage = 'Login failed. Please try again.';

                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                        errorMessage = 'Invalid email or password';
                        const attemptsRef = database.ref(`auth_attempts/${emailKey}`);
                        const snapshot = await attemptsRef.once('value');
                        const attempts = (snapshot.val() || 0) + 1;

                        if (attempts >= 3) {
                            try {
                                await firestore.collection('hospitals').doc(emailKey).update({ locked: true });
                                errorMessage = 'Account locked after 3 failed attempts. Contact Super Admin.';
                            } catch (e) { }
                        }
                        await attemptsRef.set(attempts);
                    } else if (error.code === 'auth/account-locked') {
                        errorMessage = 'Account locked. Contact Super Admin.';
                    } else if (error.code === 'auth/user-not-found') {
                        errorMessage = 'No account found with this email';
                    } else if (error.code === 'auth/network-request-failed' || error.code === 'unavailable') {
                        errorMessage = 'Server unreachable. Please check your internet connection.';
                    } else if (error.message && error.message.includes('client is offline')) {
                        errorMessage = 'Firestore is offline. Retrying...';
                    }

                    window.utils.showNotification(errorMessage, 'error');
                    elements.loginError.textContent = errorMessage;
                    elements.loginError.classList.remove('hidden');
                } finally {
                    elements.loginBtn.disabled = false;
                    elements.loginBtn.innerHTML = '<span>Sign In</span><span class="btn-arrow">→</span>';
                }
            });
        }

        // Role Visibility Logic
        function applyRoleVisibility(role) {
            const roleElements = document.querySelectorAll('[data-roles]');
            roleElements.forEach(el => {
                const allowedRoles = el.getAttribute('data-roles');
                if (allowedRoles) {
                    const rolesArray = allowedRoles.split(',').map(r => r.trim());
                    if (!rolesArray.includes(role)) {
                        el.classList.add('hidden-by-role');
                    } else {
                        el.classList.remove('hidden-by-role');
                    }
                }
            });

            // Update Dashboard link based on role
            const dashboardLink = document.querySelector('[data-screen="dashboard"]');
            if (dashboardLink) {
                dashboardLink.href = role === 'super_admin' ? '/dashboard' : '/hospital/dashboard';
            }

            // Log audit event for login
            if (window.auditLogs) {
                window.auditLogs.actions.login();
            }
        }

        // Idle Timeout Logic (15 mins)
        let idleTimer;
        function resetIdleTimer() {
            clearTimeout(idleTimer);
            if (currentUser) {
                idleTimer = setTimeout(() => {
                    console.log('🕒 Idle timeout reached. Logging out...');
                    auth.signOut();
                }, 15 * 60 * 1000);
            }
        }

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(type => {
            document.addEventListener(type, resetIdleTimer, true);
        });

        // Logout Handler
        const logoutActions = async () => {
            if (window.auditLogs) {
                await window.auditLogs.actions.logout();
            }
            // Clear all cached data to prevent cross-account leaks
            localStorage.clear();
            sessionStorage.clear();

            await auth.signOut();
            window.location.href = '/';
        };

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', logoutActions);
        }

        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.addEventListener('click', logoutActions);
        }

        // Reset Password Handler (for logged-in sessions)
        if (elements.resetPasswordBtn) {
            elements.resetPasswordBtn.addEventListener('click', async () => {
                const user = auth.currentUser;
                if (user && user.email) {
                    const confirmReset = confirm(`Send a password reset email to ${user.email}?`);
                    if (confirmReset) {
                        try {
                            await auth.sendPasswordResetEmail(user.email);
                            window.utils.showNotification('Password reset email sent to ' + user.email, 'success');
                        } catch (error) {
                            console.error('Password reset error:', error);
                            window.utils.showNotification('Failed to send reset email: ' + error.message, 'error');
                        }
                    }
                }
            });
        }

        window.getCurrentUser = () => currentUser;
    }
})();