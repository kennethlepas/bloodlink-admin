// Blood Banks Management Module with Enhanced Stock Tracking
(function () {
    'use strict';

    // Constants for blood product shelf life (in days)
    const BLOOD_SHELF_LIFE = {
        'Whole Blood': 42,
        'Red Blood Cells': 42,
        'Platelets': 5,
        'Plasma': 365,
        'Cryoprecipitate': 365
    };

    // State
    let bloodBanks = [];
    let currentEditId = null;
    let currentInventoryBankId = null;
    let currentBatchId = null;

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
        closeInventoryModal: document.getElementById('closeInventoryModal'),
        cancelInventoryModal: document.getElementById('cancelInventoryModal'),
        inventoryModalSubtitle: document.getElementById('inventoryModalSubtitle'),
        importCSVBtn: document.getElementById('importCSVBtn'),
        syncLocalCSVBtn: document.getElementById('syncLocalCSVBtn'),
        csvFileInput: document.getElementById('csvFileInput'),
        logoInput: document.getElementById('bankLogoInput'),
        logoUrlInput: document.getElementById('bankLogoUrl'),
        logoPreview: document.getElementById('logoPreview'),
        logoPlaceholder: document.getElementById('logoPlaceholder'),
        batchModal: document.getElementById('batchModal'),
        batchForm: document.getElementById('batchForm'),
        closeBatchModal: document.getElementById('closeBatchModal'),
        cancelBatchModal: document.getElementById('cancelBatchModal'),
        batchModalTitle: document.getElementById('batchModalTitle'),
        batchDonorId: document.getElementById('batchDonorId'),
        batchDonorName: document.getElementById('batchDonorName'),
        batchBloodType: document.getElementById('batchBloodType'),
        batchComponent: document.getElementById('batchComponent'),
        batchQuantity: document.getElementById('batchQuantity'),
        batchCollectionDate: document.getElementById('batchCollectionDate'),
        batchExpiryDate: document.getElementById('batchExpiryDate'),
        batchNotes: document.getElementById('batchNotes'),
        expiryAlertContainer: document.getElementById('expiryAlertContainer')
    };

    // Initialize
    window.initializePage = function () {
        console.log('Initializing blood banks page...');
        setupEventListeners();
        setupExpiryAlertChecker();
        return loadBloodBanks();
    };

    // Setup event listeners
    function setupEventListeners() {
        if (elements.addBankBtn) {
            elements.addBankBtn.addEventListener('click', openAddModal);
        }

        if (elements.syncLocalCSVBtn) {
            elements.syncLocalCSVBtn.addEventListener('click', syncFromLocalCSV);
        }

        if (elements.importCSVBtn) {
            elements.importCSVBtn.addEventListener('click', () => elements.csvFileInput.click());
        }

        if (elements.csvFileInput) {
            elements.csvFileInput.addEventListener('change', handleCSVFileSelect);
        }

        if (elements.closeBankModal) {
            elements.closeBankModal.addEventListener('click', closeAddModal);
        }

        if (elements.cancelBankModal) {
            elements.cancelBankModal.addEventListener('click', closeAddModal);
        }

        if (elements.bankForm) {
            elements.bankForm.addEventListener('submit', handleFormSubmit);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
        }

        if (elements.closeInventoryModal) {
            elements.closeInventoryModal.addEventListener('click', closeInventoryModal);
        }

        if (elements.cancelInventoryModal) {
            elements.cancelInventoryModal.addEventListener('click', closeInventoryModal);
        }

        if (elements.logoInput) {
            elements.logoInput.addEventListener('change', handleLogoUpload);
        }

        if (elements.closeBatchModal) {
            elements.closeBatchModal.addEventListener('click', closeBatchModal);
        }

        if (elements.cancelBatchModal) {
            elements.cancelBatchModal.addEventListener('click', closeBatchModal);
        }

        if (elements.batchForm) {
            elements.batchForm.addEventListener('submit', handleBatchSubmit);
        }

        if (elements.batchComponent) {
            elements.batchComponent.addEventListener('change', calculateExpiryDate);
        }

        if (elements.batchCollectionDate) {
            elements.batchCollectionDate.addEventListener('change', calculateExpiryDate);
        }

        if (elements.addBankModal) {
            elements.addBankModal.addEventListener('click', (e) => {
                if (e.target === elements.addBankModal) closeAddModal();
            });
        }

        if (elements.inventoryModal) {
            elements.inventoryModal.addEventListener('click', (e) => {
                if (e.target === elements.inventoryModal) closeInventoryModal();
            });
        }

        if (elements.batchModal) {
            elements.batchModal.addEventListener('click', (e) => {
                if (e.target === elements.batchModal) closeBatchModal();
            });
        }
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Setup expiry alert checker (runs every hour)
    function setupExpiryAlertChecker() {
        checkExpiringBlood();
        setInterval(checkExpiringBlood, 60 * 60 * 1000);
    }

    // Check for expiring or expired blood
    async function checkExpiringBlood() {
        const expiringBatches = [];
        const expiredBatches = [];
        const today = new Date();
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);

        for (const bank of bloodBanks) {
            if (!bank.batches) continue;

            const batchesArray = Object.values(bank.batches);
            for (const batch of batchesArray) {
                const expiryDate = new Date(batch.expiryDate);
                if (expiryDate < today) {
                    expiredBatches.push({ bank, batch });
                } else if (expiryDate <= sevenDaysFromNow) {
                    expiringBatches.push({ bank, batch });
                }
            }
        }

        displayExpiryAlerts(expiringBatches, expiredBatches);
    }

    // Display expiry alerts in the UI
    function displayExpiryAlerts(expiring, expired) {
        if (!elements.expiryAlertContainer) return;

        const hasAlerts = expiring.length > 0 || expired.length > 0;

        if (!hasAlerts) {
            elements.expiryAlertContainer.style.display = 'none';
            return;
        }

        elements.expiryAlertContainer.style.display = 'block';

        let html = '<div class="expiry-alerts">';

        if (expired.length > 0) {
            html += `
                <div class="alert alert-danger">
                    <div class="alert-header">
                        <span class="alert-icon">⚠️</span>
                        <strong>Expired Blood Products (${expired.length})</strong>
                    </div>
                    <ul class="alert-list">
                        ${expired.map(({ bank, batch }) => `
                            <li>
                                <strong>${escapeHtml(bank.name)}</strong> - ${batch.bloodType} (${batch.component})
                                <br>Batch: ${batch.batchId || batch.id}
                                <br>Expired on: ${formatDate(batch.expiryDate)}
                                <button class="btn-small btn-danger" onclick="window.removeExpiredBatch('${bank.id}', '${batch.id}')">
                                    Remove from Inventory
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (expiring.length > 0) {
            html += `
                <div class="alert alert-warning">
                    <div class="alert-header">
                        <span class="alert-icon">⏰</span>
                        <strong>Expiring Soon (${expiring.length})</strong>
                    </div>
                    <ul class="alert-list">
                        ${expiring.map(({ bank, batch }) => `
                            <li>
                                <strong>${escapeHtml(bank.name)}</strong> - ${batch.bloodType} (${batch.component})
                                <br>Batch: ${batch.batchId || batch.id}
                                <br>Expires on: ${formatDate(batch.expiryDate)}
                                <br>Units: ${batch.units}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        html += '</div>';
        elements.expiryAlertContainer.innerHTML = html;
    }

    // Remove expired batch from inventory
    window.removeExpiredBatch = async function (bankId, batchId) {
        try {
            const bankRef = database.ref(`bloodBanks/${bankId}`);
            const snapshot = await bankRef.child('batches').once('value');
            const batches = snapshot.val() || {};

            const batch = batches[batchId];
            if (!batch) return;

            delete batches[batchId];

            const inventoryRef = bankRef.child(`inventory/${batch.bloodType}`);
            const currentInventory = (await inventoryRef.once('value')).val() || { units: 0 };
            const newUnits = Math.max(0, currentInventory.units - batch.units);

            await bankRef.child('batches').set(batches);
            await inventoryRef.update({
                units: newUnits,
                lastUpdated: new Date().toISOString()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateInventory(bankId, {
                    action: 'remove_expired',
                    batchId: batchId,
                    bloodType: batch.bloodType,
                    unitsRemoved: batch.units,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`Removed expired ${batch.bloodType} (${batch.units} units)`, 'success');
            await loadBloodBanks();
        } catch (error) {
            console.error('Error removing expired batch:', error);
            window.utils.showNotification('Failed to remove expired batch', 'error');
        }
    };

    // Calculate expiry date based on component type
    function calculateExpiryDate() {
        const component = elements.batchComponent?.value;
        const collectionDate = elements.batchCollectionDate?.value;

        if (!component || !collectionDate) return;

        const shelfLife = BLOOD_SHELF_LIFE[component] || 42;
        const collectionDateObj = new Date(collectionDate);
        const expiryDateObj = new Date(collectionDateObj);
        expiryDateObj.setDate(collectionDateObj.getDate() + shelfLife);

        const year = expiryDateObj.getFullYear();
        const month = String(expiryDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(expiryDateObj.getDate()).padStart(2, '0');

        elements.batchExpiryDate.value = `${year}-${month}-${day}`;
    }

    // Open batch addition modal
    window.addBloodBatch = function (bankId) {
        const bank = bloodBanks.find(b => b.id === bankId);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }

        currentInventoryBankId = bankId;
        currentBatchId = null;

        if (elements.batchModalTitle) {
            elements.batchModalTitle.textContent = `Add Blood Batch - ${bank.name}`;
        }

        if (elements.batchForm) {
            elements.batchForm.reset();
        }

        const today = new Date().toISOString().split('T')[0];
        if (elements.batchCollectionDate) {
            elements.batchCollectionDate.value = today;
        }

        const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        if (elements.batchDonorId) {
            elements.batchDonorId.value = batchId;
        }

        elements.batchModal.classList.add('show');
    };

    // Edit blood batch
    window.editBloodBatch = function (bankId, batchId) {
        const bank = bloodBanks.find(b => b.id === bankId);
        if (!bank || !bank.batches || !bank.batches[batchId]) {
            window.utils.showNotification('Batch not found', 'error');
            return;
        }

        const batch = bank.batches[batchId];
        currentInventoryBankId = bankId;
        currentBatchId = batchId;

        if (elements.batchModalTitle) {
            elements.batchModalTitle.textContent = `Edit Blood Batch - ${bank.name}`;
        }

        if (elements.batchDonorId) {
            elements.batchDonorId.value = batch.batchId || batchId;
        }
        if (elements.batchDonorName) {
            elements.batchDonorName.value = batch.donorName || '';
        }
        if (elements.batchBloodType) {
            elements.batchBloodType.value = batch.bloodType || '';
        }
        if (elements.batchComponent) {
            elements.batchComponent.value = batch.component || 'Whole Blood';
        }
        if (elements.batchQuantity) {
            elements.batchQuantity.value = batch.units || 1;
        }
        if (elements.batchCollectionDate) {
            elements.batchCollectionDate.value = batch.collectionDate?.split('T')[0] || '';
        }
        if (elements.batchExpiryDate) {
            elements.batchExpiryDate.value = batch.expiryDate?.split('T')[0] || '';
        }
        if (elements.batchNotes) {
            elements.batchNotes.value = batch.notes || '';
        }

        elements.batchModal.classList.add('show');
    };

    // Close batch modal
    function closeBatchModal() {
        if (elements.batchModal) {
            elements.batchModal.classList.remove('show');
        }
        currentInventoryBankId = null;
        currentBatchId = null;
    }

    // Handle batch form submission
    async function handleBatchSubmit(e) {
        e.preventDefault();

        if (!currentInventoryBankId) {
            window.utils.showNotification('No blood bank selected', 'error');
            return;
        }

        const bloodType = elements.batchBloodType?.value;
        const component = elements.batchComponent?.value;
        const units = parseInt(elements.batchQuantity?.value) || 1;
        const collectionDate = elements.batchCollectionDate?.value;
        const expiryDate = elements.batchExpiryDate?.value;
        const donorName = elements.batchDonorName?.value || 'Unknown';
        const donorId = elements.batchDonorId?.value || `DONOR-${Date.now()}`;
        const notes = elements.batchNotes?.value || '';

        if (!bloodType || !component) {
            window.utils.showNotification('Please select blood type and component', 'error');
            return;
        }

        const batchData = {
            id: currentBatchId || `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
            batchId: donorId,
            bloodType,
            component,
            units,
            donorName,
            collectionDate: new Date(collectionDate).toISOString(),
            expiryDate: new Date(expiryDate).toISOString(),
            notes,
            addedAt: new Date().toISOString(),
            status: 'active'
        };

        try {
            const bankRef = database.ref(`bloodBanks/${currentInventoryBankId}`);

            const batchesSnapshot = await bankRef.child('batches').once('value');
            const existingBatches = batchesSnapshot.val() || {};
            existingBatches[batchData.id] = batchData;
            await bankRef.child('batches').set(existingBatches);

            const inventoryRef = bankRef.child(`inventory/${bloodType}`);
            const currentInventory = (await inventoryRef.once('value')).val() || { units: 0 };
            const newUnits = currentInventory.units + units;

            await inventoryRef.update({
                units: newUnits,
                lastUpdated: new Date().toISOString()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateInventory(currentInventoryBankId, {
                    action: currentBatchId ? 'edit_batch' : 'add_batch',
                    batchId: batchData.id,
                    bloodType: bloodType,
                    units: units,
                    component: component,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(
                `Added ${units} units of ${bloodType} (${component}) to inventory`,
                'success'
            );

            closeBatchModal();
            await loadBloodBanks();
        } catch (error) {
            console.error('Error adding blood batch:', error);
            window.utils.showNotification('Failed to add blood batch', 'error');
        }
    }

    // Enhanced inventory display with batch tracking
    function renderEnhancedInventory(bank) {
        const inventory = bank.inventory || {};
        const batches = bank.batches || {};

        let html = '<div class="inventory-enhanced">';

        // Summary cards
        html += `
            <div class="inventory-summary">
                <div class="summary-card" style="background: linear-gradient(135deg, #2563EB, #1E40AF);">
                    <div class="summary-value">${Object.keys(batches).length}</div>
                    <div class="summary-label">Total Batches</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #10B981, #059669);">
                    <div class="summary-value">${calculateTotalUnits(inventory)}</div>
                    <div class="summary-label">Total Units</div>
                </div>
                <div class="summary-card" style="background: linear-gradient(135deg, #F59E0B, #D97706);">
                    <div class="summary-value">${countExpiringBatches(batches)}</div>
                    <div class="summary-label">Expiring Soon</div>
                </div>
            </div>
        `;

        // Blood type grid
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        html += '<div class="blood-type-grid-enhanced" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">';
        for (const type of bloodTypes) {
            const typeInventory = inventory[type] || { units: 0 };
            const typeBatches = Object.values(batches).filter(b => b.bloodType === type);
            const expiringCount = typeBatches.filter(b => isExpiringSoon(b.expiryDate)).length;

            html += `
                <div class="blood-type-card-enhanced" style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #E2E8F0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 20px; font-weight: bold;">${type}</span>
                        <span style="font-size: 20px;">${getStatusIcon(typeInventory.units)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-around; margin: 12px 0; text-align: center;">
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: bold;">${typeInventory.units}</div>
                            <div style="font-size: 11px; color: #64748B;">Units</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: bold;">${typeBatches.length}</div>
                            <div style="font-size: 11px; color: #64748B;">Batches</div>
                        </div>
                        ${expiringCount > 0 ? `
                            <div style="flex: 1;">
                                <div style="font-size: 18px; font-weight: bold; color: #F59E0B;">${expiringCount}</div>
                                <div style="font-size: 11px; color: #64748B;">Expiring</div>
                            </div>
                        ` : ''}
                    </div>
                    <button class="btn-small btn-outline" onclick="window.addBloodBatch('${bank.id}')" style="width: 100%; margin-top: 12px; padding: 8px; background: #EFF6FF; border: 1px solid #3B82F6; border-radius: 8px; cursor: pointer;">
                        + Add Batch
                    </button>
                </div>
            `;
        }
        html += '</div>';

        // Batch history table
        if (Object.keys(batches).length > 0) {
            html += `
                <div class="batch-history" style="margin-top: 24px;">
                    <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Batch History</h4>
                    <table class="batch-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #F8FAFC;">
                                <th style="padding: 12px 8px; text-align: left;">Batch ID</th>
                                <th style="padding: 12px 8px; text-align: left;">Blood Type</th>
                                <th style="padding: 12px 8px; text-align: left;">Component</th>
                                <th style="padding: 12px 8px; text-align: left;">Units</th>
                                <th style="padding: 12px 8px; text-align: left;">Collection Date</th>
                                <th style="padding: 12px 8px; text-align: left;">Expiry Date</th>
                                <th style="padding: 12px 8px; text-align: left;">Status</th>
                                <th style="padding: 12px 8px; text-align: left;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(batches).sort((a, b) =>
                new Date(a.expiryDate) - new Date(b.expiryDate)
            ).map(batch => {
                const isExpired = new Date(batch.expiryDate) < new Date();
                const isExpiring = !isExpired && isExpiringSoon(batch.expiryDate);
                const bgColor = isExpired ? '#FEF2F2' : (isExpiring ? '#FFFBEB' : '#F0FDF4');
                const statusText = isExpired ? 'Expired' : (isExpiring ? 'Expiring Soon' : 'Good');
                const statusColor = isExpired ? '#DC2626' : (isExpiring ? '#F59E0B' : '#10B981');

                return `
                                    <tr style="background: ${bgColor}; border-bottom: 1px solid #E2E8F0;">
                                        <td style="padding: 12px 8px;"><code>${escapeHtml(batch.batchId || batch.id)}</code></td>
                                        <td style="padding: 12px 8px;"><span class="blood-type-badge">${batch.bloodType}</span></td>
                                        <td style="padding: 12px 8px;">${batch.component}</td>
                                        <td style="padding: 12px 8px;">${batch.units}</td>
                                        <td style="padding: 12px 8px;">${formatDate(batch.collectionDate)}</td>
                                        <td style="padding: 12px 8px;">${formatDate(batch.expiryDate)}</td>
                                        <td style="padding: 12px 8px;"><span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 12px; font-size: 11px;">${statusText}</span></td>
                                        <td style="padding: 12px 8px;">
                                            <button class="btn-icon" onclick="window.editBloodBatch('${bank.id}', '${batch.id}')" style="background: none; border: none; cursor: pointer; margin-right: 8px;">✏️</button>
                                            <button class="btn-icon btn-danger" onclick="window.removeBloodBatch('${bank.id}', '${batch.id}')" style="background: none; border: none; cursor: pointer;">🗑️</button>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // Helper functions
    function calculateTotalUnits(inventory) {
        return Object.values(inventory).reduce((sum, item) => sum + (item.units || 0), 0);
    }

    function countExpiringBatches(batches) {
        const batchesArray = Object.values(batches);
        return batchesArray.filter(b => isExpiringSoon(b.expiryDate) && new Date(b.expiryDate) >= new Date()).length;
    }

    function isExpiringSoon(expiryDate) {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(today.getDate() + 7);
        return expiry <= sevenDaysFromNow && expiry >= today;
    }

    function getStatusIcon(units) {
        if (units === 0) return '🔴';
        if (units < 10) return '🟡';
        if (units < 30) return '🟢';
        return '✅';
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Remove blood batch
    window.removeBloodBatch = async function (bankId, batchId) {
        if (!window.utils.confirmAction('Are you sure you want to remove this batch? This action cannot be undone.')) {
            return;
        }

        try {
            const bankRef = database.ref(`bloodBanks/${bankId}`);
            const batchSnapshot = await bankRef.child(`batches/${batchId}`).once('value');
            const batch = batchSnapshot.val();

            if (!batch) {
                window.utils.showNotification('Batch not found', 'error');
                return;
            }

            await bankRef.child(`batches/${batchId}`).remove();

            const inventoryRef = bankRef.child(`inventory/${batch.bloodType}`);
            const currentInventory = (await inventoryRef.once('value')).val() || { units: 0 };
            const newUnits = Math.max(0, currentInventory.units - batch.units);

            await inventoryRef.update({
                units: newUnits,
                lastUpdated: new Date().toISOString()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateInventory(bankId, {
                    action: 'remove_batch',
                    batchId: batchId,
                    bloodType: batch.bloodType,
                    unitsRemoved: batch.units,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`Removed batch ${batch.batchId || batchId}`, 'success');
            await loadBloodBanks();
        } catch (error) {
            console.error('Error removing batch:', error);
            window.utils.showNotification('Failed to remove batch', 'error');
        }
    };

    // Load blood banks data
    function loadBloodBanks() {
        return new Promise((resolve) => {
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
                renderBloodBanksTable();
                resolve();
            }, error => {
                console.error('Error loading blood banks:', error);
                window.utils.showNotification('Error loading blood banks', 'error');
                resolve();
            });
        });
    }

    // Render blood banks table
    function renderBloodBanksTable(filter = '') {
        if (bloodBanks.length === 0) {
            if (elements.tableBody) {
                elements.tableBody.innerHTML = `
                     <tr>
                        <td colspan="5" class="empty-state">
                            <div class="empty-state-icon">🏥</div>
                            <p>No blood banks registered yet</p>
                            <button class="btn-secondary" onclick="document.getElementById('addBloodBankBtn').click()">
                                Add Your First Blood Bank
                            </button>
                         </td>
                     </tr>
                `;
            }
            return;
        }

        let filtered = bloodBanks;
        if (filter) {
            const searchTerm = filter.toLowerCase();
            filtered = bloodBanks.filter(bank =>
                (bank.name || '').toLowerCase().includes(searchTerm) ||
                (bank.code || '').toLowerCase().includes(searchTerm) ||
                (bank.address || '').toLowerCase().includes(searchTerm) ||
                (bank.phoneNumber || '').toLowerCase().includes(searchTerm) ||
                (bank.email || '').toLowerCase().includes(searchTerm)
            );
        }

        if (filtered.length === 0) {
            if (elements.tableBody) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <div class="empty-state-icon">🔍</div>
                            <p>No blood banks found matching "${escapeHtml(filter)}"</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }

        if (elements.tableBody) {
            elements.tableBody.innerHTML = filtered.map(bank => {
                const inventory = bank.inventory || {};
                const availableTypes = Object.entries(inventory)
                    .filter(([, data]) => data && data.units > 0)
                    .map(([type]) => type);

                const phone = window.utils.formatPhoneNumber(bank.phoneNumber);
                const email = bank.email || 'Not provided';

                const lat = bank.location?.latitude;
                const lng = bank.location?.longitude;
                const coordsDisplay = (lat != null && lng != null)
                    ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`
                    : '';

                const logoHtml = bank.imageUrl
                    ? `<img src="${bank.imageUrl}" alt="" class="avatar-sm">`
                    : `<div class="avatar-placeholder-sm">🏥</div>`;

                let typesHtml = '';
                if (availableTypes.length === 0) {
                    typesHtml = `<span style="color:#94A3B8;font-size:12px;">None</span>`;
                } else {
                    const show = availableTypes.slice(0, 4);
                    const rest = availableTypes.length - show.length;
                    typesHtml = show.map(t => {
                        const cls = t.startsWith('AB') ? 'badge-ab-pos'
                            : t.startsWith('A') ? 'badge-a-pos'
                                : t.startsWith('B') ? 'badge-b-pos'
                                    : 'badge-o-pos';
                        return `<span class="blood-type-badge ${cls}" style="margin:1px;padding:3px 7px;font-size:11px;">${t}</span>`;
                    }).join('');
                    if (rest > 0) {
                        typesHtml += `<span style="font-size:11px;color:#64748B;margin-left:2px;">+${rest}</span>`;
                    }
                }

                return `
                    <tr>
                        <td>
                            <div class="table-cell-flex">
                                ${logoHtml}
                                <div class="cell-info">
                                    <span class="cell-main">
                                        ${bank.code ? `<span style="color:var(--primary-color);font-weight:600;">[${bank.code}]</span> ` : ''}${escapeHtml(bank.name || '—')}
                                    </span>
                                    <span class="cell-sub">
                                        <span style="color:${bank.isVerified ? '#10B981' : '#94A3B8'};">
                                            ${bank.isVerified ? '✓ Verified' : '○ Unverified'}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="cell-info">
                                <span class="cell-main">${escapeHtml(bank.address || '—')}</span>
                                ${coordsDisplay ? `<span class="cell-sub" style="font-family:monospace;font-size:11px;color:#94A3B8;">${coordsDisplay}</span>` : ''}
                            </div>
                        </td>
                        <td>
                            <div class="cell-info">
                                <span class="cell-main">${escapeHtml(phone)}</span>
                                <span class="cell-sub">${escapeHtml(email)}</span>
                            </div>
                        </td>
                        <td>
                            <div style="display:flex;flex-wrap:wrap;gap:2px;">
                                ${typesHtml}
                            </div>
                        </td>
                        <td>
                            <div style="display:flex;flex-direction:column;gap:4px;">
                                <button class="action-btn action-btn-edit" onclick="window.editBloodBank('${bank.id}')">
                                    ✏️ Edit
                                </button>
                                <button class="action-btn action-btn-success" onclick="window.editInventory('${bank.id}')">
                                    📊 Stock
                                </button>
                                <button class="action-btn action-btn-danger" onclick="window.deleteBloodBank('${bank.id}')">
                                    🗑️ Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Handle search
    function handleSearch(e) {
        renderBloodBanksTable(e.target.value);
    }

    // Open add modal
    function openAddModal() {
        currentEditId = null;
        if (elements.bankForm) elements.bankForm.reset();

        const codeInput = document.getElementById('bankCode');
        const latInput = document.getElementById('bankLatitude');
        const lngInput = document.getElementById('bankLongitude');
        if (codeInput) codeInput.value = '';
        if (latInput) latInput.value = '-1.286389';
        if (lngInput) lngInput.value = '36.817223';

        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Add Blood Bank';

        if (elements.logoPreview) {
            elements.logoPreview.src = '';
            elements.logoPreview.style.display = 'none';
        }
        if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'flex';
        if (elements.logoUrlInput) elements.logoUrlInput.value = '';

        if (elements.addBankModal) elements.addBankModal.classList.add('show');
    }

    // Close add modal
    function closeAddModal() {
        if (elements.addBankModal) elements.addBankModal.classList.remove('show');
        if (elements.bankForm) elements.bankForm.reset();

        if (elements.logoPreview) {
            elements.logoPreview.src = '';
            elements.logoPreview.style.display = 'none';
        }
        if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'flex';
        if (elements.logoUrlInput) elements.logoUrlInput.value = '';

        currentEditId = null;
    }

    // Edit blood bank
    window.editBloodBank = function (id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }

        currentEditId = id;

        const nameInput = document.getElementById('bankName');
        const codeInput = document.getElementById('bankCode');
        const addressInput = document.getElementById('bankAddress');
        const phoneInput = document.getElementById('bankPhone');
        const emailInput = document.getElementById('bankEmail');
        const latInput = document.getElementById('bankLatitude');
        const lngInput = document.getElementById('bankLongitude');
        const verifiedCheckbox = document.getElementById('bankVerified');

        if (nameInput) nameInput.value = bank.name || '';
        if (codeInput) codeInput.value = bank.code || '';
        if (addressInput) addressInput.value = bank.address || '';
        if (phoneInput) phoneInput.value = bank.phoneNumber || '';
        if (emailInput) emailInput.value = bank.email || '';
        if (latInput) latInput.value = bank.location?.latitude || '';
        if (lngInput) lngInput.value = bank.location?.longitude || '';
        if (verifiedCheckbox) verifiedCheckbox.checked = bank.isVerified || false;

        if (bank.imageUrl) {
            if (elements.logoPreview) {
                elements.logoPreview.src = bank.imageUrl;
                elements.logoPreview.style.display = 'block';
            }
            if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'none';
            if (elements.logoUrlInput) elements.logoUrlInput.value = bank.imageUrl;
        } else {
            if (elements.logoPreview) {
                elements.logoPreview.src = '';
                elements.logoPreview.style.display = 'none';
            }
            if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'flex';
            if (elements.logoUrlInput) elements.logoUrlInput.value = '';
        }

        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Edit Blood Bank';
        if (elements.addBankModal) elements.addBankModal.classList.add('show');
    };

    // Handle form submission
    async function handleFormSubmit(e) {
        e.preventDefault();

        const latInput = document.getElementById('bankLatitude');
        const lngInput = document.getElementById('bankLongitude');
        const latitude = parseFloat(latInput?.value);
        const longitude = parseFloat(lngInput?.value);

        const coordValidation = window.utils.validateCoordinates(latitude, longitude);
        if (!coordValidation.valid) {
            window.utils.showNotification(coordValidation.message, 'error');
            return;
        }

        const phoneInput = document.getElementById('bankPhone');
        const phone = phoneInput?.value.trim();
        if (!phone) {
            window.utils.showNotification('Phone number is required', 'error');
            return;
        }

        const nameInput = document.getElementById('bankName');
        const codeInput = document.getElementById('bankCode');
        const addressInput = document.getElementById('bankAddress');
        const emailInput = document.getElementById('bankEmail');
        const verifiedCheckbox = document.getElementById('bankVerified');

        const data = {
            name: nameInput?.value.trim() || '',
            code: codeInput?.value.trim() || null,
            address: addressInput?.value.trim() || '',
            phoneNumber: phone,
            email: emailInput?.value.trim() || null,
            location: { latitude, longitude },
            imageUrl: elements.logoUrlInput?.value.trim() || null,
            isVerified: verifiedCheckbox?.checked || false,
            updatedAt: new Date().toISOString()
        };

        if (!data.name) {
            window.utils.showNotification('Blood bank name is required', 'error');
            return;
        }

        try {
            if (currentEditId) {
                const existingBank = bloodBanks.find(b => b.id === currentEditId);
                if (existingBank && existingBank.inventory) {
                    data.inventory = existingBank.inventory;
                }
                if (existingBank && existingBank.batches) {
                    data.batches = existingBank.batches;
                }
                await database.ref(`bloodBanks/${currentEditId}`).update(data);

                // Log audit event
                if (window.auditLogs && window.auditLogs.actions) {
                    window.auditLogs.actions.updateBloodBank(currentEditId, {
                        name: data.name,
                        code: data.code,
                        timestamp: new Date().toISOString()
                    });
                }

                window.utils.showNotification('Blood bank updated successfully', 'success');
            } else {
                data.createdAt = new Date().toISOString();
                data.inventory = {};
                data.batches = {};
                const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                bloodTypes.forEach(type => {
                    data.inventory[type] = { units: 0, lastUpdated: new Date().toISOString() };
                });
                const newBankRef = await database.ref('bloodBanks').push(data);

                // Log audit event
                if (window.auditLogs && window.auditLogs.actions) {
                    window.auditLogs.actions.createBloodBank(newBankRef.key, {
                        name: data.name,
                        code: data.code,
                        timestamp: new Date().toISOString()
                    });
                }

                window.utils.showNotification('Blood bank added successfully', 'success');
            }

            closeAddModal();
        } catch (error) {
            console.error('Error saving blood bank:', error);
            window.utils.showNotification('Failed to save blood bank', 'error');
        }
    }

    // Edit inventory
    window.editInventory = function (id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }

        currentInventoryBankId = id;

        if (elements.inventoryModalSubtitle) {
            elements.inventoryModalSubtitle.textContent = bank.name;
        }

        const inventoryContent = document.getElementById('inventoryContent');
        if (inventoryContent) {
            inventoryContent.innerHTML = renderEnhancedInventory(bank);
        }

        if (elements.inventoryModal) {
            elements.inventoryModal.classList.add('show');
        }
    };

    // Close inventory modal
    function closeInventoryModal() {
        if (elements.inventoryModal) {
            elements.inventoryModal.classList.remove('show');
        }
        currentInventoryBankId = null;
    }

    // Delete blood bank
    window.deleteBloodBank = async function (id) {
        const bank = bloodBanks.find(b => b.id === id);
        if (!bank) {
            window.utils.showNotification('Blood bank not found', 'error');
            return;
        }

        const message = `Are you sure you want to delete "${bank.name}"?\n\nThis will permanently remove:\n - Blood bank details\n - All inventory records\n - All batch records\n\nThis action cannot be undone.`;
        if (!window.utils.confirmAction(message)) return;

        try {
            await database.ref(`bloodBanks/${id}`).remove();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.deleteBloodBank(id, {
                    name: bank.name,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification('Blood bank deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting blood bank:', error);
            window.utils.showNotification('Failed to delete blood bank', 'error');
        }
    };

    // Handle logo upload
    async function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            if (elements.logoPreview) {
                elements.logoPreview.src = event.target.result;
                elements.logoPreview.style.display = 'block';
            }
            if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        try {
            window.utils.showNotification('Uploading logo...', 'info');
            const result = await window.utils.uploadImageToCloudinary(file, 'bloodlink/blood_banks');
            if (result && result.secure_url) {
                if (elements.logoUrlInput) elements.logoUrlInput.value = result.secure_url;
                window.utils.showNotification('Logo uploaded successfully', 'success');
            }
        } catch (error) {
            console.error('Error uploading logo:', error);
            window.utils.showNotification('Failed to upload logo', 'error');
            if (elements.logoPreview) {
                elements.logoPreview.src = '';
                elements.logoPreview.style.display = 'none';
            }
            if (elements.logoPlaceholder) elements.logoPlaceholder.style.display = 'flex';
        }
    }

    // Sync from local static CSV file
    async function syncFromLocalCSV() {
        try {
            window.utils.showNotification('Fetching hospital data...', 'info');
            const response = await fetch('/static/kenya-hospitals.csv');
            if (!response.ok) throw new Error('Failed to fetch local CSV file');
            const csvText = await response.text();
            processCSV(csvText, 'Local Sync');
        } catch (error) {
            console.error('Error syncing local CSV:', error);
            window.utils.showNotification('Failed to sync local hospital data', 'error');
        }
    }

    // Handle CSV file selection
    function handleCSVFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            processCSV(event.target.result, file.name);
            if (elements.csvFileInput) elements.csvFileInput.value = '';
        };
        reader.onerror = function () {
            window.utils.showNotification('Error reading CSV file', 'error');
        };
        reader.readAsText(file);
    }

    // Process CSV text
    async function processCSV(csvText, sourceName) {
        try {
            const rows = parseCSV(csvText);
            if (rows.length === 0) {
                window.utils.showNotification('CSV source is empty or invalid', 'error');
                return;
            }

            const operationalRows = rows.filter(row =>
                (row['operation status'] || '').toLowerCase() === 'operational'
            );

            const message = `Source: ${sourceName}\nFound ${operationalRows.length} operational hospitals.\nExisting entries with same name/code will be updated. Do you want to proceed?`;
            if (!window.utils.confirmAction(message)) return;

            let importedCount = 0;
            let updatedCount = 0;

            for (const row of operationalRows) {
                const result = await importHospital(row);
                if (result.updated) updatedCount++;
                else if (result.imported) importedCount++;
            }

            window.utils.showNotification(
                `Sync complete: ${importedCount} added, ${updatedCount} updated.`,
                'success'
            );

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateBloodBank('multiple', {
                    action: 'csv_import',
                    source: sourceName,
                    added: importedCount,
                    updated: updatedCount,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Error processing CSV:', error);
            window.utils.showNotification('Error processing hospital data', 'error');
        }
    }

    // Simple CSV parser supporting quotes
    function parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < headers.length) {
                const simpleSplit = line.split(',');
                if (simpleSplit.length < headers.length) continue;
                const obj = {};
                headers.forEach((h, index) => {
                    obj[h] = simpleSplit[index] ? simpleSplit[index].replace(/^"|"$/g, '').trim() : '';
                });
                result.push(obj);
            } else {
                const obj = {};
                headers.forEach((h, index) => {
                    obj[h] = matches[index] ? matches[index].replace(/^"|"$/g, '').trim() : '';
                });
                result.push(obj);
            }
        }
        return result;
    }

    // Import a single hospital row
    async function importHospital(row) {
        const name = row.name || row.officialname;
        const code = row.code;
        if (!name) return { imported: false, updated: false };

        const address = [row.ward, row['sub county'], row.county]
            .filter(part => part && part !== 'undefined' && part !== '')
            .join(', ');

        const data = {
            name,
            address: address || 'Kenya',
            county: row.county || 'Nairobi',
            subCounty: row['sub county'] || 'Central',
            code: code || null,
            phoneNumber: 'Not provided',
            email: null,
            location: {
                latitude: parseFloat(row.latitude) || -1.286389,
                longitude: parseFloat(row.longitude) || 36.817223
            },
            isVerified: true,
            updatedAt: new Date().toISOString(),
            inventory: {},
            batches: {}
        };

        const existing = bloodBanks.find(b =>
            (name && b.name === name) || (code && b.code === code)
        );

        try {
            if (existing) {
                if (existing.inventory) data.inventory = existing.inventory;
                if (existing.batches) data.batches = existing.batches;
                await database.ref(`bloodBanks/${existing.id}`).update(data);
                return { imported: false, updated: true };
            } else {
                data.createdAt = new Date().toISOString();
                const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
                bloodTypes.forEach(type => {
                    data.inventory[type] = { units: 0, lastUpdated: new Date().toISOString() };
                });
                await database.ref('bloodBanks').push(data);
                return { imported: true, updated: false };
            }
        } catch (error) {
            console.error('Error importing hospital:', name, error);
            return { imported: false, updated: false };
        }
    }

})();