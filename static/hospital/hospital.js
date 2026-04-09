// Hospital Management Module
(function () {
    'use strict';

    // State
    let hospitalData = null;

    // DOM Elements
    const elements = {
        dashboardStats: document.getElementById('dashboardStats'),
        referralModal: document.getElementById('referralModal'),
        inventoryModal: document.getElementById('hospitalInventoryModal'),
        inventoryForm: document.getElementById('hospitalInventoryForm'),
        updateInventoryBtn: document.getElementById('updateInventoryBtn'),
        closeInventoryModal: document.getElementById('closeInventoryModal'),
        cancelInventoryModal: document.getElementById('cancelInventoryModal')
    };

    let currentBankId = null;
    let currentInventory = {};

    // Initialize Hospital Dashboard
    window.initializeHospitalDashboard = async function (data) {
        hospitalData = data;
        console.log('🏥 Initializing Hospital Dashboard for:', hospitalData.name);

        // Update sidebar tagline (below BloodLink logo) with hospital name
        const hospitalNameDisplay = document.getElementById('hospitalNameDisplay');
        if (hospitalNameDisplay) hospitalNameDisplay.textContent = hospitalData.name || 'Hospital Admin';

        // Update page subtitle
        const pageSubtitle = document.getElementById('pageSubtitle');
        if (pageSubtitle) pageSubtitle.textContent = 'Manage your hospital blood requests and referrals';

        // Hide platform-wide management tools from UI
        // (Even though they are hidden by applyRoleVisibility in auth.js, 
        // we can reinforce it here or handle specific dashboard elements)

        setupInventoryListeners();
        // Stats and dashboard rendering are handled by hospital-admin.js
    };

    function setupInventoryListeners() {
        if (elements.updateInventoryBtn) {
            elements.updateInventoryBtn.onclick = () => openInventoryModal();
        }

        if (elements.closeInventoryModal) elements.closeInventoryModal.onclick = closeInventoryModal;
        if (elements.cancelInventoryModal) elements.cancelInventoryModal.onclick = closeInventoryModal;

        if (elements.inventoryForm) {
            elements.inventoryForm.onsubmit = async (e) => {
                e.preventDefault();
                await saveInventory();
            };
        }
    }

    async function openInventoryModal() {
        if (!elements.inventoryModal || !elements.inventoryForm) return;

        // Populate form with current inventory
        const inputs = elements.inventoryForm.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            const type = input.name;
            input.value = currentInventory[type]?.units || 0;
        });

        elements.inventoryModal.classList.add('show');
    }

    function closeInventoryModal() {
        if (elements.inventoryModal) elements.inventoryModal.classList.remove('show');
    }

    async function saveInventory() {
        if (!currentBankId) {
            window.utils.showNotification('Could not identify blood bank ID', 'error');
            return;
        }

        const inputs = elements.inventoryForm.querySelectorAll('input[type="number"]');
        const newInventory = {};
        const timestamp = new Date().toISOString();

        inputs.forEach(input => {
            const type = input.name;
            const units = parseInt(input.value) || 0;
            newInventory[type] = {
                units: units,
                lastUpdated: timestamp
            };
        });

        try {
            window.utils.showNotification('Saving inventory...', 'info');
            
            // Update RTDB
            await database.ref(`bloodBanks/${currentBankId}/inventory`).update(newInventory);
            await database.ref(`bloodBanks/${currentBankId}`).update({ 
                updatedAt: timestamp,
                lastSyncFrom: 'hospital_admin'
            });

            // Sync to Firestore using Inventory Sync Service
            if (window.InventorySyncService && hospitalData && hospitalData.email) {
                const emailKey = hospitalData.email.replace(/\./g, ',');
                await window.InventorySyncService.syncFromRTDBToFirestore(
                    emailKey,
                    newInventory,
                    'hospital_admin'
                );
                
                // Start real-time sync
                window.InventorySyncService.startSync(hospitalData.email, currentBankId);
            }

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateInventory(currentBankId, {
                    inventory: newInventory,
                    hospitalName: hospitalData?.name,
                    syncedToFirestore: true
                });
            }

            window.utils.showNotification('Inventory updated successfully and synced', 'success');
            closeInventoryModal();
        } catch (error) {
            console.error('Error saving inventory:', error);
            window.utils.showNotification('Failed to update inventory', 'error');
        }
    }

    async function loadHospitalStats() {
        if (!hospitalData || !hospitalData.facilityCode) return;

        console.log('Loading hospital-specific stats for code:', hospitalData.facilityCode);

        try {
            // 1. Get Blood Bank Inventory from Realtime Database
            // We search for the blood bank that matches this facility code
            database.ref('bloodBanks').orderByChild('facilityCode').equalTo(hospitalData.facilityCode).on('value', snapshot => {
                if (snapshot.exists()) {
                    currentBankId = Object.keys(snapshot.val())[0];
                    const bankData = snapshot.val()[currentBankId];
                    currentInventory = bankData.inventory || {};
                    renderInventory(currentInventory);

                    // Update Stock Stat
                    const totalUnits = Object.values(bankData.inventory || {}).reduce((sum, type) => sum + (type.units || 0), 0);
                    const stockCard = document.querySelector('[data-stat="stock"] .stat-value');
                    if (stockCard) stockCard.textContent = totalUnits.toLocaleString();
                } else {
                    renderInventory({});
                }
            });

            // 2. Get Requests from Firestore
            firestore.collection('bloodRequests')
                .where('hospitalId', '==', hospitalData.id || hospitalData.facilityCode)
                .onSnapshot(snapshot => {
                    const activeCount = snapshot.docs.filter(doc => doc.data().status === 'pending').length;
                    const reqCard = document.querySelector('[data-stat="requests"] .stat-value');
                    if (reqCard) reqCard.textContent = activeCount;
                });

            // 3. Get Referrals from Firestore
            firestore.collection('hospital_referrals')
                .where('fromHospitalId', '==', auth.currentUser.uid)
                .onSnapshot(snapshot => {
                    const refCard = document.querySelector('[data-stat="referrals"] .stat-value');
                    if (refCard) refCard.textContent = snapshot.size;
                });

        } catch (error) {
            console.error('Error loading hospital stats:', error);
        }
    }

    function renderInventory(inventory) {
        const container = document.getElementById('hospitalInventoryGrid');
        if (!container) return;

        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        if (Object.keys(inventory).length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <p>No inventory records found for your facility.</p>
                    <button class="btn-secondary btn-small" onclick="window.hospital.openInventoryModal()">Update Inventory</button>
                </div>
            `;
            return;
        }

        container.innerHTML = bloodTypes.map(type => {
            const units = inventory[type]?.units || 0;
            const statusClass = units === 0 ? 'status-critical' : units < 20 ? 'status-urgent' : 'status-verified';
            const statusLabel = units === 0 ? 'OUT' : units < 20 ? 'LOW' : 'OK';

            return `
                <div class="blood-type-card-new ${statusClass}">
                    <div class="blood-card-top">
                        <div class="blood-type-label">${type}</div>
                        <div class="blood-status-badge">${statusLabel}</div>
                    </div>
                    <div class="blood-card-main">
                        <div class="blood-unit-count">${units}</div>
                        <div class="blood-unit-label">Units</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Export initialization for auth.js
    window.hospital = {
        init: window.initializeHospitalDashboard,
        openInventoryModal: openInventoryModal
    };

    // Handle early initialization if auth is already ready
    if (window.hospitalData) {
        window.initializePage();
    }

})();
