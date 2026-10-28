/**
 * AES-256-GCM Encryption/Decryption for sensitive data at rest.
 *
 * Used for encrypting secrets stored in the database, such as
 * LINE channel secrets and access tokens.
 *
 * Requires ENCRYPTION_KEY environment variable:
 *   - Must be a 64-character hex string (32 bytes)
 *   - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Encrypted format: iv:authTag:ciphertext (all hex-encoded)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt().
 * Input format: iv:authTag:ciphertext (hex-encoded).
 * Returns the original plaintext.
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check whether ENCRYPTION_KEY is configured.
 * Returns false if not set — callers should fall back to plaintext reads
 * for backward compatibility during migration.
 */
export function isEncryptionConfigured(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  return !!key && key.length === 64;
}

/**
 * Safely decrypt a value that might be plaintext (pre-migration) or encrypted.
 * If it looks like our iv:tag:cipher format, decrypt; otherwise return as-is.
 */
export function decryptOrPlaintext(value: string): string {
  // Our encrypted format is always hex:hex:hex (32:32:N chars)
  if (/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value) && isEncryptionConfigured()) {
    try {
      return decrypt(value);
    } catch {
      // If decryption fails, it's probably plaintext that happens to match the pattern
      return value;
    }
  }
  return value;
}

export function encryptIfPresent(value: string | null | undefined): string {
  if (!value) return '';
  if (!isEncryptionConfigured()) return value;
  try {
    return encrypt(value);
  } catch {
    return value;
  }
}

export function decryptIfPresent(value: string | null | undefined): string {
  if (!value) return '';
  return decryptOrPlaintext(value);
}

