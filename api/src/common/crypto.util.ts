import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.DB_ENCRYPTION_KEY ?? '';
  if (!keyHex || keyHex.length < 32) {
    // In demo mode, use a default key (not secure for production)
    return Buffer.from('inet-intelligence-demo-key-32chr', 'utf8');
  }
  return Buffer.from(keyHex.slice(0, 64), 'hex');
}

export function encryptPassword(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(hex):authTag(hex):encrypted(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(encryptedStr: string): string {
  // If it doesn't look encrypted (demo mode plain text), return as-is
  if (!encryptedStr.includes(':')) return encryptedStr;

  const key = getKey();
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) return encryptedStr;

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
