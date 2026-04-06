/**
 * Page Transitions & Loading States Handler
 * Implements modern skeleton screens and refresh logic
 */
(function () {
    'use strict';

    window.pageTransitions = {
        /**
         * Initialize global loading logic
         */
        init: function () {
            this.handleGlobalLoader();
            this.setupRefreshButton();
            this.setupNavigationIntercept();
            console.log('✨ Page Transitions Handler initialized');
        },

        /**
         * Top Progress Bar Controls
         */
        start: function () {
            const bar = document.getElementById('pageLoadingBar');
            if (bar) bar.classList.add('active');
        },

        stop: function () {
            const bar = document.getElementById('pageLoadingBar');
            if (bar) {
                bar.classList.remove('active');
                // Ensure it's hidden after transition
                setTimeout(() => { if (!bar.classList.contains('active')) bar.style.opacity = '0'; }, 300);
            }
        },

        /**
         * Intercept sidebar navigation to show progress bar
         */
        setupNavigationIntercept: function () {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    // Only for actual page navigation
                    if (item.getAttribute('href') && !item.getAttribute('href').startsWith('#')) {
                        this.start();
                    }
                });
            });
        },

        /**
         * Handle global loader visibility
         */
        handleGlobalLoader: function () {
            const loader = document.getElementById('global-loader');
            if (!loader) return;

            // Wait for auth to be determined
            auth.onAuthStateChanged((user) => {
                const progressFill = loader.querySelector('.loading-progress-fill');
                const statusText = loader.querySelector('.loading-status');

                if (progressFill) progressFill.style.width = '100%';
                if (statusText) statusText.textContent = 'Welcome, ' + (user?.displayName || 'Admin');

                setTimeout(() => {
                    loader.classList.add('hidden');
                    document.body.classList.remove('loading-active');

                    // Transition to hidden and remove from DOM after fade
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 500);
                }, 800);
            });
        },

        /**
         * Setup global refresh button logic
         */
        setupRefreshButton: function () {
            const refreshBtn = document.getElementById('refreshDataBtn');
            if (!refreshBtn) return;

            refreshBtn.addEventListener('click', async () => {
                const icon = refreshBtn.querySelector('.refresh-icon');

                // Add spinning animation
                icon.style.animation = 'spin 1s linear infinite';
                refreshBtn.disabled = true;

                console.log('🔄 Triggering data refresh...');

                // Show skeletons if initializePage exists on current screen
                this.toggleSkeletons(true);

                try {
                    if (window.initializePage) {
                        await window.initializePage();
                    }
                    // If we are in hospital.js context, it might be different
                    // Usually we just call the main init function again
                } catch (error) {
                    console.error('Refresh error:', error);
                } finally {
                    // Slight delay to ensure content is rendered
                    setTimeout(() => {
                        this.toggleSkeletons(false);
                        icon.style.animation = '';
                        refreshBtn.disabled = false;
                    }, 500);
                }
            });
        },

        /**
         * Show/Hide skeletons in the current page
         * @param {boolean} show 
         */
        toggleSkeletons: function (show) {
            const skeletons = document.querySelectorAll('.skeleton-row, .skeleton');

            if (show) {
                this.start();
                skeletons.forEach(s => {
                    s.style.display = '';
                    s.classList.remove('hidden');
                });
            } else {
                this.stop();
                skeletons.forEach(s => {
                    // For table rows, hide them. For spans inside text, keep them hidden.
                    if (s.tagName === 'TR') {
                        s.style.display = 'none';
                    } else {
                        s.classList.add('hidden');
                    }
                });
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.pageTransitions.init());
    } else {
        window.pageTransitions.init();
    }

})();
