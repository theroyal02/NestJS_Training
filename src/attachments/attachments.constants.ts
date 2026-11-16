export const ATTACHABLE_TYPE = {
  USER: 'users',
} as const;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const AVATAR_SUBDIR = 'public/uploads/avatars';
export const AVATAR_URL_PREFIX = '/uploads/avatars';
