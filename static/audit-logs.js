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

            const emailKey = currentUser.email.replace(/\./g, ',');

            // Determine admin role
            let role = 'super_admin';
            const adminSnapshot = await database.ref(`admins/${emailKey}`).once('value');
            if (!adminSnapshot.exists()) {
                role = 'hospital_admin';
            }

            // Check if action is allowed for role
            if (!ROLE_ACTIONS[role].includes(action)) {
                console.warn(`Action ${action} not allowed for role ${role}`);
                return;
            }

            const auditEntry = {
                action: action,
                resourceType: resourceType,
                resourceId: resourceId || 'none',
                details: details || {},
                admin: {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    role: role,
                    hospitalName: window.hospitalData?.name || (role === 'hospital_admin' ? 'Associated Hospital' : 'Super Admin')
                },
                timestamp: firestore.FieldValue ? firestore.FieldValue.serverTimestamp() : firebase.firestore.FieldValue.serverTimestamp(),  // ✅ Logical time
                timestampISO: new Date().toISOString(),  // Fallback for sorting
                severity: severity,
                metadata: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    url: window.location.href,
                    ipAddress: 'client-side' // Would need backend for real IP
                }
            };

            // Store in Firestore under Platform/Super Admin collection
            if (role === 'super_admin') {
                await firestore.collection('audit_logs').add(auditEntry);
            } else {
                console.warn('Super Admin audit script called by non-super-admin. Log ignored to maintain siloing.');
                return;
            }

            // Also log to Realtime Database for real-time monitoring (Platform path)
            const rtbdRef = database.ref(`audit_logs/platform/${Date.now()}`);
            await rtbdRef.set({
                action: action,
                resourceType: resourceType,
                adminEmail: currentUser.email,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            if (AUDIT_CONFIG.developmentMode) {
                console.log('[AUDIT LOG]', action, resourceType, auditEntry);
            }

        } catch (error) {
            console.error('Failed to log audit event:', error);
            // Don't throw - audit logging should not break main functionality
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

            const emailKey = currentUser.email.replace(/\./g, ',');

            // Determine admin role
            let role = 'super_admin';
            const adminSnapshot = await database.ref(`admins/${emailKey}`).once('value');
            if (!adminSnapshot.exists()) {
                role = 'hospital_admin';
            }

            let query;
            if (role === 'super_admin') {
                // Super admins see ALL logs via collectionGroup (Platform + all Hospitals)
                query = firestore.collectionGroup('audit_logs')
                    .orderBy('timestamp', 'desc')
                    .limit(AUDIT_CONFIG.maxEntriesPerLoad);
            } else {
                console.warn('Unauthorized log fetch attempt');
                return [];
            }

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

    /**
     * Get user activity logs from mobile app
     * @param {object} filters - Filter options
     * @returns {Promise<Array>} Array of user activity logs
     */
    async function getUserActivityLogs(filters = {}) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return [];

            // Only super admin can view all user activity logs
            const emailKey = currentUser.email.replace(/\./g, ',');
            const adminSnapshot = await database.ref(`admins/${emailKey}`).once('value');
            if (!adminSnapshot.exists()) {
                console.warn('Hospital admins cannot view user activity logs');
                return [];
            }

            console.log('📱 Fetching user activity logs from mobile app...');

            let query = firestore.collection('user_activity_logs')
                .orderBy('timestamp', 'desc')
                .limit(AUDIT_CONFIG.maxEntriesPerLoad);

            // Apply filters
            if (filters.activityType) {
                query = query.where('activityType', '==', filters.activityType);
            }
            if (filters.userType) {
                query = query.where('user.userType', '==', filters.userType);
            }
            if (filters.severity) {
                query = query.where('severity', '==', filters.severity);
            }
            if (filters.startDate) {
                query = query.where('timestampISO', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('timestampISO', '<=', filters.endDate);
            }
            if (filters.userSearch) {
                query = query.where('user.email', '==', filters.userSearch);
            }

            const snapshot = await query.get();
            const logs = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                logs.push({
                    id: doc.id,
                    activityType: data.activityType,
                    user: data.user || {},
                    data: data.data || {},
                    timestamp: data.timestamp,
                    timestampISO: data.timestampISO,
                    severity: data.severity || 'info',
                    device: data.device || {},
                    metadata: data.metadata || {},
                    logSource: 'user_app', // Distinguish from admin logs
                    resourceType: getUserActivityResourceType(data.activityType),
                    action: data.activityType,
                    resourceId: data.user?.uid || 'none'
                });
            });

            console.log(`✅ Fetched ${logs.length} user activity logs`);
            return logs;

        } catch (error) {
            console.error('Failed to fetch user activity logs:', error);
            return [];
        }
    }

    /**
     * Map user activity types to resource types for filtering
     */
    function getUserActivityResourceType(activityType) {
        const resourceMap = {
            'auth_login': 'user',
            'auth_logout': 'user',
            'auth_register': 'user',
            'auth_password_reset': 'user',
            'profile_update': 'user',
            'profile_view': 'user',
            'profile_delete': 'user',
            'request_create': 'blood_request',
            'request_view': 'blood_request',
            'request_update': 'blood_request',
            'request_cancel': 'blood_request',
            'request_accepted': 'blood_request',
            'request_completed': 'blood_request',
            'donor_register': 'donor',
            'donor_verification_submit': 'donor',
            'donor_accept_request': 'donor',
            'donor_update_availability': 'donor',
            'search_donors': 'donor',
            'search_blood_banks': 'blood_bank',
            'view_nearby_requests': 'blood_request',
            'notification_view': 'notification',
            'notification_dismiss': 'notification',
            'chat_send_message': 'chat',
            'chat_view_conversation': 'chat',
            'referral_create': 'referral',
            'referral_view': 'referral',
            'referral_accept': 'referral',
            'app_open': 'system',
            'app_close': 'system',
            'feature_access': 'system',
            'error_occurred': 'system',
            'permission_granted': 'system',
            'permission_denied': 'system'
        };
        return resourceMap[activityType] || 'user_activity';
    }

    /**
     * Get combined logs (admin + user activity)
     * @param {object} filters - Filter options
     * @returns {Promise<Array>} Array of combined logs
     */
    async function getCombinedLogs(filters = {}) {
        try {
            const [adminLogs, userLogs] = await Promise.all([
                getAuditLogs(filters),
                getUserActivityLogs(filters)
            ]);

            // Combine and sort by timestamp
            const combined = [...adminLogs, ...userLogs];

            combined.sort((a, b) => {
                const timeA = new Date(a.timestampISO || 0);
                const timeB = new Date(b.timestampISO || 0);
                return timeB - timeA;
            });

            return combined.slice(0, AUDIT_CONFIG.maxEntriesPerLoad);

        } catch (error) {
            console.error('Failed to fetch combined logs:', error);
            return [];
        }
    }

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

            const detailsText = isUserLog ? formatUserActivityDetails(log) : formatAuditDetails(log);
            const userTitle = isUserLog ? (log.user?.email || 'Unknown User') : (log.admin?.email || 'Unknown Admin');
            const userSub = isUserLog ? (log.user?.userType || 'Mobile User') : (log.admin?.role || 'Admin');
            const hospitalName = log.admin?.hospitalName || (isUserLog ? '' : 'System');

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

        // Map activity types to readable descriptions - comprehensive list
        const activityDescriptions = {
            // Authentication
            'auth_login': `<strong>📱 Login</strong> - User logged in from mobile app${user.email ? ` (${user.email})` : ''}`,
            'auth_logout': `<strong>👋 Logout</strong> - User logged out`,
            'auth_register': `<strong>✨ New Registration</strong> - ${user.email || 'Unknown user'} registered`,
            'auth_password_reset': `<strong>🔑 Password Reset</strong> - Password reset requested`,

            // Profile
            'profile_view': `<strong>👁️ Profile View</strong> - User viewed their profile`,
            'profile_update': `<strong>✏️ Profile Update</strong> - User updated their profile information`,
            'profile_delete': `<strong>⚠️ Profile Deleted</strong> - User deleted their profile`,

            // Blood Requests
            'request_create': `<strong>🩸 Blood Request Created</strong> - Type: <strong>${data.bloodType || 'Unknown'}</strong>, Urgency: ${data.urgency || 'moderate'}${data.hospital ? ` at ${data.hospital}` : ''}`,
            'request_view': `<strong>👁️ Request Viewed</strong> - User viewed blood request details`,
            'request_update': `<strong>✏️ Request Updated</strong> - User updated their blood request`,
            'request_cancel': `<strong>❌ Request Cancelled</strong> - Blood request was cancelled`,
            'request_accepted': `<strong>✅ Request Accepted</strong> - Donor accepted the blood request`,
            'request_completed': `<strong>✅ Request Completed</strong> - Blood request completed successfully`,

            // Donor Activities
            'donor_register': `<strong>🩸 New Donor</strong> - Donor registered with blood type ${data.bloodType || 'Unknown'}`,
            'donor_verification_submit': `<strong>📄 Verification Submitted</strong> - Donor submitted verification documents`,
            'donor_accept_request': `<strong>🎯 Request Accepted</strong> - Donor accepted a blood request`,
            'donor_update_availability': `<strong>🔄 Availability Updated</strong> - Donor ${data.isAvailable ? 'marked as <strong>available</strong>' : 'marked as <strong>unavailable</strong>'}`,

            // Search & Discovery
            'search_donors': `<strong>🔍 Donor Search</strong> - User searched for donors${data.filters?.bloodType ? ` (Blood type: ${data.filters.bloodType})` : ''}`,
            'search_blood_banks': `<strong>🔍 Blood Bank Search</strong> - User searched for blood banks${data.location ? ` near ${data.location}` : ''}`,
            'view_nearby_requests': `<strong>📍 Nearby Requests</strong> - User viewed nearby blood requests`,

            // Notifications
            'notification_view': `<strong>🔔 Notification Viewed</strong> - User viewed notification`,
            'notification_dismiss': `<strong>✖️ Notification Dismissed</strong> - User dismissed notification`,

            // Chat
            'chat_send_message': `<strong>💬 Message Sent</strong> - User sent a message in chat`,
            'chat_view_conversation': `<strong>👁️ Chat Viewed</strong> - User viewed chat conversation`,

            // Referrals
            'referral_create': `<strong>🔗 Referral Created</strong> - For ${data.patientName || 'patient'} to ${data.targetHospital || 'Unknown hospital'}`,
            'referral_view': `<strong>👁️ Referral Viewed</strong> - User viewed referral details`,
            'referral_accept': `<strong>✅ Referral Accepted</strong> - Referral was accepted`,

            // System
            'app_open': `<strong>📲 App Opened</strong> - User opened the app`,
            'app_close': `<strong>📴 App Closed</strong> - User closed the app`,
            'feature_access': `<strong>🎯 Feature Access</strong> - User accessed: ${data.feature || 'Unknown feature'}`,
            'error_occurred': `<strong>❌ Error</strong> - ${data.error || 'Unknown error occurred'}`,
            'permission_granted': `<strong>✅ Permission Granted</strong> - User granted ${data.permission || 'Unknown'} permission`,
            'permission_denied': `<strong>⚠️ Permission Denied</strong> - User denied ${data.permission || 'Unknown'} permission`
        };

        return activityDescriptions[activityType] || `<strong>📱 Activity</strong> - ${activityType}`;
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

    /**
     * Toggle user activity logs
     */
    async function toggleUserLogs() {
        const currentPath = window.location.pathname;
        if (currentPath === '/system-logs') {
            window.location.href = '/audit-logs';
        } else {
            window.location.href = '/system-logs';
        }
    }

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
        getUserActivityLogs: getUserActivityLogs,
        getCombinedLogs: getCombinedLogs,
        render: renderAuditLogs,
        createUI: createAuditLogUI,
        toggleUserLogs: toggleUserLogs,
        applyFilters: applyFilters,
        refreshLogs: refreshLogs,
        config: AUDIT_CONFIG,
        actions: auditActions,
        ACTION_CATEGORIES: ACTION_CATEGORIES,
        RESOURCE_TYPES: RESOURCE_TYPES
    };

    console.log('✅ Audit Logging System initialized');

})();
