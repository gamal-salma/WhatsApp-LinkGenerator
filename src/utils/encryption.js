const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const key = Buffer.from(config.encryptionKey, 'hex');

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns { encrypted, iv, authTag } all as hex strings.
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt data encrypted by encrypt().
 * @param {string} encrypted — hex ciphertext
 * @param {string} iv — hex IV
 * @param {string} authTag — hex auth tag
 * @returns {string} plaintext
 */
function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let plaintext = decipher.update(encrypted, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

module.exports = { encrypt, decrypt };
