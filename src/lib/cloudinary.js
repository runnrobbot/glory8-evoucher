const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class CloudinaryUploadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CloudinaryUploadError';
    this.code = code;
  }
}

function validateFile(file) {
  if (!file) {
    throw new CloudinaryUploadError('No file provided', 'NO_FILE');
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new CloudinaryUploadError(
      `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      'INVALID_TYPE'
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new CloudinaryUploadError(
      `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: 5MB`,
      'FILE_TOO_LARGE'
    );
  }
}

/**
 * Upload a file to Cloudinary with progress tracking.
 * @param {File} file - The file to upload
 * @param {Object} options - Upload options
 * @param {string} options.folder - Cloudinary folder (e.g., 'campaigns', 'vouchers', 'logos')
 * @param {function} options.onProgress - Progress callback (0-100)
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 * @returns {Promise<{url: string, publicId: string, width: number, height: number}>}
 */
export async function uploadToCloudinary(file, options = {}) {
  const { folder = 'general', onProgress, signal } = options;

  validateFile(file);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `glory8-evoucher/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new CloudinaryUploadError('Upload cancelled', 'CANCELLED'));
      });
    }

    xhr.open('POST', UPLOAD_URL);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            width: data.width,
            height: data.height,
            format: data.format,
            bytes: data.bytes,
          });
        } catch {
          reject(new CloudinaryUploadError('Failed to parse response', 'PARSE_ERROR'));
        }
      } else {
        reject(new CloudinaryUploadError(`Upload failed with status ${xhr.status}`, 'UPLOAD_FAILED'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new CloudinaryUploadError('Network error during upload', 'NETWORK_ERROR'));
    });

    xhr.addEventListener('abort', () => {
      reject(new CloudinaryUploadError('Upload cancelled', 'CANCELLED'));
    });

    xhr.send(formData);
  });
}

/**
 * Generate optimized Cloudinary URL with transformations.
 * @param {string} url - Original Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} Transformed URL
 */
export function getOptimizedUrl(url, options = {}) {
  if (!url || !url.includes('cloudinary.com')) return url;

  const { width, height, quality = 'auto', format = 'auto' } = options;
  const transforms = [`q_${quality}`, `f_${format}`];

  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (width || height) transforms.push('c_fill');

  return url.replace('/upload/', `/upload/${transforms.join(',')}/`);
}

export const UPLOAD_FOLDERS = {
  CAMPAIGN_BANNER: 'campaigns',
  VOUCHER_BACKGROUND: 'vouchers',
  COMPANY_LOGO: 'logos',
  USER_AVATAR: 'avatars',
};
