// Dashboard Module with Enhanced Features and Screen-Specific Suggestions
(function () {
    'use strict';

    // State
    let donors = [];
    let requesters = [];
    let requests = [];
    let bloodBanks = [];
    let reviews = [];
    let donationRecords = [];

    // Screen-specific suggestion data
    const screenSuggestions = {
        dashboard: {
            icon: "📊",
            title: "BloodLink Admin Dashboard",
            tips: [
                "Monitor blood inventory levels across all registered blood banks",
                "Track donor registration trends and verification requests",
                "Review key metrics to understand platform health",
                "Click on stat cards to navigate to detailed views",
                "Check blood type availability to identify critical shortages"
            ],
            suggestion: "Start by reviewing the blood type availability chart below. Pay attention to blood types marked as 'Critical' or 'Low'."
        },
        donors: {
            icon: "👤",
            title: "Donor Registry",
            tips: [
                "Verify new donor accounts to enable them to accept requests",
                "Track donor donation history and impact points",
                "Monitor donor availability status to gauge active donors",
                "Review rejected donors to reconsider if they update information",
                "Export donor data for external reporting needs"
            ],
            suggestion: "You have pending donor verifications. Verify them to increase the pool of available donors."
        },
        requests: {
            icon: "📋",
            title: "Blood Requests",
            tips: [
                "Approve pending blood requests to make them visible to donors",
                "Monitor urgent and critical requests for faster response",
                "Track request completion rates to measure platform impact",
                "Reject requests with clear reasons to help requesters improve",
                "Filter requests by blood type and urgency for better management"
            ],
            suggestion: "Check pending requests and approve them so donors can start responding to urgent needs."
        },
        verifications: {
            icon: "🛡️",
            title: "Verification Requests",
            tips: [
                "Review donor identity documents carefully before approval",
                "Check blood request requisition forms for authenticity",
                "Provide clear rejection reasons to help users understand decisions",
                "Approved donors can accept blood requests immediately",
                "Verification helps maintain platform trust and safety"
            ],
            suggestion: "Focus on pending verifications first to help donors start contributing."
        },
        bloodbanks: {
            icon: "🏥",
            title: "Blood Bank Management",
            tips: [
                "Track blood inventory levels by type and hospital",
                "Monitor expiring blood batches to reduce wastage",
                "Add new blood banks to expand donor reach",
                "Sync with Kenya Hospitals CSV to import verified facilities",
                "Regular inventory updates help requesters find blood faster"
            ],
            suggestion: "Update inventory levels regularly to ensure accurate availability for requesters."
        },
        reviews: {
            icon: "⭐",
            title: "Review Moderation",
            tips: [
                "Approve positive reviews to build community trust",
                "Reject reviews that violate community guidelines",
                "Monitor review content for authenticity and relevance",
                "Delete inappropriate reviews to maintain platform quality",
                "Respond to user feedback to show engagement"
            ],
            suggestion: "Review pending user feedback to maintain high-quality testimonials."
        },
        reports: {
            icon: "📊",
            title: "Reports & Analytics",
            tips: [
                "Generate PDF and Excel reports for offline analysis",
                "Filter reports by date range, blood type, and status",
                "Use analytics dashboard to track key performance metrics",
                "Schedule automated reports for regular updates",
                "Export donor data for external reporting needs"
            ],
            suggestion: "Generate a donors report to analyze registration trends and donation patterns."
        },
        notifications: {
            icon: "🔔",
            title: "Notifications Center",
            tips: [
                "Stay updated on verification requests and donor activities",
                "Mark notifications as read after reviewing them",
                "Click on notifications to take immediate action",
                "Unread notifications are highlighted for attention",
                "Notifications help you stay on top of platform activities"
            ],
            suggestion: "Review pending notifications to stay updated on platform activities."
        },
        users: {
            icon: "👥",
            title: "User Management",
            tips: [
                "Manage donor and requester accounts from a single interface",
                "Toggle user status to activate or revoke access",
                "Delete user accounts when necessary (removes all associated data)",
                "Search and filter users by role, status, and registration date",
                "Monitor user activity to ensure platform integrity"
            ],
            suggestion: "Regularly review user accounts to ensure only active and verified users have access."
        }
    };

    // Initialize dashboard
    window.initializePage = async function () {
        console.log('Initializing dashboard...');

        // --- Cache Load (Instant) ---
        try {
            const cached = localStorage.getItem('sa_dashboard_cache');
            if (cached) {
                const data = JSON.parse(cached);
                donors = data.donors || [];
                requesters = data.requesters || [];
                requests = data.requests || [];
                bloodBanks = data.bloodBanks || [];
                updateStatistics();
                updateBloodTypeOverview();
                console.log('⚡ Dashboard metrics loaded from local cache');
            }
        } catch (e) { console.warn('Cache load failed', e); }

        await loadAllData();
        setupEventListeners();
        updateWelcomeMessage();
        showContextualSuggestion();
    };

    // Show contextual suggestion based on dashboard data
    function showContextualSuggestion() {
        const suggestionBanner = document.getElementById('suggestionBanner');
        const suggestionText = document.getElementById('suggestionText');

        if (!suggestionBanner || !suggestionText) return;

        // Determine which suggestion to show based on data
        let currentScreen = 'dashboard';

        // Check for critical blood shortages
        const criticalTypes = getCriticalBloodTypes();
        if (criticalTypes.length > 0) {
            const typesList = criticalTypes.join(', ');
            suggestionText.innerHTML = `🚨 CRITICAL ALERT: Blood types ${typesList} are critically low across ${criticalTypes.length} ${criticalTypes.length === 1 ? 'blood type' : 'blood types'}. Consider reaching out to donors urgently.`;
            suggestionBanner.style.display = 'block';
            suggestionBanner.classList.add('critical-alert');
            setTimeout(() => {
                suggestionBanner.style.opacity = '0';
                setTimeout(() => {
                    suggestionBanner.style.display = 'none';
                    suggestionBanner.style.opacity = '1';
                    suggestionBanner.classList.remove('critical-alert');
                }, 500);
            }, 10000);
            return;
        }

        // Check for pending verifications
        const pendingVerifications = getPendingVerificationsCount();
        if (pendingVerifications > 0) {
            suggestionText.innerHTML = `⚠️ You have ${pendingVerifications} pending ${pendingVerifications === 1 ? 'verification' : 'verifications'}. Review them to help donors get verified faster.`;
            suggestionBanner.style.display = 'block';
            setTimeout(() => {
                suggestionBanner.style.opacity = '0';
                setTimeout(() => {
                    suggestionBanner.style.display = 'none';
                    suggestionBanner.style.opacity = '1';
                }, 500);
            }, 8000);
            return;
        }

        // Check for pending requests
        const pendingRequestsCount = requests.filter(r => r.status === 'pending' && r.verificationStatus === 'pending').length;
        if (pendingRequestsCount > 0) {
            suggestionText.innerHTML = `📋 ${pendingRequestsCount} blood ${pendingRequestsCount === 1 ? 'request' : 'requests'} ${pendingRequestsCount === 1 ? 'is' : 'are'} awaiting verification. Approve them to help patients receive blood faster.`;
            suggestionBanner.style.display = 'block';
            setTimeout(() => {
                suggestionBanner.style.opacity = '0';
                setTimeout(() => {
                    suggestionBanner.style.display = 'none';
                    suggestionBanner.style.opacity = '1';
                }, 500);
            }, 8000);
            return;
        }

        // Show random tip from dashboard suggestions
        const dashboardSuggestions = screenSuggestions.dashboard;
        const randomTip = dashboardSuggestions.tips[Math.floor(Math.random() * dashboardSuggestions.tips.length)];
        suggestionText.innerHTML = `💡 ${dashboardSuggestions.suggestion}<br><small style="opacity: 0.8; font-size: 12px;">Tip: ${randomTip}</small>`;
        suggestionBanner.style.display = 'block';
        setTimeout(() => {
            suggestionBanner.style.opacity = '0';
            setTimeout(() => {
                suggestionBanner.style.display = 'none';
                suggestionBanner.style.opacity = '1';
            }, 500);
        }, 8000);
    }

    // Helper to get critical blood types (less than 50 units)
    function getCriticalBloodTypes() {
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const critical = [];

        bloodTypes.forEach(type => {
            const total = bloodBanks.reduce((sum, bank) => {
                return sum + (bank.inventory?.[type]?.units || 0);
            }, 0);
            if (total < 50 && total > 0) critical.push(type);
        });

        return critical;
    }

    // Helper to get pending verifications count
    function getPendingVerificationsCount() {
        // This would typically come from a collection
        return donors.filter(d => d.verificationStatus === 'pending').length;
    }

    // Load all data
    async function loadAllData() {
        const promises = [];

        // Load Blood Banks
        const bloodBanksPromise = new Promise((resolve) => {
            database.ref('bloodBanks').on('value', snapshot => {
                bloodBanks = [];
                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        bloodBanks.push({ id: child.key, ...child.val() });
                    });
                }
                updateStatistics();
                updateBloodTypeOverview();
                resolve();
            }, error => {
                console.error('Error loading blood banks:', error);
                resolve();
            });
        });
        promises.push(bloodBanksPromise);

        // Load Donors & Requesters from the single 'users' collection
        const usersPromise = new Promise((resolve) => {
            firestore.collection('users').onSnapshot(snapshot => {
                donors = [];
                requesters = [];
                snapshot.forEach(doc => {
                    const data = { uid: doc.id, ...doc.data() };
                    if (data.userType === 'donor') donors.push(data);
                    else if (data.userType === 'requester') requesters.push(data);
                });
                updateStatistics();
                resolve();
            }, error => {
                console.error('Error loading users:', error);
                resolve();
            });
        });
        promises.push(usersPromise);

        // Load Blood Requests
        const requestsPromise = new Promise((resolve) => {
            firestore.collection('bloodRequests').onSnapshot(snapshot => {
                requests = [];
                snapshot.forEach(doc => {
                    requests.push({ id: doc.id, ...doc.data() });
                });
                updateStatistics();
                resolve();
            }, error => {
                console.error('Error loading requests:', error);
                resolve();
            });
        });
        promises.push(requestsPromise);

        // Load Reviews
        const reviewsPromise = new Promise((resolve) => {
            firestore.collection('reviews').onSnapshot(snapshot => {
                reviews = [];
                snapshot.forEach(doc => {
                    reviews.push({ id: doc.id, ...doc.data() });
                });
                updateStatistics();
                resolve();
            }, error => {
                console.error('Error loading reviews:', error);
                resolve();
            });
        });
        promises.push(reviewsPromise);

        await Promise.all(promises);

        // --- Cache Update (Background) ---
        try {
            localStorage.setItem('sa_dashboard_cache', JSON.stringify({
                donors, requesters, requests, bloodBanks,
                timestamp: Date.now()
            }));
        } catch (e) { console.warn('Cache write failed', e); }

        return true;
    }

    // Update statistics
    function updateStatistics() {
        // Total blood units
        const totalUnits = bloodBanks.reduce((total, bank) => {
            if (!bank.inventory) return total;
            return total + Object.values(bank.inventory).reduce(
                (sum, inv) => sum + (inv.units || 0),
                0
            );
        }, 0);
        updateElement('totalUnits', totalUnits.toLocaleString());

        // Total blood banks
        updateElement('totalBloodBanks', bloodBanks.length);

        // Verified donors
        const verifiedDonors = donors.filter(d => d.isVerified).length;
        updateElement('verifiedDonors', verifiedDonors);
        updateElement('totalDonors', donors.length);

        // Pending requests (requests waiting for admin verification)
        const pendingRequests = requests.filter(r => r.verificationStatus === 'pending').length;
        updateElement('pendingRequests', pendingRequests);

        // Pending reviews
        const pendingReviews = reviews.filter(r => r.status === 'pending').length;
        updateElement('pendingReviews', pendingReviews);

        // Update additional stats if elements exist
        const activeDonors = donors.filter(d => d.isAvailable).length;
        const totalDonations = donors.reduce((sum, d) => sum + (d.totalDonations || 0), 0);
        const completionRate = requests.length > 0
            ? Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100)
            : 0;

        updateElement('activeDonors', activeDonors);
        updateElement('totalDonations', totalDonations);
        updateElement('completionRate', completionRate);

        // Update Impact Stats in About Section
        updateElement('impactDonors', donors.length.toLocaleString() + (donors.length > 1000 ? '+' : ''));

        const livesSaved = requests.filter(r => r.status === 'completed').length * 3;
        updateElement('impactLives', livesSaved.toLocaleString() + (livesSaved > 500 ? '+' : ''));

        const counties = [...new Set(bloodBanks.map(b => b.county).filter(Boolean))].length;
        updateElement('impactCounties', counties || 47); // Default to 47 if none found

        const avgRating = reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
            : '4.8'; // Default high rating if no reviews
        updateElement('impactRating', avgRating);
    }

    // Update blood type overview with enhanced stats
    function updateBloodTypeOverview() {
        const container = document.getElementById('bloodTypeOverview');
        if (!container) return;

        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const bloodTypeData = {};

        // Calculate totals and bank counts for each blood type
        bloodTypes.forEach(type => {
            let totalUnits = 0;
            let bankCount = 0;
            let maxUnits = 0;
            let maxBank = '';

            bloodBanks.forEach(bank => {
                const units = bank.inventory?.[type]?.units || 0;
                if (units > 0) {
                    totalUnits += units;
                    bankCount++;
                    if (units > maxUnits) {
                        maxUnits = units;
                        maxBank = bank.name;
                    }
                }
            });

            bloodTypeData[type] = {
                units: totalUnits,
                banks: bankCount,
                maxBank: maxBank,
                maxUnits: maxUnits
            };
        });

        // Render blood type cards with enhanced information
        container.innerHTML = bloodTypes.map(type => {
            const data = bloodTypeData[type];
            const units = data.units;
            const status = getEnhancedStockStatus(units);

            return `
                <div class="blood-type-card-new ${status.class}">
                    <div class="blood-card-top">
                        <div class="blood-type-label">${type}</div>
                        <div class="blood-status-badge">${status.label}</div>
                    </div>
                    <div class="blood-card-main">
                        <div class="blood-unit-count">${units.toLocaleString()}</div>
                        <div class="blood-unit-label">Units Available</div>
                    </div>
                    <div class="blood-card-footer">
                        <div class="blood-bank-count">
                            <span>🏥</span>
                            <span>${data.banks} ${data.banks === 1 ? 'Bank' : 'Banks'}</span>
                        </div>
                        ${data.maxUnits > 0 ? `
                            <div class="blood-max-bank" title="Highest stock: ${data.maxBank}">
                                <span>📈</span>
                                <span>${data.maxUnits} units max</span>
                            </div>
                        ` : ''}
                        <div class="blood-trend">${status.emoji}</div>
                    </div>
                    ${units === 0 ? `
                        <div class="blood-warning">
                            <span>⚠️ No stock available</span>
                        </div>
                    ` : units < 50 ? `
                        <div class="blood-warning critical">
                            <span>🚨 Critical shortage</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Enhanced stock status with more granular levels
    function getEnhancedStockStatus(units) {
        if (units === 0) {
            return { class: 'status-critical', label: 'NO STOCK', emoji: '🔴' };
        }
        if (units < 30) {
            return { class: 'status-critical', label: 'CRITICAL', emoji: '🚨' };
        }
        if (units < 80) {
            return { class: 'status-urgent', label: 'LOW', emoji: '⚠️' };
        }
        if (units < 200) {
            return { class: 'status-moderate', label: 'MODERATE', emoji: '🟡' };
        }
        if (units < 500) {
            return { class: 'status-verified', label: 'ADEQUATE', emoji: '🟢' };
        }
        return { class: 'status-good', label: 'EXCELLENT', emoji: '✅' };
    }

    // Setup event listeners
    function setupEventListeners() {
        // Make stat cards clickable
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const label = card.querySelector('.stat-label')?.innerText;
                if (label === 'Pending Requests') {
                    window.location.href = '/requests';
                } else if (label === 'Pending Reviews') {
                    window.location.href = '/reviews';
                } else if (label === 'Verified Donors') {
                    window.location.href = '/donors';
                } else if (label === 'Blood Banks') {
                    window.location.href = '/blood-banks';
                } else if (label === 'Total Blood Units') {
                    window.location.href = '/blood-banks';
                }
            });
        });

        // Add refresh button functionality if present
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                window.utils.showNotification('Refreshing dashboard data...', 'info');
                await loadAllData();
                window.utils.showNotification('Dashboard refreshed!', 'success');
            });
        }
    }

    // Update welcome message with time-based greeting and statistics
    function updateWelcomeMessage() {
        const hour = new Date().getHours();
        let greeting = '';

        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 17) greeting = 'Good Afternoon';
        else greeting = 'Good Evening';

        const userName = document.getElementById('userName');
        const welcomeMsg = document.querySelector('.page-subtitle');

        if (welcomeMsg && !welcomeMsg.hasAttribute('data-greeted')) {
            const stats = getDashboardSummary();
            welcomeMsg.innerHTML = `${greeting}! ${stats}`;
            welcomeMsg.setAttribute('data-greeted', 'true');
        }
    }

    // Get dashboard summary for welcome message
    function getDashboardSummary() {
        const totalDonors = donors.length;
        const activeRequests = requests.filter(r => r.status === 'pending' || r.status === 'accepted').length;
        const criticalTypes = getCriticalBloodTypes();

        if (criticalTypes.length > 0) {
            return `There are ${criticalTypes.length} blood types with critical shortages. ${activeRequests} active requests need attention.`;
        }

        return `You're managing ${totalDonors} donors, ${activeRequests} active requests, and ${bloodBanks.length} blood banks.`;
    }

    // Helper to update element text content
    function updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Expose functions globally for refresh
    window.refreshDashboard = loadAllData;
    window.getDashboardStats = function () {
        return {
            donors: donors.length,
            requesters: requesters.length,
            requests: requests.length,
            bloodBanks: bloodBanks.length,
            reviews: reviews.length,
            totalUnits: bloodBanks.reduce((total, bank) => {
                if (!bank.inventory) return total;
                return total + Object.values(bank.inventory).reduce((sum, inv) => sum + (inv.units || 0), 0);
            }, 0)
        };
    };

})();