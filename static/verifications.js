// Enhanced Verifications Management Module
(function () {
    'use strict';

    let state = {
        activeItem: null,
        currentDonorFilter: 'pending',
        currentRequestFilter: 'pending',
        currentDisputeFilter: 'disputed',
        donorSearchTerm: '',
        requestSearchTerm: '',
        disputeSearchTerm: '',
        lockSearchTerm: '',
        isLoading: false,
        listeners: {
            donor: null,
            request: null,
            dispute: null
        }
    };

    // DOM Elements
    const elements = {
        donorList: document.getElementById('donorVerificationsList'),
        requestList: document.getElementById('requestVerificationsList'),
        disputeList: document.getElementById('disputesList'),
        modal: document.getElementById('verificationModal'),
        modalTitle: document.getElementById('modalTitle'),
        verificationDetails: document.getElementById('verificationDetails'),
        documentPreviews: document.getElementById('documentPreviews'),
        adminNotes: document.getElementById('adminNotes'),
        approveBtn: document.getElementById('approveBtn'),
        rejectBtn: document.getElementById('rejectBtn'),
        closeModal: document.getElementById('closeModal'),
        cancelModal: document.getElementById('cancelModalBtn'),
        donorSearch: document.getElementById('donorSearch'),
        requestSearch: document.getElementById('requestSearch'),
        disputeSearch: document.getElementById('disputeSearch'),
        donorCount: document.getElementById('donorCount'),
        requestCount: document.getElementById('requestCount'),
        disputeCount: document.getElementById('disputeCount'),
        donorPendingCount: document.getElementById('donorPendingCount'),
        donorApprovedCount: document.getElementById('donorApprovedCount'),
        donorRejectedCount: document.getElementById('donorRejectedCount'),
        requestPendingCount: document.getElementById('requestPendingCount'),
        requestApprovedCount: document.getElementById('requestApprovedCount'),
        requestRejectedCount: document.getElementById('requestRejectedCount'),
        disputeDisputedCount: document.getElementById('disputeDisputedCount'),
        disputeVerifiedCount: document.getElementById('disputeVerifiedCount'),
        disputeCancelledCount: document.getElementById('disputeCancelledCount'),
        lockList: document.getElementById('hospitalLocksList'),
        lockSearch: document.getElementById('hospitalSearch'),
        lockCount: document.getElementById('lockCount'),
        lockedBadge: document.getElementById('hospitalLockedCount')
    };

    // Initialize
    window.initializePage = async function () {
        console.log('🚀 Initializing verifications page...');
        setupEventListeners();
        setupKeyboardShortcuts();

        // Wait for all data to load before resolving
        return Promise.all([
            loadDonorVerifications(),
            loadRequestVerifications(),
            loadDonationDisputes(),
            loadHospitalLocks()
        ]);
    };

    // Setup keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape key closes modal
            if (e.key === 'Escape') {
                closeModal();
                closeImagePreview();
            }

            // Ctrl/Cmd + Enter approves verification
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.activeItem) {
                approveVerification();
            }

            // Ctrl/Cmd + Shift + R rejects verification
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R' && state.activeItem) {
                rejectVerification();
            }
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const status = chip.dataset.status;
                const tab = chip.closest('.tab-content');

                chip.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                if (tab?.id === 'donorsTab') {
                    state.currentDonorFilter = status;
                    loadDonorVerifications();
                } else if (tab?.id === 'requestsTab') {
                    state.currentRequestFilter = status;
                    loadRequestVerifications();
                } else if (tab?.id === 'disputesTab') {
                    state.currentDisputeFilter = status;
                    loadDonationDisputes();
                }
            });
        });

        // Search inputs with debounce
        if (elements.donorSearch) {
            elements.donorSearch.addEventListener('input', debounce((e) => {
                state.donorSearchTerm = e.target.value.toLowerCase();
                loadDonorVerifications();
            }, 300));
        }

        if (elements.requestSearch) {
            elements.requestSearch.addEventListener('input', debounce((e) => {
                state.requestSearchTerm = e.target.value.toLowerCase();
                loadRequestVerifications();
            }, 300));
        }

        if (elements.disputeSearch) {
            elements.disputeSearch.addEventListener('input', debounce((e) => {
                state.disputeSearchTerm = e.target.value.toLowerCase();
                loadDonationDisputes();
            }, 300));
        }

        if (elements.lockSearch) {
            elements.lockSearch.addEventListener('input', debounce((e) => {
                state.lockSearchTerm = e.target.value.toLowerCase();
                loadHospitalLocks();
            }, 300));
        }

        // Tab switching with animation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                // Add exit animation
                const currentContent = document.querySelector('.tab-content.active');
                if (currentContent) {
                    currentContent.style.animation = 'fadeOut 0.2s ease';
                    setTimeout(() => {
                        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        btn.classList.add('active');
                        document.getElementById(`${tabId}Tab`).classList.add('active');
                        document.getElementById(`${tabId}Tab`).style.animation = 'fadeInPage 0.3s ease';
                    }, 150);
                } else {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(`${tabId}Tab`).classList.add('active');
                }
            });
        });

        // Modal close handlers
        if (elements.closeModal) elements.closeModal.addEventListener('click', closeModal);
        if (elements.cancelModal) elements.cancelModal.addEventListener('click', closeModal);
        if (elements.modal) {
            elements.modal.addEventListener('click', (e) => {
                if (e.target === elements.modal) closeModal();
            });
        }

        // Approve and Reject buttons
        if (elements.approveBtn) {
            elements.approveBtn.addEventListener('click', approveVerification);
        }
        if (elements.rejectBtn) {
            elements.rejectBtn.addEventListener('click', () => showRejectConfirmModal());
        }
    }

    // Debounce utility
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Load donor verifications
    function loadDonorVerifications() {
        return new Promise((resolve) => {
            if (!elements.donorList) { resolve(); return; }

            elements.donorList.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading donor verifications...</p>
                </div>`;

            if (state.listeners.donor) state.listeners.donor();

            state.listeners.donor = firestore
                .collection('verification_requests')
                .where('userType', '==', 'donor')
                .onSnapshot(async snapshot => {
                    const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                    if (allDocs.length === 0) {
                        elements.donorList.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">👤</div>
                            <p>No ${state.currentDonorFilter} donor verifications found.</p>
                            <p class="empty-state-hint">Check back later for new submissions</p>
                        </div>`;
                        updateDonorCounts([]);
                        resolve();
                        return;
                    }

                    const verifications = allDocs.map((v, i) => {
                        // We need to fetch user data for these, but maybe only for the ones we display?
                        // Actually, for counts, we just need the status.
                        // Let's refine this to be more efficient.
                        return {
                            id: v.id,
                            userId: v.userId || v.id,
                            name: v.name || 'Unknown',
                            status: v.status || 'pending',
                            submittedAt: v.submittedAt || v.createdAt || '',
                            bloodType: v.bloodType || '—',
                            email: v.email || '—',
                            ver: v // Store original record for later use
                        };
                    });

                    // Update total counts immediately
                    updateDonorCounts(verifications);

                    // Filter for display
                    let filteredVerifications = verifications.filter(v => v.status === state.currentDonorFilter);

                    if (state.donorSearchTerm) {
                        filteredVerifications = filteredVerifications.filter(v =>
                            v.name.toLowerCase().includes(state.donorSearchTerm) ||
                            v.email.toLowerCase().includes(state.donorSearchTerm) ||
                            v.bloodType.toLowerCase().includes(state.donorSearchTerm)
                        );
                    }

                    if (filteredVerifications.length === 0) {
                        elements.donorList.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">👤</div>
                            <p>No ${state.currentDonorFilter} donor verifications found.</p>
                        </div>`;
                        resolve();
                        return;
                    }

                    // Fetch full user data ONLY for the filtered items to be efficient
                    const userSnapshots = await Promise.all(
                        filteredVerifications.map(v => firestore.collection('users').doc(v.userId).get())
                    );

                    const fullVerifications = filteredVerifications.map((v, i) => {
                        const u = userSnapshots[i].exists ? userSnapshots[i].data() : {};
                        return {
                            ...v,
                            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || v.name,
                            bloodType: u.bloodType || v.bloodType,
                            email: u.email || v.email,
                            phone: u.phoneNumber || '—',
                            weight: u.weight || v.weight,
                            questionnaire: v.ver?.donorQuestionnaire || {},
                            documents: {
                                nationalId: v.ver?.nationalIdPhotoUrl,
                                selfie: v.ver?.selfiePhotoUrl,
                                donorCard: v.ver?.donorCardPhotoUrl,
                                bloodTest: v.ver?.bloodTestReportUrl
                            }
                        };
                    });

                    renderDonorList(fullVerifications);
                    resolve();
                }, err => {
                    console.error('Donor verifications error:', err);
                    elements.donorList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <p>Error loading: ${err.message}</p>
                        <button class="btn-primary" onclick="window.initializePage()" style="margin-top: 16px;">Retry</button>
                    </div>`;
                    resolve();
                });
        });
    }

    function renderDonorList(verifications) {
        if (verifications.length === 0) {
            elements.donorList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No matching donor verifications found.</p>
                    <p class="empty-state-hint">Try adjusting your search or filter</p>
                </div>`;
            return;
        }

        elements.donorList.innerHTML = verifications.map(v => `
            <div class="verification-card" data-id="${v.id}" onclick="window.openDonorModal('${v.id}', '${v.userId}')">
                <div class="verification-card-header">
                    <div class="verification-avatar">
                        <span class="avatar-initial">${v.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="verification-info">
                        <h3 class="verification-name">${escapeHtml(v.name)}</h3>
                        <div class="verification-meta">
                            <span class="blood-type-badge ${getBloodTypeClass(v.bloodType)}">${v.bloodType}</span>
                            <span class="verification-email">📧 ${escapeHtml(v.email)}</span>
                        </div>
                    </div>
                    <div class="verification-status status-${v.status}">${v.status}</div>
                </div>
                <div class="verification-stats">
                    <div class="stat-item">
                        <span class="stat-label">Submitted</span>
                        <span class="stat-value">${formatDate(v.submittedAt)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Weight</span>
                        <span class="stat-value">${v.weight ? `${v.weight} kg` : '—'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Documents</span>
                        <span class="stat-value">${countDocuments(v.documents)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Health Check</span>
                        <span class="stat-value">${getQuestionnaireProgress(v.questionnaire)}%</span>
                    </div>
                </div>
                <div class="verification-action">
                    <span class="action-label">📄 Review Documents</span>
                    <span class="action-arrow">→</span>
                </div>
            </div>
        `).join('');
    }

    // Load request verifications
    function loadRequestVerifications() {
        return new Promise((resolve) => {
            if (!elements.requestList) { resolve(); return; }

            elements.requestList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading request verifications...</p>
            </div>`;

            if (state.listeners.request) state.listeners.request();

            state.listeners.request = firestore
                .collection('bloodRequests')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snapshot => {
                    const allRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                    let filtered = allRequests.filter(r => {
                        const status = r.verificationStatus || 'pending';
                        if (state.currentRequestFilter === 'all') return true;
                        return status === state.currentRequestFilter;
                    });

                    if (state.requestSearchTerm) {
                        filtered = filtered.filter(r =>
                            (r.patientName || '').toLowerCase().includes(state.requestSearchTerm) ||
                            (r.hospitalName || '').toLowerCase().includes(state.requestSearchTerm) ||
                            (r.bloodType || '').toLowerCase().includes(state.requestSearchTerm) ||
                            (r.requesterName || '').toLowerCase().includes(state.requestSearchTerm)
                        );
                    }

                    updateRequestCounts(allRequests);
                    renderRequestList(filtered);
                    resolve();
                }, err => {
                    console.error('Request verifications error:', err);
                    elements.requestList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <p>Error loading: ${err.message}</p>
                        <button class="btn-primary" onclick="window.initializePage()" style="margin-top: 16px;">Retry</button>
                    </div>`;
                    resolve();
                });
        });
    }

    function renderRequestList(requests) {
        if (requests.length === 0) {
            elements.requestList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🩸</div>
                    <p>No ${state.currentRequestFilter} blood request verifications found.</p>
                    <p class="empty-state-hint">Check back later for new requests</p>
                </div>`;
            return;
        }

        elements.requestList.innerHTML = requests.map(r => {
            const urgency = r.urgencyLevel || r.urgency || 'moderate';
            const status = r.verificationStatus || 'pending';
            const date = r.createdAt ? formatDate(new Date(r.createdAt)) : '—';

            return `
                <div class="verification-card" data-id="${r.id}" onclick="window.viewRequestVerification('${r.id}', '${r.requesterId}')">
                    <div class="verification-card-header">
                        <div class="verification-avatar urgent-${urgency}">
                            <span class="avatar-icon">${getUrgencyIcon(urgency)}</span>
                        </div>
                        <div class="verification-info">
                            <h3 class="verification-name">${escapeHtml(r.patientName || 'Unknown Patient')}</h3>
                            <div class="verification-meta">
                                <span class="blood-type-badge ${getBloodTypeClass(r.bloodType)}">${r.bloodType}</span>
                                <span class="hospital-name">🏥 ${escapeHtml(r.hospitalName || '—')}</span>
                            </div>
                        </div>
                        <div class="verification-status status-${status}">${status}</div>
                    </div>
                    <div class="verification-stats">
                        <div class="stat-item">
                            <span class="stat-label">Requester</span>
                            <span class="stat-value">${escapeHtml(r.requesterName || '—')}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Units</span>
                            <span class="stat-value">${r.unitsNeeded || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Urgency</span>
                            <span class="stat-value urgency-${urgency}">${urgency.toUpperCase()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Created</span>
                            <span class="stat-value">${date}</span>
                        </div>
                    </div>
                    <div class="verification-action">
                        <span class="action-label">📋 Review Request</span>
                        <span class="action-arrow">→</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Load donation disputes
    function loadDonationDisputes() {
        return new Promise((resolve) => {
            if (!elements.disputeList) { resolve(); return; }

            elements.disputeList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading donation disputes...</p>
            </div>`;

            if (state.listeners.dispute) state.listeners.dispute();

            state.listeners.dispute = firestore
                .collection('acceptedRequests')
                .onSnapshot(snapshot => {
                    const allDisputes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                    updateDisputeCounts(allDisputes);

                    let filtered = allDisputes.filter(d => d.status === state.currentDisputeFilter);

                    if (state.disputeSearchTerm) {
                        filtered = filtered.filter(d =>
                            (d.donorName || '').toLowerCase().includes(state.disputeSearchTerm) ||
                            (d.requesterName || '').toLowerCase().includes(state.disputeSearchTerm) ||
                            (d.hospitalName || '').toLowerCase().includes(state.disputeSearchTerm)
                        );
                    }

                    renderDisputeList(filtered);
                    renderDisputeList(filtered);
                    resolve();
                }, err => {
                    console.error('Disputes error:', err);
                    elements.disputeList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <p>Error loading: ${err.message}</p>
                        <button class="btn-primary" onclick="window.initializePage()" style="margin-top: 16px;">Retry</button>
                    </div>`;
                    resolve();
                });
        });
    }

    function renderDisputeList(disputes) {
        if (disputes.length === 0) {
            elements.disputeList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚖️</div>
                    <p>No ${state.currentDisputeFilter} donation disputes found.</p>
                    <p class="empty-state-hint">All disputes have been resolved</p>
                </div>`;
            return;
        }

        elements.disputeList.innerHTML = disputes.map(d => `
            <div class="verification-card" data-id="${d.id}" onclick="window.openDisputeModal('${d.id}')">
                <div class="verification-card-header">
                    <div class="verification-avatar dispute">
                        <span class="avatar-icon">⚖️</span>
                    </div>
                    <div class="verification-info">
                        <h3 class="verification-name">Dispute: ${escapeHtml(d.donorName || '?')} vs ${escapeHtml(d.requesterName || '?')}</h3>
                        <div class="verification-meta">
                            <span class="blood-type-badge ${getBloodTypeClass(d.bloodType)}">${d.bloodType}</span>
                            <span class="hospital-name">🏥 ${escapeHtml(d.hospitalName || '—')}</span>
                        </div>
                    </div>
                    <div class="verification-status status-${d.status}">${d.status}</div>
                </div>
                <div class="verification-stats">
                    <div class="stat-item">
                        <span class="stat-label">Dispute Reason</span>
                        <span class="stat-value">${escapeHtml((d.requesterVerificationNotes || 'No reason given').substring(0, 60))}${d.requesterVerificationNotes?.length > 60 ? '…' : ''}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Filed</span>
                        <span class="stat-value">${formatDate(d.requesterVerifiedAt)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Units</span>
                        <span class="stat-value">${d.unitsNeeded || 0}</span>
                    </div>
                </div>
                <div class="verification-action">
                    <span class="action-label">⚖️ Resolve Dispute</span>
                    <span class="action-arrow">→</span>
                </div>
            </div>
        `).join('');
    }

    // Hospital Account Locks
    async function loadHospitalLocks() {
        console.log('🔒 Loading locked hospitals...');
        if (!elements.lockList) return;

        try {
            const snapshot = await firestore.collection('hospitals')
                .where('locked', '==', true)
                .get();

            let hospitals = [];
            snapshot.forEach(doc => {
                hospitals.push({ id: doc.id, ...doc.data() });
            });

            // Search filter
            if (state.lockSearchTerm) {
                hospitals = hospitals.filter(h =>
                    h.name?.toLowerCase().includes(state.lockSearchTerm) ||
                    h.email?.toLowerCase().includes(state.lockSearchTerm)
                );
            }

            renderHospitalLocks(hospitals);

            // Update counts
            if (elements.lockCount) elements.lockCount.textContent = hospitals.length;
            if (elements.lockedBadge) elements.lockedBadge.textContent = hospitals.length;

        } catch (error) {
            console.error('Error loading locks:', error);
            if (elements.lockList) elements.lockList.innerHTML = '<p class="error-text">Failed to load locked accounts.</p>';
        }
    }

    function renderHospitalLocks(hospitals) {
        if (!elements.lockList) return;

        if (hospitals.length === 0) {
            elements.lockList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔓</div>
                    <p>No locked hospital accounts found.</p>
                </div>
            `;
            return;
        }

        elements.lockList.innerHTML = hospitals.map(hospital => `
            <div class="verification-card">
                <div class="card-status-badge status-locked">Locked</div>
                <div class="card-header">
                    <div class="card-title">${hospital.name || 'Unknown Hospital'}</div>
                    <div class="card-subtitle">${hospital.email}</div>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-label">Location:</span>
                        <span class="info-value">${hospital.address || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">${hospital.phone || 'N/A'}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary btn-sm" onclick="window.unlockHospital('${hospital.id}')">
                        🔓 Unlock Account
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.unlockHospital = async function (id) {
        if (!confirm('Are you sure you want to unlock this hospital account?')) return;

        try {
            // 1. Unlock in Firestore
            await firestore.collection('hospitals').doc(id).update({
                locked: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Clear failed attempts in Realtime DB
            const emailKey = id.replace(/\./g, ',');
            await database.ref(`auth_attempts/${emailKey}`).remove();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.lockHospital(id, {
                    action: 'unlock',
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification('Hospital account unlocked successfully', 'success');
            loadHospitalLocks(); // Refresh list

        } catch (error) {
            console.error('Unlock error:', error);
            window.utils.showNotification('Failed to unlock account: ' + error.message, 'error');
        }
    };

    // Open donor modal
    window.openDonorModal = async (verificationId, userId) => {
        showModalLoading();
        try {
            const [verSnap, userSnap] = await Promise.all([
                firestore.collection('verification_requests').doc(verificationId).get(),
                firestore.collection('users').doc(userId).get()
            ]);

            if (!verSnap.exists) { showNotification('Verification record not found.', 'error'); return; }

            const ver = { id: verSnap.id, ...verSnap.data() };
            const user = userSnap.exists ? userSnap.data() : {};
            state.activeItem = { id: verificationId, userId, type: 'donor', ver, user };

            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Donor';
            elements.modalTitle.textContent = `Donor Verification — ${fullName}`;

            const q = ver.donorQuestionnaire || {};
            const questionnaireProgress = getQuestionnaireProgress(q);

            elements.verificationDetails.innerHTML = `
                <div class="detail-section">
                    <h4 class="detail-section-title">👤 Personal Information</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Full Name', fullName)}
                        ${detailRow('Email', user.email || '—')}
                        ${detailRow('Phone', user.phoneNumber || '—')}
                        ${detailRow('Blood Type', `<span class="blood-type-badge ${getBloodTypeClass(user.bloodType)}">${user.bloodType || '—'}</span>`)}
                        ${detailRow('Weight', (user.weight || q.weightValue) ? `${user.weight || q.weightValue} kg` : '—')}
                        ${detailRow('Last Donation', q.lastDonationDate || 'First-time donor')}
                        ${detailRow('Submitted', formatDate(ver.submittedAt))}
                        ${detailRow('Status', `<span class="status-badge status-${ver.status}">${ver.status}</span>`)}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">🩺 Health Questionnaire</h4>
                    <div class="questionnaire-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${questionnaireProgress}%; background: ${getProgressColor(questionnaireProgress)};"></div>
                        </div>
                        <span class="progress-text">${questionnaireProgress}% completed</span>
                    </div>
                    <div class="questionnaire-grid">
                        ${renderQuestionnaire(q)}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">✅ Consent</h4>
                    <div class="consent-status ${ver.informedConsentAccepted ? 'consent-ok' : 'consent-fail'}">
                        <span class="consent-icon">${ver.informedConsentAccepted ? '✔' : '✘'}</span>
                        ${ver.informedConsentAccepted ? 'Informed consent accepted (Kenya Data Protection Act 2019)' : 'Consent NOT accepted'}
                    </div>
                </div>
                ${ver.status === 'rejected' && ver.adminNotes ? `
                    <div class="detail-section">
                        <h4 class="detail-section-title">📝 Previous Admin Notes</h4>
                        <div class="prev-notes">${escapeHtml(ver.adminNotes)}</div>
                    </div>
                ` : ''}
            `;

            renderDocs(buildDonorDocMap(ver));
            elements.modal.classList.remove('hidden');
            if (elements.adminNotes) elements.adminNotes.value = '';
            document.body.style.overflow = 'hidden';
        } catch (err) {
            console.error('openDonorModal error:', err);
            showNotification(`Failed to load verification: ${err.message}`, 'error');
        }
    };

    // Open request modal
    window.viewRequestVerification = async (requestId, userId) => {
        showModalLoading();
        try {
            const reqSnap = await firestore.collection('bloodRequests').doc(requestId).get();
            if (!reqSnap.exists) { showNotification('Blood request record not found.', 'error'); return; }

            const ver = { id: reqSnap.id, ...reqSnap.data(), type: 'blood_request' };
            const userSnap = await firestore.collection('users').doc(userId).get();
            const user = userSnap.exists ? userSnap.data() : {};

            state.activeItem = { id: requestId, userId, type: 'blood_request', ver, user };

            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Requester';
            elements.modalTitle.textContent = `Blood Request — ${fullName}`;

            const urgency = ver.urgencyLevel || ver.urgency || 'moderate';
            const status = ver.verificationStatus || 'pending';
            const createdAt = ver.createdAt ? formatDate(new Date(ver.createdAt)) : '—';

            elements.verificationDetails.innerHTML = `
                <div class="detail-section">
                    <h4 class="detail-section-title">👤 Requester Information</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Full Name', fullName)}
                        ${detailRow('Email', user.email || '—')}
                        ${detailRow('Phone', user.phoneNumber || '—')}
                        ${detailRow('Blood Type', `<span class="blood-type-badge ${getBloodTypeClass(user.bloodType)}">${user.bloodType || '—'}</span>`)}
                        ${detailRow('Submitted', createdAt)}
                        ${detailRow('Status', `<span class="status-badge status-${status}">${status}</span>`)}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">🏥 Hospital & Patient Details</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Hospital', ver.hospitalName || ver.selectedHospitalName || '—')}
                        ${detailRow('Patient Name', ver.patientName || '—')}
                        ${detailRow('Ward / Bed', ver.wardBedNumber || '—')}
                        ${detailRow('Diagnosis', ver.diagnosis || '—')}
                        ${detailRow('Blood Type Needed', `<span class="blood-type-badge ${getBloodTypeClass(ver.bloodType)}">${ver.bloodType || '—'}</span>`)}
                        ${detailRow('Units Needed', `<strong class="units-needed">${ver.unitsNeeded || 0}</strong>`)}
                        ${detailRow('Component', ver.bloodComponent || ver.bloodComponentNeeded || '—')}
                        ${detailRow('Urgency', `<span class="urgency-badge urgency-${urgency}">${urgency.toUpperCase()}</span>`)}
                        ${detailRow('Doctor', ver.doctorName || '—')}
                    </div>
                </div>
                ${ver.notes ? `
                    <div class="detail-section">
                        <h4 class="detail-section-title">📝 Additional Notes</h4>
                        <div class="notes-text">${escapeHtml(ver.notes)}</div>
                    </div>
                ` : ''}
                ${ver.adminNotes ? `
                    <div class="detail-section">
                        <h4 class="detail-section-title">📝 Previous Admin Notes</h4>
                        <div class="prev-notes">${escapeHtml(ver.adminNotes)}</div>
                    </div>
                ` : ''}
            `;

            renderDocs(buildRequesterDocMap(ver));
            elements.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } catch (err) {
            console.error('viewRequestVerification error:', err);
            showNotification(`Failed to load details: ${err.message}`, 'error');
        }
    };

    // Open dispute modal
    window.openDisputeModal = async (disputeId) => {
        showModalLoading();
        try {
            const disputeSnap = await firestore.collection('acceptedRequests').doc(disputeId).get();
            if (!disputeSnap.exists) { showNotification('Dispute record not found.', 'error'); return; }

            const r = { id: disputeSnap.id, ...disputeSnap.data() };
            state.activeItem = { id: r.id, userId: r.donorId, type: 'dispute', item: r };

            elements.modalTitle.textContent = `Donation Dispute — ${r.donorName} vs ${r.requesterName}`;

            elements.verificationDetails.innerHTML = `
                <div class="detail-section">
                    <h4 class="detail-section-title">🛡️ Dispute Overview</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Donor Name', r.donorName)}
                        ${detailRow('Requester Name', r.requesterName)}
                        ${detailRow('Blood Type', `<span class="blood-type-badge ${getBloodTypeClass(r.bloodType)}">${r.bloodType}</span>`)}
                        ${detailRow('Hospital', r.hospitalName)}
                        ${detailRow('Units Needed', r.unitsNeeded)}
                        ${detailRow('Current Status', `<span class="status-badge status-${r.status}">${r.status}</span>`)}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">💬 Testimony & Notes</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Requester Dispute Reason', `<span class="dispute-reason">${escapeHtml(r.requesterVerificationNotes || 'No reason specified')}</span>`)}
                        ${detailRow('Donor Completion Notes', r.donorNotes || 'No notes provided')}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">📅 Timeline</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Donation Marked Done', formatDate(r.donorCompletedAt))}
                        ${detailRow('Dispute Filed', formatDate(r.requesterVerifiedAt))}
                    </div>
                </div>
            `;

            renderDocs({});

            // Add dispute resolution buttons
            const modalFooter = document.getElementById('modalFooter');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button class="btn-secondary" id="cancelModalBtn">Cancel</button>
                    <button class="btn-primary btn-approve" onclick="resolveDispute('verified')">✅ Resolve as Verified</button>
                    <button class="btn-danger" onclick="resolveDispute('cancelled')">❌ Resolve as Cancelled</button>
                `;

                document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
            }

            elements.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } catch (err) {
            console.error('openDisputeModal error:', err);
            showNotification(`Failed to load dispute details: ${err.message}`, 'error');
        }
    };

    // Resolve dispute
    window.resolveDispute = async (newStatus) => {
        if (!state.activeItem || state.activeItem.type !== 'dispute') return;

        const confirmMsg = newStatus === 'verified'
            ? 'Confirming this donation will create a permanent donation record and award points to the donor. Proceed?'
            : 'Cancelling this donation will mark it as invalid. Proceed?';

        if (!confirm(confirmMsg)) return;

        setModalBusy(true);
        const timestamp = new Date().toISOString();
        const r = state.activeItem.item;

        try {
            const batch = firestore.batch();
            const arRef = firestore.collection('acceptedRequests').doc(r.id);

            batch.update(arRef, {
                status: newStatus,
                adminResolutionNotes: `Resolved by admin as ${newStatus} on ${timestamp}`,
                resolvedAt: timestamp,
                updatedAt: timestamp
            });

            if (newStatus === 'verified') {
                const donationRef = firestore.collection('donations').doc();
                batch.set(donationRef, {
                    id: donationRef.id,
                    donorId: r.donorId,
                    donorName: r.donorName,
                    requestId: r.requestId,
                    bloodType: r.bloodType,
                    donationDate: r.donorCompletedAt,
                    location: r.location,
                    bloodBankName: r.hospitalName,
                    unitsCollected: r.unitsNeeded,
                    pointsEarned: 50,
                    notes: `Admin Verified Dispute: ${r.donorNotes || ''}`,
                    createdAt: timestamp
                });

                // Update users collection
                const userRef = firestore.collection('users').doc(r.donorId);
                const userSnap = await userRef.get();
                if (userSnap.exists) {
                    const u = userSnap.data();
                    batch.update(userRef, {
                        points: (u.points || 0) + 50,
                        lastDonationDate: r.donorCompletedAt,
                        totalDonations: (u.totalDonations || 0) + 1
                    });
                }

                // Sync with donors collection
                const donorRef = firestore.collection('donors').doc(r.donorId);
                const donorSnap = await donorRef.get();
                if (donorSnap.exists) {
                    const d = donorSnap.data();
                    batch.update(donorRef, {
                        points: (d.points || 0) + 50,
                        lastDonationDate: r.donorCompletedAt,
                        totalDonations: (d.totalDonations || 0) + 1
                    });
                }

                batch.update(firestore.collection('bloodRequests').doc(r.requestId), {
                    status: 'completed',
                    completedAt: timestamp
                });
            }

            await batch.commit();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                if (newStatus === 'verified') {
                    window.auditLogs.actions.approveRequest(r.requestId, {
                        action: 'resolve_dispute_verified',
                        donorName: r.donorName,
                        requesterName: r.requesterName,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    window.auditLogs.actions.rejectRequest(r.requestId, {
                        action: 'resolve_dispute_cancelled',
                        donorName: r.donorName,
                        requesterName: r.requesterName,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            showNotification(`Dispute resolved as ${newStatus}.`, 'success');
            closeModal();
            refreshCurrentTab();
        } catch (err) {
            console.error('resolveDispute error:', err);
            showNotification(`Failed to resolve dispute: ${err.message}`, 'error');
        } finally {
            setModalBusy(false);
        }
    };

    // Approve verification
    async function approveVerification() {
        if (!state.activeItem) return;
        const notes = elements.adminNotes?.value.trim() || '';
        const timestamp = new Date().toISOString();

        setModalBusy(true);
        try {
            const batch = firestore.batch();

            if (state.activeItem.type === 'blood_request') {
                batch.update(firestore.collection('bloodRequests').doc(state.activeItem.id), {
                    verificationStatus: 'approved',
                    status: 'pending',
                    adminNotes: notes,
                    reviewedAt: timestamp,
                    updatedAt: timestamp,
                    approvedAt: timestamp,
                    approvedBy: auth?.currentUser?.email || 'admin'
                });
                batch.update(firestore.collection('users').doc(state.activeItem.userId), {
                    updatedAt: timestamp
                });
            } else if (state.activeItem.type === 'donor') {
                const donorUpdate = {
                    verificationStatus: 'approved',
                    isVerified: true,
                    verificationRejectionReason: null,
                    updatedAt: timestamp,
                };
                const q = state.activeItem.ver.donorQuestionnaire || {};
                if (q.weightValue && !state.activeItem.user.weight) {
                    donorUpdate.weight = q.weightValue;
                }
                batch.update(firestore.collection('verification_requests').doc(state.activeItem.id), {
                    status: 'approved',
                    adminNotes: notes || '',
                    reviewedAt: timestamp,
                    updatedAt: timestamp,
                });
                batch.update(firestore.collection('users').doc(state.activeItem.userId), donorUpdate);
            }

            await batch.commit();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                if (state.activeItem.type === 'blood_request') {
                    window.auditLogs.actions.approveRequest(state.activeItem.id, {
                        patientName: state.activeItem.ver.patientName,
                        notes: notes,
                        timestamp: new Date().toISOString()
                    });
                } else if (state.activeItem.type === 'donor') {
                    window.auditLogs.actions.verifyDonor(state.activeItem.userId, {
                        donorName: elements.modalTitle.textContent.split('—')[1].trim(),
                        notes: notes,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            const isRequest = state.activeItem.type === 'blood_request';
            const notifTitle = isRequest ? '🎉 Blood Request Approved' : '🎉 Verification Approved!';
            const notifMsg = isRequest
                ? `Your blood request has been approved and is now visible to donors.${notes ? ` Note: ${notes}` : ''}`
                : `Your donor identity verification has been approved.${notes ? ` Note: ${notes}` : ''}`;

            await sendNotification(state.activeItem.userId, 'verification_approved', notifTitle, notifMsg);

            showNotification('✅ Approved successfully', 'success');
            closeModal();
            refreshCurrentTab();
        } catch (err) {
            console.error('Approve error:', err);
            showNotification(`Approval failed: ${err.message}`, 'error');
        } finally {
            setModalBusy(false);
        }
    }

    // Reject verification with confirmation
    async function rejectVerification() {
        if (!state.activeItem) return;
        const notes = elements.adminNotes?.value.trim();
        if (!notes) {
            showNotification('Please provide a reason for rejection.', 'warning');
            elements.adminNotes?.focus();
            return;
        }

        const timestamp = new Date().toISOString();
        setModalBusy(true);
        try {
            const batch = firestore.batch();

            if (state.activeItem.type === 'blood_request') {
                batch.update(firestore.collection('bloodRequests').doc(state.activeItem.id), {
                    verificationStatus: 'rejected',
                    status: 'cancelled',
                    adminNotes: notes,
                    reviewedAt: timestamp,
                    updatedAt: timestamp,
                    rejectedAt: timestamp
                });
                batch.update(firestore.collection('users').doc(state.activeItem.userId), {
                    updatedAt: timestamp
                });
            } else if (state.activeItem.type === 'donor') {
                batch.update(firestore.collection('verification_requests').doc(state.activeItem.id), {
                    status: 'rejected',
                    adminNotes: notes,
                    reviewedAt: timestamp,
                    updatedAt: timestamp,
                });
                batch.update(firestore.collection('users').doc(state.activeItem.userId), {
                    verificationStatus: 'rejected',
                    isVerified: false,
                    verificationRejectionReason: notes,
                    updatedAt: timestamp,
                });
            }

            await batch.commit();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                if (state.activeItem.type === 'blood_request') {
                    window.auditLogs.actions.rejectRequest(state.activeItem.id, {
                        patientName: state.activeItem.ver.patientName,
                        reason: notes,
                        timestamp: new Date().toISOString()
                    });
                } else if (state.activeItem.type === 'donor') {
                    window.auditLogs.actions.rejectDonor(state.activeItem.userId, {
                        donorName: elements.modalTitle.textContent.split('—')[1].trim(),
                        reason: notes,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            const isRequest = state.activeItem.type === 'blood_request';
            const notifTitle = isRequest ? '❌ Request Not Approved' : '❌ Verification Not Approved';
            const notifMsg = isRequest
                ? `Your blood request was rejected. Reason: ${notes}`
                : `Your donor identity verification was rejected. Reason: ${notes}`;

            await sendNotification(state.activeItem.userId, 'verification_rejected', notifTitle, notifMsg);

            showNotification('❌ Rejected and user notified', 'info');
            closeModal();
            refreshCurrentTab();
        } catch (err) {
            console.error('Reject error:', err);
            showNotification(`Rejection failed: ${err.message}`, 'error');
        } finally {
            setModalBusy(false);
        }
    }

    function showRejectConfirmModal() {
        if (confirm('Are you sure you want to reject this verification? The user will be notified.')) {
            rejectVerification();
        }
    }

    // Helper functions
    function detailRow(label, value) {
        return `<div class="detail-item"><label>${label}</label><span>${value}</span></div>`;
    }

    function formatDate(val) {
        if (!val) return '—';
        try {
            const d = val.toDate ? val.toDate() : new Date(val);
            return d.toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return String(val); }
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

    function getQuestionnaireProgress(q) {
        const keys = ['ageConfirmed', 'noFeverOrInfection', 'noCurrentMedication', 'noChronicDisease',
            'noRecentTattoo', 'noRecentSurgery', 'noRecentVaccination', 'noHIVHepatitis',
            'noRecentMalaria', 'hasInfectiousDiseases'];
        const answered = keys.filter(k => q[k] === true).length;
        return Math.round((answered / keys.length) * 100);
    }

    function getProgressColor(percent) {
        if (percent === 100) return '#10B981';
        if (percent >= 70) return '#F59E0B';
        return '#EF4444';
    }

    function countDocuments(docs) {
        return Object.values(docs).filter(v => v).length;
    }

    function renderQuestionnaire(q) {
        const items = [
            { key: 'ageConfirmed', label: 'Age 16–64 confirmed' },
            { key: 'noFeverOrInfection', label: 'No fever or active infection' },
            { key: 'noCurrentMedication', label: 'No antibiotics / prescription meds' },
            { key: 'noChronicDisease', label: 'No hypertension / diabetes / heart disease' },
            { key: 'noRecentTattoo', label: 'No tattoo/piercing in last 6 months' },
            { key: 'noRecentSurgery', label: 'No surgery in last 6 months' },
            { key: 'noRecentVaccination', label: 'No vaccination in last 1 month' },
            { key: 'noHIVHepatitis', label: 'No HIV / Hepatitis B or C' },
            { key: 'noRecentMalaria', label: 'No malaria in last 3 months' },
            { key: 'hasInfectiousDiseases', label: 'No major infectious diseases' }
        ];
        return items.map(item => {
            const val = q[item.key];
            const icon = val === true ? '✅' : '❌';
            const cls = val === true ? 'q-yes' : 'q-no';
            return `<div class="q-row ${cls}"><span class="q-icon">${icon}</span><span class="q-label">${item.label}</span></div>`;
        }).join('');
    }

    function renderDocs(docs) {
        const container = elements.documentPreviews;
        const entries = Object.entries(docs);
        if (entries.length === 0) {
            container.innerHTML = '<p class="no-docs">No documents uploaded for this verification.</p>';
            return;
        }
        container.innerHTML = entries.map(([label, url]) => `
            <div class="doc-card" onclick="window.openImagePreview('${url}', '${label}')">
                <div class="doc-img-wrap">
                    <img src="${url}" alt="${label}" onerror="this.onerror=null;this.src='${url}';">
                </div>
                <span class="doc-label">${label}</span>
            </div>
        `).join('');
    }

    function buildDonorDocMap(ver) {
        const map = {};
        if (ver.nationalIdPhotoUrl) map['National ID / Passport'] = ver.nationalIdPhotoUrl;
        if (ver.selfiePhotoUrl) map['Selfie Photo'] = ver.selfiePhotoUrl;
        if (ver.donorCardPhotoUrl) map['Previous Donor Card'] = ver.donorCardPhotoUrl;
        if (ver.bloodTestReportUrl) map['Blood Test Report'] = ver.bloodTestReportUrl;
        return map;
    }

    function buildRequesterDocMap(ver) {
        const map = {};
        const reqForm = ver.hospitalRequisitionFormUrl || ver.hospitalFormUrl;
        if (reqForm) map['Hospital Requisition Form'] = reqForm;
        if (ver.nationalIdPhotoUrl) map['National ID / Passport'] = ver.nationalIdPhotoUrl;
        if (ver.selfiePhotoUrl) map['Selfie Photo'] = ver.selfiePhotoUrl;
        return map;
    }

    function updateDonorCounts(donors) {
        const pending = donors.filter(d => d.status === 'pending').length;
        const approved = donors.filter(d => d.status === 'approved').length;
        const rejected = donors.filter(d => d.status === 'rejected').length;

        if (elements.donorCount) elements.donorCount.textContent = donors.length;
        if (elements.donorPendingCount) elements.donorPendingCount.textContent = pending;
        if (elements.donorApprovedCount) elements.donorApprovedCount.textContent = approved;
        if (elements.donorRejectedCount) elements.donorRejectedCount.textContent = rejected;
    }

    function updateRequestCounts(requests) {
        const pending = requests.filter(r => (r.verificationStatus || 'pending') === 'pending').length;
        const approved = requests.filter(r => r.verificationStatus === 'approved').length;
        const rejected = requests.filter(r => r.verificationStatus === 'rejected').length;

        if (elements.requestCount) elements.requestCount.textContent = requests.length;
        if (elements.requestPendingCount) elements.requestPendingCount.textContent = pending;
        if (elements.requestApprovedCount) elements.requestApprovedCount.textContent = approved;
        if (elements.requestRejectedCount) elements.requestRejectedCount.textContent = rejected;
    }

    function updateDisputeCounts(disputes) {
        const disputed = disputes.filter(d => d.status === 'disputed').length;
        const verified = disputes.filter(d => d.status === 'verified').length;
        const cancelled = disputes.filter(d => d.status === 'cancelled').length;

        if (elements.disputeCount) elements.disputeCount.textContent = disputes.length;
        if (elements.disputeDisputedCount) elements.disputeDisputedCount.textContent = disputed;
        if (elements.disputeVerifiedCount) elements.disputeVerifiedCount.textContent = verified;
        if (elements.disputeCancelledCount) elements.disputeCancelledCount.textContent = cancelled;
    }

    function refreshCurrentTab() {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'donors') loadDonorVerifications();
        else if (activeTab === 'requests') loadRequestVerifications();
        else if (activeTab === 'disputes') loadDonationDisputes();
        else if (activeTab === 'locks') loadHospitalLocks();
    }

    async function sendNotification(userId, type, title, message, data = {}) {
        try {
            await firestore.collection('notifications').add({
                userId, type, title, message, data, isRead: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (err) {
            console.warn('Notification send failed:', err);
        }
    }

    function setModalBusy(busy) {
        if (elements.approveBtn) {
            elements.approveBtn.disabled = busy;
            elements.approveBtn.textContent = busy ? 'Processing…' : '✅ Approve';
        }
        if (elements.rejectBtn) {
            elements.rejectBtn.disabled = busy;
            elements.rejectBtn.textContent = busy ? 'Processing…' : '❌ Reject';
        }
    }

    function showModalLoading() {
        if (!elements.modal) return;
        elements.modalTitle.textContent = 'Loading...';
        elements.verificationDetails.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Fetching data...</p></div>';
        if (elements.documentPreviews) elements.documentPreviews.innerHTML = '';
        if (elements.adminNotes) elements.adminNotes.value = '';
        elements.modal.classList.remove('hidden');
    }

    function closeModal() {
        if (elements.modal) elements.modal.classList.add('hidden');
        state.activeItem = null;
        if (elements.adminNotes) elements.adminNotes.value = '';
        document.body.style.overflow = '';

        // Reset modal footer buttons
        const modalFooter = document.getElementById('modalFooter');
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button class="btn-secondary" id="cancelModalBtn">Cancel</button>
                <button class="btn-primary btn-approve" id="approveBtn">✅ Approve</button>
                <button class="btn-danger" id="rejectBtn">❌ Reject</button>
            `;
            document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
            document.getElementById('approveBtn')?.addEventListener('click', approveVerification);
            document.getElementById('rejectBtn')?.addEventListener('click', showRejectConfirmModal);
        }
    }
    window.closeModal = closeModal;

    window.openImagePreview = (url, label) => {
        const overlay = document.getElementById('imageOverlay');
        const img = document.getElementById('overlayImage');
        const caption = document.getElementById('overlayCaption');
        const originalBtn = document.getElementById('overlayOriginalBtn');

        if (!overlay || !img) return;

        img.src = url;
        if (caption) caption.textContent = label;
        if (originalBtn) originalBtn.href = url;

        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.closeImagePreview = () => {
        const overlay = document.getElementById('imageOverlay');
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = '';
    };

    function showNotification(message, type = 'info') {
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            window.utils.showNotification(message, 'info');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Expose globally
    window.openDonorModal = window.openDonorModal;
    window.viewRequestVerification = window.viewRequestVerification;
    window.openDisputeModal = window.openDisputeModal;
    window.resolveDispute = window.resolveDispute;
    window.initializeVerifications = window.initializePage;
})();