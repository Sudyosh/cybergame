// MUT Secure Vault - Flag Generation & Validation Service

import crypto from 'crypto';
import { FLAG_FORMAT, SUT_DATA } from '../config/constants.js';

class FlagService {
  constructor() {
    this.masterSeed = process.env.FLAG_MASTER_SEED || 'MUT_SECURE_VAULT_SUT_1990';
    this.prefix = FLAG_FORMAT.prefix;
    this.hashLength = FLAG_FORMAT.hashLength;
  }

  // Generate a hash-based flag
  generateHash(components) {
    const data = components.join(':');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Format flag with prefix
  formatFlag(hash) {
    return `${this.prefix}{${hash.substring(0, this.hashLength)}}`;
  }

  // ==================== FLAG 1: Cryptography ====================
  // Simple formula: SHA256(message + "1990" + signature)[:32]
  // This allows students to calculate the flag themselves

  generateFlag1(sessionId, message, signature) {
    // Simple concatenation: message + "1990" + signature
    const data = message + SUT_DATA.yearEstablished.toString() + signature;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return this.formatFlag(hash);
  }

  validateFlag1(sessionId, submittedFlag, expectedFlag) {
    return submittedFlag === expectedFlag;
  }

  // ==================== FLAG 2: Authentication ====================

  generateFlag2(sessionId, flag1) {
    const hash = this.generateHash([
      this.masterSeed,
      'CHALLENGE_2',
      sessionId.toString(),
      flag1,
      'MFA_COMPLETE'
    ]);
    return this.formatFlag(hash);
  }

  validateFlag2(sessionId, submittedFlag, expectedFlag) {
    return submittedFlag === expectedFlag;
  }

  // ==================== FINAL FLAG: Authorization ====================

  generateFinalFlag(sessionId, flag2) {
    const hash = this.generateHash([
      this.masterSeed,
      'CHALLENGE_3',
      sessionId.toString(),
      flag2,
      'TOP_SECRET_ACCESS'
    ]);
    return this.formatFlag(hash);
  }

  validateFinalFlag(sessionId, submittedFlag, expectedFlag) {
    return submittedFlag === expectedFlag;
  }

  // ==================== General Validation ====================

  validateFlagFormat(flag) {
    const pattern = new RegExp(`^${this.prefix}\\{[a-f0-9]{${this.hashLength}}\\}$`);
    return pattern.test(flag);
  }

  // Generate OTP secret from FLAG_1 (for Challenge 2)
  generateOTPSecretFromFlag(flag1) {
    const hash = crypto.createHash('sha256').update(flag1).digest();
    // Take first 20 bytes and encode as base32
    return this.toBase32(hash.slice(0, 20));
  }

  // Helper: Convert bytes to base32
  toBase32(buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }

    return result;
  }

  // Get demo/static flags for testing (only in development)
  getDemoFlags(sessionId) {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    return {
      flag1: this.generateFlag1(sessionId, 'demo_shared_secret', 'demo_signature'),
      flag2: this.generateFlag2(sessionId, 'demo_flag1'),
      finalFlag: this.generateFinalFlag(sessionId, 'demo_flag2')
    };
  }
}

export default new FlagService();
