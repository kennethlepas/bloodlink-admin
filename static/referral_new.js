// Dedicated Referral Creation Module
(function () {
    'use strict';

    let allHospitals = [];
    let state = {
        currentHospitalId: null,
        myHospital: null
    };

    const elements = {
        referralForm: document.getElementById('referralForm'),
        targetFacility: document.getElementById('targetFacility'),
        cancelBtn: document.getElementById('cancelBtn')
    };

    window.initializePage = async function () {
        console.log('🚀 Initializing New Referral Screen...');

        if (window.hospitalData) {
            state.currentHospitalId = window.hospitalData.id || window.hospitalData.facilityCode;
            state.myHospital = window.hospitalData;
        }

        if (!state.currentHospitalId) {
            console.warn('Waiting for hospital data...');
            setTimeout(window.initializePage, 500);
            return;
        }

        setupEventListeners();
        await Promise.all([
            loadAllHospitals(),
            loadActiveRequests()
        ]);

        populateFacilityDropdown();
        checkDeepLinking();
        console.log('✅ New Referral Screen ready');

        console.log('✅ New Referral Screen ready');
    };

    function setupEventListeners() {
        if (elements.cancelBtn) {
            elements.cancelBtn.onclick = () => {
                window.location.href = '/hospital/referrals';
            };
        }

        const patientSelect = document.getElementById('patientName');
        const bloodTypeSelect = document.getElementById('referralBloodType');

        if (patientSelect && bloodTypeSelect) {
            patientSelect.onchange = (e) => {
                const selectedOption = e.target.selectedOptions[0];
                if (selectedOption && selectedOption.dataset.bloodType) {
                    bloodTypeSelect.value = selectedOption.dataset.bloodType;
                }
            };
        }

        if (elements.referralForm) {
            elements.referralForm.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(elements.referralForm);
                const targetId = formData.get('targetHospital');
                const targetHospital = allHospitals.find(h => h.id === targetId || h.name === targetId);

                // For the patientName, if it's a select, we get the text of the selected option
                const patientName = patientSelect.options[patientSelect.selectedIndex].text;

                const data = {
                    fromHospitalId: state.currentHospitalId,
                    fromHospitalName: state.myHospital?.name || 'Local Hospital',
                    toHospitalId: targetId,
                    toHospitalName: targetHospital?.name || targetId,
                    patientName: patientName,
                    bloodType: formData.get('bloodType'),
                    units: parseInt(formData.get('units')) || null,
                    urgency: formData.get('urgency'),
                    reason: formData.get('reason'),
                    notes: formData.get('notes') || null,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await submitReferral(data);
            };
        }
    }

    async function loadActiveRequests() {
        const patientSelect = document.getElementById('patientName');
        if (!patientSelect) return;

        try {
            console.log('Fetching active requests for hospital:', state.currentHospitalId);
            // Query requests where hospitalId matches
            const snap = await firestore.collection('blood_requests')
                .where('hospitalId', '==', state.currentHospitalId)
                .where('status', '==', 'pending')
                .get();

            if (snap.empty) {
                patientSelect.innerHTML = '<option value="">No active requests found</option>';
                return;
            }

            let html = '<option value="">— Select Patient —</option>';
            snap.forEach(doc => {
                const req = doc.data();
                html += `<option value="${doc.id}" data-blood-type="${req.bloodType}">${req.patientName} (${req.bloodType})</option>`;
            });
            patientSelect.innerHTML = html;
        } catch (e) {
            console.error('loadActiveRequests:', e);
            patientSelect.innerHTML = '<option value="">Error loading patients</option>';
        }
    }

    async function loadAllHospitals() {
        try {
            const snap = await database.ref('bloodBanks').once('value');
            const data = snap.val() || {};
            allHospitals = Object.entries(data).map(([id, b]) => ({ id, ...b }));
        } catch (e) {
            console.error('loadAllHospitals:', e);
            window.utils.showNotification('Failed to load blood banks', 'error');
        }
    }

    function populateFacilityDropdown() {
        if (!elements.targetFacility) return;
        const myName = state.myHospital?.name;
        const myCode = state.myHospital?.facilityCode || state.myHospital?.code;

        elements.targetFacility.innerHTML = '<option value="">— Select target facility —</option>' +
            allHospitals
                .filter(h => h.name !== myName && h.code !== myCode)
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(h => `<option value="${h.id || h.name}">${h.name} (${h.county || 'Kenya'})</option>`)
                .join('');
    }

    function checkDeepLinking() {
        const urlParams = new URLSearchParams(window.location.search);

        // Handle parameters from Super Admin 'Refer' button
        const targetFacilityId = urlParams.get('targetFacility');
        const facilityName = urlParams.get('facilityName');

        // Handle existing parameters (if any)
        const target = urlParams.get('target') || urlParams.get('targetName');
        const targetId = urlParams.get('targetId');

        const finalId = targetFacilityId || targetId;
        const finalName = facilityName || target;

        if (finalId) {
            const opt = Array.from(elements.targetFacility.options).find(o => o.value === finalId);
            if (opt) {
                elements.targetFacility.value = opt.value;
            } else if (finalName) {
                const nameOpt = Array.from(elements.targetFacility.options).find(o => o.text.includes(finalName));
                if (nameOpt) elements.targetFacility.value = nameOpt.value;
            }
        } else if (finalName) {
            const opt = Array.from(elements.targetFacility.options).find(o => o.text.includes(finalName) || o.value === finalName);
            if (opt) {
                elements.targetFacility.value = opt.value;
            }
        }
    }

    async function submitReferral(data) {
        const btn = document.getElementById('sendReferralBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'Submitting...';
        }

        try {
            const refDoc = await firestore.collection('hospital_referrals').add(data);
            const referralId = refDoc.id;

            // 🏆 New: Trigger notification for the target hospital
            try {
                await firestore.collection('notifications').add({
                    recipientId: data.toHospitalId,
                    type: 'system_alert',
                    title: 'New Referral Received 🏥',
                    message: `You have received a new referral for ${data.patientName} (Blood Type: ${data.bloodType}) from ${data.fromHospitalName}.`,
                    data: { referralId: referralId, type: 'referral_new' },
                    isRead: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (notifErr) {
                console.warn('Failed to send referral creation notification:', notifErr);
            }

            // Log this action
            if (window.auditLogs && window.auditLogs.log) {
                await window.auditLogs.log({
                    action: 'create',
                    resourceType: 'referral',
                    resourceId: data.patientName,
                    details: {
                        to: data.toHospitalName,
                        patient: data.patientName
                    }
                });
            }

            window.utils.showNotification('Referral submitted successfully!', 'success');
            setTimeout(() => {
                window.location.href = '/hospital/referrals?tab=outbox';
            }, 1000);
        } catch (e) {
            console.error('submitReferral:', e);
            window.utils.showNotification('Failed to submit referral: ' + e.message, 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>📤</span> Submit Referral';
            }
        }
    }

})();
