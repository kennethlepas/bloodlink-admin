/**
 * Admin Policies Module for BloodLink
 * Defines policies and guidelines for admin users
 * Development Mode - Policies are for guidance and will be enforced in production
 */

(function () {
    'use strict';

    // Admin Policies Configuration
    const ADMIN_POLICIES = {
        version: '1.0.0',
        lastUpdated: '2026-04-01',
        developmentMode: true,
        effectiveDate: '2026-04-01'
    };

    // Super Admin Policies
    const SUPER_ADMIN_POLICIES = [
        {
            id: 'sa-001',
            category: 'Access Control',
            icon: '🔐',
            title: 'Full System Access',
            description: 'Super Admins have unrestricted access to all system features, including user management, blood bank oversight, and platform-wide settings. This access should be used responsibly and only for legitimate administrative purposes.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'sa-002',
            category: 'Access Control',
            icon: '👥',
            title: 'User Management Authority',
            description: 'Super Admins can create, update, and delete user accounts. All user management actions are logged in the audit trail. Account deletions are permanent and should only be performed after careful consideration.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'sa-003',
            category: 'Data Management',
            icon: '🏥',
            title: 'Blood Bank Oversight',
            description: 'Super Admins can manage all blood bank registrations, update inventory records, and verify blood bank credentials. Regular audits of blood bank data should be conducted to ensure accuracy.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'sa-004',
            category: 'Security',
            icon: '🛡️',
            title: 'Verification Authority',
            description: 'Super Admins have the authority to verify or reject donor registrations and blood requests. Each verification decision should be based on proper documentation and established criteria.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'sa-005',
            category: 'Audit & Compliance',
            icon: '📊',
            title: 'Audit Log Access',
            description: 'Super Admins can view system-wide audit logs. Regular review of audit logs is recommended to detect unusual activity and ensure compliance with platform policies.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'sa-006',
            category: 'Hospital Management',
            icon: '🏨',
            title: 'Hospital Admin Oversight',
            description: 'Super Admins can create hospital admin accounts, assign facilities, and lock/unlock hospital accounts. Hospital admins are limited to their assigned facility data only.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'sa-007',
            category: 'Data Export',
            icon: '📤',
            title: 'Data Export Privileges',
            description: 'Super Admins can export platform data for reporting and analysis. Exported data should be handled securely and in compliance with data protection regulations.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'sa-008',
            category: 'System Configuration',
            icon: '⚙️',
            title: 'Platform Settings',
            description: 'Super Admins can modify platform-wide settings including blood type configurations, notification templates, and system parameters. Changes should be tested in development before production deployment.',
            enforcement: 'development',
            severity: 'high'
        }
    ];

    // Hospital Admin Policies
    const HOSPITAL_ADMIN_POLICIES = [
        {
            id: 'ha-001',
            category: 'Access Control',
            icon: '🏥',
            title: 'Facility-Limited Access',
            description: 'Hospital Admins have access only to their assigned hospital facility data. Cross-facility data access is restricted to protect patient privacy and data segregation.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'ha-002',
            category: 'Blood Requests',
            icon: '📋',
            title: 'Blood Request Management',
            description: 'Hospital Admins can create, update, and manage blood requests for their facility. All requests must include accurate patient information and urgency classification.',
            enforcement: 'development',
            severity: 'high'
        },
        {
            id: 'ha-003',
            category: 'Inventory Management',
            icon: '🩸',
            title: 'Inventory Updates',
            description: 'Hospital Admins can update their facility blood inventory levels. Regular inventory updates (at least daily) are required to ensure accurate availability information for donors and requesters.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'ha-004',
            category: 'Referrals',
            icon: '🔗',
            title: 'Patient Referrals',
            description: 'Hospital Admins can create patient referrals to other facilities when blood is unavailable. Referrals should include complete patient information and medical urgency details.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'ha-005',
            category: 'Communication',
            icon: '💬',
            title: 'Inter-Facility Communication',
            description: 'Hospital Admins can use the chat feature to coordinate with other facilities for blood transfers and referrals. All communications should be professional and patient-focused.',
            enforcement: 'development',
            severity: 'low'
        },
        {
            id: 'ha-006',
            category: 'Reports',
            icon: '📈',
            title: 'Facility Reports',
            description: 'Hospital Admins can generate reports for their facility activities including blood requests, inventory levels, and referral statistics. Reports can be exported for internal use.',
            enforcement: 'development',
            severity: 'low'
        },
        {
            id: 'ha-007',
            category: 'Account Security',
            icon: '🔒',
            title: 'Account Security',
            description: 'Hospital Admin accounts are locked after 3 failed login attempts. Contact Super Admin for account unlock. Use strong passwords and never share account credentials.',
            enforcement: 'production',
            severity: 'high'
        },
        {
            id: 'ha-008',
            category: 'Audit',
            icon: '📋',
            title: 'Activity Logging',
            description: 'All Hospital Admin actions are logged in facility-specific audit logs. Super Admin can review these logs for compliance and security monitoring.',
            enforcement: 'development',
            severity: 'medium'
        }
    ];

    // General Admin Policies (apply to all admins)
    const GENERAL_POLICIES = [
        {
            id: 'gen-001',
            category: 'Code of Conduct',
            icon: '📜',
            title: 'Professional Conduct',
            description: 'All admins must maintain professional conduct when using the platform. This includes respectful communication, timely response to requests, and adherence to platform guidelines.',
            enforcement: 'development',
            severity: 'medium'
        },
        {
            id: 'gen-002',
            category: 'Data Privacy',
            icon: '🔏',
            title: 'Patient Data Privacy',
            description: 'All admin users must handle patient and donor data with strict confidentiality. Personal information should only be accessed for legitimate administrative purposes.',
            enforcement: 'production',
            severity: 'critical'
        },
        {
            id: 'gen-003',
            category: 'Security',
            icon: '🔑',
            title: 'Account Security',
            description: 'Admins are responsible for maintaining the security of their accounts. This includes using strong passwords, not sharing credentials, and reporting suspicious activity immediately.',
            enforcement: 'production',
            severity: 'high'
        },
        {
            id: 'gen-004',
            category: 'Compliance',
            icon: '⚖️',
            title: 'Regulatory Compliance',
            description: 'All admin activities must comply with applicable healthcare regulations and data protection laws. This includes HIPAA, GDPR, and local healthcare regulations.',
            enforcement: 'production',
            severity: 'critical'
        },
        {
            id: 'gen-005',
            icon: '🚨',
            category: 'Incident Response',
            title: 'Security Incident Reporting',
            description: 'Any suspected security incidents, data breaches, or unauthorized access must be reported immediately to the Super Admin and relevant authorities as required by law.',
            enforcement: 'production',
            severity: 'critical'
        }
    ];

    /**
     * Render policies to a container element
     * @param {string} containerId - Container element ID
     * @param {string} role - Admin role: 'super_admin' or 'hospital_admin'
     */
    function renderPolicies(containerId, role) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let policies = [];
        
        // Add general policies
        policies = policies.concat(GENERAL_POLICIES);
        
        // Add role-specific policies
        if (role === 'super_admin') {
            policies = policies.concat(SUPER_ADMIN_POLICIES);
        } else if (role === 'hospital_admin') {
            policies = policies.concat(HOSPITAL_ADMIN_POLICIES);
        }

        // Group by category
        const grouped = {};
        policies.forEach(policy => {
            if (!grouped[policy.category]) {
                grouped[policy.category] = [];
            }
            grouped[policy.category].push(policy);
        });

        // Render
        container.innerHTML = `
            <div class="policies-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <span>📋</span>
                        <span>Admin Policies & Guidelines</span>
                    </h2>
                    ${ADMIN_POLICIES.developmentMode ? '<span class="policy-dev-badge">Development Mode</span>' : ''}
                </div>
                
                <div style="background: var(--info-light); border-left: 4px solid var(--info); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                        <strong>ℹ️ Note:</strong> These policies define the expected conduct and permissions for admin users. 
                        ${ADMIN_POLICIES.developmentMode ? 'Currently in development mode - enforcement will be enabled in production.' : 'These policies are actively enforced.'}
                    </p>
                </div>

                ${Object.entries(grouped).map(([category, categoryPolicies]) => `
                    <div class="policy-section">
                        <h3 class="policy-section-title">
                            <span>${getCategoryIcon(category)}</span>
                            <span>${category}</span>
                        </h3>
                        ${categoryPolicies.map(policy => renderPolicyItem(policy)).join('')}
                    </div>
                `).join('')}

                <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid var(--gray-100);">
                    <p style="font-size: 12px; color: var(--text-tertiary); text-align: center;">
                        Policy Version: ${ADMIN_POLICIES.version} | Last Updated: ${ADMIN_POLICIES.lastUpdated}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render a single policy item
     * @param {object} policy - Policy object
     * @returns {string} HTML string
     */
    function renderPolicyItem(policy) {
        return `
            <div class="policy-item" data-policy-id="${policy.id}">
                <div class="policy-item-header">
                    <span class="policy-item-icon">${policy.icon}</span>
                    <div>
                        <span class="policy-item-title">${policy.title}</span>
                        ${policy.enforcement === 'development' ? '<span class="policy-dev-badge">Dev</span>' : ''}
                    </div>
                </div>
                <p class="policy-item-description">${policy.description}</p>
            </div>
        `;
    }

    /**
     * Get icon for category
     * @param {string} category - Category name
     * @returns {string} Emoji icon
     */
    function getCategoryIcon(category) {
        const icons = {
            'Access Control': '🔐',
            'Data Management': '📊',
            'Security': '🛡️',
            'Audit & Compliance': '📋',
            'Hospital Management': '🏨',
            'Data Export': '📤',
            'System Configuration': '⚙️',
            'Blood Requests': '📋',
            'Inventory Management': '🩸',
            'Referrals': '🔗',
            'Communication': '💬',
            'Reports': '📈',
            'Account Security': '🔒',
            'Code of Conduct': '📜',
            'Data Privacy': '🔏',
            'Compliance': '⚖️',
            'Incident Response': '🚨'
        };
        return icons[category] || '📌';
    }

    /**
     * Check if action complies with policies
     * @param {string} role - Admin role
     * @param {string} action - Action to check
     * @returns {boolean} True if allowed
     */
    function checkPolicyCompliance(role, action) {
        // In development mode, always return true but log warnings
        if (ADMIN_POLICIES.developmentMode) {
            console.log('[POLICY CHECK]', role, action, '- Development mode, allowing');
            return true;
        }

        // In production, enforce policies
        const policies = role === 'super_admin' ? SUPER_ADMIN_POLICIES : HOSPITAL_ADMIN_POLICIES;
        const relevantPolicy = policies.find(p => 
            p.title.toLowerCase().includes(action.toLowerCase()) ||
            p.description.toLowerCase().includes(action.toLowerCase())
        );

        if (!relevantPolicy) {
            return true; // No specific policy, allow by default
        }

        return relevantPolicy.enforcement === 'production';
    }

    /**
     * Get policy by ID
     * @param {string} policyId - Policy ID
     * @param {string} role - Admin role
     * @returns {object|null} Policy object or null
     */
    function getPolicyById(policyId, role = null) {
        let allPolicies = GENERAL_POLICIES.concat(SUPER_ADMIN_POLICIES, HOSPITAL_ADMIN_POLICIES);
        
        if (role) {
            const rolePolicies = role === 'super_admin' ? SUPER_ADMIN_POLICIES : HOSPITAL_ADMIN_POLICIES;
            allPolicies = GENERAL_POLICIES.concat(rolePolicies);
        }

        return allPolicies.find(p => p.id === policyId) || null;
    }

    // Expose to window
    window.adminPolicies = {
        render: renderPolicies,
        checkCompliance: checkPolicyCompliance,
        getPolicyById: getPolicyById,
        config: ADMIN_POLICIES,
        SUPER_ADMIN: SUPER_ADMIN_POLICIES,
        HOSPITAL_ADMIN: HOSPITAL_ADMIN_POLICIES,
        GENERAL: GENERAL_POLICIES
    };

    console.log('✅ Admin Policies Module initialized');

})();
