// Blood Requests Management Module
(function () {
    'use strict';

    // State
    let requests = [];

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('requestsTableBody'),
        searchInput: document.getElementById('requestsSearch'),
        statusFilter: document.getElementById('requestStatusFilter'),
        bloodTypeFilter: document.getElementById('requestBloodTypeFilter'),
        urgencyFilter: document.getElementById('urgencyFilter'),
        detailsModal: document.getElementById('requestDetailsModal'),
        detailsContent: document.getElementById('requestDetailsContent'),
        requestActions: document.getElementById('requestActions'),
        closeModal: document.getElementById('closeRequestModal')
    };

    // Initialize
    window.initializePage = function () {
        console.log('Initializing blood requests page...');
        loadRequests();
        setupEventListeners();
    };

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', window.utils.debounce(renderRequests, 300));
        }

        // Filter functionality
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', renderRequests);
        }
        if (elements.bloodTypeFilter) {
            elements.bloodTypeFilter.addEventListener('change', renderRequests);
        }
        if (elements.urgencyFilter) {
            elements.urgencyFilter.addEventListener('change', renderRequests);
        }

        // Modal close
        if (elements.closeModal) {
            elements.closeModal.addEventListener('click', closeModal);
        }
        if (elements.detailsModal) {
            elements.detailsModal.addEventListener('click', (e) => {
                if (e.target === elements.detailsModal) {
                    closeModal();
                }
            });
        }
    }

    // Load blood requests data
    function loadRequests() {
        firestore.collection('bloodRequests').onSnapshot(snapshot => {
            requests = [];

            snapshot.forEach(doc => {
                requests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('Blood requests loaded:', requests.length);
            renderRequests();
        }, error => {
            console.error('Error loading blood requests:', error);
            window.utils.showNotification('Error loading blood requests', 'error');
        });
    }

    // Render requests table
    function renderRequests() {
        if (!elements.tableBody) return;

        const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
        const statusFilter = elements.statusFilter ? elements.statusFilter.value : 'all';
        const bloodTypeFilter = elements.bloodTypeFilter ? elements.bloodTypeFilter.value : 'all';
        const urgencyFilter = elements.urgencyFilter ? elements.urgencyFilter.value : 'all';

        // Filter requests
        let filtered = requests;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(request => {
                const requesterName = request.requesterName || '';
                const patientName = request.patientName || '';
                const hospital = request.hospitalName || '';
                const bloodType = request.bloodType || '';

                return requesterName.toLowerCase().includes(searchTerm) ||
                    patientName.toLowerCase().includes(searchTerm) ||
                    hospital.toLowerCase().includes(searchTerm) ||
                    bloodType.toLowerCase().includes(searchTerm);
            });
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(request => request.status === statusFilter);
        }

        // Apply blood type filter
        if (bloodTypeFilter !== 'all') {
            filtered = filtered.filter(request => request.bloodType === bloodTypeFilter);
        }

        // Apply urgency filter
        if (urgencyFilter !== 'all') {
            filtered = filtered.filter(request => request.urgency === urgencyFilter);
        }

        // Render table
        if (filtered.length === 0) {
            const message = requests.length === 0
                ? 'No blood requests found'
                : 'No requests matching your filters';

            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <div class="empty-state-icon">🩸</div>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by urgency (critical first), then by date
        filtered.sort((a, b) => {
            const urgencyOrder = { 'critical': 0, 'urgent': 1, 'normal': 2 };
            const urgencyA = urgencyOrder[a.urgency] || 3;
            const urgencyB = urgencyOrder[b.urgency] || 3;

            if (urgencyA !== urgencyB) {
                return urgencyA - urgencyB;
            }

            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        elements.tableBody.innerHTML = filtered.map(request => {
            const requesterName = request.requesterName || 'N/A';
            const patientName = request.patientName || 'N/A';
            const bloodType = request.bloodType || 'N/A';
            const units = request.unitsNeeded || 0;
            const hospital = request.hospitalName || 'N/A';
            const urgency = request.urgency || 'normal';
            const status = request.status || 'pending';
            const date = request.createdAt ? window.utils.formatDate(new Date(request.createdAt)) : 'N/A';

            const bloodTypeClass = window.utils.getBloodTypeClass(bloodType);
            const statusClass = getStatusClass(status);
            const urgencyClass = getUrgencyClass(urgency);

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                                ${requesterName.charAt(0).toUpperCase()}
                            </div>
                            <strong>${requesterName}</strong>
                        </div>
                    </td>
                    <td>${patientName}</td>
                    <td>
                        <span class="blood-type-badge ${bloodTypeClass}">
                            ${bloodType}
                        </span>
                    </td>
                    <td>
                        <span style="font-weight: 700; color: #DC2626;">${units}</span>
                        ${units === 1 ? 'unit' : 'units'}
                    </td>
                    <td>${hospital}</td>
                    <td>
                        <span class="status-badge ${urgencyClass}">
                            ${getUrgencyEmoji(urgency)} ${urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                        </span>
                    </td>
                    <td>${date}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn action-btn-edit" onclick="window.viewRequestDetails('${request.id}')">
                            👁️ View
                        </button>
                        ${status === 'pending' ? `
                            <button class="action-btn action-btn-success" onclick="window.approveRequest('${request.id}', '${patientName}')">
                                ✅ Approve
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Get status CSS class
    function getStatusClass(status) {
        const statusClasses = {
            'pending': 'status-pending',
            'approved': 'status-verified',
            'completed': 'status-verified',
            'cancelled': 'status-critical'
        };
        return statusClasses[status] || 'status-pending';
    }

    // Get urgency CSS class
    function getUrgencyClass(urgency) {
        const urgencyClasses = {
            'critical': 'status-critical',
            'urgent': 'status-urgent',
            'normal': 'status-moderate'
        };
        return urgencyClasses[urgency] || 'status-moderate';
    }

    // Get urgency emoji
    function getUrgencyEmoji(urgency) {
        const emojis = {
            'critical': '🚨',
            'urgent': '⚠️',
            'normal': 'ℹ️'
        };
        return emojis[urgency] || 'ℹ️';
    }

    // View request details
    window.viewRequestDetails = function (requestId) {
        const request = requests.find(r => r.id === requestId);
        if (!request) return;

        const bloodTypeClass = window.utils.getBloodTypeClass(request.bloodType);
        const statusClass = getStatusClass(request.status);
        const urgencyClass = getUrgencyClass(request.urgency);
        const date = request.createdAt ? window.utils.formatDate(new Date(request.createdAt)) : 'N/A';

        elements.detailsContent.innerHTML = `
            <div style="display: grid; gap: 24px;">
                <div style="background: var(--gray-50); padding: 20px; border-radius: var(--border-radius); border: 2px solid var(--gray-200);">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">Request Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Requester</div>
                            <div style="font-weight: 600;">${request.requesterName || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Patient Name</div>
                            <div style="font-weight: 600;">${request.patientName || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Blood Type</div>
                            <span class="blood-type-badge ${bloodTypeClass}">${request.bloodType || 'N/A'}</span>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Units Needed</div>
                            <div style="font-weight: 700; font-size: 20px; color: #DC2626;">${request.unitsNeeded || 0}</div>
                        </div>
                    </div>
                </div>

                <div style="background: var(--gray-50); padding: 20px; border-radius: var(--border-radius); border: 2px solid var(--gray-200);">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">Hospital Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Hospital Name</div>
                            <div style="font-weight: 600;">${request.hospitalName || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Location</div>
                            <div style="font-weight: 600;">${request.hospitalLocation || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Contact</div>
                            <div style="font-weight: 600;">${request.contactNumber || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div style="background: var(--gray-50); padding: 20px; border-radius: var(--border-radius); border: 2px solid var(--gray-200);">
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">Request Status</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Status</div>
                            <span class="status-badge ${statusClass}">${(request.status || 'pending').charAt(0).toUpperCase() + (request.status || 'pending').slice(1)}</span>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Urgency</div>
                            <span class="status-badge ${urgencyClass}">${getUrgencyEmoji(request.urgency)} ${(request.urgency || 'normal').charAt(0).toUpperCase() + (request.urgency || 'normal').slice(1)}</span>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Request Date</div>
                            <div style="font-weight: 600;">${date}</div>
                        </div>
                    </div>
                </div>

                ${request.reason ? `
                    <div style="background: var(--gray-50); padding: 20px; border-radius: var(--border-radius); border: 2px solid var(--gray-200);">
                        <h3 style="margin-bottom: 8px; color: var(--text-primary);">Reason for Request</h3>
                        <p style="color: var(--text-secondary); line-height: 1.6;">${request.reason}</p>
                    </div>
                ` : ''}
            </div>
        `;

        // Populate action buttons
        if (request.status === 'pending') {
            elements.requestActions.innerHTML = `
                <button class="btn-primary" onclick="window.approveRequest('${request.id}', '${request.patientName}'); window.closeRequestModal();">
                    ✅ Approve Request
                </button>
                <button class="btn-secondary" onclick="window.rejectRequest('${request.id}', '${request.patientName}'); window.closeRequestModal();">
                    ❌ Reject Request
                </button>
                <button class="btn-secondary" onclick="window.closeRequestModal();">
                    Close
                </button>
            `;
        } else {
            elements.requestActions.innerHTML = `
                <button class="btn-secondary" onclick="window.closeRequestModal();">
                    Close
                </button>
            `;
        }

        // Show modal
        elements.detailsModal.classList.add('modal');
        elements.detailsModal.style.display = 'flex';
        setTimeout(() => {
            elements.detailsModal.style.opacity = '1';
        }, 10);
    };

    // Close modal
    function closeModal() {
        if (elements.detailsModal) {
            elements.detailsModal.style.opacity = '0';
            setTimeout(() => {
                elements.detailsModal.style.display = 'none';
            }, 300);
        }
    }
    window.closeRequestModal = closeModal;

    // Approve request
    window.approveRequest = async function (requestId, patientName) {
        if (!window.utils.confirmAction(`Are you sure you want to approve the blood request for ${patientName}?`)) {
            return;
        }

        try {
            await firestore.collection('bloodRequests').doc(requestId).update({
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: auth.currentUser.email
            });

            window.utils.showNotification(`Request for ${patientName} approved successfully`, 'success');
        } catch (error) {
            console.error('Error approving request:', error);
            window.utils.showNotification('Failed to approve request', 'error');
        }
    };

    // Reject request
    window.rejectRequest = async function (requestId, patientName) {
        const reason = prompt(`Please provide a reason for rejecting the blood request for ${patientName}:`);
        if (!reason) return;

        try {
            await firestore.collection('bloodRequests').doc(requestId).update({
                status: 'cancelled',
                rejectedAt: new Date().toISOString(),
                rejectedBy: auth.currentUser.email,
                rejectionReason: reason
            });

            window.utils.showNotification(`Request for ${patientName} rejected`, 'success');
        } catch (error) {
            console.error('Error rejecting request:', error);
            window.utils.showNotification('Failed to reject request', 'error');
        }
    };

})();