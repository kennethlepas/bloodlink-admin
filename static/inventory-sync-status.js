/**
 * Inventory Sync Status Indicator
 * Displays real-time sync status in the UI
 */

(function () {
    'use strict';

    let syncStatusElement = null;
    let currentStatus = 'idle';
    let statusTimeout = null;

    /**
     * Create sync status indicator element
     */
    function createStatusIndicator() {
        if (syncStatusElement) return;

        syncStatusElement = document.createElement('div');
        syncStatusElement.id = 'inventorySyncStatus';
        syncStatusElement.className = 'sync-status-indicator';
        syncStatusElement.innerHTML = `
            <span class="sync-status-icon">⏳</span>
            <span class="sync-status-text">Sync: Idle</span>
        `;

        // Add to DOM near inventory save buttons
        const inventorySection = document.querySelector('.inventory-section') || 
                                document.querySelector('.detail-modal-content') ||
                                document.body;
        
        if (inventorySection) {
            inventorySection.appendChild(syncStatusElement);
        }

        // Add styles
        addStyles();
    }

    /**
     * Add CSS styles for the indicator
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .sync-status-indicator {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #ffffff;
                border: 2px solid #e8e3dc;
                border-radius: 8px;
                padding: 10px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                font-family: 'DM Sans', sans-serif;
                font-size: 13px;
                z-index: 10000;
                transition: all 0.3s ease;
                opacity: 0.9;
            }

            .sync-status-indicator:hover {
                opacity: 1;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
            }

            .sync-status-icon {
                font-size: 16px;
                display: inline-block;
            }

            .sync-status-text {
                color: #2c2825;
                font-weight: 500;
            }

            .sync-status-indicator.syncing {
                border-color: #3498db;
                background: #ebf5fb;
            }

            .sync-status-indicator.syncing .sync-status-icon {
                animation: spin 1s linear infinite;
            }

            .sync-status-indicator.success {
                border-color: #27ae60;
                background: #eafaf1;
            }

            .sync-status-indicator.error {
                border-color: #e74c3c;
                background: #fdedec;
            }

            .sync-status-indicator.warning {
                border-color: #f39c12;
                background: #fef9e7;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @media (max-width: 768px) {
                .sync-status-indicator {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Update sync status indicator
     */
    function updateStatus(status, message) {
        if (!syncStatusElement) {
            createStatusIndicator();
        }

        currentStatus = status;
        const icon = syncStatusElement.querySelector('.sync-status-icon');
        const text = syncStatusElement.querySelector('.sync-status-text');

        // Remove all status classes
        syncStatusElement.classList.remove('syncing', 'success', 'error', 'warning');

        switch (status) {
            case 'syncing':
                syncStatusElement.classList.add('syncing');
                icon.textContent = '🔄';
                text.textContent = message || 'Syncing...';
                break;

            case 'success':
                syncStatusElement.classList.add('success');
                icon.textContent = '✅';
                text.textContent = message || 'Synced successfully';
                
                // Auto-hide after 3 seconds
                clearTimeout(statusTimeout);
                statusTimeout = setTimeout(() => {
                    syncStatusElement.style.opacity = '0';
                    setTimeout(() => {
                        syncStatusElement.style.display = 'none';
                    }, 300);
                }, 3000);
                break;

            case 'error':
                syncStatusElement.classList.add('error');
                icon.textContent = '❌';
                text.textContent = message || 'Sync failed';
                break;

            case 'warning':
                syncStatusElement.classList.add('warning');
                icon.textContent = '⚠️';
                text.textContent = message || 'Sync warning';
                break;

            default:
                icon.textContent = '⏳';
                text.textContent = 'Sync: Idle';
                break;
        }

        // Show element if hidden
        syncStatusElement.style.display = 'flex';
        syncStatusElement.style.opacity = '0.9';

        console.log(`📡 UI Status [${status}]: ${message}`);
    }

    /**
     * Listen to sync events from InventorySyncService
     */
    function setupEventListeners() {
        window.addEventListener('inventorySync', (event) => {
            const { status, message } = event.detail;
            
            // Show syncing indicator
            updateStatus('syncing', 'Syncing inventory...');
            
            // Update with result after short delay
            setTimeout(() => {
                updateStatus(status, message);
            }, 500);
        });
    }

    /**
     * Initialize sync status indicator
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                createStatusIndicator();
                setupEventListeners();
            });
        } else {
            createStatusIndicator();
            setupEventListeners();
        }
    }

    // Public API
    window.InventorySyncStatus = {
        update: updateStatus,
        show: createStatusIndicator,
        hide: function () {
            if (syncStatusElement) {
                syncStatusElement.style.display = 'none';
            }
        },
        getStatus: function () {
            return currentStatus;
        }
    };

    // Auto-initialize
    init();

    console.log('✅ Inventory Sync Status Indicator loaded');
})();
