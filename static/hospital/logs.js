// Activity Logs Module for Hospital Admin
(function () {
    'use strict';

    window.initializePage = async function () {
        console.log('📜 Initializing Activity Logs Module...');
        await loadActivityLogs();
    };

    window.loadActivityLogs = async function (filters = {}) {
        const list = document.getElementById('auditLogsList');
        if (!list) return;

        list.innerHTML = `
            <div class="loading-state" style="text-align: center; padding: 40px;">
                <div class="loading-spinner"></div>
                <p>Fetching facility logs...</p>
            </div>
        `;

        try {
            // Using the global auditLogs system
            if (window.auditLogs && window.auditLogs.get) {
                const logs = await window.auditLogs.get(filters);
                window.auditLogs.render('auditLogsList', logs);
            } else {
                console.error('Audit logging system not found');
                list.innerHTML = '<div class="empty-state">❌ Error: Logging system not initialized</div>';
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            list.innerHTML = `<div class="empty-state">❌ Error loading logs: ${error.message}</div>`;
        }
    };


    window.refreshLogs = function () {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification('Refreshing logs...', 'info');
        }
        loadActivityLogs();
    };

    window.applyFilters = function () {
        const action = document.getElementById('actionFilter')?.value;
        const resource = document.getElementById('resourceFilter')?.value;
        const userSearch = document.getElementById('userSearchFilter')?.value.trim();

        const filters = {};
        if (action) filters.action = action;
        if (resource) filters.resourceType = resource;
        if (userSearch) filters.userSearch = userSearch;

        loadActivityLogs(filters);
    };

})();
