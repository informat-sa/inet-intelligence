import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const DEMO_KEY_WARNING_SHOWN = { value: false };

function getKey(): Buffer {
  const keyHex = process.env.DB_ENCRYPTION_KEY ?? '';
  if (!keyHex || keyHex.length < 32) {
    // SECURITY: If DB_ENCRYPTION_KEY is not set, we use a fallback key.
    // This is ONLY acceptable in DEMO_MODE. In production this means
    // SQL Server passwords stored in PostgreSQL are encrypted with a
    // publicly known key and can be decrypted by anyone with DB access.
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      throw new Error(
        'FATAL: DB_ENCRYPTION_KEY must be set in production. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    if (!DEMO_KEY_WARNING_SHOWN.value) {
      DEMO_KEY_WARNING_SHOWN.value = true;
      console.warn(
        '[crypto.util] WARNING: DB_ENCRYPTION_KEY not set — using insecure demo key. ' +
        'Set DB_ENCRYPTION_KEY in production!'
      );
    }
    return Buffer.from('inet-intelligence-demo-key-32chr', 'utf8');
  }
  // Validate that the key is valid hex before using it
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error('DB_ENCRYPTION_KEY must be a hexadecimal string (use crypto.randomBytes(32).toString("hex"))');
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
