// Utilities Module - Shared Helper Functions

// Format date to readable string
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format date with time
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format phone number
function formatPhoneNumber(phone) {
    if (!phone) return 'Not provided';
    return phone;
}

// Get blood type color class
function getBloodTypeClass(bloodType) {
    const type = bloodType.toUpperCase();

    if (type.startsWith('A')) {
        return type.includes('+') ? 'badge-a-pos' : 'badge-a-neg';
    } else if (type.startsWith('B')) {
        return type.includes('+') ? 'badge-b-pos' : 'badge-b-neg';
    } else if (type.startsWith('AB')) {
        return type.includes('+') ? 'badge-ab-pos' : 'badge-ab-neg';
    } else if (type.startsWith('O')) {
        return type.includes('+') ? 'badge-o-pos' : 'badge-o-neg';
    }

    return 'badge-a-pos';
}

// Get status badge class
function getStatusClass(status) {
    switch (status) {
        case 'verified':
        case 'approved':
        case 'completed':
            return 'status-verified';
        case 'pending':
            return 'status-pending';
        case 'critical':
        case 'rejected':
        case 'cancelled':
            return 'status-critical';
        case 'urgent':
            return 'status-urgent';
        case 'moderate':
            return 'status-moderate';
        default:
            return 'status-pending';
    }
}

// Get stock status emoji and info
function getStockStatus(units) {
    if (units === 0) {
        return { emoji: '⚫', label: 'Out of stock', class: 'status-critical' };
    } else if (units < 10) {
        return { emoji: '🔴', label: 'Critical', class: 'status-critical' };
    } else if (units < 30) {
        return { emoji: '🟡', label: 'Low', class: 'status-urgent' };
    } else {
        return { emoji: '🟢', label: 'Good', class: 'status-verified' };
    }
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number
function validatePhone(phone) {
    // Basic validation - at least 10 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
}

// Validate coordinates
function validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
        return { valid: false, message: 'Coordinates must be numbers' };
    }

    if (latitude < -90 || latitude > 90) {
        return { valid: false, message: 'Latitude must be between -90 and 90' };
    }

    if (longitude < -180 || longitude > 180) {
        return { valid: false, message: 'Longitude must be between -180 and 180' };
    }

    return { valid: true };
}

// Format coordinates
function formatCoordinates(lat, lng) {
    if (!lat || !lng) return 'N/A';
    return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
}

// Generate star rating HTML
function generateStarRating(rating) {
    const filledStars = '⭐'.repeat(rating || 0);
    const emptyStars = '☆'.repeat(5 - (rating || 0));
    return filledStars + emptyStars;
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: ${type === 'success' ? '#D1FAE5' : type === 'error' ? '#FEE2E2' : '#FEF3C7'};
        color: ${type === 'success' ? '#065F46' : type === 'error' ? '#991B1B' : '#78350F'};
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Confirm dialog
function confirmAction(message) {
    return confirm(message);
}

// Debounce function for search inputs
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

// Export utilities
window.utils = {
    formatDate,
    formatDateTime,
    formatPhoneNumber,
    getBloodTypeClass,
    getStatusClass,
    getStockStatus,
    validateEmail,
    validatePhone,
    validateCoordinates,
    formatCoordinates,
    generateStarRating,
    showNotification,
    confirmAction,
    debounce
};

console.log('Utilities module loaded');