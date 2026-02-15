// Blood Banks Management Module
(function() {
    'use strict';

    // State
    let bloodBanks = [];
    let currentEditId = null;
    let currentInventoryBankId = null;

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('bloodBanksTableBody'),
        searchInput: document.getElementById('bloodBanksSearch'),
        addBankBtn: document.getElementById('addBloodBankBtn'),
        addBankModal: document.getElementById('addBloodBankModal'),
        bankForm: document.getElementById('bloodBankForm'),
        closeBankModal: document.getElementById('closeBloodBankModal'),
        cancelBankModal: document.getElementById('cancelBloodBankModal'),
        inventoryModal: document.getElementById('inventoryModal'),
        inventoryForm: document.getElementById('inventoryForm'),
        closeInventoryModal: document.getElementById('closeInventoryModal'),
        cancelInventoryModal: document.getElementById('cancelInventoryModal'),
        inventoryModalSubtitle: document.getElementById('inventoryModalSubtitle')
    };

    // Initialize
    window.initializePage = function() {
        console.log('Initializing blood banks page...');
        loadBloodBanks();
        setupEventListeners();
    };

    // Setup event listeners
    function setupEventListeners() {
        // Add blood bank button
        elements.addBankBtn.addEventListener('click', openAddModal);
        
        // Close modal buttons
        elements.closeBankModal.addEventListener('click', closeAddModal);
        elements.cancelBankModal.addEventListener('click', closeAddModal);
        
        // Form submission
        elements.bankForm.addEventListener('submit', handleFormSubmit);
        
        // Search functionality
        elements.searchInput.addEventListener('input', window.utils.debounce(handleSearch, 300));
        
        // Inventory modal
        elements.closeInventoryModal.addEventListener('click', closeInventoryModal);
        elements.cancelInventoryModal.addEventListener('click', closeInventoryModal);
        elements.inventoryForm.addEventListener('submit', handleInventorySubmit);
        
        // Close modal on outside click
        elements.addBankModal.addEventListener('click', (e) => {
            if (e.target === elements.addBankModal) closeAddModal();
        });
        
        elements.inventoryModal.addEventListener('click', (e) => {
            if (e.target === elements.inventoryModal) closeInventoryModal();
        });
    }

    // Load blood banks data
    function loadBloodBanks() {
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
            
            console.log('Blood banks loaded:', bloodBanks.length);
            renderBloodBanks();
        }, error => {
            console.error('Error loading blood banks:', error);
            window.utils.showNotification('Error loading blood banks', 'error');
        });
    }

    // Render blood banks table
    function renderBloodBanks(filter = '') {
        if (bloodBanks.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">🏥</div>
                        <p>No blood banks registered yet</p>
                        <button class="btn-secondary" onclick="document.getElementById('addBloodBankBtn').click()">
                            Add Your First Blood Bank
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Filter blood banks
        let filtered = bloodBanks;
        if (filter) {
            const searchTerm = filter.toLowerCase();
            filtered = bloodBanks.filter(bank => 
                (bank.name || '').toLowerCase().includes(searchTerm) ||
                (bank.address || '').toLowerCase().includes(searchTerm) ||
                (bank.phoneNumber || '').toLowerCase().includes(searchTerm) ||
                (bank.email || '').toLowerCase().includes(searchTerm)
            );
        }
        
        if (filtered.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <p>No blood banks found matching "${filter}"</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        elements.tableBody.innerHTML = filtered.map(bank => {
            const coords = window.utils.formatCoordinates(
                bank.location?.latitude,
                bank.location?.longitude
            );
            
            const inventory = bank.inventory || {};
            const availableTypes = Object.entries(inventory).filter(([type, data]) => 
                data && data.units > 0
            ).length;
            
            const phone = window.utils.formatPhoneNumber(bank.phoneNumber);
            const email = bank.email || 'Not provided';
            const verified = bank.isVerified ? '✓' : '○';
            const verifiedColor = bank.isVerified ? '#10B981' : '#94A3B8';
            
            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong>${bank.name}</strong>
                            <span style="color: ${verifiedColor}; font-size: 18px;" title="${bank.isVerified ? 'Verified' : 'Not verified'}">${verified}</span>
                        </div>
                    </td>
                    <td style="max-width: 200px;">
                        ${bank.address}<br>
                        <small style="color: #64748B;">${coords}</small>
                    </td>
                    <td>
                        ${phone}<br>
                        <small style="color: #64748B;">${email}</small>
                    </td>
                    <td>
                        <span class="blood-type-badge ${availableTypes > 0 ? 'status-verified' : 'status-critical'}">
                            ${availableTypes} / 8 types
                        </span>
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="action-btn action-btn-edit" onclick="window.editBloodBank('${bank.id}')">
                            ✏️ Edit
                        </button>
                        <button class="action-btn action-btn-success" onclick="window.editInventory('${bank.id}')">
                            📊 Stock
                        </button>
                        <button class="action-btn action-btn-danger" onclick="window.deleteBloodBank('${bank.id}')">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Handle search
    function handleSearch(e) {
        renderBloodBanks(e.target.value);
    }

    // Open add modal
    function openAddModal() {
        currentEditId = null;
        elements.bankForm.reset();
        
        // Set default coordinates (Nairobi)
        document.getElementById('bankLatitude').value = '-1.286389';
        document.getElementById('bankLongitude').value = '36.817223';
        
        document.getElementById('modalTitle').textContent = 'Add Blood Bank';
        elements.addBankModal.classList.add('show');
    }

    // Close add modal
    function closeAddModal() {
        elements.addBankModal.classList.remove('show');
        elements.bankForm.reset();
        currentEditId = null;
    }

    // Edit blood bank
    window.editBloodBank = function(id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }
        
        currentEditId = id;
        
        // Populate form
        document.getElementById('bankName').value = bank.name || '';
        document.getElementById('bankAddress').value = bank.address || '';
        document.getElementById('bankPhone').value = bank.phoneNumber || '';
        document.getElementById('bankEmail').value = bank.email || '';
        document.getElementById('bankLatitude').value = bank.location?.latitude || '';
        document.getElementById('bankLongitude').value = bank.location?.longitude || '';
        document.getElementById('bankVerified').checked = bank.isVerified || false;
        
        document.getElementById('modalTitle').textContent = 'Edit Blood Bank';
        elements.addBankModal.classList.add('show');
    };

    // Handle form submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const latitude = parseFloat(document.getElementById('bankLatitude').value);
        const longitude = parseFloat(document.getElementById('bankLongitude').value);
        
        // Validate coordinates
        const coordValidation = window.utils.validateCoordinates(latitude, longitude);
        if (!coordValidation.valid) {
            window.utils.showNotification(coordValidation.message, 'error');
            return;
        }
        
        const phone = document.getElementById('bankPhone').value.trim();
        if (!phone) {
            window.utils.showNotification('Phone number is required', 'error');
            return;
        }
        
        const data = {
            name: document.getElementById('bankName').value.trim(),
            address: document.getElementById('bankAddress').value.trim(),
            phoneNumber: phone,
            email: document.getElementById('bankEmail').value.trim() || null,
            location: {
                latitude: latitude,
                longitude: longitude
            },
            isVerified: document.getElementById('bankVerified').checked,
            updatedAt: new Date().toISOString()
        };
        
        try {
            if (currentEditId) {
                // Update existing
                const existingBank = bloodBanks.find(b => b.id === currentEditId);
                if (existingBank && existingBank.inventory) {
                    data.inventory = existingBank.inventory;
                }
                
                await database.ref(`bloodBanks/${currentEditId}`).update(data);
                window.utils.showNotification('Blood bank updated successfully', 'success');
            } else {
                // Create new
                data.createdAt = new Date().toISOString();
                
                // Initialize inventory
                data.inventory = {};
                const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                bloodTypes.forEach(type => {
                    data.inventory[type] = {
                        units: 0,
                        lastUpdated: new Date().toISOString()
                    };
                });
                
                await database.ref('bloodBanks').push(data);
                window.utils.showNotification('Blood bank added successfully', 'success');
            }
            
            closeAddModal();
        } catch (error) {
            console.error('Error saving blood bank:', error);
            window.utils.showNotification('Failed to save blood bank', 'error');
        }
    }

    // Edit inventory
    window.editInventory = function(id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }
        
        currentInventoryBankId = id;
        const inventory = bank.inventory || {};
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        
        elements.inventoryModalSubtitle.textContent = `${bank.name} - ${bank.address}`;
        
        // Populate inventory form
        bloodTypes.forEach(type => {
            const currentUnits = inventory[type]?.units || 0;
            const lastUpdated = inventory[type]?.lastUpdated;
            
            const input = document.getElementById(`units-${type}`);
            if (input) input.value = currentUnits;
            
            const statusEl = document.getElementById(`status-${type}`);
            if (statusEl) {
                const status = window.utils.getStockStatus(currentUnits);
                statusEl.textContent = status.emoji;
                statusEl.title = status.label;
            }
            
            const metaEl = document.getElementById(`meta-${type}`);
            if (metaEl) {
                if (lastUpdated) {
                    metaEl.textContent = `Updated: ${window.utils.formatDate(lastUpdated)}`;
                } else {
                    metaEl.textContent = 'Never updated';
                }
            }
        });
        
        elements.inventoryModal.classList.add('show');
    };

    // Close inventory modal
    function closeInventoryModal() {
        elements.inventoryModal.classList.remove('show');
        currentInventoryBankId = null;
    }

    // Handle inventory submission
    async function handleInventorySubmit(e) {
        e.preventDefault();
        
        if (!currentInventoryBankId) {
            window.utils.showNotification('No blood bank selected', 'error');
            return;
        }
        
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const updates = {};
        const timestamp = new Date().toISOString();
        
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
            await database.ref(`bloodBanks/${currentInventoryBankId}`).update(updates);
            
            const bank = bloodBanks.find(b => b.id === currentInventoryBankId);
            window.utils.showNotification(
                `Inventory updated successfully for ${bank?.name || 'blood bank'}`,
                'success'
            );
            
            closeInventoryModal();
        } catch (error) {
            console.error('Error updating inventory:', error);
            window.utils.showNotification('Failed to update inventory', 'error');
        }
    }

    // Delete blood bank
    window.deleteBloodBank = async function(id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }
        
        const message = `Are you sure you want to delete "${bank.name}"?\n\nThis will permanently remove:\n- Blood bank details\n- All inventory records\n- This action cannot be undone`;
        
        if (!window.utils.confirmAction(message)) {
            return;
        }
        
        try {
            await database.ref(`bloodBanks/${id}`).remove();
            window.utils.showNotification('Blood bank deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting blood bank:', error);
            window.utils.showNotification('Failed to delete blood bank', 'error');
        }
    };

})();