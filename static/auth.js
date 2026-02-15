// Authentication Module
(function () {
    'use strict';

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
        userName: document.getElementById('userName')
    };

    // Check if we're on login page or dashboard page
    const isLoginPage = window.location.pathname === '/';

    // Immediately hide loading screen for dashboard pages to prevent blue flash
    if (!isLoginPage && elements.loading) {
        elements.loading.classList.add('hidden');
    }

    // Authentication State Observer
    auth.onAuthStateChanged(async user => {
        // Hide loading screen
        if (elements.loading) {
            elements.loading.classList.add('hidden');
        }

        if (user) {
            try {
                // Check if user is admin
                const emailKey = user.email.replace(/\./g, ',');
                const adminSnapshot = await database.ref(`admins/${emailKey}`).once('value');

                if (adminSnapshot.val() === true) {
                    currentUser = user;

                    // Update UI with user info
                    if (elements.userEmail) {
                        elements.userEmail.textContent = user.email;
                    }
                    if (elements.userName) {
                        const name = user.email.split('@')[0];
                        elements.userName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
                    }

                    if (isLoginPage) {
                        // Redirect to dashboard
                        window.location.href = '/dashboard';
                    } else {
                        // Show admin dashboard
                        if (elements.loginContainer) {
                            elements.loginContainer.classList.add('hidden');
                        }
                        if (elements.adminDashboard) {
                            elements.adminDashboard.classList.remove('hidden');
                        }

                        // Initialize page-specific functionality
                        if (window.initializePage) {
                            window.initializePage();
                        }
                    }

                    console.log('Admin authenticated:', user.email);
                } else {
                    console.log('Access denied: Not an admin');
                    if (elements.loginError && isLoginPage) {
                        elements.loginError.textContent = 'Access denied: You do not have admin privileges';
                        elements.loginError.classList.remove('hidden');
                    }
                    await auth.signOut();
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                if (elements.loginError && isLoginPage) {
                    elements.loginError.textContent = 'Error verifying admin status. Please try again.';
                    elements.loginError.classList.remove('hidden');
                }
                await auth.signOut();
            }
        } else {
            currentUser = null;

            if (isLoginPage) {
                // Show login form
                if (elements.loginContainer) {
                    elements.loginContainer.classList.remove('hidden');
                }
            } else {
                // Redirect to login
                window.location.href = '/';
            }
        }
    });

    // Login Form Handler
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            elements.loginBtn.disabled = true;
            elements.loginBtn.innerHTML = '<span>Signing in...</span>';
            elements.loginError.classList.add('hidden');

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // Success - auth state observer will handle redirect
            } catch (error) {
                console.error('Login error:', error);

                let errorMessage = 'Login failed. Please try again.';

                switch (error.code) {
                    case 'auth/invalid-credential':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password';
                        break;
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many login attempts. Please try again later.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your connection.';
                        break;
                }

                elements.loginError.textContent = errorMessage;
                elements.loginError.classList.remove('hidden');
            } finally {
                elements.loginBtn.disabled = false;
                elements.loginBtn.innerHTML = '<span>Sign In</span><span class="btn-arrow">→</span>';
            }
        });
    }

    // Logout Handler
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = '/';
            } catch (error) {
                console.error('Logout error:', error);
                alert('Failed to logout. Please try again.');
            }
        });
    }

    // Export current user getter
    window.getCurrentUser = () => currentUser;

})();