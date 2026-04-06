const cloudinaryConfig = {
    cloudName: 'dzr9qoqkw',
    uploadPreset: 'bloodlink_profiles',
    verificationPreset: 'bloodlink_verification',
};

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;

const CLOUDINARY_FOLDERS = {
    profilePictures: 'bloodlink/profile_pictures',
    donorVerification: 'bloodlink/verification/donors',
    requesterVerification: 'bloodlink/verification/requesters',
    adminUploads: 'bloodlink/admin',
};

async function uploadImageToCloudinary(file, folder = CLOUDINARY_FOLDERS.adminUploads, isVerification = false) {
    if (!file) return null;
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', isVerification
            ? cloudinaryConfig.verificationPreset
            : cloudinaryConfig.uploadPreset);
        formData.append('folder', folder);

        console.log(`Uploading to Cloudinary — folder: ${folder}, preset: ${isVerification ? 'verification' : 'profiles'}`);

        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData,
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cloudinary error:', errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Upload successful:', data.secure_url);
        return {
            secure_url: data.secure_url,
            public_id: data.public_id,
            url: data.url,
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

function getCloudinaryThumbUrl(url, width = 320, height = 200) {
    if (!url) return '';
    return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`);
}

function getPublicIdFromUrl(url) {
    if (!url) return null;
    try {
        const matches = url.match(/\/([^\/]+)\.[^.]+$/);
        return matches ? matches[1] : null;
    } catch { return null; }
}

window.cloudinaryConfig = cloudinaryConfig;
window.CLOUDINARY_UPLOAD_URL = CLOUDINARY_UPLOAD_URL;
window.CLOUDINARY_FOLDERS = CLOUDINARY_FOLDERS;
window.uploadImageToCloudinary = uploadImageToCloudinary;
window.getCloudinaryThumbUrl = getCloudinaryThumbUrl;
window.getPublicIdFromUrl = getPublicIdFromUrl;

console.log('Cloudinary configuration loaded — cloud: dzr9qoqkw');