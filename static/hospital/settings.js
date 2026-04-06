// Hospital Settings Module
(function () {
    'use strict';

    const state = {
        hospitalId: null,
        facilityCode: null,
        profileData: null
    };

    const elements = {
        tabs: document.querySelectorAll('.settings-tab'),
        panes: document.querySelectorAll('.settings-pane'),
        profileForm: document.getElementById('profileForm'),
        skeletons: document.querySelectorAll('.skeleton-wrapper')
    };

    window.initializePage = async function () {
        console.log('⚙️ Initializing Hospital Settings...');
        state.hospitalId = auth.currentUser?.uid;

        setupTabs();
        await loadHospitalProfile();
    };

    function setupTabs() {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                // Update active tab
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update active pane
                elements.panes.forEach(p => p.classList.remove('active'));
                document.getElementById(`pane-${target}`).classList.add('active');
            });
        });
    }

    async function loadHospitalProfile() {
        if (!state.hospitalId) return;

        try {
            // Fetch from Firestore
            const doc = await firestore.collection('hospitals').doc(state.hospitalId).get();

            if (doc.exists) {
                state.profileData = doc.data();
                state.facilityCode = state.profileData.facilityCode;
                fillProfileForm(state.profileData);
            } else {
                // Try searching by email if UID matches nothing (legacy)
                const email = auth.currentUser.email;
                const snapshot = await firestore.collection('hospitals')
                    .where('email', '==', email)
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    const hospitalDoc = snapshot.docs[0];
                    state.profileData = hospitalDoc.data();
                    state.hospitalId = hospitalDoc.id;
                    state.facilityCode = state.profileData.facilityCode;
                    fillProfileForm(state.profileData);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            window.utils.showNotification('Failed to load settings data', 'error');
        }
    }

    function fillProfileForm(data) {
        // Elements to fill
        const mapping = {
            'hospitalName': data.name,
            'facilityCode': data.facilityCode,
            'hospitalEmail': data.email,
            'hospitalPhone': data.phoneNumber,
            'hospitalCounty': data.county,
            'hospitalSubCounty': data.subCounty,
            'hospitalAddress': data.address
        };

        // Artificial delay to show off skeletons (per user request for modern feel)
        setTimeout(() => {
            for (const [id, value] of Object.entries(mapping)) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = value || '';
                    el.classList.remove('hidden');
                }
            }

            // Hide skeletons
            elements.skeletons.forEach(s => s.classList.add('hidden'));
        }, 1200);
    }

    // Handle profile update
    if (elements.profileForm) {
        elements.profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveProfileBtn');
            const spinner = btn.querySelector('.btn-spinner');

            btn.disabled = true;
            spinner.classList.remove('hidden');

            const formData = new FormData(elements.profileForm);
            const updates = Object.fromEntries(formData.entries());

            try {
                await firestore.collection('hospitals').doc(state.hospitalId).update({
                    ...updates,
                    updatedAt: new Date().toISOString()
                });

                window.utils.showNotification('Profile updated successfully', 'success');
            } catch (error) {
                console.error('Update error:', error);
                window.utils.showNotification('Failed to update profile', 'error');
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        });
    }

})();
