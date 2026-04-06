const firebaseConfig = {
    apiKey: "AIzaSyBmbgEyTbdFFFwpxaLYdX3rRwvoWSL1wQ0",
    authDomain: "bloodlink-app-b9297.firebaseapp.com",
    databaseURL: "https://bloodlink-app-b9297-default-rtdb.firebaseio.com",
    projectId: "bloodlink-app-b9297",
    storageBucket: "bloodlink-app-b9297.firebasestorage.app",
    messagingSenderId: "492859346824",
    appId: "1:492859346824:web:77dea9c3e8c6eb1376f43d",
    measurementId: "G-B55EDLVHF2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const firestore = firebase.firestore();

// State Variables
let currentUser = null;
let donors = [];
let requesters = [];
let requests = [];
let bloodBanks = [];
let reviews = [];

// DOM Elements
const elements = {
    loading: document.getElementById('loading'),
    loginContainer: document.getElementById('loginContainer'),
    adminContainer: document.getElementById('adminContainer'),
    loginForm: document.getElementById('loginForm'),
    loginError: document.getElementById('loginError'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userEmail: document.getElementById('userEmail'),
    addBloodBankModal: document.getElementById('addBloodBankModal'),
    bloodBankForm: document.getElementById('bloodBankForm'),
    addBloodBankBtn: document.getElementById('addBloodBankBtn'),
    cancelBankModal: document.getElementById('cancelBankModal'),
    reviewDetailsModal: document.getElementById('reviewDetailsModal'),
    closeReviewModal: document.getElementById('closeReviewModal')
};

// ==================== AUTHENTICATION (Consolidated in auth.js) ====================
// Only use getCurrentUser() if needed for component-level logic

elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = 'Signing in...';
    elements.loginError.classList.add('hidden');

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login error:', error);

        let errorMessage = 'Login failed. Please try again.';

        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many login attempts. Please try again later.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection.';
        }

        elements.loginError.textContent = errorMessage;
        elements.loginError.classList.remove('hidden');
    } finally {
        elements.loginBtn.disabled = false;
        elements.loginBtn.textContent = 'Sign In';
    }
});

elements.logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
});

// ==================== DATA LOADING ====================

function loadData() {
    console.log('Loading data from Firebase...');

    // Load Blood Banks from Realtime Database
    database.ref('bloodBanks').on('value', snapshot => {
        bloodBanks = [];

        console.log('Blood Banks snapshot:', snapshot.val());

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const bankData = child.val();
                bloodBanks.push({
                    id: child.key,
                    ...bankData
                });
                console.log('Loaded blood bank:', child.key, bankData);
            });
        }

        console.log('Total blood banks loaded:', bloodBanks.length);
        renderBloodBanks();
        updateStats();
    }, error => {
        console.error('Error loading blood banks:', error);
    });

    // Load Donors from Firestore
    firestore.collection('donors').onSnapshot(snapshot => {
        donors = [];

        snapshot.forEach(doc => {
            donors.push({
                uid: doc.id,
                ...doc.data()
            });
        });

        renderDonors();
        updateStats();
    }, error => {
        console.error('Error loading donors:', error);
    });

    // Load Requesters from Firestore
    firestore.collection('requesters').onSnapshot(snapshot => {
        requesters = [];

        snapshot.forEach(doc => {
            requesters.push({
                uid: doc.id,
                ...doc.data()
            });
        });

        updateStats();
    }, error => {
        console.error('Error loading requesters:', error);
    });

    // Load Blood Requests from Firestore
    firestore.collection('bloodRequests').onSnapshot(snapshot => {
        requests = [];

        snapshot.forEach(doc => {
            requests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderRequests();
        updateStats();
    }, error => {
        console.error('Error loading requests:', error);
    });

    // Load Reviews from Firestore
    firestore.collection('reviews').onSnapshot(snapshot => {
        reviews = [];

        snapshot.forEach(doc => {
            reviews.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('Reviews loaded:', reviews.length);
        renderReviews();
        updateStats();
    }, error => {
        console.error('Error loading reviews:', error);
    });
}

// ==================== STATISTICS ====================

function updateStats() {
    // Calculate total units across all blood banks
    const totalUnits = bloodBanks.reduce((total, bank) => {
        if (!bank.inventory) return total;

        const bankTotal = Object.values(bank.inventory).reduce(
            (sum, inv) => sum + (inv.units || 0),
            0
        );
        return total + bankTotal;
    }, 0);
    document.getElementById('totalUnits').textContent = totalUnits;

    // Verified Donors from Firestore
    const verifiedDonors = donors.filter(d => d.isVerified).length;
    document.getElementById('verifiedDonors').textContent = verifiedDonors;

    // Total Donors
    document.getElementById('totalDonors').textContent = donors.length;

    // Pending Requests
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    document.getElementById('pendingRequests').textContent = pendingRequests;

    // Total Blood Banks
    document.getElementById('totalBloodBanks').textContent = bloodBanks.length;

    // Pending Reviews
    const pendingReviews = reviews.filter(r => r.status === 'pending').length;
    document.getElementById('pendingReviews').textContent = pendingReviews;

    // Update blood type overview
    updateBloodTypeOverview();
}

// ==================== BLOOD TYPE OVERVIEW ====================

function updateBloodTypeOverview() {
    const bloodTypeOverview = document.getElementById('bloodTypeOverview');
    if (!bloodTypeOverview) return;

    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const bloodTypeData = {};

    // Calculate totals for each blood type across all banks
    bloodTypes.forEach(type => {
        bloodTypeData[type] = bloodBanks.reduce((total, bank) => {
            return total + (bank.inventory?.[type]?.units || 0);
        }, 0);
    });

    // Render blood type cards
    bloodTypeOverview.innerHTML = bloodTypes.map(type => {
        const units = bloodTypeData[type];
        const status = units === 0 ? 'empty' : units < 50 ? 'low' : units < 100 ? 'medium' : 'good';
        const statusColors = {
            empty: { bg: '#fee2e2', color: '#991b1b', label: 'Out of Stock' },
            low: { bg: '#fef3c7', color: '#78350f', label: 'Low Stock' },
            medium: { bg: '#dbeafe', color: '#1e40af', label: 'Moderate' },
            good: { bg: '#d1fae5', color: '#065f46', label: 'Good Stock' }
        };
        const colors = statusColors[status];

        return `
            <div class="blood-type-card" style="background: ${colors.bg}; border-left: 4px solid ${colors.color};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: ${colors.color};">${type}</div>
                        <div style="font-size: 14px; color: #64748B; margin-top: 4px;">${colors.label}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 28px; font-weight: bold; color: ${colors.color};">${units}</div>
                        <div style="font-size: 12px; color: #64748B;">units</div>
                    </div>
                </div>
                <div style="margin-top: 12px; font-size: 12px; color: #64748B;">
                    ${bloodBanks.filter(b => b.inventory?.[type]?.units > 0).length} bank${bloodBanks.filter(b => b.inventory?.[type]?.units > 0).length !== 1 ? 's' : ''} available
                </div>
            </div>
        `;
    }).join('');
}

// ==================== BLOOD BANK MANAGEMENT ====================

function renderBloodBanks() {
    const tbody = document.getElementById('bloodBanksTableBody');

    console.log('Rendering blood banks. Count:', bloodBanks.length);

    if (bloodBanks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No blood banks registered yet</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    bloodBanks.forEach(bank => {
        console.log('Rendering bank:', bank);

        // Get location coordinates
        const location = bank.location || {};
        const lat = location.latitude || 0;
        const lng = location.longitude || 0;
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        // Count available blood types with inventory
        const inventory = bank.inventory || {};
        const availableTypes = Object.entries(inventory).filter(([type, data]) =>
            data && data.units > 0
        ).length;

        // Format phone number
        const phone = bank.phoneNumber || 'Not provided';

        // Format email
        const email = bank.email || 'Not provided';

        // Check if verified
        const isVerified = bank.isVerified || false;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong>${bank.name}</strong>
                    ${isVerified ? '<span style="color: #10b981;" title="Verified">✓</span>' : '<span style="color: #94a3b8;" title="Not verified">○</span>'}
                </div>
            </td>
            <td style="max-width: 200px;">${bank.address}</td>
            <td>${phone}</td>
            <td>${email}</td>
            <td style="font-family: monospace; font-size: 12px;">${coords}</td>
            <td>
                <span class="blood-type-badge" style="background: ${availableTypes > 0 ? '#d1fae5' : '#fee2e2'}; color: ${availableTypes > 0 ? '#065f46' : '#991b1b'};">
                    ${availableTypes} / 8 types
                </span>
            </td>
            <td style="white-space: nowrap;">
                <button class="action-btn edit-btn" onclick="editBloodBank('${bank.id}')">
                    ✏️ Edit
                </button>
                <button class="action-btn" style="background: #dbeafe; color: #1e40af;" onclick="editBloodBankInventory('${bank.id}')">
                    📊 Stock
                </button>
                <button class="action-btn delete-btn" onclick="deleteBloodBank('${bank.id}')">
                    🗑️ Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

async function editBloodBank(id) {
    const bank = bloodBanks.find(b => b.id === id);

    if (!bank) {
        alert('Blood bank not found');
        return;
    }

    // Pre-fill form with existing data
    document.getElementById('bankName').value = bank.name || '';
    document.getElementById('bankAddress').value = bank.address || '';
    document.getElementById('bankPhone').value = bank.phoneNumber || '';
    document.getElementById('bankEmail').value = bank.email || '';
    document.getElementById('bankLatitude').value = bank.location?.latitude || '';
    document.getElementById('bankLongitude').value = bank.location?.longitude || '';
    document.getElementById('bankVerified').checked = bank.isVerified || false;

    // Store the ID for update
    elements.bloodBankForm.dataset.editId = id;

    // Change modal title
    const modalTitle = elements.addBloodBankModal.querySelector('h2');
    modalTitle.textContent = 'Edit Blood Bank';

    elements.addBloodBankModal.classList.add('show');
}

// Current blood bank being edited
let currentInventoryBankId = null;

async function editBloodBankInventory(id) {
    const bank = bloodBanks.find(b => b.id === id);

    if (!bank) {
        alert('Blood bank not found');
        return;
    }

    currentInventoryBankId = id;
    const inventory = bank.inventory || {};
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    // Update modal title
    document.getElementById('inventoryModalTitle').textContent = `Manage Blood Inventory`;
    document.getElementById('inventoryModalSubtitle').textContent = `${bank.name} - ${bank.address}`;

    // Populate form with current inventory
    bloodTypes.forEach(type => {
        const currentUnits = inventory[type]?.units || 0;
        const lastUpdated = inventory[type]?.lastUpdated;

        // Set input value
        const input = document.getElementById(`units-${type}`);
        if (input) {
            input.value = currentUnits;
        }

        // Update status indicator
        const statusEl = document.getElementById(`status-${type}`);
        if (statusEl) {
            if (currentUnits === 0) {
                statusEl.textContent = '⚫'; // Empty
                statusEl.title = 'Out of stock';
            } else if (currentUnits < 10) {
                statusEl.textContent = '🔴'; // Critical
                statusEl.title = 'Critical stock';
            } else if (currentUnits < 30) {
                statusEl.textContent = '🟡'; // Low
                statusEl.title = 'Low stock';
            } else {
                statusEl.textContent = '🟢'; // Good
                statusEl.title = 'Good stock';
            }
        }

        // Update metadata
        const metaEl = document.getElementById(`meta-${type}`);
        if (metaEl && lastUpdated) {
            const date = new Date(lastUpdated);
            metaEl.textContent = `Updated: ${date.toLocaleDateString()}`;
        } else if (metaEl) {
            metaEl.textContent = 'Never updated';
        }
    });

    // Show modal
    document.getElementById('inventoryModal').classList.add('show');
}

function viewBloodBankInventory(id) {
    const bank = bloodBanks.find(b => b.id === id);

    if (!bank) {
        alert('Blood bank not found');
        return;
    }

    const inventory = bank.inventory || {};
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    let inventoryDetails = `Blood Inventory for: ${bank.name}\n\n`;
    inventoryDetails += `Location: ${bank.address}\n`;
    inventoryDetails += `Phone: ${bank.phoneNumber}\n\n`;
    inventoryDetails += `Current Stock:\n`;
    inventoryDetails += `${'='.repeat(40)}\n`;

    bloodTypes.forEach(type => {
        const units = inventory[type]?.units || 0;
        const status = units < 10 ? '🔴 Critical' : units < 30 ? '🟡 Low' : '🟢 Good';
        inventoryDetails += `${type.padEnd(6)} : ${String(units).padStart(4)} units  ${status}\n`;
    });

    const totalUnits = bloodTypes.reduce((sum, type) => sum + (inventory[type]?.units || 0), 0);
    inventoryDetails += `${'='.repeat(40)}\n`;
    inventoryDetails += `Total  : ${String(totalUnits).padStart(4)} units\n`;

    alert(inventoryDetails);
}

async function deleteBloodBank(id) {
    const bank = bloodBanks.find(b => b.id === id);

    if (!bank) {
        alert('Blood bank not found');
        return;
    }

    const confirmMessage = `Are you sure you want to delete "${bank.name}"?\n\nThis will permanently remove:\n- Blood bank details\n- All inventory records\n- This action cannot be undone`;

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        await database.ref(`bloodBanks/${id}`).remove();
        console.log('Blood bank deleted:', id);
        alert('Blood bank deleted successfully');
    } catch (error) {
        console.error('Error deleting blood bank:', error);
        alert('Failed to delete blood bank. Please try again.');
    }
}

elements.addBloodBankBtn.addEventListener('click', () => {
    // Reset form
    elements.bloodBankForm.reset();
    delete elements.bloodBankForm.dataset.editId;

    // Reset modal title
    const modalTitle = elements.addBloodBankModal.querySelector('h2');
    modalTitle.textContent = 'Add Blood Bank';

    // Set default coordinates (Nairobi city center)
    document.getElementById('bankLatitude').value = '-1.286389';
    document.getElementById('bankLongitude').value = '36.817223';

    elements.addBloodBankModal.classList.add('show');
});

elements.cancelBankModal.addEventListener('click', () => {
    elements.addBloodBankModal.classList.remove('show');
    elements.bloodBankForm.reset();
    delete elements.bloodBankForm.dataset.editId;
});

elements.bloodBankForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const latitude = parseFloat(document.getElementById('bankLatitude').value);
    const longitude = parseFloat(document.getElementById('bankLongitude').value);

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
        alert('Please enter valid coordinates (numbers only)');
        return;
    }

    if (latitude < -90 || latitude > 90) {
        alert('Latitude must be between -90 and 90');
        return;
    }

    if (longitude < -180 || longitude > 180) {
        alert('Longitude must be between -180 and 180');
        return;
    }

    // Validate phone number
    const phoneNumber = document.getElementById('bankPhone').value.trim();
    if (!phoneNumber) {
        alert('Phone number is required');
        return;
    }

    const data = {
        name: document.getElementById('bankName').value.trim(),
        address: document.getElementById('bankAddress').value.trim(),
        phoneNumber: phoneNumber,
        email: document.getElementById('bankEmail').value.trim() || null,
        location: {
            latitude: latitude,
            longitude: longitude
        },
        isVerified: document.getElementById('bankVerified').checked,
        updatedAt: new Date().toISOString()
    };

    const editId = elements.bloodBankForm.dataset.editId;

    try {
        if (editId) {
            // Update existing blood bank
            const existingBank = bloodBanks.find(b => b.id === editId);

            // Preserve existing inventory
            if (existingBank && existingBank.inventory) {
                data.inventory = existingBank.inventory;
            }

            await database.ref(`bloodBanks/${editId}`).update(data);
            console.log('Blood bank updated:', editId);
            alert('Blood bank updated successfully');
        } else {
            // Create new blood bank with empty inventory
            data.createdAt = new Date().toISOString();

            // Initialize inventory with all blood types at 0 units
            data.inventory = {};
            const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
            bloodTypes.forEach(type => {
                data.inventory[type] = {
                    units: 0,
                    lastUpdated: new Date().toISOString()
                };
            });

            const newRef = await database.ref('bloodBanks').push(data);
            console.log('New blood bank created:', newRef.key);
            alert('Blood bank added successfully!');
        }

        // Close modal and reset form
        elements.addBloodBankModal.classList.remove('show');
        elements.bloodBankForm.reset();
        delete elements.bloodBankForm.dataset.editId;
    } catch (error) {
        console.error('Error saving blood bank:', error);
        alert(`Failed to save blood bank: ${error.message}`);
    }
});

// ==================== DONOR MANAGEMENT ====================

function renderDonors() {
    const tbody = document.getElementById('donorsTableBody');

    if (donors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No donors registered yet</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    donors.forEach(donor => {
        const fullName = `${donor.firstName || ''} ${donor.lastName || ''}`.trim() || 'N/A';
        const weight = donor.weight || 'N/A';
        const totalDonations = donor.totalDonations || 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${fullName}</td>
            <td>${donor.email}</td>
            <td>${donor.phoneNumber}</td>
            <td>
                <span class="blood-type-badge" style="background: #fee2e2; color: #991b1b;">
                    ${donor.bloodType}
                </span>
            </td>
            <td>${weight}</td>
            <td>${totalDonations}</td>
            <td>
                <span class="status-badge ${donor.isVerified ? 'donor-verified' : 'donor-pending'}">
                    ${donor.isVerified ? 'Verified' : 'Pending'}
                </span>
            </td>
            <td>
                ${!donor.isVerified
                ? `<button class="action-btn verify-btn" onclick="verifyDonor('${donor.uid}')">Verify</button>`
                : ''}
            </td>
        `;

        tbody.appendChild(row);
    });
}

async function verifyDonor(uid) {
    if (!confirm('Are you sure you want to verify this donor?')) {
        return;
    }

    try {
        const updates = {
            isVerified: true,
            isAvailable: true,
            updatedAt: new Date().toISOString()
        };

        await firestore.collection('users').doc(uid).update(updates);
        await firestore.collection('donors').doc(uid).update(updates);

        alert('Donor verified successfully');
    } catch (error) {
        console.error('Error verifying donor:', error);
        alert('Failed to verify donor. Please try again.');
    }
}

// ==================== REQUEST MANAGEMENT ====================

function renderRequests() {
    const tbody = document.getElementById('requestsTableBody');

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No blood requests at this time</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    requests.forEach(req => {
        const requesterName = req.requesterName || 'N/A';
        const urgency = req.urgencyLevel || 'moderate';
        const location = req.hospitalName || req.location?.address || 'N/A';
        const timestamp = req.createdAt
            ? new Date(req.createdAt).toLocaleString()
            : 'N/A';
        const status = req.status || 'pending';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${requesterName}</td>
            <td>
                <span class="blood-type-badge" style="background: #dbeafe; color: #1e40af;">
                    ${req.bloodType}
                </span>
            </td>
            <td>
                <span class="status-badge urgency-${urgency}">
                    ${urgency.toUpperCase()}
                </span>
            </td>
            <td>${location}</td>
            <td>${timestamp}</td>
            <td>
                <span class="status-badge ${status === 'pending' ? 'donor-pending' : 'donor-verified'}">
                    ${status}
                </span>
            </td>
            <td>
                ${status === 'pending' ? `
                    <button class="action-btn verify-btn" onclick="updateRequest('${req.id}', 'completed')">
                        Fulfill
                    </button>
                    <button class="action-btn delete-btn" onclick="updateRequest('${req.id}', 'cancelled')">
                        Cancel
                    </button>
                ` : ''}
            </td>
        `;

        tbody.appendChild(row);
    });
}

async function updateRequest(id, status) {
    const action = status === 'completed' ? 'fulfill' : 'cancel';

    if (!confirm(`Are you sure you want to ${action} this request?`)) {
        return;
    }

    try {
        await firestore.collection('bloodRequests').doc(id).update({
            status,
            updatedAt: new Date().toISOString()
        });

        alert(`Request ${status} successfully`);
    } catch (error) {
        console.error('Error updating request:', error);
        alert('Failed to update request. Please try again.');
    }
}

// ==================== REVIEW MANAGEMENT ====================

function renderReviews() {
    const tbody = document.getElementById('reviewsTableBody');
    const searchInput = document.getElementById('reviewsSearch');
    const statusFilter = document.getElementById('reviewStatusFilter');

    if (!tbody) {
        console.error('Reviews table body not found');
        return;
    }

    // Get current filter values
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const filterStatus = statusFilter ? statusFilter.value : 'all';

    // Filter reviews
    let filteredReviews = reviews;

    if (filterStatus !== 'all') {
        filteredReviews = filteredReviews.filter(r => r.status === filterStatus);
    }

    if (searchTerm) {
        filteredReviews = filteredReviews.filter(r =>
            (r.userName || '').toLowerCase().includes(searchTerm) ||
            (r.review || '').toLowerCase().includes(searchTerm) ||
            (r.bloodType || '').toLowerCase().includes(searchTerm) ||
            (r.userType || '').toLowerCase().includes(searchTerm)
        );
    }

    // Sort by date (newest first)
    filteredReviews.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
    });

    if (filteredReviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No reviews found</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    filteredReviews.forEach(review => {
        const userName = review.userName || 'Anonymous';
        const userType = review.userType || 'N/A';
        const bloodType = review.bloodType || 'N/A';
        const rating = review.rating || 0;
        const reviewText = review.review || '';
        const status = review.status || 'pending';
        const createdAt = review.createdAt
            ? new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : 'N/A';

        // Generate star rating display
        const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

        // Truncate review text for table display
        const displayReview = reviewText.length > 50
            ? reviewText.substring(0, 50) + '...'
            : reviewText;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${userName}</strong>
            </td>
            <td>
                <span class="blood-type-badge" style="background: ${userType === 'donor' ? '#d1fae5' : '#dbeafe'}; color: ${userType === 'donor' ? '#065f46' : '#1e40af'};">
                    ${userType}
                </span>
            </td>
            <td>
                <span class="blood-type-badge" style="background: #fee2e2; color: #991b1b;">
                    ${bloodType}
                </span>
            </td>
            <td style="font-size: 16px;">${stars}</td>
            <td style="max-width: 250px;">
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${reviewText}">
                    ${displayReview}
                </div>
            </td>
            <td>${createdAt}</td>
            <td>
                <span class="status-badge ${status === 'approved' ? 'donor-verified' :
                status === 'rejected' ? 'status-critical' :
                    'donor-pending'
            }">
                    ${status}
                </span>
            </td>
            <td style="white-space: nowrap;">
                <button class="action-btn" style="background: #dbeafe; color: #1e40af;" onclick="viewReview('${review.id}')">
                    👁️ View
                </button>
                ${status === 'pending' ? `
                    <button class="action-btn verify-btn" onclick="approveReview('${review.id}')">
                        ✅ Approve
                    </button>
                    <button class="action-btn delete-btn" onclick="rejectReview('${review.id}')">
                        ❌ Reject
                    </button>
                ` : status === 'approved' ? `
                    <button class="action-btn delete-btn" onclick="rejectReview('${review.id}')">
                        ❌ Reject
                    </button>
                ` : `
                    <button class="action-btn verify-btn" onclick="approveReview('${review.id}')">
                        ✅ Approve
                    </button>
                `}
                <button class="action-btn delete-btn" onclick="deleteReview('${review.id}')">
                    🗑️ Delete
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    console.log('Rendered reviews:', filteredReviews.length);
}

async function viewReview(id) {
    const review = reviews.find(r => r.id === id);

    if (!review) {
        alert('Review not found');
        return;
    }

    const modal = document.getElementById('reviewDetailsModal');
    const content = document.getElementById('reviewDetailsContent');
    const actions = document.getElementById('reviewActions');

    if (!modal || !content || !actions) {
        console.error('Modal elements not found');
        return;
    }

    // Generate star rating display
    const stars = '⭐'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));

    // Format date
    const createdAt = review.createdAt
        ? new Date(review.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'N/A';

    // Populate content
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 50px; height: 50px; border-radius: 25px; background: linear-gradient(135deg, #1b8882 0%, #16b43e 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px;">
                    ${(review.userName || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #1e293b;">${review.userName || 'Anonymous'}</h3>
                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                        <span class="blood-type-badge" style="background: ${review.userType === 'donor' ? '#d1fae5' : '#dbeafe'}; color: ${review.userType === 'donor' ? '#065f46' : '#1e40af'};">
                            ${review.userType || 'N/A'}
                        </span>
                        <span class="blood-type-badge" style="background: #fee2e2; color: #991b1b;">
                            ${review.bloodType || 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <div style="font-size: 24px; margin-bottom: 8px;">${stars}</div>
                <div style="font-size: 14px; color: #64748b;">Rating: ${review.rating || 0}/5</div>
            </div>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Review</h4>
                <p style="margin: 0; font-size: 15px; color: #1e293b; line-height: 1.6;">${review.review || 'No review text provided'}</p>
            </div>
            
            ${review.category ? `
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Category</h4>
                    <span class="blood-type-badge" style="background: #e0e7ff; color: #4338ca;">
                        ${review.category}
                    </span>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 16px; font-size: 13px; color: #64748b;">
                <div>
                    <strong>Submitted:</strong> ${createdAt}
                </div>
                <div>
                    <strong>Status:</strong> 
                    <span class="status-badge ${review.status === 'approved' ? 'donor-verified' :
            review.status === 'rejected' ? 'status-critical' :
                'donor-pending'
        }">
                        ${review.status || 'pending'}
                    </span>
                </div>
            </div>
        </div>
    `;

    // Populate action buttons
    if (review.status === 'pending') {
        actions.innerHTML = `
            <button class="add-btn" onclick="approveReviewFromModal('${review.id}')">
                ✅ Approve Review
            </button>
            <button class="action-btn delete-btn" onclick="rejectReviewFromModal('${review.id}')">
                ❌ Reject Review
            </button>
            <button class="action-btn" onclick="closeReviewDetailsModal()">
                Cancel
            </button>
        `;
    } else if (review.status === 'approved') {
        actions.innerHTML = `
            <button class="action-btn delete-btn" onclick="rejectReviewFromModal('${review.id}')">
                ❌ Reject Review
            </button>
            <button class="action-btn" onclick="closeReviewDetailsModal()">
                Close
            </button>
        `;
    } else {
        actions.innerHTML = `
            <button class="add-btn" onclick="approveReviewFromModal('${review.id}')">
                ✅ Approve Review
            </button>
            <button class="action-btn" onclick="closeReviewDetailsModal()">
                Close
            </button>
        `;
    }

    // Show modal
    modal.classList.add('show');
}

async function approveReview(id) {
    if (!confirm('Are you sure you want to approve this review? It will be visible to all users.')) {
        return;
    }

    try {
        await firestore.collection('reviews').doc(id).update({
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.email
        });

        console.log('Review approved:', id);
        alert('✅ Review approved successfully!');
    } catch (error) {
        console.error('Error approving review:', error);
        alert('Failed to approve review. Please try again.');
    }
}

async function rejectReview(id) {
    const reason = prompt('Please provide a reason for rejection (optional):');

    if (reason === null) {
        return; // User cancelled
    }

    try {
        await firestore.collection('reviews').doc(id).update({
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser.email,
            rejectionReason: reason || 'No reason provided'
        });

        console.log('Review rejected:', id);
        alert('❌ Review rejected');
    } catch (error) {
        console.error('Error rejecting review:', error);
        alert('Failed to reject review. Please try again.');
    }
}

async function deleteReview(id) {
    const review = reviews.find(r => r.id === id);

    if (!review) {
        alert('Review not found');
        return;
    }

    const confirmMessage = `Are you sure you want to permanently delete this review?\n\nFrom: ${review.userName}\nRating: ${review.rating}/5\n\nThis action cannot be undone.`;

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        await firestore.collection('reviews').doc(id).delete();
        console.log('Review deleted:', id);
        alert('🗑️ Review deleted successfully');
    } catch (error) {
        console.error('Error deleting review:', error);
        alert('Failed to delete review. Please try again.');
    }
}

async function approveReviewFromModal(id) {
    await approveReview(id);
    closeReviewDetailsModal();
}

async function rejectReviewFromModal(id) {
    await rejectReview(id);
    closeReviewDetailsModal();
}

function closeReviewDetailsModal() {
    const modal = document.getElementById('reviewDetailsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// ==================== TAB NAVIGATION ====================

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const tabName = tab.dataset.tab;
        document.getElementById(tabName + 'Tab').classList.remove('hidden');
    });
});

// ==================== SEARCH FUNCTIONALITY ====================

document.getElementById('bloodBanksSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#bloodBanksTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

document.getElementById('donorsSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#donorsTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

document.getElementById('requestsSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#requestsTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Review search and filter
document.getElementById('reviewsSearch')?.addEventListener('input', renderReviews);
document.getElementById('reviewStatusFilter')?.addEventListener('change', renderReviews);

// ==================== INVENTORY MODAL HANDLERS ====================

// Close inventory modal
document.getElementById('closeInventoryModal').addEventListener('click', () => {
    document.getElementById('inventoryModal').classList.remove('show');
    currentInventoryBankId = null;
});

document.getElementById('cancelInventoryModal').addEventListener('click', () => {
    document.getElementById('inventoryModal').classList.remove('show');
    currentInventoryBankId = null;
});

// Handle inventory form submission
document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentInventoryBankId) {
        alert('Error: No blood bank selected');
        return;
    }

    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const updates = {};
    const timestamp = new Date().toISOString();

    // Collect all updated values
    bloodTypes.forEach(type => {
        const input = document.getElementById(`units-${type}`);
        if (input) {
            const units = parseInt(input.value) || 0;
            updates[`inventory/${type}`] = {
                units: units,
                lastUpdated: timestamp
            };
        }
    });

    try {
        // Update database
        await database.ref(`bloodBanks/${currentInventoryBankId}`).update(updates);

        // Close modal
        document.getElementById('inventoryModal').classList.remove('show');
        currentInventoryBankId = null;

        // Show success message
        const bank = bloodBanks.find(b => b.id === currentInventoryBankId);
        alert(`✅ Inventory updated successfully for ${bank?.name || 'blood bank'}!`);

    } catch (error) {
        console.error('Error updating inventory:', error);
        alert('❌ Failed to update inventory. Please try again.');
    }
});

// ==================== REVIEW MODAL HANDLERS ====================

// Close review details modal
if (elements.closeReviewModal) {
    elements.closeReviewModal.addEventListener('click', closeReviewDetailsModal);
}

// Close modal when clicking outside
document.getElementById('reviewDetailsModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('reviewDetailsModal')) {
        closeReviewDetailsModal();
    }
});

// ==================== UTILITY FUNCTIONS ====================

elements.addBloodBankModal.addEventListener('click', (e) => {
    if (e.target === elements.addBloodBankModal) {
        elements.addBloodBankModal.classList.remove('show');
        elements.bloodBankForm.reset();
        delete elements.bloodBankForm.dataset.editId;
    }
});

// Close inventory modal when clicking outside
document.getElementById('inventoryModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('inventoryModal')) {
        document.getElementById('inventoryModal').classList.remove('show');
        currentInventoryBankId = null;
    }
});

window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

console.log('BloodLink Admin Panel initialized');
console.log('Firebase config loaded');
console.log('Waiting for authentication...');