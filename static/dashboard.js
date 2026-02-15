// Dashboard Module
(function() {
    'use strict';

    // State
    let donors = [];
    let requesters = [];
    let requests = [];
    let bloodBanks = [];
    let reviews = [];

    // Initialize dashboard
    window.initializePage = function() {
        console.log('Initializing dashboard...');
        loadAllData();
    };

    // Load all data
    function loadAllData() {
        // Load Blood Banks
        database.ref('bloodBanks').on('value', snapshot => {
            bloodBanks = [];
            
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    bloodBanks.push({
                        id: child.key,
                        ...child.val()
                    });
                });
            }
            
            updateStatistics();
            updateBloodTypeOverview();
        }, error => {
            console.error('Error loading blood banks:', error);
        });

        // Load Donors
        firestore.collection('donors').onSnapshot(snapshot => {
            donors = [];
            snapshot.forEach(doc => {
                donors.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });
            updateStatistics();
        }, error => {
            console.error('Error loading donors:', error);
        });

        // Load Requesters
        firestore.collection('requesters').onSnapshot(snapshot => {
            requesters = [];
            snapshot.forEach(doc => {
                requesters.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });
            updateStatistics();
        }, error => {
            console.error('Error loading requesters:', error);
        });

        // Load Blood Requests
        firestore.collection('bloodRequests').onSnapshot(snapshot => {
            requests = [];
            snapshot.forEach(doc => {
                requests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            updateStatistics();
        }, error => {
            console.error('Error loading requests:', error);
        });

        // Load Reviews
        firestore.collection('reviews').onSnapshot(snapshot => {
            reviews = [];
            snapshot.forEach(doc => {
                reviews.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            updateStatistics();
        }, error => {
            console.error('Error loading reviews:', error);
        });
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
        updateElement('totalUnits', totalUnits);
        
        // Total blood banks
        updateElement('totalBloodBanks', bloodBanks.length);
        
        // Verified donors
        const verifiedDonors = donors.filter(d => d.isVerified).length;
        updateElement('verifiedDonors', verifiedDonors);
        
        // Total donors
        updateElement('totalDonors', donors.length);
        
        // Pending requests
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        updateElement('pendingRequests', pendingRequests);
        
        // Pending reviews
        const pendingReviews = reviews.filter(r => r.status === 'pending').length;
        updateElement('pendingReviews', pendingReviews);
    }

    // Update blood type overview
    function updateBloodTypeOverview() {
        const container = document.getElementById('bloodTypeOverview');
        if (!container) return;
        
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const bloodTypeData = {};
        
        // Calculate totals for each blood type
        bloodTypes.forEach(type => {
            bloodTypeData[type] = bloodBanks.reduce((total, bank) => {
                return total + (bank.inventory?.[type]?.units || 0);
            }, 0);
        });
        
        // Render blood type cards
        container.innerHTML = bloodTypes.map(type => {
            const units = bloodTypeData[type];
            const status = window.utils.getStockStatus(units);
            const banksAvailable = bloodBanks.filter(b => b.inventory?.[type]?.units > 0).length;
            
            const colors = {
                'status-critical': { bg: '#FEE2E2', color: '#991B1B' },
                'status-urgent': { bg: '#FEF3C7', color: '#78350F' },
                'status-verified': { bg: '#D1FAE5', color: '#065F46' }
            };
            const colorScheme = colors[status.class];
            
            return `
                <div class="blood-type-card" style="background: ${colorScheme.bg}; border-color: ${colorScheme.color};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: ${colorScheme.color};">${type}</div>
                            <div style="font-size: 13px; color: #64748B; margin-top: 4px;">${status.label}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 32px; font-weight: 700; color: ${colorScheme.color};">${units}</div>
                            <div style="font-size: 12px; color: #64748B;">units</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #64748B;">
                        ${status.emoji} ${banksAvailable} bank${banksAvailable !== 1 ? 's' : ''} available
                    </div>
                </div>
            `;
        }).join('');
    }

    // Helper to update element text content
    function updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

})();