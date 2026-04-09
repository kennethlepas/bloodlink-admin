// System Logs Module for Super Admin
// Displays combined admin audit logs + user activity logs
(function () {
    'use strict';

    let state = {
        includeUserLogs: false,
        currentFilters: {},
        isLoading: false
    };

    /**
     * Initialize the system logs page
     */
    window.initializePage = async function () {
        console.log('🔍 Initializing Super Admin System Logs...');
        
        if (!window.auditLogs) {
            console.error('❌ Audit logs module not found');
            showError('Audit logging system not initialized. Please refresh the page.');
            return;
        }

        await loadSystemLogs();
        await updateLogStats();
        setupAutoRefresh();
    };

    /**
     * Load system logs with proper error handling
     */
    window.loadSystemLogs = async function (filters = {}) {
        if (state.isLoading) {
            console.log('⏳ Logs already loading...');
            return;
        }

        state.isLoading = true;
        state.currentFilters = filters;

        const container = document.getElementById('logsUIContainer');
        if (!container) {
            console.error('❌ Container logsUIContainer not found');
            return;
        }

        try {
            console.log('📥 Loading system logs...', filters);
            
            // Load combined logs (admin + user activity)
            const logs = await window.auditLogs.getCombinedLogs(filters);
            
            console.log(`✅ Loaded ${logs.length} logs:`, {
                adminLogs: logs.filter(l => l.logSource === 'admin').length,
                userLogs: logs.filter(l => l.logSource === 'user_app').length
            });

            // Render the logs
            renderSystemLogsUI(logs);
            
            // Update stats
            await updateLogStats();
            
        } catch (error) {
            console.error('❌ Error loading system logs:', error);
            showError(`Failed to load system logs: ${error.message}`);
        } finally {
            state.isLoading = false;
        }
    };

    /**
     * Render the complete system logs UI
     */
    function renderSystemLogsUI(logs) {
        const container = document.getElementById('logsUIContainer');
        if (!container) return;

        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 16px;">📋</div>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">No System Logs Found</h3>
                    <p style="color: var(--text-secondary);">
                        Logs will appear here as actions are performed in the system.
                    </p>
                    <button onclick="window.loadSystemLogs()" style="margin-top: 16px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🔄 Refresh Logs
                    </button>
                </div>
            `;
            return;
        }

        // Group logs by source
        const adminLogs = logs.filter(l => l.logSource === 'admin');
        const userLogs = logs.filter(l => l.logSource === 'user_app');

        container.innerHTML = `
            <div class="logs-content">
                <div class="logs-header" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 700;">
                            📊 System Logs (${logs.length} entries)
                        </h3>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="window.toggleUserLogs()" style="padding: 8px 16px; background: ${state.includeUserLogs ? 'var(--primary)' : 'white'}; color: ${state.includeUserLogs ? 'white' : 'var(--primary)'}; border: 1px solid var(--primary); border-radius: 8px; cursor: pointer; font-size: 13px;">
                                📱 ${state.includeUserLogs ? 'Hide User Logs' : 'Show User Logs'}
                            </button>
                            <button onclick="window.loadSystemLogs()" style="padding: 8px 16px; background: white; color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; cursor: pointer; font-size: 13px;">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="logs-filters" style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
                    <select id="actionFilter" onchange="window.applyFilters()" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
                        <option value="">All Actions</option>
                        <optgroup label="Admin Actions">
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="login">Admin Login</option>
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                        </optgroup>
                        <optgroup label="User Activities">
                            <option value="auth_login">User Login</option>
                            <option value="auth_register">User Registration</option>
                            <option value="request_create">Request Created</option>
                            <option value="request_accepted">Request Accepted</option>
                            <option value="donor_register">Donor Registered</option>
                            <option value="chat_send_message">Chat Message</option>
                            <option value="referral_create">Referral Created</option>
                            <option value="error_occurred">Errors</option>
                        </optgroup>
                    </select>
                    
                    <select id="resourceFilter" onchange="window.applyFilters()" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
                        <option value="">All Resources</option>
                        <optgroup label="Admin Resources">
                            <option value="user">User</option>
                            <option value="donor">Donor</option>
                            <option value="blood_request">Blood Request</option>
                            <option value="hospital">Hospital</option>
                            <option value="system">System</option>
                        </optgroup>
                        <optgroup label="User Resources">
                            <option value="user_activity">User Activity</option>
                            <option value="chat">Chat</option>
                            <option value="referral">Referral</option>
                            <option value="notification">Notification</option>
                        </optgroup>
                    </select>

                    ${state.includeUserLogs ? `
                    <select id="userTypeFilter" onchange="window.applyFilters()" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;" title="Filter by user type">
                        <option value="">All User Types</option>
                        <option value="donor">🩸 Donors</option>
                        <option value="requester">📋 Requesters</option>
                        <option value="hospital">🏥 Hospital Admins</option>
                    </select>
                    ` : ''}

                    ${state.includeUserLogs ? `
                    <select id="severityFilter" onchange="window.applyFilters()" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
                        <option value="">All Severities</option>
                        <option value="info">ℹ️ Info</option>
                        <option value="warning">⚠️ Warning</option>
                        <option value="error">❌ Error</option>
                    </select>
                    ` : ''}

                    <input type="text" id="userSearchFilter" placeholder="🔍 Search email..." 
                        onkeyup="if(event.key === 'Enter') window.applyFilters()"
                        style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
                </div>

                <!-- Logs List -->
                <div class="logs-list" style="display: flex; flex-direction: column; gap: 12px;">
                    ${logs.map(log => renderLogEntry(log)).join('')}
                </div>

                ${logs.length >= 50 ? `
                <div style="text-align: center; padding: 16px; color: var(--text-secondary); font-size: 13px;">
                    Showing latest 50 logs. Use filters to narrow down results.
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render a single log entry
     */
    function renderLogEntry(log) {
        const isUserLog = log.logSource === 'user_app';
        const action = log.action || log.activityType || 'unknown';
        const timestamp = formatTimestamp(log.timestamp);
        
        // Determine color based on log source and severity
        let borderColor = '#cbd5e1';
        if (isUserLog) {
            borderColor = log.severity === 'error' ? '#ef4444' : 
                         log.severity === 'warning' ? '#f59e0b' : '#3b82f6';
        } else {
            switch (action) {
                case 'create': borderColor = '#22c55e'; break;
                case 'update': borderColor = '#3b82f6'; break;
                case 'delete': borderColor = '#ef4444'; break;
                case 'approve': borderColor = '#10b981'; break;
                case 'reject': borderColor = '#f59e0b'; break;
                case 'login': borderColor = '#8b5cf6'; break;
                default: borderColor = '#cbd5e1';
            }
        }

        const detailsText = isUserLog ? formatUserActivityDetails(log) : formatAdminDetails(log);
        const userTitle = isUserLog ? (log.user?.email || 'Unknown User') : (log.admin?.email || 'Unknown Admin');
        const userSub = isUserLog ? (log.user?.userType || 'Mobile User') : (log.admin?.role || 'Admin');

        return `
            <div class="log-entry" style="
                padding: 16px;
                border-radius: 12px;
                background: white;
                border: 1px solid var(--border-color);
                border-left: 4px solid ${borderColor};
                transition: all 0.2s;
            " onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" 
               onmouseout="this.style.boxShadow='none'">
                
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 15px; font-weight: 700; color: var(--primary); margin-bottom: 2px;">
                            ${userTitle}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">
                            ${userSub} ${log.admin?.hospitalName ? `• ${log.admin.hospitalName}` : ''}
                            ${isUserLog ? '• 📱 Mobile App' : '• 💻 Admin Panel'}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">
                        ${timestamp}
                    </div>
                </div>

                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span class="action-badge" style="
                            padding: 4px 10px;
                            border-radius: 20px;
                            font-size: 11px;
                            font-weight: 700;
                            text-transform: uppercase;
                            background: ${getActionColor(action)}20;
                            color: ${getActionColor(action)};
                        ">
                            ${action}
                        </span>
                        <span style="font-size: 12px; color: var(--text-secondary);">
                            ${log.resourceType || 'activity'}
                        </span>
                        ${log.severity ? `
                        <span class="severity-badge" style="
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 10px;
                            font-weight: 600;
                            background: ${getSeverityColor(log.severity)}20;
                            color: ${getSeverityColor(log.severity)};
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

                    ${isUserLog && log.device ? `
                        <p style="margin-top: 4px; font-size: 10px; color: var(--text-tertiary);">
                            📱 ${log.device.model || ''} (${log.device.os || ''} ${log.device.osVersion || ''})
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
     * Get color for action type
     */
    function getActionColor(action) {
        const colors = {
            create: '#22c55e',
            update: '#3b82f6',
            delete: '#ef4444',
            approve: '#10b981',
            reject: '#f59e0b',
            login: '#8b5cf6',
            logout: '#64748b',
            auth_login: '#8b5cf6',
            request_create: '#ef4444',
            donor_register: '#22c55e',
            error_occurred: '#ef4444'
        };
        return colors[action] || '#64748b';
    }

    /**
     * Get color for severity level
     */
    function getSeverityColor(severity) {
        const colors = {
            info: '#3b82f6',
            warning: '#f59e0b',
            error: '#ef4444',
            critical: '#dc2626'
        };
        return colors[severity] || '#64748b';
    }

    /**
     * Format admin audit log details
     */
    function formatAdminDetails(log) {
        const details = log.details || {};
        const action = log.action || 'unknown';

        const descriptions = {
            login: `Admin logged in from ${log.metadata?.platform || 'unknown platform'}`,
            logout: `Admin logged out`,
            create: `Created new ${log.resourceType || 'resource'}${details.name ? `: <strong>${details.name}</strong>` : ''}`,
            update: `Updated ${log.resourceType || 'resource'}`,
            delete: `Deleted ${log.resourceType || 'resource'}${details.name ? `: <strong>${details.name}</strong>` : ''}`,
            approve: `Approved ${log.resourceType || 'resource'}${details.reason ? ` - Reason: ${details.reason}` : ''}`,
            reject: `Rejected ${log.resourceType || 'resource'}${details.reason ? ` - Reason: ${details.reason}` : ''}`,
            warning: `⚠️ ${details.message || 'Warning event'}`,
            export: `Exported ${log.resourceType || 'data'}`
        };

        return descriptions[action] || `Action: ${action} on ${log.resourceType || 'resource'}`;
    }

    /**
     * Format user activity log details
     */
    function formatUserActivityDetails(log) {
        const activityType = log.activityType || 'unknown';
        const data = log.data || {};
        const user = log.user || {};

        const descriptions = {
            auth_login: `User logged in from mobile app`,
            auth_logout: `User logged out`,
            auth_register: `New user registered: ${user.email || 'Unknown'}`,
            request_create: `🩸 Blood request created: <strong>${data.bloodType || 'Unknown'}</strong> (${data.urgency || 'moderate'})`,
            request_accepted: `✅ Donor accepted blood request`,
            request_completed: `✅ Blood request completed`,
            donor_register: `New donor registered: Blood type ${data.bloodType || 'Unknown'}`,
            donor_accept_request: `🎯 Donor accepted a blood request`,
            referral_create: `🔗 Referral created for ${data.patientName || 'patient'}`,
            error_occurred: `❌ Error: ${data.error || 'Unknown error'}`,
            chat_send_message: `User sent a message in chat`
        };

        return descriptions[activityType] || `User activity: ${activityType}`;
    }

    /**
     * Update log statistics
     */
    async function updateLogStats() {
        try {
            if (!window.auditLogs) return;

            const logs = await window.auditLogs.getCombinedLogs();
            const now = new Date();
            const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            const recentLogs = logs.filter(l => {
                const ts = l.timestampISO ? new Date(l.timestampISO) : 
                          l.timestamp?.toDate ? l.timestamp.toDate() : null;
                return ts && ts > last24h;
            });

            const totalEl = document.getElementById('totalEvents');
            const userEl = document.getElementById('userActivities');
            const adminEl = document.getElementById('adminActions');
            const errorEl = document.getElementById('systemErrors');

            if (totalEl) totalEl.textContent = recentLogs.length;
            if (userEl) userEl.textContent = recentLogs.filter(l => l.logSource === 'user_app').length;
            if (adminEl) adminEl.textContent = recentLogs.filter(l => l.logSource === 'admin').length;
            if (errorEl) errorEl.textContent = recentLogs.filter(l => 
                l.severity === 'error' || l.action === 'error_occurred' || l.activityType === 'error_occurred'
            ).length;

            console.log('📊 Stats updated:', {
                total: recentLogs.length,
                user: userEl?.textContent,
                admin: adminEl?.textContent,
                errors: errorEl?.textContent
            });
        } catch (err) {
            console.error('❌ Error updating stats:', err);
        }
    }

    /**
     * Toggle user activity logs visibility
     */
    window.toggleUserLogs = async function () {
        state.includeUserLogs = !state.includeUserLogs;
        console.log(`📱 User logs ${state.includeUserLogs ? 'enabled' : 'disabled'}`);
        await window.loadSystemLogs(state.currentFilters);
    };

    /**
     * Apply filters
     */
    window.applyFilters = async function () {
        const actionFilter = document.getElementById('actionFilter')?.value || '';
        const resourceFilter = document.getElementById('resourceFilter')?.value || '';
        const severityFilter = document.getElementById('severityFilter')?.value || '';
        const userTypeFilter = document.getElementById('userTypeFilter')?.value || '';
        const userSearch = document.getElementById('userSearchFilter')?.value.trim() || '';

        const filters = {};
        if (actionFilter) filters.action = actionFilter;
        if (resourceFilter) filters.resourceType = resourceFilter;
        if (severityFilter) filters.severity = severityFilter;
        if (userTypeFilter) filters.userType = userTypeFilter;
        if (userSearch) filters.userSearch = userSearch;

        console.log('🔍 Applying filters:', filters);
        await window.loadSystemLogs(filters);
    };

    /**
     * Refresh logs
     */
    window.refreshLogs = async function () {
        console.log('🔄 Refreshing logs...');
        if (window.utils?.showNotification) {
            window.utils.showNotification('Refreshing system logs...', 'info');
        }
        await window.loadSystemLogs(state.currentFilters);
    };

    /**
     * Setup auto-refresh (every 60 seconds)
     */
    function setupAutoRefresh() {
        console.log('⏰ Setting up auto-refresh (60s interval)');
        setInterval(async () => {
            console.log('🔄 Auto-refreshing logs...');
            await window.loadSystemLogs(state.currentFilters);
        }, 60000); // 60 seconds
    }

    /**
     * Show error message
     */
    function showError(message) {
        const container = document.getElementById('logsUIContainer');
        if (container) {
            container.innerHTML = `
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

    console.log('✅ Super Admin System Logs Module loaded');

})();
