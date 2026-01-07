// MUT Secure Vault - OTP (One-Time Password) Service
// Implements TOTP for Challenge 2

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { AUTH_CONFIG, SUT_DATA } from '../config/constants.js';

class OTPService {
  constructor() {
    this.config = AUTH_CONFIG.otp;
    this.issuer = 'MUT Secure Vault';
  }

  // Generate OTP secret from FLAG_1
  generateSecretFromFlag(flag1) {
    // Hash the flag to create a deterministic secret
    const hash = crypto.createHash('sha256').update(flag1).digest();

    // Convert to base32 (first 20 bytes = 32 base32 characters)
    const secret = this.toBase32(hash.slice(0, 20));

    return {
      base32: secret,
      ascii: hash.slice(0, 20).toString('ascii'),
      hex: hash.slice(0, 20).toString('hex')
    };
  }

  // Generate a new random secret (for testing)
  generateRandomSecret() {
    return speakeasy.generateSecret({
      length: 20,
      name: `${this.issuer}:Player`,
      issuer: this.issuer
    });
  }

  // Generate TOTP token
  generateTOTP(secret) {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32',
      digits: this.config.digits,
      step: this.config.step
    });
  }

  // Verify TOTP token
  verifyTOTP(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token.toString(),
      digits: this.config.digits,
      step: this.config.step,
      window: this.config.window // Allow 1 step before/after
    });
  }

  // Generate QR code for authenticator app
  async generateQRCode(secret, username = 'Player') {
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: `${this.issuer}:${username}`,
      issuer: this.issuer,
      encoding: 'base32',
      digits: this.config.digits,
      period: this.config.step
    });

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return {
        qrCode: qrCodeDataUrl,
        otpauthUrl: otpauthUrl,
        secret: secret,
        instructions: {
          en: 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)',
          th: 'สแกน QR code นี้ด้วยแอปยืนยันตัวตน (Google Authenticator, Authy, ฯลฯ)'
        }
      };
    } catch (error) {
      console.error('[OTPService] QR generation error:', error);
      return {
        error: 'Failed to generate QR code',
        secret: secret,
        otpauthUrl: otpauthUrl
      };
    }
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

  // Generate hint for players
  getOTPHint(flag1) {
    return {
      en: `Your FLAG_1 is the key to generating the OTP secret.
The secret is derived from SHA-256(FLAG_1), taking the first 20 bytes and encoding as base32.
Use an authenticator app or calculate the TOTP manually with:
- Algorithm: SHA-1
- Digits: ${this.config.digits}
- Period: ${this.config.step} seconds`,
      th: `FLAG_1 ของคุณคือกุญแจในการสร้าง OTP secret
Secret มาจาก SHA-256(FLAG_1) โดยใช้ 20 bytes แรกและเข้ารหัส base32
ใช้แอปยืนยันตัวตนหรือคำนวณ TOTP เองด้วย:
- Algorithm: SHA-1
- Digits: ${this.config.digits}
- Period: ${this.config.step} วินาที`
    };
  }
}

export default new OTPService();
