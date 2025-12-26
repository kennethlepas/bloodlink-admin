// Firebase Configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBmbgEyTbdFFFwpxaLYdX3rRwvoWSL1wQ0",
  authDomain: "bloodlink-app-b9297.firebaseapp.com",
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

// State Variables
let currentUser = null;
let inventory = [];
let donors = [];
let requests = [];

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
    addInventoryModal: document.getElementById('addInventoryModal'),
    inventoryForm: document.getElementById('inventoryForm'),
    addInventoryBtn: document.getElementById('addInventoryBtn'),
    cancelModal: document.getElementById('cancelModal')
};

// ==================== AUTHENTICATION ====================

// Auth state listener
auth.onAuthStateChanged(user => {
    elements.loading.classList.add('hidden');
    
    if (user) {
        currentUser = user;
        elements.userEmail.textContent = user.email;
        elements.loginContainer.classList.add('hidden');
        elements.adminContainer.style.display = 'block';
        loadData();
    } else {
        currentUser = null;
        elements.loginContainer.classList.remove('hidden');
        elements.adminContainer.style.display = 'none';
    }
});

// Login handler
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

// Logout handler
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
    // Load Blood Inventory
    database.ref('bloodInventory').on('value', snapshot => {
        inventory = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                inventory.push({
                    id: child.key,
                    ...child.val()
                });
            });
        }
        
        renderInventory();
        updateStats();
    }, error => {
        console.error('Error loading inventory:', error);
    });

    // Load Donors
    database.ref('users').on('value', snapshot => {
        donors = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const user = child.val();
                if (user.userType === 'donor') {
                    donors.push({
                        uid: child.key,
                        ...user
                    });
                }
            });
        }
        
        renderDonors();
        updateStats();
    }, error => {
        console.error('Error loading donors:', error);
    });

    // Load Blood Requests
    database.ref('bloodRequests').on('value', snapshot => {
        requests = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                requests.push({
                    id: child.key,
                    ...child.val()
                });
            });
        }
        
        renderRequests();
        updateStats();
    }, error => {
        console.error('Error loading requests:', error);
    });
}

// ==================== STATISTICS ====================

function updateStats() {
    // Total Units
    const totalUnits = inventory.reduce((sum, item) => sum + (item.unitsAvailable || 0), 0);
    document.getElementById('totalUnits').textContent = totalUnits;
    
    // Critical Stock
    const criticalStock = inventory.filter(item => item.unitsAvailable < 20).length;
    document.getElementById('criticalStock').textContent = criticalStock;
    
    // Verified Donors
    const verifiedDonors = donors.filter(d => d.isVerified).length;
    document.getElementById('verifiedDonors').textContent = verifiedDonors;
    
    // Total Donors
    document.getElementById('totalDonors').textContent = donors.length;
    
    // Pending Requests
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    document.getElementById('pendingRequests').textContent = pendingRequests;
}

// ==================== INVENTORY MANAGEMENT ====================

function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No inventory data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    inventory.forEach(item => {
        const units = item.unitsAvailable || 0;
        const status = units < 20 ? 'critical' : units < 35 ? 'low' : 'good';
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        
        const expiryDate = item.expiryDate || 'N/A';
        const location = item.location || 'N/A';
        const lastUpdated = item.lastUpdated 
            ? new Date(item.lastUpdated).toLocaleDateString() 
            : 'N/A';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="blood-type-badge" style="background: #dbeafe; color: #1e40af;">
                    ${item.bloodType}
                </span>
            </td>
            <td>${units} units</td>
            <td>
                <span class="status-badge status-${status}">${statusLabel}</span>
            </td>
            <td>${expiryDate}</td>
            <td>${location}</td>
            <td>${lastUpdated}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editInventory('${item.id}')">
                    Edit
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function editInventory(id) {
    const item = inventory.find(i => i.id === id);
    
    if (!item) {
        alert('Inventory item not found');
        return;
    }
    
    const newUnits = prompt(`Update units for ${item.bloodType}:`, item.unitsAvailable);
    
    if (newUnits !== null && newUnits !== '') {
        try {
            await database.ref(`bloodInventory/${id}`).update({
                unitsAvailable: parseInt(newUnits),
                lastUpdated: new Date().toISOString()
            });
            
            alert('Inventory updated successfully');
        } catch (error) {
            console.error('Error updating inventory:', error);
            alert('Failed to update inventory. Please try again.');
        }
    }
}

// Add inventory modal handlers
elements.addInventoryBtn.addEventListener('click', () => {
    elements.addInventoryModal.classList.add('show');
    
    // Set default expiry date to 42 days from now (blood shelf life)
    const expiryInput = document.getElementById('expiryDate');
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 42);
    expiryInput.min = new Date().toISOString().split('T')[0];
    expiryInput.value = defaultExpiry.toISOString().split('T')[0];
});

elements.cancelModal.addEventListener('click', () => {
    elements.addInventoryModal.classList.remove('show');
    elements.inventoryForm.reset();
});

elements.inventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        bloodType: document.getElementById('bloodType').value,
        unitsAvailable: parseInt(document.getElementById('unitsAvailable').value),
        expiryDate: document.getElementById('expiryDate').value,
        location: document.getElementById('location').value,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        bloodBankId: 'main_bank'
    };
    
    try {
        await database.ref('bloodInventory').push(data);
        
        elements.addInventoryModal.classList.remove('show');
        elements.inventoryForm.reset();
        
        alert('Blood stock added successfully');
    } catch (error) {
        console.error('Error adding inventory:', error);
        alert('Failed to add blood stock. Please try again.');
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
        await database.ref(`users/${uid}`).update({
            isVerified: true,
            isAvailable: true,
            updatedAt: new Date().toISOString()
        });
        
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
        const urgency = req.urgency || 'moderate';
        const location = req.location || 'N/A';
        const timestamp = req.timestamp 
            ? new Date(req.timestamp).toLocaleString() 
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
                    <button class="action-btn verify-btn" onclick="updateRequest('${req.id}', 'fulfilled')">
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
    const action = status === 'fulfilled' ? 'fulfill' : 'cancel';
    
    if (!confirm(`Are you sure you want to ${action} this request?`)) {
        return;
    }
    
    try {
        await database.ref(`bloodRequests/${id}`).update({
            status,
            updatedAt: new Date().toISOString()
        });
        
        alert(`Request ${status} successfully`);
    } catch (error) {
        console.error('Error updating request:', error);
        alert('Failed to update request. Please try again.');
    }
}

// ==================== TAB NAVIGATION ====================

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Show selected tab content
        const tabName = tab.dataset.tab;
        document.getElementById(tabName + 'Tab').classList.remove('hidden');
    });
});

// ==================== SEARCH FUNCTIONALITY ====================

// Inventory search
document.getElementById('inventorySearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Donors search
document.getElementById('donorsSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#donorsTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Requests search
document.getElementById('requestsSearch').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#requestsTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// ==================== UTILITY FUNCTIONS ====================

// Close modal when clicking outside
elements.addInventoryModal.addEventListener('click', (e) => {
    if (e.target === elements.addInventoryModal) {
        elements.addInventoryModal.classList.remove('show');
        elements.inventoryForm.reset();
    }
});

// Handle errors globally
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// Log when app is ready
console.log('BloodLink Admin Panel initialized');
console.log('Firebase config loaded');
console.log('Waiting for authentication...');