
(function () {
    'use strict';

    // State
    let activeItem = null;

    // Initialize shared elements when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('verificationModal');
        const closeModalBtn = document.getElementById('closeModal');
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const adminNotes = document.getElementById('adminNotes');

        if (!modal) return;

        window.closeVerificationModal = () => {
            modal.classList.add('hidden');
            activeItem = null;
            if (adminNotes) adminNotes.value = '';
        };

        if (closeModalBtn) closeModalBtn.onclick = window.closeVerificationModal;
        modal.addEventListener('click', e => { if (e.target === modal) window.closeVerificationModal(); });

        // Image Preview Listeners
        const imageOverlay = document.getElementById('imageOverlay');
        const closeImageOverlay = document.getElementById('closeImageOverlay');

        if (imageOverlay) {
            imageOverlay.addEventListener('click', (e) => {
                if (e.target === imageOverlay) window.closeImagePreview();
            });
        }
        if (closeImageOverlay) {
            closeImageOverlay.onclick = window.closeImagePreview;
        }

        if (approveBtn) {
            approveBtn.onclick = async () => {
                if (!activeItem) return;
                const notes = adminNotes.value.trim();
                const timestamp = new Date().toISOString();
                setModalBusy(true);
                try {
                    const batch = firestore.batch();

                    if (activeItem.ver && activeItem.ver.type === 'blood_request') {
                        // 1. Handle Blood Request Verification
                        batch.update(firestore.collection('bloodRequests').doc(activeItem.id), {
                            verificationStatus: 'approved',
                            status: 'pending', // Make it active for donors to see
                            adminNotes: notes || '',
                            reviewedAt: timestamp,
                            updatedAt: timestamp,
                            approvedAt: timestamp,
                            approvedBy: auth?.currentUser?.email || 'admin'
                        });

                        // 2. Link to user record but don't set isVerified (per user request)
                        batch.update(firestore.collection('users').doc(activeItem.userId), {
                            updatedAt: timestamp
                        });
                    } else {
                        // 3. Handle Donor Account Verification
                        const donorUpdate = {
                            verificationStatus: 'approved',
                            isVerified: true,
                            verificationRejectionReason: null,
                            updatedAt: timestamp,
                        };

                        // Propagate weight from questionnaire to user profile if available
                        const q = activeItem.ver.donorQuestionnaire || {};
                        if (q.weightValue && !activeItem.user.weight) {
                            donorUpdate.weight = q.weightValue;
                        }

                        batch.update(firestore.collection('verification_requests').doc(activeItem.id), {
                            status: 'approved',
                            adminNotes: notes || '',
                            reviewedAt: timestamp,
                            updatedAt: timestamp,
                        });
                        batch.update(firestore.collection('users').doc(activeItem.userId), donorUpdate);
                    }

                    await batch.commit();

                    const isRequest = activeItem.ver && activeItem.ver.type === 'blood_request';
                    const msgSuffix = notes ? ` Note from admin: ${notes}` : '';
                    const notifTitle = isRequest ? '🎉 Blood Request Approved' : '🎉 Verification Approved!';
                    const notifMsg = isRequest
                        ? `Your blood request for ${activeItem.ver.patientName || 'patient'} has been approved and is now visible to donors.${msgSuffix}`
                        : `Your donor identity verification has been approved.${msgSuffix}`;

                    await sendNotification(activeItem.userId, 'verification_approved', notifTitle, notifMsg, {
                        verificationId: activeItem.id,
                        type: activeItem.type
                    });

                    if (window.utils && window.utils.showNotification) {
                        window.utils.showNotification('✅ Approved successfully', 'success');
                    }
                    window.closeVerificationModal();
                    if (window.refreshVerifications) window.refreshVerifications();
                } catch (err) {
                    console.error('Approve error:', err);
                    alert(`Approval failed: ${err.message}`);
                } finally {
                    setModalBusy(false);
                }
            };
        }

        if (rejectBtn) {
            rejectBtn.onclick = async () => {
                if (!activeItem) return;
                const notes = adminNotes.value.trim();
                if (!notes) { alert('Please provide a reason for rejection.'); adminNotes.focus(); return; }
                const timestamp = new Date().toISOString();
                setModalBusy(true);
                try {
                    const batch = firestore.batch();

                    if (activeItem.ver && activeItem.ver.type === 'blood_request') {
                        // 1. Handle Blood Request Rejection
                        batch.update(firestore.collection('bloodRequests').doc(activeItem.id), {
                            verificationStatus: 'rejected',
                            status: 'cancelled',
                            adminNotes: notes,
                            reviewedAt: timestamp,
                            updatedAt: timestamp,
                            rejectedAt: timestamp
                        });
                        batch.update(firestore.collection('users').doc(activeItem.userId), {
                            updatedAt: timestamp
                        });
                    } else {
                        // 2. Handle Donor Account Rejection
                        batch.update(firestore.collection('verification_requests').doc(activeItem.id), {
                            status: 'rejected',
                            adminNotes: notes,
                            reviewedAt: timestamp,
                            updatedAt: timestamp,
                        });
                        batch.update(firestore.collection('users').doc(activeItem.userId), {
                            verificationStatus: 'rejected',
                            isVerified: false,
                            verificationRejectionReason: notes,
                            updatedAt: timestamp,
                        });
                    }

                    await batch.commit();

                    const isRequest = activeItem.ver && activeItem.ver.type === 'blood_request';
                    const notifTitle = isRequest ? '❌ Request Not Approved' : '❌ Verification Not Approved';
                    const notifMsg = isRequest
                        ? `Your blood request for ${activeItem.ver.patientName || 'patient'} was rejected. Reason: ${notes}.`
                        : `Your donor identity verification was rejected. Reason: ${notes}.`;

                    await sendNotification(activeItem.userId, 'verification_rejected', notifTitle, notifMsg, {
                        verificationId: activeItem.id,
                        type: activeItem.type
                    });

                    if (window.utils && window.utils.showNotification) {
                        window.utils.showNotification('❌ Rejected and user notified', 'info');
                    }
                    window.closeVerificationModal();
                    if (window.refreshVerifications) window.refreshVerifications();
                } catch (err) {
                    console.error('Reject error:', err);
                    alert(`Rejection failed: ${err.message}`);
                } finally {
                    setModalBusy(false);
                }
            };
        }

        function setModalBusy(busy) {
            if (approveBtn) {
                approveBtn.disabled = busy;
                approveBtn.textContent = busy ? 'Processing…' : 'Approve';
            }
            if (rejectBtn) rejectBtn.disabled = busy;
        }
    });

    window.openDonorModal = async (verificationId, userId) => {
        showModalLoading();
        try {
            const [verSnap, userSnap] = await Promise.all([
                firestore.collection('verification_requests').doc(verificationId).get(),
                firestore.collection('users').doc(userId).get(),
            ]);
            if (!verSnap.exists) { alert('Verification record not found.'); return; }

            const ver = { id: verSnap.id, ...verSnap.data() };
            const user = userSnap.exists ? userSnap.data() : {};
            activeItem = { id: verificationId, userId, type: 'donor', ver, user };

            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Donor';
            document.getElementById('modalTitle').textContent = `Donor Verification — ${fullName}`;

            const q = ver.donorQuestionnaire || {};
            document.getElementById('verificationDetails').innerHTML = `
        <div class="detail-section">
          <h4 class="detail-section-title">👤 Personal Information</h4>
          <div class="detail-grid-2">
            ${detailRow('Full Name', fullName)}
            ${detailRow('Email', user.email || '—')}
            ${detailRow('Phone', user.phoneNumber || '—')}
            ${detailRow('Blood Type', user.bloodType || '—')}
            ${detailRow('Weight', (user.weight || q.weightValue) ? `${user.weight || q.weightValue} kg` : '—')}
            ${detailRow('Last Donation', q.lastDonationDate || 'First-time donor')}
            ${detailRow('Submitted', formatDate(ver.submittedAt))}
            ${detailRow('Current Status', statusBadge(ver.status))}
          </div>
        </div>
        <div class="detail-section">
          <h4 class="detail-section-title">🩺 Health Questionnaire</h4>
          ${buildQuestionnaireProgressBar(q)}
          <div class="questionnaire-grid">${renderQuestionnaire(q)}</div>
        </div>
        <div class="detail-section">
          <h4 class="detail-section-title">✅ Consent</h4>
          <div class="consent-status ${ver.informedConsentAccepted ? 'consent-ok' : 'consent-fail'}">
            <span class="consent-icon">${ver.informedConsentAccepted ? '✔' : '✘'}</span>
            ${ver.informedConsentAccepted
                    ? 'Informed consent accepted (Kenya Data Protection Act 2019)'
                    : 'Consent NOT accepted'}
          </div>
        ${ver.status === 'rejected' && ver.adminNotes ? `
        <div class="detail-section">
          <h4 class="detail-section-title">📝 Previous Admin Notes</h4>
          <div class="prev-notes">${ver.adminNotes}</div>
        </div>` : ''}
      `;
            renderDocs(buildDonorDocMap(ver));
            document.getElementById('verificationModal').classList.remove('hidden');
        } catch (err) {
            console.error('openDonorModal error:', err);
            alert(`Failed to load verification: ${err.message}`);
        }
    };

    window.openRequesterModal = async (docId, userId, isBloodRequest = false) => {
        showModalLoading();
        try {
            let ver, user;
            if (isBloodRequest) {
                const [reqSnap, userSnap] = await Promise.all([
                    firestore.collection('bloodRequests').doc(docId).get(),
                    firestore.collection('users').doc(userId).get(),
                ]);
                if (!reqSnap.exists) { alert('Blood request record not found.'); return; }
                ver = { id: reqSnap.id, ...reqSnap.data(), type: 'blood_request' };
                user = userSnap.exists ? userSnap.data() : {};
            } else {
                const [verSnap, userSnap] = await Promise.all([
                    firestore.collection('verification_requests').doc(docId).get(),
                    firestore.collection('users').doc(userId).get(),
                ]);
                if (!verSnap.exists) { alert('Verification record not found.'); return; }
                ver = { id: verSnap.id, ...verSnap.data() };
                user = userSnap.exists ? userSnap.data() : {};
            }

            activeItem = { id: docId, userId, type: 'requester', ver, user };

            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Requester';
            document.getElementById('modalTitle').textContent = isBloodRequest ? `Blood Request Docs — ${fullName}` : `Requester Verification — ${fullName}`;

            document.getElementById('verificationDetails').innerHTML = `
        <div class="detail-section">
          <h4 class="detail-section-title">👤 Requester Information</h4>
          <div class="detail-grid-2">
            ${detailRow('Full Name', fullName)}
            ${detailRow('Email', user.email || '—')}
            ${detailRow('Phone', user.phoneNumber || '—')}
            ${detailRow('Blood Type', user.bloodType || '—')}
            ${detailRow('Submitted', formatDate(ver.submittedAt || ver.createdAt))}
            ${detailRow('Current Status', statusBadge(ver.status || ver.verificationStatus || 'pending'))}
          </div>
        </div>
        <div class="detail-section">
          <h4 class="detail-section-title">🏥 Hospital & Patient Details</h4>
          <div class="detail-grid-2">
            ${detailRow('Hospital', ver.selectedHospitalName || ver.hospitalName || '—')}
            ${detailRow('MFL Code', ver.selectedHospitalMflCode || '—')}
            ${detailRow('Patient Name', ver.patientName || '—')}
            ${detailRow('Age / Gender', `${ver.patientAge || '—'} / ${ver.patientGender || '—'}`)}
            ${detailRow('MRN Number', ver.patientMrnNumber || '—')}
            ${detailRow('Ward / Bed', ver.wardBedNumber || '—')}
            ${detailRow('Diagnosis', ver.diagnosis || '—')}
            ${detailRow('Units Needed', `<strong style="color:#DC2626;font-size:1.1em;">${ver.unitsNeeded || '—'}</strong>`)}
            ${detailRow('Component', ver.bloodComponentNeeded || ver.bloodComponent || '—')}
            ${detailRow('Doctor', ver.doctorName || '—')}
            ${detailRow('Urgency', (ver.urgencyLevel || ver.urgency || 'Moderate'))}
            ${detailRow('Required By', formatDate(ver.requiredDate || ver.deadline))}
          </div>
        </div>
        ${ver.notes ? `
        <div class="detail-section">
          <h4 class="detail-section-title">📝 Notes</h4>
          <p class="notes-text">${ver.notes}</p>
        </div>` : ''}
        ${(ver.status === 'rejected' || ver.verificationStatus === 'rejected') && ver.adminNotes ? `
        <div class="detail-section">
          <h4 class="detail-section-title">📝 Previous Admin Notes</h4>
          <div class="prev-notes">${ver.adminNotes}</div>
        </div>` : ''}
      `;
            renderDocs(buildRequesterDocMap(ver));
            showApproveRejectButtons(true);
            document.getElementById('verificationModal').classList.remove('hidden');
        } catch (err) {
            console.error('openRequesterModal error:', err);
            alert(`Failed to load details: ${err.message}`);
        }
    };

    // Bridge functions for donors.js and requests.js
    window.viewDonorVerification = async (userId) => {
        const snap = await firestore.collection('verification_requests')
            .where('userId', '==', userId)
            .where('userType', '==', 'donor')
            .limit(1).get();
        if (snap.empty) {
            alert('No verification request found for this donor.');
            return;
        }
        window.openDonorModal(snap.docs[0].id, userId);
    };

    window.viewRequestVerification = async (requestId, userId) => {
        try {
            // 1. Check if there's a specific verification request linked to this requestId
            const verSnap = await firestore.collection('verification_requests')
                .where('requestId', '==', requestId)
                .limit(1).get();

            if (!verSnap.empty) {
                window.openRequesterModal(verSnap.docs[0].id, userId, false);
                return;
            }

            // 2. Check for general requester verification for this user
            const generalVerSnap = await firestore.collection('verification_requests')
                .where('userId', '==', userId)
                .where('userType', '==', 'requester')
                .limit(1).get();

            if (!generalVerSnap.empty) {
                window.openRequesterModal(generalVerSnap.docs[0].id, userId, false);
                return;
            }

            // 3. Fallback: Check the blood request itself for documents
            const bloodReqSnap = await firestore.collection('bloodRequests').doc(requestId).get();
            if (bloodReqSnap.exists) {
                const data = bloodReqSnap.data();
                if (data.hospitalRequisitionFormUrl || data.hospitalFormUrl || data.verificationDocs) {
                    window.openRequesterModal(requestId, userId, true);
                    return;
                }
            }

            alert('No verification documents found for this request.');
        } catch (err) {
            console.error('viewRequestVerification error:', err);
            alert(`Failed to check documents: ${err.message}`);
        }
    };

    // Helper functions (copied/refactored from verifications.js)
    function showModalLoading() {
        const modal = document.getElementById('verificationModal');
        if (!modal) return;
        document.getElementById('modalTitle').textContent = 'Loading…';
        document.getElementById('verificationDetails').innerHTML =
            '<div class="loading-state"><img src="/static/images/logo.jpg" class="loading-logo"><p>Fetching data…</p></div>';
        document.getElementById('documentPreviews').innerHTML = '';
        const notes = document.getElementById('adminNotes');
        if (notes) notes.value = '';
        modal.classList.remove('hidden');
    }

    window.openImagePreview = (url, label = 'Document') => {
        const overlay = document.getElementById('imageOverlay');
        const img = document.getElementById('overlayImage');
        const caption = document.getElementById('overlayCaption');
        const originalBtn = document.getElementById('overlayOriginalBtn');

        if (!overlay || !img) return;

        img.src = url;
        if (caption) caption.textContent = label;
        if (originalBtn) originalBtn.href = url;

        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    window.closeImagePreview = () => {
        const overlay = document.getElementById('imageOverlay');
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
    };

    function renderDocs(docs) {
        const grid = document.getElementById('documentPreviews');
        const entries = Object.entries(docs);
        if (entries.length === 0) {
            grid.innerHTML = '<p class="no-docs">No documents uploaded.</p>';
            return;
        }
        grid.innerHTML = entries.map(([label, url]) => {
            const thumbUrl = url.replace('/upload/', '/upload/w_320,h_200,c_fill,q_auto,f_auto/');
            return `
        <div class="doc-card" onclick="openImagePreview('${url}', '${label}')">
          <div class="doc-img-wrap">
            <img src="${thumbUrl}" alt="${label}" onerror="this.onerror=null;this.src='${url}';">
          </div>
          <span class="doc-label">${label}</span>
        </div>
      `;
        }).join('');
    }

    function buildDonorDocMap(ver) {
        const map = {};
        if (ver.nationalIdPhotoUrl) map['National ID / Passport'] = ver.nationalIdPhotoUrl;
        if (ver.selfiePhotoUrl) map['Selfie Photo'] = ver.selfiePhotoUrl;
        if (ver.donorCardPhotoUrl) map['Previous Donor Card'] = ver.donorCardPhotoUrl;
        if (ver.bloodTestReportUrl) map['Blood Test Report'] = ver.bloodTestReportUrl;

        // Include generic verificationDocs object
        if (ver.verificationDocs && typeof ver.verificationDocs === 'object') {
            Object.entries(ver.verificationDocs).forEach(([k, url]) => {
                const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
                if (!map[label]) map[label] = url;
            });
        }
        return map;
    }

    function buildRequesterDocMap(ver) {
        const map = {};
        const reqForm = ver.hospitalRequisitionFormUrl || ver.hospitalFormUrl || ver.hospitalRequisitionUrl || ver.requisitionUrl;
        if (reqForm) map['Hospital Requisition Form'] = reqForm;

        const labReport = ver.labReportUrl || ver.laboratoryReportUrl || ver.medicalReportUrl;
        if (labReport) map['Medical/Lab Report'] = labReport;

        if (ver.nationalIdPhotoUrl) map['National ID / Passport'] = ver.nationalIdPhotoUrl;
        if (ver.selfiePhotoUrl) map['Selfie Photo'] = ver.selfiePhotoUrl;

        if (ver.verificationDocs && typeof ver.verificationDocs === 'object') {
            Object.entries(ver.verificationDocs).forEach(([k, url]) => {
                const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());
                if (!map[label]) map[label] = url;
            });
        }
        return map;
    }

    window.openDisputeModal = async (disputeId) => {
        showModalLoading();
        try {
            const disputeSnap = await firestore.collection('acceptedRequests').doc(disputeId).get();
            if (!disputeSnap.exists) { alert('Dispute record not found.'); return; }
            const r = { id: disputeSnap.id, ...disputeSnap.data() };
            activeItem = { id: r.id, userId: r.donorId, type: 'dispute', item: r };

            document.getElementById('modalTitle').textContent = `Donation Dispute — ${r.donorName} vs ${r.requesterName}`;
            document.getElementById('verificationDetails').innerHTML = `
                <div class="detail-section">
                    <h4 class="detail-section-title">🛡️ Dispute Overview</h4>
                    <div class="detail-grid-2">
                        ${detailRow('Donor Name', r.donorName)}
                        ${detailRow('Requester Name', r.requesterName)}
                        ${detailRow('Blood Type', r.bloodType)}
                        ${detailRow('Hospital', r.hospitalName)}
                        ${detailRow('Units Needed', r.unitsNeeded)}
                        ${detailRow('Current Status', statusBadge(r.status))}
                    </div>
                </div>
                <div class="detail-section">
                    <h4 class="detail-section-title">💬 Testimony & Notes</h4>
                    <div class="detail-grid-1">
                        ${detailRow('Requester Dispute Reason', `<span style="color:#DC2626;font-weight:600;">${r.requesterVerificationNotes || 'No reason specified'}</span>`)}
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

            const footer = document.getElementById('modalFooter');
            footer.innerHTML = `
                <div class="modal-actions-dispute">
                    <button class="btn-success" onclick="resolveDispute('verified')">Resolve as Verified</button>
                    <button class="btn-danger" onclick="resolveDispute('cancelled')">Resolve as Cancelled</button>
                    <button class="btn-secondary" onclick="closeModal()">Keep Pending</button>
                </div>
            `;

            renderDocs({});
            document.getElementById('verificationModal').classList.remove('hidden');
        } catch (err) {
            console.error('openDisputeModal error:', err);
            alert(`Failed to load dispute details: ${err.message}`);
        }
    };

    window.resolveDispute = async (newStatus) => {
        if (!activeItem || activeItem.type !== 'dispute') return;
        const confirmMsg = newStatus === 'verified'
            ? 'Confirming this donation will create a permanent donation record and award points to the donor. Proceed?'
            : 'Cancelling this donation will mark it as invalid. Proceed?';

        if (!confirm(confirmMsg)) return;

        showModalLoading();
        const timestamp = new Date().toISOString();
        const r = activeItem.item;

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
                // Create donation record
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

                // Update donor points
                const donorRef = firestore.collection('users').doc(r.donorId);
                const donorSnap = await donorRef.get();
                if (donorSnap.exists) {
                    const d = donorSnap.data();
                    batch.update(donorRef, {
                        points: (d.points || 0) + 50,
                        lastDonationDate: r.donorCompletedAt
                    });
                }

                // Complete the original blood request
                batch.update(firestore.collection('bloodRequests').doc(r.requestId), {
                    status: 'completed',
                    completedAt: timestamp
                });
            }

            await batch.commit();
            alert(`Dispute resolved as ${newStatus}.`);
            closeModal();
            if (window.loadDonationDisputes) window.loadDonationDisputes();
        } catch (err) {
            console.error('resolveDispute error:', err);
            alert(`Failed to resolve dispute: ${err.message}`);
        }
    };

    function detailRow(label, value) { return `<div class="detail-item"><label>${label}</label><span>${value}</span></div>`; }
    function statusBadge(status) {
        const colors = {
            approved: '#10B981',
            pending: '#F59E0B',
            rejected: '#EF4444',
            disputed: '#DC2626',
            verified: '#059669',
            cancelled: '#4B5563'
        };
        return `<span style="color:${colors[status] || '#94A3B8'};font-weight:700;text-transform:capitalize;">${status}</span>`;
    }
    function formatDate(val) {
        if (!val) return '—';
        const d = (val && typeof val.toDate === 'function') ? val.toDate() : new Date(val);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-KE');
    }

    async function sendNotification(userId, type, title, message, data = {}) {
        return firestore.collection('notifications').add({
            userId,
            recipientId: userId, // Ensure consistency with admin filter
            type,
            title,
            message,
            data,
            isRead: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
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
            { key: 'hasInfectiousDiseases', label: 'No major infectious diseases' },
        ];
        return items.map(item => {
            const val = q[item.key];
            const icon = val === true ? '✅' : '❌';
            const cls = val === true ? 'q-yes' : 'q-no';
            return `<div class="q-row ${cls}"><span class="q-icon">${icon}</span><span class="q-label">${item.label}</span></div>`;
        }).join('');
    }

    function buildQuestionnaireProgressBar(q) {
        const keys = ['ageConfirmed', 'noFeverOrInfection', 'noCurrentMedication', 'noChronicDisease', 'noRecentTattoo', 'noRecentSurgery', 'noRecentVaccination', 'noHIVHepatitis', 'noRecentMalaria', 'hasInfectiousDiseases'];
        const answered = keys.filter(k => q[k] === true).length;
        const pct = Math.round((answered / keys.length) * 100);
        const color = pct === 100 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444';
        return `
      <div class="q-progress-wrap">
        <div style="background:#e5e7eb;border-radius:99px;height:8px;margin-bottom:10px;">
          <div style="width:${pct}%;background:${color};height:8px;border-radius:99px;transition:width .4s;"></div>
        </div>
        <span style="color:${color};font-size:12px;font-weight:700;">${answered}/${keys.length} health declarations confirmed</span>
      </div>
    `;
    }

    // Modal UI Helpers
    function showApproveRejectButtons(show) {
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const adminNotes = document.getElementById('adminNotes');
        if (approveBtn) approveBtn.style.display = show ? '' : 'none';
        if (rejectBtn) rejectBtn.style.display = show ? '' : 'none';
        const notesWrap = adminNotes?.closest('.modal-notes-wrap') || adminNotes?.parentElement;
        if (notesWrap) notesWrap.style.display = show ? '' : 'none';
    }

    function showDisputeButtons() {
        showApproveRejectButtons(false);
        const approveBtn = document.getElementById('approveBtn');
        const footer = document.getElementById('modalFooter') || (approveBtn ? approveBtn.parentElement : null);
        if (!footer) return;
        const existing = footer.querySelector('.dispute-actions');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'dispute-actions';
        div.style.cssText = 'display:flex;gap:10px;margin-top:12px;';
        div.innerHTML = `
      <button onclick="resolveDispute('verified')"
        style="flex:1;padding:12px;background:#10B981;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">
        ✅ Resolve as Verified
      </button>
      <button onclick="resolveDispute('cancelled')"
        style="flex:1;padding:12px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">
        ❌ Resolve as Cancelled
      </button>
    `;
        footer.appendChild(div);
    }

})();
