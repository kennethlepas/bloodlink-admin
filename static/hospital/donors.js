// Nearby Donors Module for Hospital Admin
(function () {
    'use strict';

    let allDonors = [];
    let hospitalLocation = null;
    let donations = [];
    let selectedDonor = null;

    const elements = {
        donorDetailModal: document.getElementById('donorDetailModal'),
        closeDonorModal: document.getElementById('closeDonorModal'),
        cancelDonorModal: document.getElementById('cancelDonorModal'),
        donorModalSubtitle: document.getElementById('donorModalSubtitle'),
        donorDetailsContent: document.getElementById('donorDetailsContent')
    };

    window.initializePage = async function () {
        console.log('🧔 Initializing Nearby Donors Module...');
        setupEventListeners();

        // Load donations once
        loadDonations();

        // Wait for hospital data to be ready
        if (!window.hospitalData) {
            console.warn('Waiting for hospital data...');
            setTimeout(window.initializePage, 500);
            return;
        }

        // Support both nested .location object and top-level coordinates
        hospitalLocation = window.hospitalData.location || {
            lat: window.hospitalData.latitude || window.hospitalData.lat,
            lng: window.hospitalData.longitude || window.hospitalData.lng
        };

        if (!hospitalLocation || (!hospitalLocation.lat && !hospitalLocation.latitude)) {
            console.warn('Hospital location not found in Firestore data. Attempting CSV fallback...');
            try {
                const response = await fetch('/static/kenya-hospitals.csv');
                const csvText = await response.text();
                const rows = csvText.split('\n').filter(r => r.trim()).slice(1);
                const facilityCode = window.hospitalData.facilityCode || window.myFacilityCode;

                const hospital = rows.find(row => {
                    const cols = row.split(',').map(c => c.trim());
                    return cols[0] === facilityCode;
                });

                if (hospital) {
                    const cols = hospital.split(',').map(c => c.trim());
                    const lat = parseFloat(cols[26]);
                    const lng = parseFloat(cols[27]);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        hospitalLocation = { lat, lng };
                        console.log('✅ Found hospital location in CSV:', hospitalLocation);
                    }
                }
            } catch (err) {
                console.error('CSV fallback failed:', err);
            }

            if (!hospitalLocation || (!hospitalLocation.lat && !hospitalLocation.latitude)) {
                console.warn('Hospital location still not found. Distance calculations will be disabled.');
            }
        }

        await loadNearbyDonors();
    };

    function setupEventListeners() {
        document.getElementById('donorSearch')?.addEventListener('input', filterDonors);
        document.getElementById('bloodTypeFilter')?.addEventListener('change', filterDonors);
        document.getElementById('distanceFilter')?.addEventListener('change', filterDonors);

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
    }

    // Load donations from Firestore to calculate accurate totals
    function loadDonations() {
        firestore
            .collection('donations')
            .onSnapshot(snapshot => {
                donations = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('Donations loaded:', donations.length);
                if (allDonors.length > 0) renderDonors(allDonors);
            }, err => {
                console.error('Error loading donations:', err);
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
        if (totalDonations >= 50) return { class: 'donor-badge-platinum', text: '🏆 Platinum' };
        if (totalDonations >= 25) return { class: 'donor-badge-gold', text: '🥇 Gold' };
        if (totalDonations >= 10) return { class: 'donor-badge-silver', text: '🥈 Silver' };
        if (totalDonations >= 5) return { class: 'donor-badge-bronze', text: '🥉 Bronze' };
        if (totalDonations >= 1) return { class: 'donor-badge-starter', text: '⭐ Starter' };
        return null;
    }

    window.loadNearbyDonors = async function () {
        const grid = document.getElementById('donorsGrid');
        if (!grid) return;

        grid.innerHTML = `<tr><td colspan="6" class="empty-state">
            <div class="loading-spinner"></div>
            <p>Locating donors...</p>
        </td></tr>`;

        // If no hospital location, auto-set distance filter to 'Any Distance'
        const hasLocation = hospitalLocation && (hospitalLocation.lat || hospitalLocation.latitude);
        if (!hasLocation) {
            const distFilter = document.getElementById('distanceFilter');
            if (distFilter) distFilter.value = 'all';
        }

        try {
            // Fetch donors from 'users' collection
            const snapshot = await firestore.collection('users')
                .where('userType', '==', 'donor')
                .get();

            allDonors = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const donorLoc = data.location;

                // Construct donor name from firstName and lastName
                let donorName = 'Anonymous Donor';
                if (data.firstName || data.lastName) {
                    donorName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                } else {
                    donorName = data.name || data.displayName || data.email || 'Anonymous Donor';
                }

                let distance = null;
                if (hasLocation) {
                    const hLat = hospitalLocation.lat || hospitalLocation.latitude;
                    const hLng = hospitalLocation.lng || hospitalLocation.longitude;
                    const dLat = donorLoc ? (donorLoc.lat || donorLoc.latitude) : null;
                    const dLng = donorLoc ? (donorLoc.lng || donorLoc.longitude) : null;

                    if (hLat && hLng && dLat && dLng) {
                        distance = calculateDistance(hLat, hLng, dLat, dLng);
                    }
                }

                allDonors.push({
                    id: doc.id,
                    name: donorName,
                    email: data.email || '—',
                    phoneNumber: data.phoneNumber || data.phone || '—',
                    bloodType: data.bloodType || 'Unknown',
                    weight: data.weight || null,
                    lastDonation: data.lastDonationAt || data.lastDonationDate || 'Never',
                    distance: distance,
                    isAvailable: data.isAvailable !== false,
                    createdAt: data.createdAt || null
                });
            });

            // Sort: available first, then by distance (null distances at end)
            allDonors.sort((a, b) => {
                if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
                if (a.distance === null && b.distance === null) return 0;
                if (a.distance === null) return 1;
                if (b.distance === null) return -1;
                return a.distance - b.distance;
            });

            renderDonors(allDonors);
        } catch (error) {
            console.error('Error loading donors:', error);
            grid.innerHTML = `<tr><td colspan="8" class="empty-state">❌ Error loading donors. Please try again.</td></tr>`;
        }
    };

    window.viewDonorDetails = function (donorId, event) {
        if (event) event.stopPropagation();

        const donor = allDonors.find(d => d.id === donorId);
        if (!donor) return;

        selectedDonor = donor;

        if (elements.donorModalSubtitle) {
            elements.donorModalSubtitle.textContent = donor.name;
        }

        if (elements.donorDetailsContent) {
            elements.donorDetailsContent.innerHTML = renderDonorDetailsContent(donor);
        }

        if (elements.donorDetailModal) {
            elements.donorDetailModal.classList.add('show');
        }
    };

    function closeDonorModal() {
        if (elements.donorDetailModal) {
            elements.donorDetailModal.classList.remove('show');
        }
        selectedDonor = null;
    }

    function renderDonors(donors) {
        const grid = document.getElementById('donorsGrid');
        if (!grid) return;

        if (donors.length === 0) {
            grid.innerHTML = `<tr><td colspan="8" class="empty-state">
                <div class="empty-state-icon">🧔</div>
                <p>No donors found matching your filters</p>
                <p style="font-size: 12px; margin-top: 8px;">Try adjusting the blood type or distance filters</p>
            </td></tr>`;
            return;
        }

        grid.innerHTML = donors.map(d => {
            const stats = getDonorStats(d.id);
            const badge = getDonorBadge(stats.totalDonations);
            const btClass = getBloodTypeClass(d.bloodType);

            return `
                <tr onclick="window.viewDonorDetails('${d.id}', event)" style="cursor: pointer;">
                    <td>
                        <div class="table-cell-flex">
                            <div class="avatar-initial-sm avatar-initial-red">${escapeHtml(d.name).charAt(0)}</div>
                            <div class="cell-info">
                                <span class="cell-main">${escapeHtml(d.name)}</span>
                                ${badge ? `<span class="donor-badge ${badge.class}" style="font-size: 10px;">${badge.text}</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="cell-info">
                            <span class="cell-main" style="font-size: 12px;">${escapeHtml(d.email || '—')}</span>
                            <span class="cell-sub">${escapeHtml(d.phoneNumber || '—')}</span>
                        </div>
                    </td>
                    <td><span class="blood-type-badge ${btClass}">${d.bloodType}</span></td>
                    <td style="font-weight:600; font-size: 13px;">${d.weight ? `${d.weight} kg` : '—'}</td>
                    <td>
                        <div style="font-weight:700;color:#059669;font-size:16px;">${stats.totalDonations}</div>
                        <div style="font-size:10px;color:#3B82F6;">💉 ${stats.totalUnits} units</div>
                    </td>
                    <td style="font-weight: 600; color: #3b82f6;">${d.distance !== null ? `${d.distance.toFixed(1)} km` : '—'}</td>
                    <td>
                        <span class="status-badge ${d.isAvailable ? 'status-active' : 'status-pending'}">
                            ${d.isAvailable ? '✅ Available' : '⌛ On hold'}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <button class="action-btn action-btn-info" onclick="window.viewDonorDetails('${d.id}', event)">
                                👁️ View
                            </button>
                            <button class="action-btn action-btn-edit" onclick="startChatWithUser('${d.id}', '${escapeHtml(d.name)}')">
                                💬 Chat
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderDonorDetailsContent(donor) {
        const stats = getDonorStats(donor.id);
        const badge = getDonorBadge(stats.totalDonations);
        const btClass = getBloodTypeClass(donor.bloodType);
        const joinedDate = donor.createdAt ? new Date(donor.createdAt).toLocaleDateString() : '—';

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
                    <span>${escapeHtml(donor.name)}</span>
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
                    <span><span class="blood-type-badge ${btClass}">${donor.bloodType || '—'}</span></span>
                </div>
                <div class="detail-item">
                    <label>Weight</label>
                    <span>${donor.weight ? `${donor.weight} kg` : '—'}</span>
                </div>
                <div class="detail-item">
                    <label>Distance from You</label>
                    <span>${donor.distance !== null ? `${donor.distance.toFixed(2)} km` : 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <label>Donor Level</label>
                    <span>${badge ? `<span class="donor-badge ${badge.class}">${badge.text}</span>` : 'Regular Donor'}</span>
                </div>
                <div class="detail-item">
                    <label>Next Eligibility</label>
                    <span>${stats.nextEligibility ? stats.nextEligibility.toLocaleDateString() : 'Eligible now'}</span>
                </div>
            </div>
            
            ${stats.allDonations.length > 0 ? `
                <div class="batch-history">
                    <h4>📊 Donation History</h4>
                    <div style="overflow-x: auto;">
                        <table class="batch-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Location</th>
                                    <th>Blood Type</th>
                                    <th>Units</th>
                                    <th>Points</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.allDonations.map(donation => `
                                    <tr>
                                        <td>${new Date(donation.donationDate).toLocaleDateString()}</td>
                                        <td>${escapeHtml(donation.bloodBankName || 'Medical Facility')}</td>
                                        <td><span class="blood-type-badge ${getBloodTypeClass(donation.bloodType)}">${donation.bloodType}</span></td>
                                        <td>${donation.unitsCollected || 1}</td>
                                        <td style="color: #D97706; font-weight: 600;">+${donation.pointsEarned || 0}</td>
                                        <td><span class="status-badge status-verified">Completed</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : '<div class="empty-state"><p>No previous donation records found</p></div>'}
        `;
    }

    function filterDonors() {
        const search = document.getElementById('donorSearch')?.value.toLowerCase() || '';
        const bloodType = document.getElementById('bloodTypeFilter')?.value || 'all';
        const maxDistance = document.getElementById('distanceFilter')?.value || 'all';

        const filtered = allDonors.filter(d => {
            const matchesSearch = !search || d.name.toLowerCase().includes(search) || d.bloodType.toLowerCase().includes(search);
            const matchesBlood = bloodType === 'all' || d.bloodType === bloodType;
            // Include donors with unknown distance unless a specific range is selected
            const matchesDist = maxDistance === 'all' || d.distance === null || (d.distance !== null && d.distance <= parseInt(maxDistance));
            return matchesSearch && matchesBlood && matchesDist;
        });

        renderDonors(filtered);
    }

    // Haversine formula to calculate distance between two points in km
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    window.startChatWithUser = function (userId, userName) {
        window.location.href = `/hospital/chat?targetId=${userId}&targetName=${encodeURIComponent(userName)}`;
    };

    function formatDate(val) {
        if (!val || val === 'Never') return 'Never';
        try {
            const d = new Date(val);
            return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return val; }
    }

    function getBloodTypeClass(bt) {
        if (!bt) return 'badge-o-pos';
        const type = bt.replace('+', '-pos').replace('-', '-neg').toLowerCase();
        return `badge-${type}`;
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" }[m]));
    }
    // Handle early initialization if auth is already ready
    if (window.hospitalData) {
        window.initializePage();
    }

})();
