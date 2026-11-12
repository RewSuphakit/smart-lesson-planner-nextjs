/**
 * Avatar File Storage Utility
 *
 * Offloads Base64 `data:image/...` avatars from MySQL (`MediumText`) to the
 * persistent `/public/uploads/avatars` directory (mounted as `uploads_data` volume in Docker).
 *
 * - Keeps database rows tiny (~45 bytes path instead of 50KB-150KB Base64 blobs)
 * - Gracefully falls back to storing Base64 data URLs when running on read-only
 *   serverless filesystems (e.g., Vercel / AWS Lambda)
 * - Supports reading & serving both disk-stored avatars and legacy Base64 data URLs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_URI_REGEX = /^data:(image\/(webp|jpeg|png|gif));base64,([A-Za-z0-9+/=]+)$/;
const AVATAR_UPLOAD_REL_DIR = '/uploads/avatars';

function getAvatarDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'avatars');
}

function isServerlessReadOnlyFs(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Checks whether an avatar string is a stored file path (`/uploads/avatars/...`)
 * or a legacy Base64 `data:image/...` URI, and returns the public/API URL to serve it.
 */
export function resolveStudentAvatarUrl(
  studentId: number,
  avatar: string | null | undefined,
  updatedAt?: Date | null
): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('data:image/') || avatar.startsWith('/uploads/avatars/')) {
    const version = updatedAt ? updatedAt.getTime() : 0;
    return `/api/students/${studentId}/avatar?v=${version}`;
  }
  return avatar;
}

/**
 * Saves a Base64 `data:image/...` string to `/public/uploads/avatars/<prefix>-<hash>.<ext>`.
 * Returns the relative path `/uploads/avatars/...` on success, or falls back to the
 * original `dataUri` if running in a read-only serverless environment.
 */
export function persistAvatarDataUri(
  dataUri: string | null | undefined,
  prefix = 'avatar',
  previousAvatar?: string | null
): string | null {
  if (!dataUri) {
    removeAvatarFileIfLocal(previousAvatar);
    return null;
  }

  const trimmed = dataUri.trim();
  const match = DATA_URI_REGEX.exec(trimmed);
  if (!match) {
    // External URL (e.g. Google avatar) or preset key
    return trimmed;
  }

  if (isServerlessReadOnlyFs()) {
    return trimmed;
  }

  try {
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const base64Data = match[3];
    const buffer = Buffer.from(base64Data, 'base64');
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${safePrefix}-${hash}.${ext}`;
    const dir = getAvatarDir();

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }

    const newRelPath = `${AVATAR_UPLOAD_REL_DIR}/${fileName}`;
    if (previousAvatar && previousAvatar !== newRelPath) {
      removeAvatarFileIfLocal(previousAvatar);
    }

    return newRelPath;
  } catch (err) {
    console.warn('[AvatarStorage] Disk write unavailable, falling back to inline data URI:', err);
    return trimmed;
  }
}

/**
 * Deletes an old local avatar file from `/public/uploads/avatars` if it exists.
 */
export function removeAvatarFileIfLocal(avatarPath: string | null | undefined): void {
  if (!avatarPath || !avatarPath.startsWith(`${AVATAR_UPLOAD_REL_DIR}/`)) return;
  if (isServerlessReadOnlyFs()) return;

  try {
    const fileName = path.basename(avatarPath);
    const fullPath = path.join(getAvatarDir(), fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Reads an avatar (either from `/uploads/avatars/...` on disk or a legacy `data:image/...` string)
 * and returns `{ buffer, contentType, etag }` for binary HTTP responses.
 */
export function readAvatarBinary(
  avatar: string | null | undefined
): { buffer: Buffer; contentType: string; etag: string } | null {
  if (!avatar) return null;

  // 1. Disk-stored file in /public/uploads/avatars/
  if (avatar.startsWith(`${AVATAR_UPLOAD_REL_DIR}/`)) {
    try {
      const fileName = path.basename(avatar);
      const fullPath = path.join(getAvatarDir(), fileName);
      if (!fs.existsSync(fullPath)) return null;

      const buffer = fs.readFileSync(fullPath);
      const ext = path.extname(fileName).toLowerCase();
      const contentType =
        ext === '.webp'
          ? 'image/webp'
          : ext === '.png'
            ? 'image/png'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/jpeg';
      const etag = `"${crypto.createHash('sha1').update(buffer).digest('hex')}"`;
      return { buffer, contentType, etag };
    } catch {
      return null;
    }
  }

  // 2. Legacy Base64 data URI
  const match = DATA_URI_REGEX.exec(avatar);
  if (!match) return null;

  const buffer = Buffer.from(match[3], 'base64');
  const contentType = match[1];
  const etag = `"${crypto.createHash('sha1').update(avatar).digest('hex')}"`;
  return { buffer, contentType, etag };
}

