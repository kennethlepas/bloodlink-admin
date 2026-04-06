// Hospital Directory Module
(function () {
    'use strict';

    let allHospitals = [];
    let bloodBanks = {};

    window.initializePage = async function () {
        console.log('🏥 Initializing Blood Banks directory...');
        setupEventListeners();
        await loadHospitals();
    };

    function setupEventListeners() {
        const searchInput = document.getElementById('hospitalSearch');
        const typeFilter = document.getElementById('bloodTypeFilter');

        const filterHandler = () => renderHospitals();
        if (searchInput) searchInput.addEventListener('input', filterHandler);
        if (typeFilter) typeFilter.addEventListener('change', filterHandler);
    }

    async function loadHospitals() {
        const tableBody = document.getElementById('hospitalsTableBody');
        if (!tableBody) return;

        try {
            // 1. Fetch all hospitals from Firestore
            const hospitalsSnapshot = await firestore.collection('hospitals').get();
            allHospitals = hospitalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. Fetch all blood bank inventory from Realtime Database
            database.ref('bloodBanks').on('value', snapshot => {
                bloodBanks = snapshot.val() || {};
                renderHospitals();
            });
        } catch (error) {
            console.error('Error loading hospitals:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="error-text">Failed to load hospital data.</div></td></tr>';
        }
    }

    function renderHospitals() {
        const tableBody = document.getElementById('hospitalsTableBody');
        const searchQuery = document.getElementById('hospitalSearch')?.value.toLowerCase() || '';
        const selectedType = document.getElementById('bloodTypeFilter')?.value || '';

        if (!tableBody) return;

        // Get current user's identification keys
        const hospital = window.hospitalData;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        const myEmailKey = hospital?.email?.replace(/\./g, ',') || auth.currentUser?.email?.replace(/\./g, ',');
        const myFacilityCode = hospital?.facilityCode || hospital?.code || user?.facilityCode;

        let filtered = allHospitals.filter(h => {
            const isSelf = h.id === myEmailKey || h.facilityCode === myFacilityCode || h.email === (hospital?.email || auth.currentUser?.email);
            return !isSelf;
        });

        if (searchQuery) {
            filtered = filtered.filter(h =>
                (h.name || '').toLowerCase().includes(searchQuery) ||
                (h.county || '').toLowerCase().includes(searchQuery)
            );
        }

        if (selectedType) {
            // Filter hospitals that HAVE the selected blood type in stock
            filtered = filtered.filter(h => {
                const bank = Object.values(bloodBanks).find(b => b.facilityCode === h.facilityCode);
                return bank && bank.inventory && bank.inventory[selectedType] && bank.inventory[selectedType].units > 0;
            });
        }

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <p>No other hospitals found matching your selection.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(h => {
            const bank = Object.values(bloodBanks).find(b => b.facilityCode === h.facilityCode || b.name === h.name);
            const inventory = bank?.inventory || {};
            const availableTypes = Object.entries(inventory)
                .filter(([, data]) => data && data.units > 0)
                .map(([type]) => type);

            const logoHtml = h.imageUrl || bank?.imageUrl
                ? `<img src="${h.imageUrl || bank?.imageUrl}" alt="" class="avatar-sm">`
                : `<div class="avatar-placeholder-sm">🏥</div>`;

            let typesHtml = '';
            if (availableTypes.length === 0) {
                typesHtml = `<span style="color:rgba(255,255,255,0.3);font-size:12px;">None</span>`;
            } else {
                const show = availableTypes.slice(0, 4);
                const rest = availableTypes.length - show.length;
                typesHtml = show.map(t => {
                    const cls = t.startsWith('AB') ? 'badge-ab-pos'
                        : t.startsWith('A') ? 'badge-a-pos'
                            : t.startsWith('B') ? 'badge-b-pos'
                                : 'badge-o-pos';
                    return `<span class="blood-type-badge ${cls}" style="background:rgba(255,255,255,0.1);">${t}</span>`;
                }).join('');
                if (rest > 0) {
                    typesHtml += `<span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:4px;">+${rest}</span>`;
                }
            }

            return `
                <tr>
                    <td>
                        <div class="table-cell-flex">
                            ${logoHtml}
                            <div class="cell-info">
                                <span class="cell-main">${h.name || 'Unnamed Facility'}</span>
                                <span class="cell-sub">
                                    <span style="color:${h.isVerified ? '#10B981' : 'rgba(255,255,255,0.3)'};">
                                        ${h.isVerified ? '✓ Verified' : '○ Unverified'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="cell-info">
                            <span class="cell-main">${h.county || 'N/A'}${h.subCounty ? ', ' + h.subCounty : ''}</span>
                            <span class="cell-sub">${h.address || ''}</span>
                        </div>
                    </td>
                    <td>
                        <div class="cell-info">
                            <span class="cell-main">${h.phoneNumber || 'N/A'}</span>
                            <span class="cell-sub">${h.email || ''}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;flex-wrap:wrap;gap:2px;">
                            ${typesHtml}
                        </div>
                    </td>
                    <td>
                        <button class="action-btn action-btn-success" onclick="viewHospitalDetails('${h.id}')">
                            📊 Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ========== Hospital Detail Modal ==========

    window.viewHospitalDetails = function (hospitalId) {
        const hospital = allHospitals.find(h => h.id === hospitalId);
        if (!hospital) return;

        const bank = Object.values(bloodBanks).find(b => b.facilityCode === hospital.facilityCode);
        const inventory = bank?.inventory || {};
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        const modal = document.getElementById('hospitalDetailModal');
        const content = document.getElementById('hospitalDetailContent');
        const actions = document.getElementById('hospitalDetailActions');
        const titleEl = document.getElementById('detailModalTitle');
        const subtitleEl = document.getElementById('detailModalSubtitle');

        if (!modal || !content) return;

        if (titleEl) titleEl.textContent = hospital.name || 'Hospital Details';
        if (subtitleEl) subtitleEl.textContent = `${hospital.county || ''}${hospital.subCounty ? ', ' + hospital.subCounty : ''} · ${hospital.facilityCode || 'N/A'}`;

        // Build inventory cards
        const inventoryHtml = bloodTypes.map(type => {
            const data = inventory[type] || {};
            const units = data.units || 0;
            const stockClass = units === 0 ? 'stock-out' : units < 20 ? 'stock-low' : 'stock-ok';
            const statusClass = units === 0 ? 's-out' : units < 20 ? 's-low' : 's-ok';
            const statusLabel = units === 0 ? 'OUT' : units < 20 ? 'LOW' : 'OK';
            const lastUpdated = data.lastUpdated
                ? new Date(data.lastUpdated).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
                : '—';

            return `
                <div class="detail-blood-card ${stockClass}">
                    <div class="detail-blood-type">${type}</div>
                    <div class="detail-blood-units">${units}</div>
                    <div class="detail-blood-status ${statusClass}">${statusLabel}</div>
                    <div class="detail-blood-updated">${lastUpdated}</div>
                </div>
            `;
        }).join('');

        // Build contact section
        const contactHtml = `
            <div class="detail-contact-grid">
                <div class="detail-contact-item">
                    <div class="detail-contact-label">📧 Email</div>
                    <div class="detail-contact-value">${hospital.email || 'Not available'}</div>
                </div>
                <div class="detail-contact-item">
                    <div class="detail-contact-label">📞 Phone</div>
                    <div class="detail-contact-value">${hospital.phoneNumber || hospital.phone || 'Not available'}</div>
                </div>
                <div class="detail-contact-item full-width">
                    <div class="detail-contact-label">📍 Address</div>
                    <div class="detail-contact-value">${hospital.address || [hospital.county, hospital.subCounty].filter(Boolean).join(', ') || 'Not available'}</div>
                </div>
                <div class="detail-contact-item">
                    <div class="detail-contact-label">🏷️ Facility Code</div>
                    <div class="detail-contact-value">${hospital.facilityCode || 'N/A'}</div>
                </div>
                <div class="detail-contact-item">
                    <div class="detail-contact-label">🏥 Type</div>
                    <div class="detail-contact-value">${hospital.type || hospital.facilityType || 'Hospital'}</div>
                </div>
            </div>
        `;

        // Assemble content
        content.innerHTML = `
            <div class="detail-hospital-header">
                <div class="detail-hospital-avatar">🏥</div>
                <div>
                    <div class="detail-hospital-name">${hospital.name || 'Unnamed Facility'}</div>
                    <div class="detail-hospital-meta">
                        <span>📍 ${hospital.county || 'Unknown'}${hospital.subCounty ? ', ' + hospital.subCounty : ''}</span>
                        <span>🏷️ ${hospital.facilityCode || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <span>🩸</span> Blood Inventory
                </div>
                <div class="detail-inventory-grid">
                    ${inventoryHtml}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <span>📋</span> Contact Information
                </div>
                ${contactHtml}
            </div>
        `;

        // Action buttons
        const chatUrl = `/hospital/chat?targetId=${encodeURIComponent(hospital.facilityCode || '')}&targetName=${encodeURIComponent(hospital.name || '')}`;
        const referUrl = `/hospital/referrals?to=${encodeURIComponent(hospital.facilityCode || '')}`;

        actions.innerHTML = `
            <a href="${chatUrl}" class="detail-action-btn detail-btn-chat">
                💬 Message This Hospital
            </a>
            <a href="${referUrl}" class="detail-action-btn detail-btn-refer">
                🔗 Refer Patient
            </a>
            <button class="detail-action-btn detail-btn-close" onclick="closeHospitalDetail()">
                Close
            </button>
        `;

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    window.closeHospitalDetail = function () {
        const modal = document.getElementById('hospitalDetailModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    };

    // Close on backdrop click
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('hospitalDetailModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeHospitalDetail();
            });
        }
    });

})();
