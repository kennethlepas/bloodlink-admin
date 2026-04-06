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

// Show premium notification
function showNotification(message, type = 'success') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    notification.innerHTML = `
        <div class="notification-icon">${icons[type] || 'ℹ'}</div>
        <div class="notification-content">${message}</div>
        <button class="notification-close">&times;</button>
    `;

    container.appendChild(notification);

    // Auto remove
    const timer = setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => notification.remove(), 400);
    }, 5000);

    notification.querySelector('.notification-close').onclick = () => {
        clearTimeout(timer);
        notification.classList.add('notification-hide');
        setTimeout(() => notification.remove(), 400);
    };
}

// Global System Event Listeners
window.addEventListener('online', () => {
    showNotification('Network connection restored.', 'success');
});

window.addEventListener('offline', () => {
    showNotification('You are offline. Some features may be unavailable.', 'warning');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    showNotification('A system error occurred. Please refresh if issues persist.', 'error');
});

// Cloudinary Image Upload
async function uploadImageToCloudinary(file, folder = 'bloodlink/admin') {
    if (!file) return null;

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.cloudinaryConfig.uploadPreset);
        formData.append('folder', folder);

        console.log(`Uploading to Cloudinary [${folder}]...`);

        const response = await fetch(window.CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cloudinary error response:', errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Upload successful:', data.secure_url);

        return {
            secure_url: data.secure_url,
            public_id: data.public_id,
            url: data.url
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Extract public_id from Cloudinary URL
function getPublicIdFromUrl(url) {
    try {
        if (!url) return null;
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        const publicId = lastPart.split('.')[0];
        // If there's a folder structure in the URL, we might need more logic
        // but for now, this handles the basic case.
        return publicId;
    } catch (e) {
        return null;
    }
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
    debounce,
    uploadImageToCloudinary,
    getPublicIdFromUrl
};

console.log('Utilities module loaded');