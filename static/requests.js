// ==================== BLOOD REQUESTS MANAGEMENT ====================

let allRequests = [];
let currentRequestId = null;

// Initialize the page
window.initializePage = async function () {
    console.log('Initializing blood requests page...');
    setupEventListeners();
    await loadBloodRequests();
};

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('requestsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterRequests);
    }

    // Status filter
    const statusFilter = document.getElementById('requestStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterRequests);
    }

    // Blood type filter
    const bloodTypeFilter = document.getElementById('requestBloodTypeFilter');
    if (bloodTypeFilter) {
        bloodTypeFilter.addEventListener('change', filterRequests);
    }

    // Urgency filter
    const urgencyFilter = document.getElementById('urgencyFilter');
    if (urgencyFilter) {
        urgencyFilter.addEventListener('change', filterRequests);
    }

    // Modal close buttons
    const closeModal = document.getElementById('closeRequestModal');
    if (closeModal) {
        closeModal.addEventListener('click', closeRequestModal);
    }

    const closeRejectModal = document.getElementById('closeRejectModal');
    if (closeRejectModal) {
        closeRejectModal.addEventListener('click', closeRejectModal);
    }

    const cancelRejectBtn = document.getElementById('cancelRejectBtn');
    if (cancelRejectBtn) {
        cancelRejectBtn.addEventListener('click', closeRejectModal);
    }

    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener('click', confirmRejectRequest);
    }

    // Click outside modal to close
    const modalOverlay = document.getElementById('requestDetailsModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeRequestModal();
        });
    }

    const rejectModal = document.getElementById('rejectRequestModal');
    if (rejectModal) {
        rejectModal.addEventListener('click', (e) => {
            if (e.target === rejectModal) closeRejectModal();
        });
    }
}

// Load blood requests from API
async function loadBloodRequests() {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    // Show loading skeleton
    tbody.innerHTML = `
        ${Array(5).fill().map(() => `
            <tr class="skeleton-row">
                <td><div class="skeleton-text" style="width: 80px;"></div></td>
                <td><div class="skeleton-text" style="width: 120px;"></div></td>
                <td><div class="skeleton-text" style="width: 60px;"></div></td>
                <td><div class="skeleton-text" style="width: 40px;"></div></td>
                <td><div class="skeleton-text" style="width: 150px;"></div></td>
                <td><div class="skeleton-text" style="width: 70px;"></div></td>
                <td><div class="skeleton-text" style="width: 90px;"></div></td>
                <td><div class="skeleton-text" style="width: 80px;"></div></td>
                <td><div class="skeleton-text" style="width: 100px;"></div></td>
            </tr>
        `).join('')}
    `;

    try {
        // Fetch from Firebase
        const requests = await fetchBloodRequestsFromFirebase();
        allRequests = requests;
        updateStats(requests);
        renderRequests(requests);
    } catch (error) {
        console.error('Error loading blood requests:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Error loading requests: ${error.message}</p>
                    <button class="btn-primary" onclick="window.initializePage()" style="margin-top: 16px;">Retry</button>
                </td>
            </tr>
        `;
    }
}

// Fetch blood requests from Firebase
async function fetchBloodRequestsFromFirebase() {
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) return [];
        const db = firebase.firestore();
        const requestsRef = db.collection('bloodRequests');

        // Use global hospitalData set by hospital/base.html
        const hospital = window.hospitalData;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        if (hospital || (user && user.role === 'hospital_admin')) {
            const currentFac = hospital || user;
            const hospitalId = currentFac.id || currentFac.hospitalId || auth.currentUser?.uid;
            const facilityCode = currentFac.facilityCode || currentFac.code;
            const email = currentFac.email;
            const name = currentFac.name || currentFac.hospitalName;

            console.log('Fetching requests for hospital:', { name, facilityCode, email });

            const queries = [];
            // Match by any possible identifier in the request document
            if (name) queries.push(requestsRef.where('hospitalName', '==', name).get());
            if (facilityCode) queries.push(requestsRef.where('hospitalCode', '==', facilityCode).get());
            if (hospitalId) queries.push(requestsRef.where('hospitalId', '==', hospitalId).get());
            if (email) queries.push(requestsRef.where('hospitalEmail', '==', email).get());

            if (queries.length === 0) return [];

            const snapshots = await Promise.all(queries);
            const results = new Map();
            snapshots.forEach(s => s.forEach(doc => {
                const data = doc.data();
                results.set(doc.id, { id: doc.id, ...data });
            }));

            return Array.from(results.values()).map(data => ({
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                expiresAt: data.expiresAt?.toDate?.() || new Date(data.expiresAt)
            })).sort((a, b) => b.createdAt - a.createdAt);
        }

        // Super Admin: Fetch all requests (showing both verified and unverified)
        const snapshot = await requestsRef.orderBy('createdAt', 'desc').limit(200).get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id, ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                expiresAt: data.expiresAt?.toDate?.() || new Date(data.expiresAt)
            };
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        return [];
    }
}

// Update statistics cards
function updateStats(requests) {
    const counts = { total: requests.length, pending: 0, approved: 0, accepted: 0, completed: 0 };
    requests.forEach(r => { if (counts.hasOwnProperty(r.status)) counts[r.status]++; });

    ['total', 'pending', 'approved', 'accepted', 'completed'].forEach(s => {
        const el = document.getElementById(s + 'Requests');
        if (el) el.textContent = counts[s] || (s === 'total' ? counts.total : 0);
    });
}

// Filter and render requests
function filterRequests() {
    const search = document.getElementById('requestsSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('requestStatusFilter')?.value || 'all';
    const bType = document.getElementById('requestBloodTypeFilter')?.value || 'all';
    const urgency = document.getElementById('urgencyFilter')?.value || 'all';

    const filtered = allRequests.filter(r => {
        const matchSearch = !search || [r.requesterName, r.patientName, r.hospitalName, r.bloodType, r.id].some(f => (f || '').toLowerCase().includes(search));
        const matchStatus = status === 'all' || r.status === status;
        const matchType = bType === 'all' || r.bloodType === bType;
        const matchUrgency = urgency === 'all' || r.urgencyLevel === urgency;
        return matchSearch && matchStatus && matchType && matchUrgency;
    });

    renderRequests(filtered);
}

// Render requests in table
function renderRequests(requests) {
    const tbody = document.getElementById('requestsTableBody');
    const thead = document.querySelector('.data-table thead tr');
    if (!tbody || !thead) return;

    // Detect available columns
    const columns = Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim());
    const hasHospital = columns.some(c => c.includes('Hospital'));
    const hasDate = columns.some(c => c.includes('Date'));
    const colCount = columns.length;

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-state">No blood requests found.</td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(request => `
        <tr class="request-row ${request.urgencyLevel === 'critical' ? 'critical-row' : ''}" onclick="viewRequestDetails('${request.id}')">
            <td><span class="request-id">${request.id.slice(-8).toUpperCase()}</span></td>
            <td>
                <div class="patient-info">
                    <span class="patient-name">${escapeHtml(request.patientName || 'N/A')}</span>
                    <span class="requester-name">By: ${escapeHtml(request.requesterName || 'N/A')}</span>
                </div>
            </td>
            <td><span class="blood-type-badge ${getBloodTypeClass(request.bloodType)}">${request.bloodType || '—'}</span></td>
            <td><span class="units-needed">${request.unitsNeeded || request.units || 0}</span> <span class="units-label">units</span></td>
            ${hasHospital ? `<td><div class="hospital-info">🏠 ${escapeHtml(request.hospitalName || 'N/A')}</div></td>` : ''}
            <td><span class="urgency-badge urgency-${request.urgencyLevel}">${(request.urgencyLevel || 'moderate').toUpperCase()}</span></td>
            ${hasDate ? `<td><div class="date-display">${formatDate(request.createdAt)}</div></td>` : ''}
            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
            <td onclick="event.stopPropagation()">
                <div class="action-buttons">
                    <button class="action-btn btn-view" onclick="viewRequestDetails('${request.id}')" title="View Details">👁️</button>
                    ${request.status === 'pending' ? `
                        <button class="action-btn btn-accept" onclick="acceptRequest('${request.id}')" title="Accept">✅</button>
                        <button class="action-btn btn-reject" onclick="showRejectModal('${request.id}')" title="Reject">❌</button>
                    ` : ''}
                    <button class="action-btn btn-chat" onclick="startChatWithUser('${request.requesterId}', '${escapeHtml(request.requesterName || 'Requester')}')" title="Chat with Requester">💬</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Clear all filters
window.clearFilters = function () {
    const searchInput = document.getElementById('requestsSearch');
    const statusFilter = document.getElementById('requestStatusFilter');
    const bloodTypeFilter = document.getElementById('requestBloodTypeFilter');
    const urgencyFilter = document.getElementById('urgencyFilter');

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (bloodTypeFilter) bloodTypeFilter.value = 'all';
    if (urgencyFilter) urgencyFilter.value = 'all';

    filterRequests();
};

// View request details
window.viewRequestDetails = async function (requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    currentRequestId = requestId;

    const modal = document.getElementById('requestDetailsModal');
    const content = document.getElementById('requestDetailsContent');
    const subtitle = document.getElementById('requestModalSubtitle');
    const actions = document.getElementById('requestModalActions');

    if (!modal || !content) return;

    if (subtitle) {
        subtitle.textContent = `Request ID: ${request.id}`;
    }

    // Render request details
    content.innerHTML = `
        <div class="request-details-grid">
            <div class="detail-section">
                <div class="detail-section-title">
                    <span>👤</span> Patient Information
                </div>
                <div class="detail-row">
                    <span class="detail-label">Patient Name</span>
                    <span class="detail-value">${escapeHtml(request.patientName || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Blood Type</span>
                    <span class="detail-value blood-type">${request.bloodType || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Units Needed</span>
                    <span class="detail-value units">${request.unitsNeeded || 0}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Diagnosis</span>
                    <span class="detail-value">${escapeHtml(request.diagnosis || 'N/A')}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-section-title">
                    <span>🏥</span> Hospital Information
                </div>
                <div class="detail-row">
                    <span class="detail-label">Hospital</span>
                    <span class="detail-value">${escapeHtml(request.hospitalName || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${escapeHtml(request.hospitalAddress || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Doctor</span>
                    <span class="detail-value">${escapeHtml(request.doctorName || 'N/A')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Requester</span>
                    <span class="detail-value">${escapeHtml(request.requesterName || 'N/A')}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-section-title">
                    <span>⚡</span> Request Details
                </div>
                <div class="detail-row">
                    <span class="detail-label">Urgency Level</span>
                    <span class="detail-value">
                        <span class="urgency-indicator urgency-${request.urgencyLevel}">
                            ${getUrgencyIcon(request.urgencyLevel)} ${(request.urgencyLevel || 'moderate').toUpperCase()}
                        </span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">
                        <span class="status-badge status-${request.status}">${request.status}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${formatDateTime(request.createdAt)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Expires</span>
                    <span class="detail-value ${isExpired(request.expiresAt) ? 'text-bold-danger' : ''}">
                        ${formatDateTime(request.expiresAt)}
                        ${isExpired(request.expiresAt) ? ' (Expired)' : ''}
                    </span>
                </div>
            </div>
            
            ${request.notes ? `
                <div class="detail-section">
                    <div class="detail-section-title">
                        <span>📝</span> Additional Notes
                    </div>
                    <div class="detail-row">
                        <span class="detail-value" style="text-align: left; max-width: 100%;">${escapeHtml(request.notes)}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Render action buttons
    if (request.status === 'pending') {
        actions.innerHTML = `
            <button class="btn-primary btn-accept" onclick="acceptRequest('${request.id}')">✅ Accept Request</button>
            <button class="btn-danger" onclick="showRejectModal('${request.id}')">❌ Reject Request</button>
            <button class="btn-secondary" onclick="startChatWithUser('${request.requesterId}', '${escapeHtml(request.requesterName || 'Requester')}')">💬 Chat with Requester</button>
            <button class="btn-secondary" onclick="closeRequestModal()">Close</button>
        `;
    } else {
        actions.innerHTML = `
            <button class="btn-secondary" onclick="startChatWithUser('${request.requesterId}', '${escapeHtml(request.requesterName || 'Requester')}')">💬 Chat with Requester</button>
            <button class="btn-secondary" onclick="closeRequestModal()">Close</button>
        `;
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
};

// Accept request
window.acceptRequest = async function (requestId) {
    if (!confirm('Are you sure you want to accept this blood request?')) return;

    try {
        // Update request status
        const request = allRequests.find(r => r.id === requestId);
        if (request) {
            request.status = 'accepted';
            await updateRequestInFirebase(requestId, { status: 'accepted' });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.approveRequest(requestId, {
                    patientName: request.patientName,
                    bloodType: request.bloodType,
                    status: 'accepted',
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Refresh the list
        await loadBloodRequests();

        // Close modal if open
        closeRequestModal();

        // Show success message
        showNotification('Request accepted successfully!', 'success');
    } catch (error) {
        console.error('Error accepting request:', error);
        showNotification('Error accepting request: ' + error.message, 'error');
    }
};

// Show reject modal
window.showRejectModal = function (requestId) {
    currentRequestId = requestId;
    const modal = document.getElementById('rejectRequestModal');
    const reasonTextarea = document.getElementById('rejectionReason');
    if (reasonTextarea) reasonTextarea.value = '';
    if (modal) modal.classList.add('show');
};

// Confirm reject request
window.confirmRejectRequest = async function () {
    const reason = document.getElementById('rejectionReason')?.value.trim();
    if (!reason) {
        window.utils.showNotification('Please provide a reason for rejection.', 'warning');
        return;
    }

    try {
        // Update request status
        const request = allRequests.find(r => r.id === currentRequestId);
        if (request) {
            request.status = 'rejected';
            await updateRequestInFirebase(currentRequestId, {
                status: 'rejected',
                rejectionReason: reason,
                rejectedAt: new Date().toISOString()
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.rejectRequest(currentRequestId, {
                    patientName: request.patientName,
                    bloodType: request.bloodType,
                    reason: reason,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Refresh the list
        await loadBloodRequests();

        // Close modals
        closeRejectModal();
        closeRequestModal();

        // Show success message
        showNotification('Request rejected successfully.', 'info');
    } catch (error) {
        console.error('Error rejecting request:', error);
        showNotification('Error rejecting request: ' + error.message, 'error');
    }
};

// Update request in Firebase
async function updateRequestInFirebase(requestId, updates) {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            await db.collection('bloodRequests').doc(requestId).update(updates);
        }
        console.log('Request updated:', requestId, updates);
    } catch (error) {
        console.error('Error updating in Firebase:', error);
        // Update local data anyway for UI consistency
        const request = allRequests.find(r => r.id === requestId);
        if (request) Object.assign(request, updates);
    }
}

// Close modals
window.closeRequestModal = function () {
    const modal = document.getElementById('requestDetailsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
};

window.closeRejectModal = function () {
    const modal = document.getElementById('rejectRequestModal');
    if (modal) modal.classList.remove('show');
};

// Export requests data
window.exportRequestsData = function () {
    const data = allRequests.map(r => ({
        'Request ID': r.id,
        'Patient Name': r.patientName,
        'Requester': r.requesterName,
        'Blood Type': r.bloodType,
        'Units Needed': r.unitsNeeded,
        'Hospital': r.hospitalName,
        'Urgency': r.urgencyLevel,
        'Status': r.status,
        'Created': formatDateTime(r.createdAt),
        'Diagnosis': r.diagnosis
    }));

    const csv = convertToCSV(data);
    downloadCSV(csv, `blood_requests_${new Date().toISOString().split('T')[0]}.csv`);
};

// Refresh requests
window.refreshRequests = function () {
    loadBloodRequests();
};

window.startChatWithUser = function (userId, userName) {
    if (!userId) {
        showNotification('User ID not available', 'error');
        return;
    }
    window.location.href = `/hospital/chat?targetId=${userId}&targetName=${encodeURIComponent(userName)}`;
};

// Helper functions
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBloodTypeClass(bloodType) {
    if (!bloodType) return 'badge-o-pos';
    if (bloodType.startsWith('AB')) return bloodType.includes('-') ? 'badge-ab-neg' : 'badge-ab-pos';
    if (bloodType.startsWith('A')) return bloodType.includes('-') ? 'badge-a-neg' : 'badge-a-pos';
    if (bloodType.startsWith('B')) return bloodType.includes('-') ? 'badge-b-neg' : 'badge-b-pos';
    if (bloodType.startsWith('O')) return bloodType.includes('-') ? 'badge-o-neg' : 'badge-o-pos';
    return 'badge-o-pos';
}

function getUrgencyIcon(urgency) {
    const icons = { critical: '🚨', urgent: '⚠️', moderate: 'ℹ️' };
    return icons[urgency] || 'ℹ️';
}

function formatDate(date) {
    if (!date) return '—';
    try {
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
}

function formatTime(date) {
    if (!date) return '—';
    try {
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

function formatDateTime(date) {
    if (!date) return '—';
    try {
        const d = date instanceof Date ? date : new Date(date);
        return `${formatDate(d)} ${formatTime(d)}`;
    } catch {
        return '—';
    }
}

function isExpired(date) {
    if (!date) return false;
    try {
        const expiryDate = date instanceof Date ? date : new Date(date);
        return expiryDate < new Date();
    } catch {
        return false;
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(header => JSON.stringify(obj[header] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function showNotification(message, type = 'info') {
    // Use window.utils.showNotification if available
    if (window.utils && window.utils.showNotification) {
        window.utils.showNotification(message, type);
    } else {
        window.utils.showNotification(message, 'info');
    }
}

// Auto-refresh every 30 seconds
let refreshInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadBloodRequests();
    }
}, 30000);

// Clean up interval on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
});