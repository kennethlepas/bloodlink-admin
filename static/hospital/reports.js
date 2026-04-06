// Enhanced Reports Management Module with Advanced Features
(function () {
    'use strict';

    // State management
    let state = {
        donors: [],
        bloodBanks: [],
        requests: [],
        users: [],
        donations: [],
        isLoading: false,
        userRole: null,
        hospitalId: null,
        hospitalName: null,
        charts: {
            bloodType: null,
            requestsTrend: null,
            urgency: null,
            donorActivity: null
        },
        filters: {
            donors: { dateRange: 'all', bloodType: 'all', status: 'all', minDonations: 0, maxDonations: null },
            inventory: { hospital: '', bloodType: 'all', status: 'all' },
            requests: { dateRange: 'all', status: 'all', urgency: 'all' },
            users: { role: 'all', status: 'all', verification: 'all' },
            bookings: { dateRange: 'all', type: 'all', status: 'all' },
            referrals: { dateRange: 'all', status: 'all', urgency: 'all' },
            chats: { dateRange: 'all' }
        },
        bookings: [],
        referrals: [],
        chats: [],
        cache: new Map(),
        listeners: []
    };

    // ==================== INITIALIZATION ====================

    window.initializePage = async function () {
        console.log('🚀 Initializing Reports Dashboard...');
        showLoadingState(true);

        try {
            await setupEventListeners();
            await loadAllData();
            await updateAnalytics();
            await initializeCharts();
            await loadSavedFilters();
            showNotification('Reports dashboard ready', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            showNotification('Failed to initialize reports: ' + error.message, 'error');
        } finally {
            showLoadingState(false);
        }
    };

    // ==================== EVENT LISTENERS ====================

    function setupEventListeners() {
        // Tab switching with animation
        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const tabId = tab.dataset.tab;
                await switchTab(tabId);
            });
        });

        // Donor filters with debounce
        setupFilterListeners('donorDateRange', 'donors', filterDonors);
        setupFilterListeners('donorBloodType', 'donors', filterDonors);
        setupFilterListeners('donorVerificationStatus', 'donors', filterDonors);
        setupDebouncedFilter('minDonations', filterDonors);
        setupDebouncedFilter('maxDonations', filterDonors);

        // Inventory filters
        setupDebouncedFilter('inventoryHospital', filterInventory);
        setupFilterListeners('inventoryBloodType', 'inventory', filterInventory);
        setupFilterListeners('inventoryStatus', 'inventory', filterInventory);

        // Request filters
        setupFilterListeners('requestDateRange', 'requests', filterRequests);
        setupFilterListeners('requestStatus', 'requests', filterRequests);
        setupFilterListeners('requestUrgency', 'requests', filterRequests);

        // User filters
        setupFilterListeners('userRole', 'users', filterUsers);
        setupFilterListeners('userStatus', 'users', filterUsers);
        setupFilterListeners('userVerification', 'users', filterUsers);

        // Booking filters
        setupFilterListeners('bookingDateRange', 'bookings', filterBookings);
        setupFilterListeners('bookingType', 'bookings', filterBookings);
        setupFilterListeners('bookingStatus', 'bookings', filterBookings);

        // Referral filters
        setupFilterListeners('referralDateRange', 'referrals', filterReferrals);
        setupFilterListeners('referralStatus', 'referrals', filterReferrals);
        setupFilterListeners('referralUrgency', 'referrals', filterReferrals);

        // Chat filters
        setupFilterListeners('chatDateRange', 'chats', filterChats);

        // Export all button
        const exportAllBtn = document.getElementById('exportAllReports');
        if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllReports);

        // Schedule button
        const scheduleBtn = document.getElementById('scheduleReports');
        if (scheduleBtn) scheduleBtn.addEventListener('click', openScheduleModal);

        // Modal close
        const modalClose = document.querySelector('#scheduleModal .modal-close');
        if (modalClose) modalClose.addEventListener('click', closeScheduleModal);

        // Auto-refresh every 5 minutes
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                refreshData();
            }
        }, 300000);
    }

    function setupFilterListeners(elementId, filterType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('change', () => {
                state.filters[filterType][elementId.replace(filterType, '').toLowerCase()] = element.value;
                saveFilters();
                handler();
            });
        }
    }

    function setupDebouncedFilter(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            let timeout;
            element.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => handler(), 500);
            });
        }
    }

    async function switchTab(tabId) {
        // Update active tab UI
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));

        const activeTab = Array.from(document.querySelectorAll('.report-tab')).find(t => t.dataset.tab === tabId);
        if (activeTab) activeTab.classList.add('active');

        const activeContent = document.getElementById(`${tabId}Tab`);
        if (activeContent) activeContent.classList.add('active');

        // Refresh charts if switching to analytics
        if (tabId === 'analytics') {
            await refreshCharts();
        }

        // Play subtle animation
        if (activeContent) {
            activeContent.style.animation = 'fadeInPage 0.3s ease';
        }
    }

    // ==================== DATA LOADING ====================

    async function loadAllData() {
        state.isLoading = true;

        try {
            // Check User Role and Hospital Identity
            const hospital = window.hospitalData;
            const user = firebase.auth().currentUser;

            if (hospital) {
                state.userRole = 'hospital_admin';
                state.hospitalId = hospital.facilityCode || hospital.code || hospital.id;
                state.hospitalName = hospital.hospitalName || hospital.name;

                const titleEl = document.querySelector('.page-title');
                const subtitleEl = document.querySelector('.page-subtitle');
                if (titleEl) titleEl.textContent = `Reports: ${state.hospitalName}`;
                if (subtitleEl) subtitleEl.textContent = `Localized analytics for Facility Code: ${state.hospitalId}`;
            }

            // Define Queries based on Role
            let requestsQuery = firestore.collection('bloodRequests');
            let donationsQuery = firestore.collection('donations');
            let donorBookingsQuery = firestore.collection('donorBookings');
            let recipientBookingsQuery = firestore.collection('recipientBookings');
            let referralsQuery = firestore.collection('hospital_referrals');
            let chatsQuery = firestore.collection('chats');

            if (state.userRole === 'hospital_admin') {
                requestsQuery = requestsQuery.where('hospitalName', '==', state.hospitalName);
                donationsQuery = donationsQuery.where('hospitalName', '==', state.hospitalName);
                donorBookingsQuery = donorBookingsQuery.where('hospitalId', '==', state.hospitalId);
                recipientBookingsQuery = recipientBookingsQuery.where('hospitalId', '==', state.hospitalId);
                referralsQuery = referralsQuery.where('participants', 'array-contains', state.hospitalId);
                chatsQuery = chatsQuery.where('participants', 'array-contains', state.hospitalId);
            }

            // Parallel data fetching
            const [donorsSnap, requestsSnap, usersSnap, donationsSnap, dBookingsSnap, rBookingsSnap, referralsSnap, chatsSnap] = await Promise.all([
                firestore.collection('users').where('userType', '==', 'donor').get(),
                requestsQuery.get(),
                firestore.collection('users').get(),
                donationsQuery.get(),
                donorBookingsQuery.get(),
                recipientBookingsQuery.get(),
                referralsQuery.get(),
                chatsQuery.get()
            ]);

            // Process Bookings
            const dBookings = dBookingsSnap.docs.map(d => ({ ...d.data(), id: d.id, type: 'donation' }));
            const rBookings = rBookingsSnap.docs.map(d => ({ ...d.data(), id: d.id, type: 'transfusion' }));
            state.bookings = [...dBookings, ...rBookings].map(b => ({
                ...b,
                date: b.date?.toDate?.() || new Date(b.date || 0)
            }));

            // Process Referrals
            state.referrals = referralsSnap.docs.map(d => ({
                ...d.data(),
                id: d.id,
                createdAtDate: d.data().createdAt?.toDate?.() || new Date(d.data().createdAt || 0)
            }));

            // Process Chats
            state.chats = chatsSnap.docs.map(d => ({
                ...d.data(),
                id: d.id,
                lastMessageTimeDate: d.data().lastMessageTime?.toDate?.() || new Date(d.data().lastMessageTime || 0)
            }));

            // Process donors
            state.donors = donorsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fullName: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim() || 'Unknown'
            }));

            // Process requests with formatted dates
            state.requests = requestsSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAtDate: data.createdAt?.toDate?.() || new Date(data.createdAt || 0),
                    acceptedAtDate: data.acceptedAt?.toDate?.() || null,
                    completedAtDate: data.completedAt?.toDate?.() || null
                };
            });

            // Process users
            state.users = usersSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fullName: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim() || 'Unknown'
            }));

            // Process donations
            state.donations = donationsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                donationDate: d.data().donationDate?.toDate?.() || new Date(d.data().donationDate || 0)
            }));

            // 5. Load blood banks from Realtime Database with strict deduplication
            const banksSnap = await database.ref('bloodBanks').once('value');
            const banksMap = new Map();

            if (banksSnap.exists()) {
                banksSnap.forEach(child => {
                    const bank = { id: child.key, ...child.val() };

                    // Deduplication logic: keyed by unique ID or Name+Code combo
                    const uniqueKey = bank.id || `${bank.name}_${bank.facilityCode}`;

                    if (state.userRole === 'hospital_admin') {
                        // Filter to only show their own hospital in inventory
                        const matchesName = bank.name && state.hospitalName && bank.name.toLowerCase() === state.hospitalName.toLowerCase();
                        const matchesCode = bank.facilityCode && state.hospitalId && String(bank.facilityCode) === String(state.hospitalId);

                        if (matchesName || matchesCode) {
                            banksMap.set(uniqueKey, bank);
                        }
                    } else {
                        // Super admin: show all, but no duplicates
                        banksMap.set(uniqueKey, bank);
                    }
                });
            }
            state.bloodBanks = Array.from(banksMap.values());

            console.log('✅ Data loaded:', {
                donors: state.donors.length,
                requests: state.requests.length,
                users: state.users.length,
                donations: state.donations.length,
                banks: state.bloodBanks.length
            });

            // Update donor donation counts
            await updateDonorDonationCounts();

        } catch (error) {
            console.error('❌ Error loading data:', error);
            throw error;
        } finally {
            state.isLoading = false;
        }
    }

    async function updateDonorDonationCounts() {
        const donationMap = new Map();
        state.donations.forEach(d => {
            donationMap.set(d.donorId, (donationMap.get(d.donorId) || 0) + 1);
        });

        state.donors = state.donors.map(donor => ({
            ...donor,
            donationCount: donationMap.get(donor.id) || 0
        }));
    }

    async function refreshData() {
        console.log('🔄 Refreshing data...');
        await loadAllData();
        await updateAnalytics();
        await refreshCharts();
        await filterDonors();
        await filterInventory();
        await filterRequests();
        await filterUsers();
        showNotification('Data refreshed', 'info');
    }

    // ==================== FILTER FUNCTIONS ====================

    function filterByDateRange(data, dateRange, dateField = 'createdAtDate') {
        if (!dateRange || dateRange === 'all') return data;

        const now = new Date();
        let startDate;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'yesterday':
                startDate = new Date(now.setDate(now.getDate() - 1));
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'quarter':
                startDate = new Date(now.setMonth(now.getMonth() - 3));
                break;
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                return data;
        }

        return data.filter(item => {
            const itemDate = item[dateField] || new Date(0);
            return itemDate >= startDate;
        });
    }

    async function filterDonors() {
        const filters = state.filters.donors;
        let filtered = [...state.donors];

        // Apply date range
        filtered = filterByDateRange(filtered, filters.dateRange, 'createdAt');

        // Apply blood type filter
        if (filters.bloodType && filters.bloodType !== 'all') {
            filtered = filtered.filter(d => d.bloodType === filters.bloodType);
        }

        // Apply verification status
        if (filters.status && filters.status !== 'all') {
            if (filters.status === 'verified') filtered = filtered.filter(d => d.isVerified);
            else if (filters.status === 'pending') filtered = filtered.filter(d => d.verificationStatus === 'pending');
            else if (filters.status === 'rejected') filtered = filtered.filter(d => d.verificationStatus === 'rejected');
        }

        // Apply donation range
        const minDonations = parseInt(filters.minDonations) || 0;
        const maxDonations = filters.maxDonations ? parseInt(filters.maxDonations) : Infinity;
        filtered = filtered.filter(d => d.donationCount >= minDonations && d.donationCount <= maxDonations);

        // Store filtered data for export
        window.filteredDonorsData = filtered;
        return filtered;
    }

    async function filterInventory() {
        const filters = state.filters.inventory;
        let filtered = [...state.bloodBanks];

        // Apply hospital search
        if (filters.hospital) {
            filtered = filtered.filter(b =>
                b.name?.toLowerCase().includes(filters.hospital.toLowerCase()) ||
                b.address?.toLowerCase().includes(filters.hospital.toLowerCase())
            );
        }

        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        const result = filtered.map(bank => {
            const inventory = bank.inventory || {};
            const row = {
                hospital: bank.name,
                address: bank.address,
                phone: bank.phoneNumber,
                ...bloodTypes.reduce((acc, type) => {
                    acc[type] = inventory[type]?.units || 0;
                    return acc;
                }, {})
            };

            const total = bloodTypes.reduce((sum, type) => sum + row[type], 0);
            row.total = total;
            row.criticalCount = bloodTypes.filter(type => row[type] > 0 && row[type] < 5).length;
            row.lowCount = bloodTypes.filter(type => row[type] >= 5 && row[type] <= 10).length;

            return row;
        });

        // Apply blood type filter
        let finalResult = result;
        if (filters.bloodType && filters.bloodType !== 'all') {
            finalResult = finalResult.filter(r => r[filters.bloodType] > 0);
        }

        // Apply stock status filter
        if (filters.status && filters.status !== 'all') {
            if (filters.status === 'critical') {
                finalResult = finalResult.filter(r => r.criticalCount > 0);
            } else if (filters.status === 'low') {
                finalResult = finalResult.filter(r => r.lowCount > 0 && r.criticalCount === 0);
            } else if (filters.status === 'adequate') {
                finalResult = finalResult.filter(r => r.criticalCount === 0 && r.lowCount === 0);
            }
        }

        window.filteredInventoryData = finalResult;
        return finalResult;
    }

    async function filterRequests() {
        const filters = state.filters.requests;
        let filtered = [...state.requests];

        // Apply date range
        filtered = filterByDateRange(filtered, filters.dateRange);

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(r => r.status === filters.status);
        }

        // Apply urgency filter
        if (filters.urgency && filters.urgency !== 'all') {
            filtered = filtered.filter(r => (r.urgencyLevel || r.urgency) === filters.urgency);
        }

        window.filteredRequestsData = filtered;
        return filtered;
    }

    async function filterUsers() {
        const filters = state.filters.users;
        let filtered = [...state.users];

        // Apply role filter
        if (filters.role && filters.role !== 'all') {
            filtered = filtered.filter(u => u.userType === filters.role);
        }

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
            const isActive = filters.status === 'active';
            filtered = filtered.filter(u => (u.isActive !== false) === isActive);
        }

        // Apply verification filter
        if (filters.verification && filters.verification !== 'all') {
            if (filters.verification === 'verified') {
                filtered = filtered.filter(u => u.isVerified === true);
            } else if (filters.verification === 'pending') {
                filtered = filtered.filter(u => u.verificationStatus === 'pending');
            }
        }

        window.filteredUsersData = filtered;
        return filtered;
    }

    async function filterBookings() {
        const filters = state.filters.bookings;
        let filtered = [...state.bookings];

        filtered = filterByDateRange(filtered, filters.dateRange, 'date');

        if (filters.type && filters.type !== 'all') {
            filtered = filtered.filter(b => b.type === filters.type);
        }

        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(b => b.status === filters.status);
        }

        window.filteredBookingsData = filtered;
        return filtered;
    }

    async function filterReferrals() {
        const filters = state.filters.referrals;
        let filtered = [...state.referrals];

        filtered = filterByDateRange(filtered, filters.dateRange, 'createdAtDate');

        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(r => r.status === filters.status);
        }

        if (filters.urgency && filters.urgency !== 'all') {
            filtered = filtered.filter(r => r.urgency === filters.urgency);
        }

        window.filteredReferralsData = filtered;
        return filtered;
    }

    async function filterChats() {
        const filters = state.filters.chats;
        let filtered = [...state.chats];

        filtered = filterByDateRange(filtered, filters.dateRange, 'lastMessageTimeDate');

        window.filteredChatsData = filtered;
        return filtered;
    }

    // ==================== REPORT GENERATION ====================

    async function prepareDonorsData() {
        const filtered = await filterDonors();
        return filtered.map(d => ({
            'Donor ID': d.id,
            'Full Name': d.fullName,
            'Email': d.email || 'N/A',
            'Phone': d.phoneNumber || 'N/A',
            'Blood Type': d.bloodType || 'N/A',
            'Total Donations': d.donationCount,
            'Points': d.points || 0,
            'Status': d.isVerified ? 'Verified' : (d.verificationStatus === 'pending' ? 'Pending' : 'Unverified'),
            'Availability': d.isAvailable ? 'Available' : 'Unavailable',
            'Joined': formatDate(d.createdAt)
        }));
    }

    async function prepareInventoryData() {
        return await filterInventory();
    }

    async function prepareRequestsData() {
        const filtered = await filterRequests();
        return filtered.map(r => ({
            'Request ID': r.id,
            'Patient Name': r.patientName || 'Unknown',
            'Blood Type': r.bloodType || 'N/A',
            'Units Needed': r.unitsNeeded || 0,
            'Hospital': r.hospitalName || 'N/A',
            'Urgency': (r.urgencyLevel || r.urgency || 'moderate').toUpperCase(),
            'Status': r.status || 'pending',
            'Requester': r.requesterName || 'N/A',
            'Created': formatDate(r.createdAt),
            'Response Time': calculateResponseTime(r)
        }));
    }

    async function prepareUsersData() {
        const filtered = await filterUsers();
        return filtered.map(u => ({
            'User ID': u.id,
            'Full Name': u.fullName,
            'Email': u.email || 'N/A',
            'Role': (u.userType || 'User').toUpperCase(),
            'Blood Type': u.bloodType || 'N/A',
            'Status': (u.isActive !== false) ? 'Active' : 'Inactive',
            'Verified': u.isVerified ? 'Yes' : (u.verificationStatus === 'pending' ? 'Pending' : 'No'),
            'Points': u.points || 0,
            'Joined': formatDate(u.createdAt)
        }));
    }

    async function prepareBookingsData() {
        const filtered = await filterBookings();
        return filtered.map(b => ({
            'Booking ID': b.id,
            'Type': (b.type || 'N/A').toUpperCase(),
            'Patient/Donor': b.patientName || b.donorName || 'N/A',
            'Blood Type': b.bloodType || 'N/A',
            'Hospital': b.hospitalName || 'N/A',
            'Date': formatDate(b.date),
            'Time': b.timeSlot || 'N/A',
            'Status': b.status || 'pending'
        }));
    }

    async function prepareReferralsData() {
        const filtered = await filterReferrals();
        return filtered.map(r => ({
            'Referral ID': r.id,
            'Patient': r.patientName || 'N/A',
            'From': r.fromHospitalName || 'N/A',
            'To': r.toHospitalName || 'N/A',
            'Blood Type': r.bloodType || 'N/A',
            'Urgency': (r.urgency || 'standard').toUpperCase(),
            'Status': r.status || 'pending',
            'Created': formatDate(r.createdAtDate)
        }));
    }

    async function prepareChatsData() {
        const filtered = await filterChats();
        return filtered.map(c => {
            const names = Object.values(c.participantNames || {});
            return {
                'Chat ID': c.id,
                'Participants': names.join(' & '),
                'Last Message': c.lastMessage || 'N/A',
                'Last Activity': formatDate(c.lastMessageTimeDate),
                'Unread Messages': Object.values(c.unreadCount || {}).reduce((a, b) => a + b, 0)
            };
        });
    }

    function calculateResponseTime(request) {
        if (!request.acceptedAtDate || !request.createdAtDate) return 'N/A';
        const hours = (request.acceptedAtDate - request.createdAtDate) / (1000 * 60 * 60);
        if (hours < 1) return `${(hours * 60).toFixed(0)} mins`;
        if (hours < 24) return `${hours.toFixed(1)} hrs`;
        return `${(hours / 24).toFixed(1)} days`;
    }

    // ==================== EXPORT FUNCTIONS ====================

    window.generateDonorsReport = async function () {
        await generatePDFReport('Donors Registry Report', await prepareDonorsData(), 'Donors_Report');
    };

    window.exportDonorsExcel = async function () {
        await exportToExcel(await prepareDonorsData(), 'Donors_Report', 'Donors');
    };

    window.generateInventoryReport = async function () {
        await generatePDFReport('Blood Inventory Report', await prepareInventoryData(), 'Inventory_Report');
    };

    window.exportInventoryExcel = async function () {
        await exportToExcel(await prepareInventoryData(), 'Inventory_Report', 'Inventory');
    };

    window.generateRequestsReport = async function () {
        await generatePDFReport('Blood Requests Report', await prepareRequestsData(), 'Requests_Report');
    };

    window.exportRequestsExcel = async function () {
        await exportToExcel(await prepareRequestsData(), 'Requests_Report', 'Requests');
    };

    window.generateUsersReport = async function () {
        await generatePDFReport('System Users Report', await prepareUsersData(), 'Users_Report');
    };

    window.exportUsersExcel = async function () {
        await exportToExcel(await prepareUsersData(), 'Users_Report', 'Users');
    };

    window.generateBookingsReport = async function () {
        await generatePDFReport('Bookings Report', await prepareBookingsData(), 'Bookings_Report');
    };

    window.exportBookingsExcel = async function () {
        await exportToExcel(await prepareBookingsData(), 'Bookings_Report', 'Bookings');
    };

    window.generateReferralsReport = async function () {
        await generatePDFReport('Referrals Report', await prepareReferralsData(), 'Referrals_Report');
    };

    window.exportReferralsExcel = async function () {
        await exportToExcel(await prepareReferralsData(), 'Referrals_Report', 'Referrals');
    };

    window.generateChatsReport = async function () {
        await generatePDFReport('Chat Activity Report', await prepareChatsData(), 'Chats_Report');
    };

    window.exportChatsExcel = async function () {
        await exportToExcel(await prepareChatsData(), 'Chats_Report', 'Chats');
    };

    window.generateAnalyticsReport = async function () {
        const analyticsData = await generateAnalyticsData();
        await exportToExcel([analyticsData], 'Analytics_Report', 'Analytics');
    };

    window.exportAnalyticsExcel = async function () {
        window.generateAnalyticsReport();
    };

    async function exportToExcel(data, filename, sheetName = 'Report') {
        if (!data || data.length === 0) {
            showNotification('No data available for export', 'warning');
            return;
        }

        try {
            showNotification('Preparing Excel export...', 'info');

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Auto-size columns
            const maxWidth = 50;
            const colWidths = Object.keys(data[0] || {}).map(key => ({
                wch: Math.min(maxWidth, Math.max(15, key.length, ...data.map(row => String(row[key] || '').length)))
            }));
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `${filename}_${formatDateForFile()}.xlsx`);
            showNotification('Excel export completed!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification('Failed to export: ' + error.message, 'error');
        }
    }

    async function generatePDFReport(title, data, filename) {
        if (!data || data.length === 0) {
            showNotification('No data available for PDF generation', 'warning');
            return;
        }

        try {
            showNotification('Generating PDF...', 'info');

            const { jsPDF } = window.jspdf;
            // Determine orientation based on number of columns
            const headers = Object.keys(data[0] || {});
            const isWide = headers.length > 7;
            const doc = new jsPDF({
                orientation: isWide ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Add header with gradient-like background
            const pageWidth = doc.internal.pageSize.width;
            doc.setFillColor(30, 58, 138); // Deeper blue
            doc.rect(0, 0, pageWidth, 40, 'F');

            // Decorative accent
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 38, pageWidth, 2, 'F');

            // Logo and branding
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('BloodLink', 15, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Advanced Blood Management & Network System', 15, 28);

            // Report Title and Metadata
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 15, 52);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const dateStr = new Date().toLocaleString('en-KE');
            doc.text(`Generated: ${dateStr}`, pageWidth - 15, 15, { align: 'right' });
            doc.text(`Total Records: ${data.length}`, pageWidth - 15, 22, { align: 'right' });

            const rows = data.map(item => headers.map(h => String(item[h] || '')));

            // Add table with improved styling
            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 60,
                theme: 'striped',
                headStyles: {
                    fillColor: [37, 99, 235],
                    textColor: 255,
                    fontSize: isWide ? 8 : 9,
                    fontStyle: 'bold',
                    halign: 'left',
                    cellPadding: 3
                },
                bodyStyles: {
                    fontSize: isWide ? 7 : 8,
                    textColor: 50,
                    cellPadding: 3,
                    valign: 'middle'
                },
                alternateRowStyles: {
                    fillColor: [249, 250, 251]
                },
                styles: {
                    overflow: 'linebreak',
                    cellWidth: 'auto',
                    lineWidth: 0.1,
                    lineColor: [229, 231, 235]
                },
                margin: { left: 15, right: 15, bottom: 20 },
                didDrawPage: function (data) {
                    // Footer on every page
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    const pg = doc.internal.getNumberOfPages();
                    doc.text(
                        `BloodLink Official System Report - Page ${pg}`,
                        pageWidth / 2,
                        doc.internal.pageSize.height - 10,
                        { align: 'center' }
                    );
                }
            });

            doc.save(`${filename}_${formatDateForFile()}.pdf`);
            showNotification('PDF generated successfully!', 'success');
        } catch (error) {
            console.error('PDF generation error:', error);
            showNotification('Failed to generate PDF: ' + error.message, 'error');
        }
    }

    async function exportAllReports() {
        showNotification('Preparing comprehensive report...', 'info');

        try {
            const wb = XLSX.utils.book_new();

            const sheets = {
                'Donors': await prepareDonorsData(),
                'Inventory': await prepareInventoryData(),
                'Requests': await prepareRequestsData(),
                'Users': await prepareUsersData(),
                'Bookings': await prepareBookingsData(),
                'Referrals': await prepareReferralsData(),
                'Chats': await prepareChatsData(),
                'Analytics': [await generateAnalyticsData()]
            };

            for (const [name, data] of Object.entries(sheets)) {
                if (data && data.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, name);
                }
            }

            XLSX.writeFile(wb, `BloodLink_Complete_Report_${formatDateForFile()}.xlsx`);
            showNotification('All reports exported successfully!', 'success');
        } catch (error) {
            console.error('Export all error:', error);
            showNotification('Failed to export all reports', 'error');
        }
    }

    // ==================== ANALYTICS FUNCTIONS ====================

    async function generateAnalyticsData() {
        const completedRequests = state.requests.filter(r => r.status === 'completed').length;
        const completionRate = state.requests.length > 0 ? ((completedRequests / state.requests.length) * 100).toFixed(1) : 0;

        // Calculate average response time
        const acceptedRequests = state.requests.filter(r => r.status === 'accepted' && r.acceptedAtDate && r.createdAtDate);
        let avgResponseTime = 0;
        if (acceptedRequests.length > 0) {
            const totalHours = acceptedRequests.reduce((sum, r) => {
                const hours = (r.acceptedAtDate - r.createdAtDate) / (1000 * 60 * 60);
                return sum + hours;
            }, 0);
            avgResponseTime = (totalHours / acceptedRequests.length).toFixed(1);
        }

        // Blood type distribution
        const bloodTypeCounts = {};
        state.donors.forEach(d => {
            const bt = d.bloodType || 'Unknown';
            bloodTypeCounts[bt] = (bloodTypeCounts[bt] || 0) + 1;
        });

        return {
            'Generated On': new Date().toLocaleString('en-KE'),
            'Total Donors': state.donors.length,
            'Verified Donors': state.donors.filter(d => d.isVerified).length,
            'Active Donors': state.donors.filter(d => d.isAvailable).length,
            'Total Requests': state.requests.length,
            'Pending Requests': state.requests.filter(r => r.status === 'pending').length,
            'Completed Requests': completedRequests,
            'Completion Rate': `${completionRate}%`,
            'Avg Response Time': avgResponseTime > 0 ? `${avgResponseTime} hours` : 'N/A',
            'Total Donations': state.donations.length,
            'Total Points Awarded': state.donors.reduce((sum, d) => sum + (d.points || 0), 0),
            'Active Blood Banks': state.bloodBanks.length,
            'Critical Blood Types': await getCriticalBloodTypes(),
            'Total Bookings': state.bookings.length,
            'Donation Bookings': state.bookings.filter(b => b.type === 'donation').length,
            'Transfusion Bookings': state.bookings.filter(b => b.type === 'transfusion').length,
            'Referrals Sent/Received': state.referrals.length,
            'Referral Success Rate': state.referrals.length > 0 ? ((state.referrals.filter(r => r.status === 'completed').length / state.referrals.length) * 100).toFixed(1) + '%' : 'N/A',
            'Active Chat Threads': state.chats.length,
            'Total Messages (Approx)': state.chats.reduce((sum, c) => sum + (c.messageCount || 0), 0)
        };
    }

    async function getCriticalBloodTypes() {
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const critical = [];

        for (const type of bloodTypes) {
            let total = 0;
            state.bloodBanks.forEach(bank => {
                total += bank.inventory?.[type]?.units || 0;
            });
            if (total < 10) critical.push(`${type} (${total} units)`);
        }

        return critical.join(', ') || 'None';
    }

    async function updateAnalytics() {
        const analytics = await generateAnalyticsData();

        // Update DOM elements
        const elements = {
            totalDonorsMetric: state.donors.length,
            totalRequestsMetric: state.requests.length,
            completionRateMetric: analytics['Completion Rate'],
            avgResponseMetric: analytics['Avg Response Time'],
            activeBanksMetric: state.userRole === 'hospital_admin' ? 'Monitoring' : state.bloodBanks.length,
            criticalRequestsMetric: state.requests.filter(r => (r.urgencyLevel || r.urgency) === 'critical').length,
            totalBookingsMetric: analytics['Total Bookings'],
            referralsMetric: analytics['Referrals Sent/Received']
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    // ==================== CHART FUNCTIONS ====================

    async function initializeCharts() {
        // Wait for Chart.js to load
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet, retrying...');
            setTimeout(initializeCharts, 500);
            return;
        }

        await refreshCharts();
    }

    async function refreshCharts() {
        try {
            // Destroy existing charts
            Object.values(state.charts).forEach(chart => {
                if (chart) chart.destroy();
            });

            // Blood Type Distribution Chart
            const bloodTypeCtx = document.getElementById('bloodTypeChart')?.getContext('2d');
            if (bloodTypeCtx) {
                const bloodTypeData = await getBloodTypeDistribution();
                state.charts.bloodType = new Chart(bloodTypeCtx, {
                    type: 'doughnut',
                    data: {
                        labels: bloodTypeData.labels,
                        datasets: [{
                            data: bloodTypeData.values,
                            backgroundColor: [
                                '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
                                '#1E40AF', '#1E3A8A', '#2E3B4E', '#4B5563'
                            ],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} donors` } }
                        }
                    }
                });
            }

            // Requests Trend Chart
            const trendCtx = document.getElementById('requestsTrendChart')?.getContext('2d');
            if (trendCtx) {
                const trendData = await getRequestsTrend();
                state.charts.requestsTrend = new Chart(trendCtx, {
                    type: 'line',
                    data: {
                        labels: trendData.labels,
                        datasets: [
                            {
                                label: 'Total Requests',
                                data: trendData.total,
                                borderColor: '#2563EB',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                tension: 0.4,
                                fill: true
                            },
                            {
                                label: 'Completed',
                                data: trendData.completed,
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                tension: 0.4,
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { position: 'top' } }
                    }
                });
            }

            // Urgency Distribution Chart
            const urgencyCtx = document.getElementById('urgencyChart')?.getContext('2d');
            if (urgencyCtx) {
                const urgencyData = await getUrgencyDistribution();
                state.charts.urgency = new Chart(urgencyCtx, {
                    type: 'bar',
                    data: {
                        labels: urgencyData.labels,
                        datasets: [{
                            label: 'Requests',
                            data: urgencyData.values,
                            backgroundColor: ['#DC2626', '#F59E0B', '#0EA5E9'],
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { display: false } }
                    }
                });
            }

            // Donor Activity Chart
            const activityCtx = document.getElementById('donorActivityChart')?.getContext('2d');
            if (activityCtx) {
                const activityData = await getDonorActivity();
                state.charts.donorActivity = new Chart(activityCtx, {
                    type: 'bar',
                    data: {
                        labels: activityData.labels,
                        datasets: [{
                            label: 'Donations',
                            data: activityData.values,
                            backgroundColor: '#059669',
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { position: 'top' } }
                    }
                });
            }

            // Booking Type Distribution Chart
            const bookingTypeCtx = document.getElementById('bookingTypeChart')?.getContext('2d');
            if (bookingTypeCtx) {
                const donationCount = state.bookings.filter(b => b.type === 'donation').length;
                const transfusionCount = state.bookings.filter(b => b.type === 'transfusion').length;
                state.charts.bookingType = new Chart(bookingTypeCtx, {
                    type: 'pie',
                    data: {
                        labels: ['Donations', 'Transfusions'],
                        datasets: [{
                            data: [donationCount, transfusionCount],
                            backgroundColor: ['#DB2777', '#2563EB', '#FB923C', '#F472B6'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Chart refresh error:', error);
        }
    }

    async function getBloodTypeDistribution() {
        const counts = {};
        state.donors.forEach(d => {
            const bt = d.bloodType || 'Unknown';
            counts[bt] = (counts[bt] || 0) + 1;
        });
        return {
            labels: Object.keys(counts),
            values: Object.values(counts)
        };
    }

    async function getRequestsTrend() {
        const last7Days = [];
        const total = [];
        const completed = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dateStr = date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
            last7Days.push(dateStr);

            const dayTotal = state.requests.filter(r => {
                const rDate = r.createdAtDate;
                return rDate >= date && rDate < nextDay;
            }).length;
            total.push(dayTotal);

            const dayCompleted = state.requests.filter(r => {
                const rDate = r.completedAtDate;
                const status = (r.status || '').toLowerCase();
                return status === 'completed' && rDate && rDate >= date && rDate < nextDay;
            }).length;
            completed.push(dayCompleted);
        }

        return { labels: last7Days, total, completed };
    }

    async function getUrgencyDistribution() {
        const critical = state.requests.filter(r => (r.urgencyLevel || r.urgency) === 'critical').length;
        const urgent = state.requests.filter(r => (r.urgencyLevel || r.urgency) === 'urgent').length;
        const moderate = state.requests.filter(r => (r.urgencyLevel || r.urgency) === 'moderate').length;

        return {
            labels: ['Critical', 'Urgent', 'Moderate'],
            values: [critical, urgent, moderate]
        };
    }

    async function getDonorActivity() {
        const last6Months = [];
        const donations = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            // Fix month rollover bug by setting day to 1 before subtracting months
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = date.toLocaleDateString('en-KE', { month: 'short' });
            last6Months.push(monthStr);

            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const monthDonations = state.donations.filter(d => {
                const dDate = d.donationDate;
                return dDate >= monthStart && dDate <= monthEnd;
            }).length;
            donations.push(monthDonations);
        }

        return { labels: last6Months, values: donations };
    }

    // ==================== PREVIEW FUNCTIONS ====================

    window.previewDonorsReport = async function () {
        await showPreview('donors', await prepareDonorsData(), ['Full Name', 'Blood Type', 'Total Donations', 'Status']);
    };

    window.previewInventoryReport = async function () {
        await showPreview('inventory', await prepareInventoryData(), ['hospital', 'total', 'criticalCount']);
    };

    window.previewRequestsReport = async function () {
        await showPreview('requests', await prepareRequestsData(), ['Patient Name', 'Blood Type', 'Urgency', 'Status']);
    };

    window.previewUsersReport = async function () {
        await showPreview('users', await prepareUsersData(), ['Full Name', 'Role', 'Status', 'Verified']);
    };

    async function showPreview(type, data, displayFields) {
        const previewDiv = document.getElementById(`${type}Preview`);
        const contentDiv = document.getElementById(`${type}PreviewContent`);

        if (!previewDiv || !contentDiv) return;

        if (!data || data.length === 0) {
            contentDiv.innerHTML = '<div class="empty-state"><p>📭 No data available for the selected filters</p></div>';
        } else {
            const previewData = data.slice(0, 10);
            const tableHtml = `
                <table class="preview-table">
                    <thead>
                        <tr>${displayFields.map(f => `<th>${f}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${previewData.map(row => `
                            <tr>${displayFields.map(f => `<td>${row[f] || row[f.toLowerCase().replace(' ', '')] || '—'}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.length > 10 ? `<div class="preview-footer">Showing 10 of ${data.length} records</div>` : ''}
            `;
            contentDiv.innerHTML = tableHtml;
        }

        previewDiv.style.display = 'block';
        previewDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.closePreview = function (type) {
        const previewDiv = document.getElementById(`${type}Preview`);
        if (previewDiv) previewDiv.style.display = 'none';
    };

    // ==================== SCHEDULE FUNCTIONS ====================

    window.openScheduleModal = function () {
        const modal = document.getElementById('scheduleModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeScheduleModal = function () {
        const modal = document.getElementById('scheduleModal');
        if (modal) modal.style.display = 'none';
    };

    window.saveSchedule = async function () {
        const reportType = document.getElementById('scheduleReportType')?.value;
        const frequency = document.getElementById('scheduleFrequency')?.value;
        const format = document.getElementById('scheduleFormat')?.value;
        const email = document.getElementById('scheduleEmail')?.value;
        const notes = document.getElementById('scheduleNotes')?.value;

        if (!email) {
            showNotification('Please enter a recipient email', 'error');
            return;
        }

        try {
            await firestore.collection('scheduled_reports').add({
                reportType,
                frequency,
                format,
                email,
                notes,
                createdAt: firestore.FieldValue.serverTimestamp(),
                status: 'active',
                lastSent: null
            });

            showNotification('Report scheduled successfully!', 'success');
            closeScheduleModal();

            // Clear form
            if (document.getElementById('scheduleNotes')) document.getElementById('scheduleNotes').value = '';
        } catch (error) {
            console.error('Error scheduling report:', error);
            showNotification('Failed to schedule report: ' + error.message, 'error');
        }
    };

    // ==================== UTILITY FUNCTIONS ====================

    function formatDate(date) {
        if (!date) return 'N/A';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return 'N/A';
        }
    }

    function formatDateForFile() {
        return new Date().toISOString().split('T')[0];
    }

    function showNotification(message, type = 'info') {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    function showLoadingState(show) {
        state.isLoading = show;
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    async function saveFilters() {
        try {
            await localStorage.setItem('reportFilters', JSON.stringify(state.filters));
        } catch (e) {
            console.warn('Failed to save filters:', e);
        }
    }

    async function loadSavedFilters() {
        try {
            const saved = localStorage.getItem('reportFilters');
            if (saved) {
                const parsed = JSON.parse(saved);
                state.filters = { ...state.filters, ...parsed };

                // Restore filter values to DOM
                for (const [category, filters] of Object.entries(state.filters)) {
                    for (const [key, value] of Object.entries(filters)) {
                        const element = document.getElementById(`${category}${key.charAt(0).toUpperCase() + key.slice(1)}`);
                        if (element && value) element.value = value;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load saved filters:', e);
        }
    }

    // ==================== EMAIL REPORT ====================

    window.emailDonorsReport = async function () {
        await emailReport('Donors', await prepareDonorsData());
    };

    window.emailInventoryReport = async function () {
        await emailReport('Inventory', await prepareInventoryData());
    };

    window.emailRequestsReport = async function () {
        await emailReport('Blood Requests', await prepareRequestsData());
    };

    window.emailUsersReport = async function () {
        await emailReport('System Users', await prepareUsersData());
    };

    async function emailReport(title, data) {
        const email = prompt('Enter recipient email address:');
        if (!email) return;

        try {
            showNotification('Preparing email...', 'info');

            // Generate PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.text('BloodLink Report', 14, 25);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text(title, 14, 50);

            if (data && data.length > 0) {
                const headers = Object.keys(data[0]);
                const rows = data.map(item => headers.map(h => String(item[h] || '')));
                doc.autoTable({
                    head: [headers],
                    body: rows,
                    startY: 60,
                    theme: 'striped'
                });
            }

            const pdfBlob = doc.output('blob');

            // Send email via Firebase function (if available)
            const sendEmailFunction = firebase.functions().httpsCallable('sendReportEmail');
            await sendEmailFunction({
                to: email,
                subject: `BloodLink Report: ${title}`,
                pdfAttachment: await blobToBase64(pdfBlob),
                reportName: title
            });

            showNotification(`Report sent to ${email}`, 'success');
        } catch (error) {
            console.error('Email error:', error);
            showNotification('Failed to send email: ' + error.message, 'error');
        }
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ==================== PRINT DASHBOARD ====================

    window.printAnalyticsDashboard = function () {
        const dashboard = document.querySelector('.analytics-dashboard');
        if (!dashboard) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>BloodLink Analytics Dashboard</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .analytics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                        .analytics-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
                        .metric-value { font-size: 32px; font-weight: bold; color: #2563EB; }
                        .charts-container { margin-top: 30px; }
                        .chart-card { margin-bottom: 30px; }
                        h2 { color: #1E40AF; }
                        hr { margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <h1>BloodLink Analytics Dashboard</h1>
                    <p>Generated: ${new Date().toLocaleString('en-KE')}</p>
                    <hr/>
                    ${dashboard.outerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

})();