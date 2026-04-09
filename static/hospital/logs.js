// Activity Logs Module for Hospital Admin
// Displays facility-specific audit logs
(function () {
    'use strict';

    let state = {
        currentFilters: {},
        isLoading: false,
        logs: []
    };

    /**
     * Initialize the activity logs page
     */
    window.initializePage = async function () {
        console.log('📜 Initializing Hospital Admin Activity Logs...');
        
        if (!window.auditLogs) {
            console.error('❌ Audit logs module not found');
            showError('Audit logging system not initialized. Please refresh the page.');
            return;
        }

        // Ensure hospital data is available
        if (!window.hospitalData) {
            console.error('❌ Hospital context not found');
            showError('Hospital context not available. Please reload the page.');
            return;
        }

        console.log('🏥 Hospital:', window.hospitalData.name || window.hospitalData.hospitalName);
        
        await loadActivityLogs();
        setupAutoRefresh();
    };

    /**
     * Load activity logs with proper error handling
     */
    window.loadActivityLogs = async function (filters = {}) {
        if (state.isLoading) {
            console.log('⏳ Logs already loading...');
            return;
        }

        state.isLoading = true;
        state.currentFilters = filters;

        const list = document.getElementById('auditLogsList');
        if (!list) {
            console.error('❌ Container auditLogsList not found');
            return;
        }

        // Show loading state
        list.innerHTML = `
            <div class="loading-state" style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                <p style="color: var(--text-secondary);">Loading facility logs...</p>
            </div>
        `;

        try {
            console.log('📥 Loading activity logs...', filters);
            
            // Load hospital-specific audit logs
            const logs = await window.auditLogs.get(filters);
            state.logs = logs;
            
            console.log(`✅ Loaded ${logs.length} activity logs`);

            // Render the logs
            renderActivityLogsUI(logs);
            
        } catch (error) {
            console.error('❌ Error loading activity logs:', error);
            showError(`Failed to load activity logs: ${error.message}`);
        } finally {
            state.isLoading = false;
        }
    };

    /**
     * Render the activity logs UI
     */
    function renderActivityLogsUI(logs) {
        const list = document.getElementById('auditLogsList');
        if (!list) return;

        if (!logs || logs.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 16px;">📋</div>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">No Activity Logs Found</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">
                        Activity logs will appear here as actions are performed in your facility.
                    </p>
                    <button onclick="window.loadActivityLogs()" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🔄 Refresh Logs
                    </button>
                </div>
            `;
            return;
        }

        list.innerHTML = logs.map(log => renderLogEntry(log)).join('');
    }

    /**
     * Render a single log entry
     */
    function renderLogEntry(log) {
        const action = log.action || 'unknown';
        const timestamp = formatTimestamp(log.timestamp);
        
        // Determine border color based on action
        let borderColor = '#cbd5e1';
        switch (action) {
            case 'create': borderColor = '#22c55e'; break;
            case 'update': borderColor = '#3b82f6'; break;
            case 'delete': borderColor = '#ef4444'; break;
            case 'approve': borderColor = '#10b981'; break;
            case 'reject': borderColor = '#f59e0b'; break;
            case 'login': borderColor = '#8b5cf6'; break;
            case 'logout': borderColor = '#64748b'; break;
            default: borderColor = '#cbd5e1';
        }

        const detailsText = formatAuditDetails(log);
        const adminEmail = log.admin?.email || 'Unknown Admin';
        const adminRole = log.admin?.role || 'Admin';
        const hospitalName = log.admin?.hospitalName || window.hospitalData?.name || 'Facility';

        return `
            <div class="audit-log-entry" style="
                padding: 16px;
                border-radius: 12px;
                background: #fdfdfd;
                border: 1px solid rgba(0, 0, 0, 0.03);
                border-left: 4px solid ${borderColor};
                margin-bottom: 16px;
                transition: all 0.2s;
            " onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'" 
               onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
                
                <div class="audit-log-entry-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="font-size: 15px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">
                            ${adminEmail}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">
                            ${adminRole} • ${hospitalName}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="audit-badge audit-badge-${action}" style="
                            padding: 4px 10px;
                            border-radius: 20px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            background: ${getActionBgColor(action)};
                            color: ${getActionTextColor(action)};
                        ">
                            ${action}
                        </span>
                        <span class="audit-log-timestamp" style="font-size: 12px; color: #94a3b8; font-weight: 500; white-space: nowrap;">
                            ${timestamp}
                        </span>
                    </div>
                </div>

                <div class="audit-log-details" style="padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                    <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: var(--text-secondary);">
                            ${log.resourceType || 'activity'}
                        </span>
                        ${log.severity ? `
                        <span style="
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-size: 10px;
                            font-weight: 600;
                            background: ${getSeverityBgColor(log.severity)};
                            color: ${getSeverityTextColor(log.severity)};
                            margin-left: auto;
                        ">
                            ${log.severity}
                        </span>
                        ` : ''}
                    </div>

                    <p style="font-size: 14px; line-height: 1.5; color: var(--text-secondary); margin: 0;">
                        ${detailsText}
                    </p>

                    ${log.resourceId && log.resourceId !== 'none' ? `
                        <p style="margin-top: 8px; font-size: 11px; color: var(--text-tertiary); border-top: 1px dashed #e2e8f0; padding-top: 4px;">
                            <strong>ID:</strong> ${log.resourceId}
                        </p>
                    ` : ''}

                    ${log.metadata?.platform ? `
                        <p style="margin-top: 4px; font-size: 10px; color: var(--text-tertiary);">
                            💻 ${log.metadata.platform}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Format timestamp safely (logical time)
     */
    function formatTimestamp(v) {
        if (!v) return 'Unknown';
        
        try {
            // Handle Firestore Timestamp
            if (v.toDate) {
                const d = v.toDate();
                if (isNaN(d.getTime())) return 'Invalid Date';
                return d.toLocaleString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            // Handle ISO string or milliseconds
            if (typeof v === 'string' || typeof v === 'number') {
                const d = new Date(v);
                if (isNaN(d.getTime())) return 'Invalid Date';
                return d.toLocaleString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            // Handle {seconds, nanoseconds}
            if (v.seconds) {
                const d = new Date(v.seconds * 1000);
                if (isNaN(d.getTime())) return 'Invalid Date';
                return d.toLocaleString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            return 'Unknown';
        } catch (err) {
            console.warn('⚠️ Invalid timestamp:', v);
            return 'Invalid Date';
        }
    }

    /**
     * Get background color for action badge
     */
    function getActionBgColor(action) {
        const colors = {
            create: '#dcfce7',
            update: '#dbeafe',
            delete: '#fee2e2',
            approve: '#d1fae5',
            reject: '#ffedd5',
            login: '#f3e8ff',
            logout: '#f1f5f9'
        };
        return colors[action] || '#f1f5f9';
    }

    /**
     * Get text color for action badge
     */
    function getActionTextColor(action) {
        const colors = {
            create: '#166534',
            update: '#1e40af',
            delete: '#991b1b',
            approve: '#065f46',
            reject: '#9a3412',
            login: '#6b21a8',
            logout: '#475569'
        };
        return colors[action] || '#475569';
    }

    /**
     * Get background color for severity
     */
    function getSeverityBgColor(severity) {
        const colors = {
            info: '#dbeafe',
            warning: '#fef3c7',
            error: '#fee2e2',
            critical: '#fecaca'
        };
        return colors[severity] || '#f1f5f9';
    }

    /**
     * Get text color for severity
     */
    function getSeverityTextColor(severity) {
        const colors = {
            info: '#1e40af',
            warning: '#92400e',
            error: '#991b1b',
            critical: '#991b1b'
        };
        return colors[severity] || '#475569';
    }

    /**
     * Format audit log details into readable text
     */
    function formatAuditDetails(log) {
        const details = log.details || {};
        const action = log.action || 'unknown';

        const descriptions = {
            login: `Admin logged in from ${log.metadata?.platform || 'unknown platform'}`,
            logout: `Admin logged out`,
            create: `Created new ${log.resourceType || 'resource'}${details.name ? `: <strong>${details.name}</strong>` : ''}`,
            update: `Updated ${log.resourceType || 'resource'}${details.changes ? ' with changes' : ''}`,
            delete: `Deleted ${log.resourceType || 'resource'}${details.name ? `: <strong>${details.name}</strong>` : ''}`,
            approve: `Approved ${log.resourceType || 'resource'}${details.reason ? ` - Reason: ${details.reason}` : ''}`,
            reject: `Rejected ${log.resourceType || 'resource'}${details.reason ? ` - Reason: ${details.reason}` : ''}`,
            warning: `⚠️ ${details.message || 'Warning event'}`,
            export: `Exported ${log.resourceType || 'data'}`,
            view: `Viewed ${log.resourceType || 'resource'}`
        };

        return descriptions[action] || `Action: ${action} on ${log.resourceType || 'resource'}`;
    }

    /**
     * Apply filters
     */
    window.applyFilters = async function () {
        const action = document.getElementById('actionFilter')?.value || '';
        const resource = document.getElementById('resourceFilter')?.value || '';
        const userSearch = document.getElementById('userSearchFilter')?.value.trim() || '';

        const filters = {};
        if (action) filters.action = action;
        if (resource) filters.resourceType = resource;
        if (userSearch) filters.userSearch = userSearch;

        console.log('🔍 Applying filters:', filters);
        await window.loadActivityLogs(filters);
    };

    /**
     * Refresh logs
     */
    window.refreshLogs = async function () {
        console.log('🔄 Refreshing activity logs...');
        if (window.utils?.showNotification) {
            window.utils.showNotification('Refreshing activity logs...', 'info');
        }
        await window.loadActivityLogs(state.currentFilters);
    };

    /**
     * Setup auto-refresh (every 60 seconds)
     */
    function setupAutoRefresh() {
        console.log('⏰ Setting up auto-refresh (60s interval)');
        setInterval(async () => {
            console.log('🔄 Auto-refreshing activity logs...');
            await window.loadActivityLogs(state.currentFilters);
        }, 60000); // 60 seconds
    }

    /**
     * Show error message
     */
    function showError(message) {
        const list = document.getElementById('auditLogsList');
        if (list) {
            list.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 60px 20px; color: #ef4444;">
                    <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
                    <h3 style="margin-bottom: 8px;">Error Loading Logs</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">${message}</p>
                    <button onclick="window.initializePage()" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    console.log('✅ Hospital Admin Activity Logs Module loaded');

})();
