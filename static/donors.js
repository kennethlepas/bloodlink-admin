// Donors Management Module
(function() {
    'use strict';

    // State
    let donors = [];

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('donorsTableBody'),
        searchInput: document.getElementById('donorsSearch'),
        statusFilter: document.getElementById('donorStatusFilter'),
        bloodTypeFilter: document.getElementById('bloodTypeFilter')
    };

    // Initialize
    window.initializePage = function() {
        console.log('Initializing donors page...');
        loadDonors();
        setupEventListeners();
    };

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        elements.searchInput.addEventListener('input', window.utils.debounce(renderDonors, 300));
        
        // Filter functionality
        elements.statusFilter.addEventListener('change', renderDonors);
        elements.bloodTypeFilter.addEventListener('change', renderDonors);
    }

    // Load donors data
    function loadDonors() {
        firestore.collection('donors').onSnapshot(snapshot => {
            donors = [];
            
            snapshot.forEach(doc => {
                donors.push({
                    uid: doc.id,
                    ...doc.data()
                });
            });
            
            console.log('Donors loaded:', donors.length);
            renderDonors();
        }, error => {
            console.error('Error loading donors:', error);
            window.utils.showNotification('Error loading donors', 'error');
        });
    }

    // Render donors table
    function renderDonors() {
        const searchTerm = elements.searchInput.value.toLowerCase();
        const statusFilter = elements.statusFilter.value;
        const bloodTypeFilter = elements.bloodTypeFilter.value;
        
        // Filter donors
        let filtered = donors;
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(donor => {
                const fullName = `${donor.firstName || ''} ${donor.lastName || ''}`.toLowerCase();
                return fullName.includes(searchTerm) ||
                       (donor.email || '').toLowerCase().includes(searchTerm) ||
                       (donor.phoneNumber || '').toLowerCase().includes(searchTerm) ||
                       (donor.bloodType || '').toLowerCase().includes(searchTerm);
            });
        }
        
        // Apply status filter
        if (statusFilter !== 'all') {
            const isVerified = statusFilter === 'verified';
            filtered = filtered.filter(donor => donor.isVerified === isVerified);
        }
        
        // Apply blood type filter
        if (bloodTypeFilter !== 'all') {
            filtered = filtered.filter(donor => donor.bloodType === bloodTypeFilter);
        }
        
        // Render table
        if (filtered.length === 0) {
            const message = donors.length === 0 
                ? 'No donors registered yet' 
                : 'No donors found matching your filters';
            
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort by verification status (pending first) then by name
        filtered.sort((a, b) => {
            if (a.isVerified !== b.isVerified) {
                return a.isVerified ? 1 : -1;
            }
            const nameA = `${a.firstName || ''} ${a.lastName || ''}`;
            const nameB = `${b.firstName || ''} ${b.lastName || ''}`;
            return nameA.localeCompare(nameB);
        });
        
        elements.tableBody.innerHTML = filtered.map(donor => {
            const fullName = `${donor.firstName || ''} ${donor.lastName || ''}`.trim() || 'N/A';
            const weight = donor.weight || 'N/A';
            const totalDonations = donor.totalDonations || 0;
            const phone = window.utils.formatPhoneNumber(donor.phoneNumber);
            const bloodTypeClass = window.utils.getBloodTypeClass(donor.bloodType || 'A+');
            const statusClass = donor.isVerified ? 'status-verified' : 'status-pending';
            const statusText = donor.isVerified ? 'Verified' : 'Pending';
            
            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #2563EB, #1E40AF); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                ${fullName.charAt(0).toUpperCase()}
                            </div>
                            <strong>${fullName}</strong>
                        </div>
                    </td>
                    <td>
                        ${donor.email}<br>
                        <small style="color: #64748B;">${phone}</small>
                    </td>
                    <td>
                        <span class="blood-type-badge ${bloodTypeClass}">
                            ${donor.bloodType || 'N/A'}
                        </span>
                    </td>
                    <td>${weight}${typeof weight === 'number' ? ' kg' : ''}</td>
                    <td>
                        <span style="font-weight: 700; color: #059669;">${totalDonations}</span>
                        ${totalDonations === 1 ? 'donation' : 'donations'}
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        ${!donor.isVerified ? `
                            <button class="action-btn action-btn-success" onclick="window.verifyDonor('${donor.uid}', '${fullName}')">
                                ✅ Verify
                            </button>
                        ` : `
                            <span style="color: #64748B; font-size: 13px;">No actions</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Verify donor
    window.verifyDonor = async function(uid, name) {
        if (!window.utils.confirmAction(`Are you sure you want to verify ${name}?\n\nThis will allow them to donate blood.`)) {
            return;
        }
        
        try {
            const updates = {
                isVerified: true,
                isAvailable: true,
                updatedAt: new Date().toISOString()
            };
            
            // Update both collections
            await firestore.collection('users').doc(uid).update(updates);
            await firestore.collection('donors').doc(uid).update(updates);
            
            window.utils.showNotification(`${name} verified successfully`, 'success');
        } catch (error) {
            console.error('Error verifying donor:', error);
            window.utils.showNotification('Failed to verify donor', 'error');
        }
    };

})();