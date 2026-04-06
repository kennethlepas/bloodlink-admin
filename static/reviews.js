// Reviews Management Module
(function () {
    'use strict';

    // State
    let reviews = [];
    let currentUser = null;

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('reviewsTableBody'),
        searchInput: document.getElementById('reviewsSearch'),
        statusFilter: document.getElementById('reviewStatusFilter'),
        ratingFilter: document.getElementById('ratingFilter'),
        detailsModal: document.getElementById('reviewDetailsModal'),
        detailsContent: document.getElementById('reviewDetailsContent'),
        detailsActions: document.getElementById('reviewActions'),
        closeModal: document.getElementById('closeReviewModal')
    };

    // Initialize
    window.initializePage = function () {
        console.log('Initializing reviews page...');
        currentUser = window.getCurrentUser();
        setupEventListeners();
        return loadReviews();
    };

    // Setup event listeners
    function setupEventListeners() {
        // Search functionality
        elements.searchInput.addEventListener('input', window.utils.debounce(renderReviews, 300));

        // Filter functionality
        elements.statusFilter.addEventListener('change', renderReviews);
        elements.ratingFilter.addEventListener('change', renderReviews);

        // Modal close
        elements.closeModal.addEventListener('click', closeDetailsModal);
        elements.detailsModal.addEventListener('click', (e) => {
            if (e.target === elements.detailsModal) closeDetailsModal();
        });
    }

    // Load reviews data
    function loadReviews() {
        return new Promise((resolve) => {
            firestore.collection('reviews').onSnapshot(snapshot => {
                reviews = [];
                snapshot.forEach(doc => {
                    reviews.push({ id: doc.id, ...doc.data() });
                });

                console.log('Reviews loaded:', reviews.length);
                renderReviews();
                resolve();
            }, error => {
                console.error('Error loading reviews:', error);
                window.utils.showNotification('Error loading reviews', 'error');
                resolve();
            });
        });
    }

    // Render reviews table
    function renderReviews() {
        const searchTerm = elements.searchInput.value.toLowerCase();
        const statusFilter = elements.statusFilter.value;
        const ratingFilter = elements.ratingFilter.value;

        // Filter reviews
        let filtered = reviews;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(review => {
                return (review.userName || '').toLowerCase().includes(searchTerm) ||
                    (review.review || '').toLowerCase().includes(searchTerm) ||
                    (review.bloodType || '').toLowerCase().includes(searchTerm) ||
                    (review.userType || '').toLowerCase().includes(searchTerm);
            });
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(review => (review.status || 'pending') === statusFilter);
        }

        // Apply rating filter
        if (ratingFilter !== 'all') {
            filtered = filtered.filter(review => review.rating === parseInt(ratingFilter));
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // Render table
        if (filtered.length === 0) {
            const message = reviews.length === 0
                ? 'No reviews found'
                : 'No reviews found matching your filters';

            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-state-icon">⭐</div>
                        <p>${message}</p>
                    </td>
                </tr>
            `;
            return;
        }

        elements.tableBody.innerHTML = filtered.map(review => {
            const userName = review.userName || 'Anonymous';
            const userType = review.userType || 'N/A';
            const bloodType = review.bloodType || 'N/A';
            const rating = review.rating || 0;
            const reviewText = review.review || '';
            const status = review.status || 'pending';
            const createdAt = window.utils.formatDate(review.createdAt);

            const stars = window.utils.generateStarRating(rating);
            const displayReview = reviewText.length > 50
                ? reviewText.substring(0, 50) + '...'
                : reviewText;

            const userTypeClass = userType === 'donor' ? 'status-verified' : 'status-pending';
            const bloodTypeClass = window.utils.getBloodTypeClass(bloodType);
            const statusClass = window.utils.getStatusClass(status);

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #DC2626, #991B1B); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                                ${userName.charAt(0).toUpperCase()}
                            </div>
                            <strong>${userName}</strong>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${userTypeClass}">
                            ${userType}
                        </span>
                    </td>
                    <td>
                        <span class="blood-type-badge ${bloodTypeClass}">
                            ${bloodType}
                        </span>
                    </td>
                    <td style="font-size: 16px;">${stars}</td>
                    <td>
                        <div class="text-truncate-250" title="${reviewText}">
                            ${displayReview}
                        </div>
                    </td>
                    <td class="cell-sub">${createdAt}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${status}
                        </span>
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="action-btn action-btn-edit" onclick="window.viewReview('${review.id}')">
                            👁️ View
                        </button>
                        ${status === 'pending' ? `
                            <button class="action-btn action-btn-success" onclick="window.approveReview('${review.id}')">
                                ✅
                            </button>
                            <button class="action-btn action-btn-danger" onclick="window.rejectReview('${review.id}')">
                                ❌
                            </button>
                        ` : status === 'approved' ? `
                            <button class="action-btn action-btn-danger" onclick="window.rejectReview('${review.id}')">
                                ❌
                            </button>
                        ` : `
                            <button class="action-btn action-btn-success" onclick="window.approveReview('${review.id}')">
                                ✅
                            </button>
                        `}
                        <button class="action-btn action-btn-danger" onclick="window.deleteReview('${review.id}')">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // View review details
    window.viewReview = function (id) {
        const review = reviews.find(r => r.id === id);
        if (!review) {
            window.utils.showNotification('Review not found', 'error');
            return;
        }

        const stars = window.utils.generateStarRating(review.rating || 0);
        const createdAt = window.utils.formatDateTime(review.createdAt);
        const userTypeClass = review.userType === 'donor' ? 'status-verified' : 'status-pending';
        const bloodTypeClass = window.utils.getBloodTypeClass(review.bloodType || 'A+');
        const statusClass = window.utils.getStatusClass(review.status || 'pending');

        elements.detailsContent.innerHTML = `
            <div style="margin-bottom: 24px;">
                <div class="table-cell-flex" style="margin-bottom: 16px;">
                    <div class="avatar-initial-sm avatar-initial-red avatar-lg">
                        ${(review.userName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div class="cell-info">
                        <h3 class="cell-main" style="font-size: 20px; margin: 0;">${review.userName || 'Anonymous'}</h3>
                        <div style="display: flex; gap: 8px; margin-top: 6px;">
                            <span class="status-badge ${userTypeClass}">${review.userType || 'N/A'}</span>
                            <span class="blood-type-badge ${bloodTypeClass}">${review.bloodType || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="review-card-static">
                    <div class="review-stars-lg">${stars}</div>
                    <div class="cell-sub">Rating: ${review.rating || 0}/5</div>
                </div>
                
                <div class="review-card-static">
                    <h4 class="cell-sub" style="margin-bottom: 12px; text-transform: uppercase; font-weight: 600;">Review</h4>
                    <p class="cell-main" style="font-weight: 400; line-height: 1.7;">${review.review || 'No review text provided'}</p>
                </div>
                
                ${review.category ? `
                    <div class="review-card-static">
                        <h4 class="cell-sub" style="margin-bottom: 8px; text-transform: uppercase;">Category</h4>
                        <span class="status-badge" style="background: #E0E7FF; color: #4338CA;">
                            ${review.category}
                        </span>
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 20px; font-size: 13px; color: #64748B; flex-wrap: wrap;">
                    <div>
                        <strong>Submitted:</strong> ${createdAt}
                    </div>
                    <div>
                        <strong>Status:</strong> 
                        <span class="status-badge ${statusClass}">
                            ${review.status || 'pending'}
                        </span>
                    </div>
                </div>
            </div>
        `;

        // Populate action buttons
        if (review.status === 'pending') {
            elements.detailsActions.innerHTML = `
                <button class="btn-primary" onclick="window.approveReviewFromModal('${review.id}')">
                    ✅ Approve Review
                </button>
                <button class="action-btn action-btn-danger" onclick="window.rejectReviewFromModal('${review.id}')">
                    ❌ Reject Review
                </button>
                <button class="btn-secondary" onclick="window.closeReviewDetails()">
                    Close
                </button>
            `;
        } else if (review.status === 'approved') {
            elements.detailsActions.innerHTML = `
                <button class="action-btn action-btn-danger" onclick="window.rejectReviewFromModal('${review.id}')">
                    ❌ Reject Review
                </button>
                <button class="btn-secondary" onclick="window.closeReviewDetails()">
                    Close
                </button>
            `;
        } else {
            elements.detailsActions.innerHTML = `
                <button class="btn-primary" onclick="window.approveReviewFromModal('${review.id}')">
                    ✅ Approve Review
                </button>
                <button class="btn-secondary" onclick="window.closeReviewDetails()">
                    Close
                </button>
            `;
        }

        elements.detailsModal.classList.add('show');
    };

    // Approve review
    window.approveReview = async function (id) {
        if (!window.utils.confirmAction('Are you sure you want to approve this review? It will be visible to all users.')) {
            return;
        }

        try {
            await firestore.collection('reviews').doc(id).update({
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: currentUser ? currentUser.email : 'admin'
            });

            window.utils.showNotification('Review approved successfully', 'success');
        } catch (error) {
            console.error('Error approving review:', error);
            window.utils.showNotification('Failed to approve review', 'error');
        }
    };

    // Reject review
    window.rejectReview = async function (id) {
        const reason = prompt('Please provide a reason for rejection (optional):');
        if (reason === null) return; // User cancelled

        try {
            await firestore.collection('reviews').doc(id).update({
                status: 'rejected',
                rejectedAt: new Date().toISOString(),
                rejectedBy: currentUser ? currentUser.email : 'admin',
                rejectionReason: reason || 'No reason provided'
            });

            window.utils.showNotification('Review rejected', 'success');
        } catch (error) {
            console.error('Error rejecting review:', error);
            window.utils.showNotification('Failed to reject review', 'error');
        }
    };

    // Delete review
    window.deleteReview = async function (id) {
        const review = reviews.find(r => r.id === id);
        if (!review) {
            window.utils.showNotification('Review not found', 'error');
            return;
        }

        const message = `Are you sure you want to permanently delete this review?\n\nFrom: ${review.userName}\nRating: ${review.rating}/5\n\nThis action cannot be undone.`;

        if (!window.utils.confirmAction(message)) {
            return;
        }

        try {
            await firestore.collection('reviews').doc(id).delete();
            window.utils.showNotification('Review deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting review:', error);
            window.utils.showNotification('Failed to delete review', 'error');
        }
    };

    // Approve review from modal
    window.approveReviewFromModal = async function (id) {
        await window.approveReview(id);
        closeDetailsModal();
    };

    // Reject review from modal
    window.rejectReviewFromModal = async function (id) {
        await window.rejectReview(id);
        closeDetailsModal();
    };

    // Close details modal
    function closeDetailsModal() {
        elements.detailsModal.classList.remove('show');
    }

    window.closeReviewDetails = closeDetailsModal;

})();