// Donors Management Module with Enhanced Donation Tracking
(function () {
    'use strict';

    let donors = [];
    let donations = [];
    let selectedDonor = null;
    let initialized = false;

    const elements = {
        tableBody: document.getElementById('donorsTableBody'),
        searchInput: document.getElementById('donorsSearch'),
        statusFilter: document.getElementById('donorStatusFilter'),
        bloodTypeFilter: document.getElementById('bloodTypeFilter'),
        availabilityFilter: document.getElementById('availabilityFilter'),
        donorDetailModal: document.getElementById('donorDetailModal'),
        closeDonorModal: document.getElementById('closeDonorModal'),
        cancelDonorModal: document.getElementById('cancelDonorModal'),
        donorModalSubtitle: document.getElementById('donorModalSubtitle'),
        donorDetailsContent: document.getElementById('donorDetailsContent')
    };

    // Initialize
    window.initializePage = function () {
        console.log('Initializing donors page...');
        setupEventListeners();
        return Promise.all([loadDonors(), loadDonations()]);
    };

    // Setup event listeners
    function setupEventListeners() {
        if (initialized) return;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', window.utils.debounce(renderDonors, 300));
        }
        if (elements.statusFilter) {
            elements.statusFilter.addEventListener('change', renderDonors);
        }
        if (elements.bloodTypeFilter) {
            elements.bloodTypeFilter.addEventListener('change', renderDonors);
        }
        if (elements.availabilityFilter) {
            elements.availabilityFilter.addEventListener('change', renderDonors);
        }
        if (elements.closeDonorModal) {
            elements.closeDonorModal.addEventListener('click', closeDonorModal);
        }
        if (elements.cancelDonorModal) {
            elements.cancelDonorModal.addEventListener('click', closeDonorModal);
        }
        if (elements.donorDetailModal) {
            elements.donorDetailModal.addEventListener('click', (e) => {
                if (e.target === elements.donorDetailModal) closeDonorModal();
            });
        }
        initialized = true;
    }

    // Load donors from Firestore
    function loadDonors() {
        return new Promise((resolve) => {
            firestore
                .collection('users')
                .where('userType', '==', 'donor')
                .onSnapshot(snapshot => {
                    donors = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('Donors loaded:', donors.length);
                    renderDonors();
                    resolve();
                }, err => {
                    console.error('Error loading donors:', err);
                    window.utils.showNotification('Error loading donors', 'error');
                    resolve();
                });
        });
    }

    // Load donations from Firestore to calculate accurate totals
    function loadDonations() {
        return new Promise((resolve) => {
            firestore
                .collection('donations')
                .onSnapshot(snapshot => {
                    donations = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('Donations loaded:', donations.length);
                    renderDonors();
                    resolve();
                }, err => {
                    console.error('Error loading donations:', err);
                    resolve();
                });
        });
    }

    // Get donor statistics from actual donation records
    function getDonorStats(donorId) {
        const donorDonations = donations.filter(d => d.donorId === donorId);

        // Filter only completed/verified donations
        const completedDonations = donorDonations.filter(d =>
            d.status === 'completed' || d.status === 'verified' || !d.status
        );

        const totalDonations = completedDonations.length;
        const totalPoints = completedDonations.reduce((sum, d) => sum + (d.pointsEarned || 0), 0);
        const totalUnits = completedDonations.reduce((sum, d) => sum + (d.unitsCollected || 1), 0);

        const lastDonation = completedDonations.length > 0
            ? completedDonations.sort((a, b) => new Date(b.donationDate) - new Date(a.donationDate))[0]
            : null;

        const livesImpacted = totalDonations * 3;

        let nextEligibility = null;
        if (lastDonation && lastDonation.donationDate) {
            const lastDate = new Date(lastDonation.donationDate);
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + 56);
            nextEligibility = nextDate;
        }

        return {
            totalDonations,
            totalPoints,
            totalUnits,
            livesImpacted,
            lastDonation,
            nextEligibility,
            allDonations: completedDonations
        };
    }

    // Get donor badge based on total donations
    function getDonorBadge(totalDonations) {
        if (totalDonations >= 50) return { class: 'donor-badge-platinum', text: '🏆 Platinum Donor' };
        if (totalDonations >= 25) return { class: 'donor-badge-gold', text: '🥇 Gold Donor' };
        if (totalDonations >= 10) return { class: 'donor-badge-silver', text: '🥈 Silver Donor' };
        if (totalDonations >= 5) return { class: 'donor-badge-bronze', text: '🥉 Bronze Donor' };
        if (totalDonations >= 1) return { class: 'donor-badge-starter', text: '⭐ Starter Donor' };
        return null;
    }

    // View donor details (can be called from both row click and view button)
    window.viewDonorDetails = function (donorId, event) {
        // Stop event propagation to prevent double trigger if called from button
        if (event) {
            event.stopPropagation();
        }

        const donor = donors.find(d => d.id === donorId);
        if (!donor) {
            window.utils.showNotification('Donor not found', 'error');
            return;
        }

        selectedDonor = donor;

        if (elements.donorModalSubtitle) {
            elements.donorModalSubtitle.textContent = `${donor.firstName || ''} ${donor.lastName || ''}`.trim() || 'Unknown';
        }

        if (elements.donorDetailsContent) {
            elements.donorDetailsContent.innerHTML = renderDonorDetails(donor);
        }

        if (elements.donorDetailModal) {
            elements.donorDetailModal.classList.add('show');
        }
    };

    // Render donors table
    function renderDonors() {
        if (!elements.tableBody) return;

        const search = (elements.searchInput?.value || '').toLowerCase();
        const statusFilter = elements.statusFilter?.value || 'all';
        const bloodTypeFilter = elements.bloodTypeFilter?.value || 'all';
        const availabilityFilter = elements.availabilityFilter?.value || 'all';

        let filtered = [...donors];

        if (search) {
            filtered = filtered.filter(d => {
                const name = `${d.firstName || ''} ${d.lastName || ''}`.toLowerCase();
                return name.includes(search)
                    || (d.email || '').toLowerCase().includes(search)
                    || (d.phoneNumber || '').toLowerCase().includes(search)
                    || (d.bloodType || '').toLowerCase().includes(search);
            });
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(d => {
                if (statusFilter === 'verified') return d.isVerified === true;
                if (statusFilter === 'pending') return d.verificationStatus === 'pending';
                if (statusFilter === 'rejected') return d.verificationStatus === 'rejected';
                return true;
            });
        }

        if (bloodTypeFilter !== 'all') {
            filtered = filtered.filter(d => d.bloodType === bloodTypeFilter);
        }

        if (availabilityFilter !== 'all') {
            filtered = filtered.filter(d => {
                if (availabilityFilter === 'available') return d.isAvailable === true;
                if (availabilityFilter === 'unavailable') return d.isAvailable === false;
                return true;
            });
        }

        if (filtered.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <p>${donors.length === 0 ? 'No donors registered yet' : 'No donors match your filters'}</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort donors by priority and donation count
        filtered.sort((a, b) => {
            const aStats = getDonorStats(a.id);
            const bStats = getDonorStats(b.id);

            const getPriority = (d) => {
                if (d.verificationStatus === 'pending') return 0;
                if (d.isVerified) return 1;
                return 2;
            };
            const priorityA = getPriority(a);
            const priorityB = getPriority(b);
            if (priorityA !== priorityB) return priorityA - priorityB;

            return bStats.totalDonations - aStats.totalDonations;
        });

        elements.tableBody.innerHTML = filtered.map(d => {
            const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown';
            const btClass = getBloodTypeClass(d.bloodType || 'A+');
            const stats = getDonorStats(d.id);
            const badge = getDonorBadge(stats.totalDonations);

            let statusClass = '';
            let statusText = '';
            if (d.isVerified) {
                statusClass = 'status-verified';
                statusText = 'Verified';
            } else if (d.verificationStatus === 'pending') {
                statusClass = 'status-pending';
                statusText = 'Pending';
            } else if (d.verificationStatus === 'rejected') {
                statusClass = 'status-critical';
                statusText = 'Rejected';
            } else {
                statusClass = 'status-pending';
                statusText = 'Unsubmitted';
            }

            const availClass = d.isAvailable ? 'status-verified' : 'status-urgent';
            const availText = d.isAvailable ? 'Available' : 'Unavailable';

            const joined = d.createdAt
                ? new Date(d.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

            return `
                <tr onclick="window.viewDonorDetails('${d.id}', event)" style="cursor: pointer;">
                    <td>
                        <div class="table-cell-flex">
                            <div class="avatar-initial-sm">${fullName.charAt(0).toUpperCase()}</div>
                            <div class="cell-info">
                                <span class="cell-main">${escapeHtml(fullName)}</span>
                                <span class="cell-sub">Joined ${joined}</span>
                                ${badge ? `<span class="donor-badge ${badge.class}" style="margin-top: 4px; display: inline-block;">${badge.text}</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="cell-info">
                        <span class="cell-main">${escapeHtml(d.email || '—')}</span>
                        <span class="cell-sub">${escapeHtml(d.phoneNumber || '—')}</span>
                    </td>
                    <td><span class="blood-type-badge ${btClass}">${d.bloodType || '—'}</span></td>
                    <td style="font-weight:600;">${d.weight ? `${d.weight} kg` : '—'}</td>
                    <td>
                        <div style="font-weight:700;color:#059669;font-size:18px;">${stats.totalDonations}</div>
                        <div style="font-size:11px;color:#D97706;">⭐ ${stats.totalPoints} pts</div>
                        <div style="font-size:10px;color:#3B82F6;">💉 ${stats.totalUnits} units</div>
                    </td>
                    <td>
                        <div>
                            <span class="status-badge ${statusClass}" style="text-transform:capitalize;">${statusText}</span>
                            <br>
                            <span class="status-badge ${availClass}" style="margin-top:4px;display:inline-block;font-size:11px;">
                                ${availText}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;flex-direction:column;gap:4px;">
                            <button class="action-btn action-btn-info" onclick="window.viewDonorDetails('${d.id}', event)" title="View Details">
                                👁️ View
                            </button>
                            ${!d.isVerified && d.verificationStatus !== 'rejected' ? `
                                <button class="action-btn action-btn-success" onclick="event.stopPropagation(); window.verifyDonor('${d.id}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')">
                                    ✅ Verify
                                </button>
                            ` : ''}
                            ${d.isVerified ? `
                                <button class="action-btn action-btn-danger" onclick="event.stopPropagation(); window.unverifyDonor('${d.id}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')">
                                    ❌ Revoke
                                </button>
                            ` : ''}
                            ${d.verificationStatus === 'rejected' ? `
                                <button class="action-btn action-btn-edit" onclick="event.stopPropagation(); window.reconsiderDonor('${d.id}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')">
                                    🔄 Reconsider
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Get blood type CSS class
    function getBloodTypeClass(bloodType) {
        if (!bloodType) return 'badge-o-pos';
        if (bloodType.startsWith('AB')) return bloodType.includes('-') ? 'badge-ab-neg' : 'badge-ab-pos';
        if (bloodType.startsWith('A')) return bloodType.includes('-') ? 'badge-a-neg' : 'badge-a-pos';
        if (bloodType.startsWith('B')) return bloodType.includes('-') ? 'badge-b-neg' : 'badge-b-pos';
        if (bloodType.startsWith('O')) return bloodType.includes('-') ? 'badge-o-neg' : 'badge-o-pos';
        return 'badge-o-pos';
    }

    // Render donor details with complete donation history
    function renderDonorDetails(donor) {
        const fullName = `${donor.firstName || ''} ${donor.lastName || ''}`.trim() || 'Unknown';
        const joinedDate = donor.createdAt ? new Date(donor.createdAt).toLocaleDateString('en-KE', {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : 'Unknown';

        const stats = getDonorStats(donor.id);
        const badge = getDonorBadge(stats.totalDonations);

        let statusClass = '';
        let statusText = '';
        if (donor.isVerified) {
            statusClass = 'status-verified';
            statusText = 'Verified';
        } else if (donor.verificationStatus === 'pending') {
            statusClass = 'status-pending';
            statusText = 'Pending Review';
        } else if (donor.verificationStatus === 'rejected') {
            statusClass = 'status-critical';
            statusText = 'Rejected';
        } else {
            statusClass = 'status-pending';
            statusText = 'Not Submitted';
        }

        const availClass = donor.isAvailable ? 'status-verified' : 'status-urgent';
        const availText = donor.isAvailable ? 'Available' : 'Unavailable';

        return `
            <div class="donor-stats-cards">
                <div class="donor-stat-card">
                    <div class="stat-number">${stats.totalDonations}</div>
                    <div class="stat-label">Total Donations</div>
                </div>
                <div class="donor-stat-card">
                    <div class="stat-number">⭐ ${stats.totalPoints}</div>
                    <div class="stat-label">Impact Points</div>
                </div>
                <div class="donor-stat-card">
                    <div class="stat-number">${stats.totalUnits}</div>
                    <div class="stat-label">Units Donated</div>
                </div>
                <div class="donor-stat-card">
                    <div class="stat-number">${stats.livesImpacted}</div>
                    <div class="stat-label">Lives Impacted</div>
                </div>
            </div>
            
            <div class="details-grid">
                <div class="detail-item">
                    <label>Full Name</label>
                    <span>${escapeHtml(fullName)}</span>
                </div>
                <div class="detail-item">
                    <label>Email</label>
                    <span>${escapeHtml(donor.email || '—')}</span>
                </div>
                <div class="detail-item">
                    <label>Phone Number</label>
                    <span>${escapeHtml(donor.phoneNumber || '—')}</span>
                </div>
                <div class="detail-item">
                    <label>Blood Type</label>
                    <span><span class="blood-type-badge ${getBloodTypeClass(donor.bloodType)}">${donor.bloodType || '—'}</span></span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${donor.weight ? `${donor.weight} kg` : '—'}</span>
                </div>
                <div class="detail-item">
                    <label>Location</label>
                    <span>${donor.county ? `${donor.county}${donor.town ? `, ${donor.town}` : ''}` : '—'}</span>
                </div>
                <div class="detail-item">
                    <label>Donor Badge</label>
                    <span>${badge ? `<span class="donor-badge ${badge.class}">${badge.text}</span>` : 'Regular Donor'}</span>
                </div>
                <div class="detail-item">
                    <label>Next Eligibility</label>
                    <span>${stats.nextEligibility ? stats.nextEligibility.toLocaleDateString() : 'Eligible now'}</span>
                </div>
                <div class="detail-item">
                    <label>Joined Date</label>
                    <span>${joinedDate}</span>
                </div>
                <div class="detail-item">
                    <label>Verification Status</label>
                    <span><span class="status-badge ${statusClass}">${statusText}</span></span>
                </div>
                <div class="detail-item">
                    <label>Availability</label>
                    <span><span class="status-badge ${availClass}">${availText}</span></span>
                </div>
            </div>
            
            ${donor.verificationRejectionReason ? `
                <div class="alert alert-danger" style="margin-top: 16px;">
                    <div class="alert-header">
                        <span class="alert-icon">⚠️</span>
                        <strong>Rejection Reason</strong>
                    </div>
                    <p style="margin-top: 8px;">${escapeHtml(donor.verificationRejectionReason)}</p>
                </div>
            ` : ''}
            
            ${stats.allDonations.length > 0 ? `
                <div class="batch-history" style="margin-top: 24px;">
                    <h4>📊 Complete Donation History</h4>
                    <div style="overflow-x: auto;">
                        <table class="batch-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Blood Type</th>
                                    <th>Component</th>
                                    <th>Units</th>
                                    <th>Points</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.allDonations.map(donation => `
                                    <tr>
                                        <td>${new Date(donation.donationDate).toLocaleDateString()}</td>
                                        <td>${escapeHtml(donation.bloodBankName || donation.location?.address || 'Medical Facility')}</td>
                                        <td><span class="blood-type-badge ${getBloodTypeClass(donation.bloodType)}">${donation.bloodType}</span></td>
                                        <td>${donation.bloodComponent || 'Whole Blood'}</td>
                                        <td>${donation.unitsCollected || 1}</td>
                                        <td style="color: #D97706; font-weight: 600;">+${donation.pointsEarned || 50}</td>
                                        <td><span class="status-badge status-verified">Completed</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : '<div class="empty-state" style="margin-top: 24px;"><p>No donation records yet</p></div>'}
        `;
    }

    // Close donor modal
    function closeDonorModal() {
        if (elements.donorDetailModal) {
            elements.donorDetailModal.classList.remove('show');
        }
        selectedDonor = null;
    }

    // Verify donor
    window.verifyDonor = async function (uid, name) {
        if (!window.utils.confirmAction(`Verify ${name}?\n\nThis will allow them to accept blood donation requests.`)) return;

        try {
            const timestamp = new Date().toISOString();

            const vSnap = await firestore.collection('verification_requests')
                .where('userId', '==', uid)
                .where('userType', '==', 'donor')
                .limit(1).get();

            const batch = firestore.batch();
            const donorUpdate = {
                verificationStatus: 'approved',
                isVerified: true,
                updatedAt: timestamp
            };

            if (!vSnap.empty) {
                const qDoc = vSnap.docs[0];
                const qData = qDoc.data();
                const questionnaire = qData.donorQuestionnaire || {};
                if (questionnaire.weightValue) {
                    donorUpdate.weight = questionnaire.weightValue;
                }
                batch.update(qDoc.ref, {
                    status: 'approved',
                    reviewedAt: timestamp,
                    updatedAt: timestamp,
                    adminNotes: 'Verified by admin'
                });
            }

            batch.update(firestore.collection('users').doc(uid), donorUpdate);
            await batch.commit();

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.verifyDonor(uid, {
                    donorName: name,
                    status: 'approved',
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`${name} verified successfully`, 'success');
        } catch (err) {
            console.error('verifyDonor error:', err);
            window.utils.showNotification('Failed to verify donor', 'error');
        }
    };

    // Unverify donor
    window.unverifyDonor = async function (uid, name) {
        if (!window.utils.confirmAction(`Revoke verification for ${name}?\n\nThis will remove their ability to accept blood requests.`)) return;

        try {
            const timestamp = new Date().toISOString();
            await firestore.collection('users').doc(uid).update({
                verificationStatus: 'rejected',
                isVerified: false,
                isAvailable: false,
                updatedAt: timestamp,
                verificationRejectionReason: 'Verification revoked by admin'
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.rejectDonor(uid, {
                    donorName: name,
                    reason: 'Verification revoked by admin',
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`${name}'s verification revoked`, 'success');
        } catch (err) {
            console.error('unverifyDonor error:', err);
            window.utils.showNotification('Failed to revoke verification', 'error');
        }
    };

    // Reconsider rejected donor
    window.reconsiderDonor = async function (uid, name) {
        if (!window.utils.confirmAction(`Reconsider ${name}?\n\nThis will mark them as pending review again.`)) return;

        try {
            const timestamp = new Date().toISOString();
            await firestore.collection('users').doc(uid).update({
                verificationStatus: 'pending',
                isVerified: false,
                updatedAt: timestamp,
                verificationRejectionReason: null
            });

            // Log audit event
            if (window.auditLogs && window.auditLogs.actions) {
                window.auditLogs.actions.updateUser(uid, {
                    action: 'reconsideration',
                    donorName: name,
                    timestamp: new Date().toISOString()
                });
            }

            window.utils.showNotification(`${name} marked for reconsideration`, 'success');
        } catch (err) {
            console.error('reconsiderDonor error:', err);
            window.utils.showNotification('Failed to reconsider donor', 'error');
        }
    };

    // Escape HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();