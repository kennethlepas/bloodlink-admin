// System Logs Module for Super Admin
(function () {
    'use strict';

    window.initializePage = async function () {
        console.log('🔍 Initializing Super Admin System Logs...');
        await loadSystemLogs();
        await updateLogStats();
    };

    window.loadSystemLogs = async function (filters = {}) {
        const container = document.getElementById('logsUIContainer');
        if (!container) return;

        // Note: Using auditLogs from audit-logs.js which we already included in the template
        if (window.auditLogs && window.auditLogs.createUI) {
            // Re-create the UI inside the container
            // createUI(containerId, includeUserLogs, includeHospitalLogs)
            await window.auditLogs.createUI('logsUIContainer', true, true);
        }
    };

    window.updateLogStats = async function () {
        try {
            if (!window.auditLogs || !window.auditLogs.getCombinedLogs) return;

            const logs = await window.auditLogs.getCombinedLogs();
            const now = new Date();
            const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            const recentLogs = logs.filter(l => {
                const ts = l.timestampISO ? new Date(l.timestampISO) : null;
                return ts && ts > last24h;
            });

            const totalEl = document.getElementById('totalEvents');
            const userEl = document.getElementById('userActivities');
            const adminEl = document.getElementById('adminActions');
            const errorEl = document.getElementById('systemErrors');

            if (totalEl) totalEl.textContent = recentLogs.length;
            if (userEl) userEl.textContent = recentLogs.filter(l => l.logSource === 'user_app').length;
            if (adminEl) adminEl.textContent = recentLogs.filter(l => l.logSource === 'admin').length;
            if (errorEl) errorEl.textContent = recentLogs.filter(l => l.severity === 'error' || l.action === 'error_occurred').length;
        } catch (err) {
            console.error('updateLogStats:', err);
        }
    };

    // Global refresh function
    window.refreshLogs = async function () {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification('Refreshing all system logs...', 'info');
        }
        await loadSystemLogs();
        await updateLogStats();
    };

})();
