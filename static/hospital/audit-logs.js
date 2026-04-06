/**
 * Audit Logging System for BloodLink Admin
 * Tracks all admin actions for both Super Admin and Hospital Admin
 * Customized logging based on admin role
 */

(function () {
    'use strict';

    // Audit Log Configuration
    const AUDIT_CONFIG = {
        enabled: true,
        maxEntriesPerLoad: 50,
        retentionDays: 90,
        developmentMode: true
    };

    // Action Categories
    const ACTION_CATEGORIES = {
        CREATE: 'create',
        UPDATE: 'update',
        DELETE: 'delete',
        LOGIN: 'login',
        LOGOUT: 'logout',
        APPROVE: 'approve',
        REJECT: 'reject',
        EXPORT: 'export',
        VIEW: 'view',
        WARNING: 'warning'
    };

    // Resource Types
    const RESOURCE_TYPES = {
        USER: 'user',
        DONOR: 'donor',
        REQUEST: 'blood_request',
        BLOOD_BANK: 'blood_bank',
        REVIEW: 'review',
        REFERRAL: 'referral',
        INVENTORY: 'inventory',
        VERIFICATION: 'verification',
        NOTIFICATION: 'notification',
        CHAT: 'chat',
        REPORT: 'report',
        HOSPITAL: 'hospital',
        SYSTEM: 'system',
        USER_ACTIVITY: 'user_activity' // New: User app activities
    };

    // Role-specific permissions for actions
    const ROLE_ACTIONS = {
        super_admin: [
            ACTION_CATEGORIES.CREATE,
            ACTION_CATEGORIES.UPDATE,
            ACTION_CATEGORIES.DELETE,
            ACTION_CATEGORIES.LOGIN,
            ACTION_CATEGORIES.LOGOUT,
            ACTION_CATEGORIES.APPROVE,
            ACTION_CATEGORIES.REJECT,
            ACTION_CATEGORIES.EXPORT,
            ACTION_CATEGORIES.VIEW,
            ACTION_CATEGORIES.WARNING
        ],
        hospital_admin: [
            ACTION_CATEGORIES.CREATE,
            ACTION_CATEGORIES.UPDATE,
            ACTION_CATEGORIES.LOGIN,
            ACTION_CATEGORIES.LOGOUT,
            ACTION_CATEGORIES.APPROVE,
            ACTION_CATEGORIES.REJECT,
            ACTION_CATEGORIES.VIEW
        ]
    };

    /**
     * Log an audit event
     * @param {string} action - The action performed
     * @param {string} resourceType - Type of resource affected
     * @param {string} resourceId - ID of the resource
     * @param {object} details - Additional details about the action
     * @param {string} severity - Severity level: 'info', 'warning', 'error'
     */
    async function logAuditEvent(action, resourceType, resourceId = null, details = {}, severity = 'info') {
        if (!AUDIT_CONFIG.enabled) return;

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            const hospital = window.hospitalData;
            if (!hospital) {
                console.warn('Cannot log audit event: Hospital context missing');
                return;
            }

            // Use the established hospital ID (Email Key) or fall back to facility code
            const hospitalId = hospital.id || hospital.facilityCode || currentUser.email.replace(/\./g, ',');
            const role = 'hospital_admin';

            const auditEntry = {
                action: action,
                resourceType: resourceType,
                resourceId: resourceId || 'none',
                details: details || {},
                admin: {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    role: role,
                    hospitalName: hospital.name || hospital.hospitalName || 'Hospital Admin',
                    hospitalId: hospitalId
                },
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                timestampISO: new Date().toISOString(),
                severity: severity,
                metadata: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    url: window.location.href,
                    ipAddress: 'client-side'
                }
            };

            // Hospital admin logs go to a subcollection under their hospital [STRICT SILOING]
            await firestore.collection('hospitals').doc(hospitalId)
                .collection('audit_logs').add(auditEntry);

            // Also log to Realtime Database for real-time monitoring (Siloed path)
            const rtbdRef = database.ref(`audit_logs/hospitals/${hospitalId}/${Date.now()}`);
            await rtbdRef.set({
                action: action,
                resourceType: resourceType,
                adminEmail: currentUser.email,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            if (AUDIT_CONFIG.developmentMode) {
                console.log('[HOSPITAL AUDIT LOG]', action, resourceType, auditEntry);
            }

        } catch (error) {
            console.error('Failed to log hospital audit event:', error);
        }
    }

    /**
     * Get audit logs for the current admin
     * @param {object} filters - Filter options
     * @returns {Promise<Array>} Array of audit log entries
     */
    async function getAuditLogs(filters = {}) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return [];

            const hospital = window.hospitalData;
            if (!hospital) {
                console.warn('Cannot fetch audit logs: Hospital context missing');
                return [];
            }

            const hospitalId = hospital.id || hospital.facilityCode || currentUser.email.replace(/\./g, ',');

            let query = firestore.collection('hospitals').doc(hospitalId)
                .collection('audit_logs')
                .orderBy('timestamp', 'desc')
                .limit(AUDIT_CONFIG.maxEntriesPerLoad);

            // Apply filters
            if (filters.userSearch) {
                // Search in admin email or resourceId
                query = query.where('admin.email', '==', filters.userSearch);
            }
            if (filters.action) {
                query = query.where('action', '==', filters.action);
            }
            if (filters.resourceType) {
                query = query.where('resourceType', '==', filters.resourceType);
            }
            if (filters.startDate) {
                query = query.where('timestampISO', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('timestampISO', '<=', filters.endDate);
            }

            const snapshot = await query.get();
            const logs = [];

            snapshot.forEach(doc => {
                logs.push({
                    id: doc.id,
                    ...doc.data(),
                    logSource: 'admin' // Distinguish from user activity logs
                });
            });

            return logs;

        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            return [];
        }
    }

    // Combined and User Activity logs removed for hospital context

    /**
     * Render audit logs to a container element
     * @param {string} containerId - ID of the container element
     * @param {Array} logs - Array of audit log entries
     */
    function renderAuditLogs(containerId, logs) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="audit-log-empty">
                    <div class="audit-log-empty-icon">📋</div>
                    <p>No audit logs found</p>
                    <p style="font-size: 12px; margin-top: 8px;">Audit logs will appear here as actions are performed</p>
                </div>
            `;
            return;
        }

        container.innerHTML = logs.map(log => {
            const isUserLog = log.logSource === 'user_app';
            const actionClass = log.action || log.activityType || 'info';
            const badgeClass = `audit-badge-${actionClass}`;
            const timestamp = log.timestampISO
                ? new Date(log.timestampISO).toLocaleString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : 'Unknown';

            const detailsText = formatAuditDetails(log);
            const userTitle = log.admin?.email || 'Unknown Admin';
            const userSub = log.admin?.role || 'Admin';
            const hospitalName = log.admin?.hospitalName || 'Associated Hospital';

            return `
                <div class="audit-log-entry ${actionClass}" style="border-left-color: ${isUserLog ? 'var(--info)' : ''}; padding-top: 15px;">
                    <div class="audit-log-entry-header" style="margin-bottom: 8px;">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="audit-log-user" style="font-size: 15px; font-weight: 700; color: var(--primary);">
                                ${userTitle}
                            </span>
                            <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase;">
                                ${userSub} ${hospitalName ? `• ${hospitalName}` : ''}
                            </span>
                        </div>
                        <span class="audit-log-timestamp">${timestamp}</span>
                    </div>
                    
                    <div class="audit-log-details" style="padding: 10px; background: rgba(0,0,0,0.02); border-radius: 8px;">
                        <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                            <span class="audit-badge ${badgeClass}" style="font-size: 10px; padding: 2px 8px; border-radius: 4px;">
                                ${log.action || log.activityType}
                            </span>
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                ${log.resourceType || 'activity'}
                            </span>
                        </div>
                        
                        <p style="font-size: 14px; line-height: 1.5; color: var(--text-secondary);">
                            ${detailsText}
                        </p>
                        
                        ${log.resourceId && log.resourceId !== 'none' ? `
                            <p style="margin-top: 8px; font-size: 11px; color: var(--text-tertiary); border-top: 1px dashed #ddd; padding-top: 4px;">
                                <span style="font-weight: 600;">ID:</span> ${log.resourceId}
                            </p>
                        ` : ''}
                        
                        ${isUserLog && log.device ? `
                            <p style="margin-top: 4px; font-size: 10px; color: var(--text-tertiary);">
                                📱 ${log.device.model} (${log.device.os} ${log.device.osVersion})
                            </p>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Format audit log details into readable text
     * @param {object} log - Audit log entry
     * @returns {string} Formatted details
     */
    function formatAuditDetails(log) {
        const details = log.details || {};

        switch (log.action) {
            case ACTION_CATEGORIES.LOGIN:
                return `Admin logged in from ${log.metadata?.platform || 'unknown platform'}`;
            case ACTION_CATEGORIES.LOGOUT:
                return `Admin logged out after session`;
            case ACTION_CATEGORIES.CREATE:
                return `Created new ${log.resourceType}${details.name ? `: <strong>${details.name}</strong>` : ''}`;
            case ACTION_CATEGORIES.UPDATE:
                return `Updated ${log.resourceType}${details.changes ? ` with changes` : ''}`;
            case ACTION_CATEGORIES.DELETE:
                return `Deleted ${log.resourceType}${details.name ? `: <strong>${details.name}</strong>` : ''}`;
            case ACTION_CATEGORIES.APPROVE:
                return `Approved ${log.resourceType}${details.reason ? ` - Reason: ${details.reason}` : ''}`;
            case ACTION_CATEGORIES.REJECT:
                return `Rejected ${log.resourceType}${details.reason ? ` - Reason: ${details.reason}` : ''}`;
            case ACTION_CATEGORIES.WARNING:
                return `⚠️ ${details.message || 'Warning event recorded'}`;
            default:
                return Object.entries(details).map(([key, value]) =>
                    `<strong>${key}:</strong> ${value}`
                ).join(', ');
        }
    }

    /**
     * Format user activity log details into readable text
     * @param {object} log - User activity log entry
     * @returns {string} Formatted details
     */
    function formatUserActivityDetails(log) {
        const activityType = log.activityType || 'unknown';
        const data = log.data || {};
        const user = log.user || {};

        // Map activity types to readable descriptions
        const activityDescriptions = {
            // Authentication
            'auth_login': `User logged in from mobile app`,
            'auth_logout': `User logged out`,
            'auth_register': `New user registered: ${user.email || 'Unknown'}`,
            'auth_password_reset': `Password reset requested`,

            // Profile
            'profile_view': `User viewed their profile`,
            'profile_update': `User updated their profile information`,
            'profile_delete': `⚠️ User deleted their profile`,

            // Blood Requests
            'request_create': `🩸 Blood request created: <strong>${data.bloodType}</strong> (${data.urgency || 'moderate'}) at ${data.hospital || 'Unknown hospital'}`,
            'request_view': `User viewed blood request details`,
            'request_update': `User updated their blood request`,
            'request_cancel': `Blood request cancelled`,
            'request_accepted': `✅ Donor accepted blood request`,
            'request_completed': `✅ Blood request completed successfully`,

            // Donor Activities
            'donor_register': `New donor registered: Blood type ${data.bloodType || 'Unknown'}`,
            'donor_verification_submit': `Donor submitted verification documents`,
            'donor_accept_request': `🎯 Donor accepted a blood request`,
            'donor_update_availability': `Donor ${data.isAvailable ? 'marked as available' : 'marked as unavailable'}`,

            // Search & Discovery
            'search_donors': `User searched for donors${data.filters?.bloodType ? ` (Blood type: ${data.filters.bloodType})` : ''}`,
            'search_blood_banks': `User searched for blood banks${data.location ? ` near ${data.location}` : ''}`,
            'view_nearby_requests': `User viewed nearby blood requests`,

            // Notifications
            'notification_view': `User viewed notification`,
            'notification_dismiss': `User dismissed notification`,

            // Chat
            'chat_send_message': `User sent a message in chat`,
            'chat_view_conversation': `User viewed chat conversation`,

            // Referrals
            'referral_create': `🔗 Referral created for ${data.patientName || 'patient'} to ${data.targetHospital || 'Unknown hospital'}`,
            'referral_view': `User viewed referral details`,
            'referral_accept': `✅ Referral accepted`,

            // System
            'app_open': `User opened the app`,
            'app_close': `User closed the app`,
            'feature_access': `User accessed feature: ${data.feature || 'Unknown'}`,
            'error_occurred': `❌ Error: ${data.error || 'Unknown error'}`,
            'permission_granted': `User granted ${data.permission || 'Unknown'} permission`,
            'permission_denied': `⚠️ User denied ${data.permission || 'Unknown'} permission`
        };

        return activityDescriptions[activityType] || `User activity: ${activityType}`;
    }

    /**
     * Create audit log UI component
     * @param {string} containerId - Container element ID
     * @param {boolean} showFilters - Whether to show filter controls
     * @param {boolean} includeUserLogs - Whether to include user activity logs
     */
    async function createAuditLogUI(containerId, showFilters = true, includeUserLogs = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="audit-log-container">
                <div class="audit-log-header">
                    <h3 class="audit-log-title">
                        <span>📜</span>
                        <span>${includeUserLogs ? 'System Logs (Admin + User Activity)' : 'Audit Logs'}</span>
                    </h3>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-secondary btn-small" onclick="window.auditLogs.toggleUserLogs()">
                            ${includeUserLogs ? '📱 Hide User Logs' : '📱 Show User Logs'}
                        </button>
                        <button class="btn-secondary btn-small" onclick="window.auditLogs.refreshLogs()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                ${showFilters ? `
                    <div class="audit-log-filters">
                        <select id="auditActionFilter" class="filter-select" onchange="window.auditLogs.applyFilters()">
                            <option value="">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                            <option value="warning">Warning</option>
                            ${includeUserLogs ? `
                                <optgroup label="User Activities">
                                    <option value="auth_login">User Login</option>
                                    <option value="request_create">Blood Request Created</option>
                                    <option value="donor_register">Donor Registered</option>
                                    <option value="donor_accept_request">Request Accepted</option>
                                    <option value="error_occurred">Errors</option>
                                </optgroup>
                            ` : ''}
                        </select>
                        <select id="auditResourceFilter" class="filter-select" onchange="window.auditLogs.applyFilters()">
                            <option value="">All Resources</option>
                            <option value="user">User</option>
                            <option value="donor">Donor</option>
                            <option value="blood_request">Blood Request</option>
                            <option value="blood_bank">Blood Bank</option>
                            <option value="review">Review</option>
                            <option value="inventory">Inventory</option>
                            <option value="verification">Verification</option>
                            <option value="hospital">Hospital</option>
                            ${includeUserLogs ? `
                                <option value="user_activity">User Activity</option>
                            ` : ''}
                        </select>
                        ${includeUserLogs ? `
                            <select id="auditSeverityFilter" class="filter-select" onchange="window.auditLogs.applyFilters()">
                                <option value="">All Severities</option>
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="error">Error</option>
                                <option value="critical">Critical</option>
                            </select>
                        ` : ''}
                        <div style="flex: 1; min-width: 200px; position: relative;">
                            <input type="text" id="auditUserSearch" class="form-control" placeholder="🔍 Search User Email..." 
                                style="border-radius: 8px; font-size: 13px;"
                                onkeyup="if(event.key === 'Enter') window.auditLogs.applyFilters()">
                        </div>
                    </div>
                ` : ''}
                <div id="auditLogsList">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading audit logs...</p>
                    </div>
                </div>
            </div>
        `;

        // Load initial logs
        const logs = includeUserLogs ? await getCombinedLogs() : await getAuditLogs();
        renderAuditLogs('auditLogsList', logs);
    }

    // toggleUserLogs removed for hospital context

    /**
     * Apply filters to audit logs
     */
    async function applyFilters() {
        const actionFilter = document.getElementById('auditActionFilter')?.value || '';
        const resourceFilter = document.getElementById('auditResourceFilter')?.value || '';
        const severityFilter = document.getElementById('auditSeverityFilter')?.value || '';
        const userSearch = document.getElementById('auditUserSearch')?.value.trim() || '';

        // Determine if we're on system logs page
        const includeUserLogs = window.location.pathname === '/system-logs';

        const filters = {};
        if (actionFilter) filters.action = actionFilter;
        if (resourceFilter) filters.resourceType = resourceFilter;
        if (severityFilter) filters.severity = severityFilter;
        if (userSearch) filters.userSearch = userSearch;

        const container = document.getElementById('auditLogsList');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Filtering ${includeUserLogs ? 'system' : 'audit'} logs...</p>
                </div>
            `;
        }

        const logs = includeUserLogs ?
            await getCombinedLogs(filters) :
            await getAuditLogs(filters);
        renderAuditLogs('auditLogsList', logs);
    }

    /**
     * Refresh audit logs
     */
    async function refreshLogs() {
        if (window.utils) {
            window.utils.showNotification('Refreshing logs...', 'info');
        }

        const includeUserLogs = window.location.pathname === '/system-logs';
        const logs = includeUserLogs ? await getCombinedLogs() : await getAuditLogs();
        renderAuditLogs('auditLogsList', logs);

        if (window.utils) {
            window.utils.showNotification('Logs refreshed!', 'success');
        }
    }

    // Convenience functions for common audit actions
    const auditActions = {
        // Authentication
        login: () => logAuditEvent(ACTION_CATEGORIES.LOGIN, RESOURCE_TYPES.SYSTEM, null, {}, 'info'),
        logout: () => logAuditEvent(ACTION_CATEGORIES.LOGOUT, RESOURCE_TYPES.SYSTEM, null, {}, 'info'),

        // User Management
        createUser: (userId, details) => logAuditEvent(ACTION_CATEGORIES.CREATE, RESOURCE_TYPES.USER, userId, details, 'info'),
        updateUser: (userId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.USER, userId, details, 'info'),
        deleteUser: (userId, details) => logAuditEvent(ACTION_CATEGORIES.DELETE, RESOURCE_TYPES.USER, userId, details, 'warning'),

        // Donor Management
        verifyDonor: (donorId, details) => logAuditEvent(ACTION_CATEGORIES.APPROVE, RESOURCE_TYPES.DONOR, donorId, details, 'info'),
        rejectDonor: (donorId, details) => logAuditEvent(ACTION_CATEGORIES.REJECT, RESOURCE_TYPES.DONOR, donorId, details, 'warning'),

        // Blood Request Management
        approveRequest: (requestId, details) => logAuditEvent(ACTION_CATEGORIES.APPROVE, RESOURCE_TYPES.REQUEST, requestId, details, 'info'),
        rejectRequest: (requestId, details) => logAuditEvent(ACTION_CATEGORIES.REJECT, RESOURCE_TYPES.REQUEST, requestId, details, 'warning'),
        updateRequest: (requestId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.REQUEST, requestId, details, 'info'),
        createBroadcastRequest: (requestId, details) => logAuditEvent(ACTION_CATEGORIES.CREATE, RESOURCE_TYPES.REQUEST, requestId, details, 'info'),
        cancelBroadcast: (requestId, details) => logAuditEvent(ACTION_CATEGORIES.DELETE, RESOURCE_TYPES.REQUEST, requestId, details, 'warning'),

        // Blood Bank Management
        createBloodBank: (bankId, details) => logAuditEvent(ACTION_CATEGORIES.CREATE, RESOURCE_TYPES.BLOOD_BANK, bankId, details, 'info'),
        updateBloodBank: (bankId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.BLOOD_BANK, bankId, details, 'info'),
        deleteBloodBank: (bankId, details) => logAuditEvent(ACTION_CATEGORIES.DELETE, RESOURCE_TYPES.BLOOD_BANK, bankId, details, 'warning'),

        // Inventory Management
        updateInventory: (bankId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.INVENTORY, bankId, details, 'info'),

        // Review Management
        approveReview: (reviewId, details) => logAuditEvent(ACTION_CATEGORIES.APPROVE, RESOURCE_TYPES.REVIEW, reviewId, details, 'info'),
        rejectReview: (reviewId, details) => logAuditEvent(ACTION_CATEGORIES.REJECT, RESOURCE_TYPES.REVIEW, reviewId, details, 'warning'),
        deleteReview: (reviewId, details) => logAuditEvent(ACTION_CATEGORIES.DELETE, RESOURCE_TYPES.REVIEW, reviewId, details, 'warning'),

        // Hospital Management (Super Admin only)
        createHospital: (hospitalId, details) => logAuditEvent(ACTION_CATEGORIES.CREATE, RESOURCE_TYPES.HOSPITAL, hospitalId, details, 'info'),
        updateHospital: (hospitalId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.HOSPITAL, hospitalId, details, 'info'),
        lockHospital: (hospitalId, details) => logAuditEvent(ACTION_CATEGORIES.UPDATE, RESOURCE_TYPES.HOSPITAL, hospitalId, details, 'warning'),

        // Export actions
        exportData: (resourceType, details) => logAuditEvent(ACTION_CATEGORIES.EXPORT, resourceType, null, details, 'info'),

        // Warning events
        logWarning: (resourceType, details) => logAuditEvent(ACTION_CATEGORIES.WARNING, resourceType, null, details, 'warning')
    };

    // Expose to window
    window.auditLogs = {
        log: logAuditEvent,
        get: getAuditLogs,
        render: renderAuditLogs,
        createUI: createAuditLogUI,
        applyFilters: applyFilters,
        refreshLogs: refreshLogs,
        config: AUDIT_CONFIG,
        actions: auditActions,
        ACTION_CATEGORIES: ACTION_CATEGORIES,
        RESOURCE_TYPES: RESOURCE_TYPES
    };

    console.log('✅ Audit Logging System initialized');

})();
