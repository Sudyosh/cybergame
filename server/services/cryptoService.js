// MUT Secure Vault - Cryptography Service
// Implements: AES-256, RSA-2048, Diffie-Hellman, SHA-256, Digital Signatures

import crypto from 'crypto';
import { CRYPTO_CONFIG, SUT_DATA } from '../config/constants.js';

class CryptoService {
  constructor() {
    this.config = CRYPTO_CONFIG;
    this.sutYear = SUT_DATA.yearEstablished; // 1990
  }

  // ==================== Diffie-Hellman ====================

  generateDHParams() {
    // Generate DH parameters with hints to 1990
    const dh = crypto.createDiffieHellman(this.config.dh.primeLength);
    dh.generateKeys();

    return {
      prime: dh.getPrime('hex'),
      generator: dh.getGenerator('hex'),
      serverPublicKey: dh.getPublicKey('hex'),
      serverPrivateKey: dh.getPrivateKey('hex')
    };
  }

  computeDHSharedSecret(clientPublicKey, serverPrivateKey, prime, generator) {
    try {
      const dh = crypto.createDiffieHellman(
        Buffer.from(prime, 'hex'),
        Buffer.from(generator, 'hex')
      );
      dh.setPrivateKey(Buffer.from(serverPrivateKey, 'hex'));
      const sharedSecret = dh.computeSecret(Buffer.from(clientPublicKey, 'hex'));
      return sharedSecret.toString('hex');
    } catch (error) {
      console.error('[CryptoService] DH computation error:', error.message);
      return null;
    }
  }

  // ==================== AES-256 ====================

  generateAESKey(sharedSecret) {
    // Derive AES key from shared secret + SUT salt
    const salt = this.config.salt; // "suranaree"
    const hash = crypto.createHash(this.config.hash.algorithm);
    hash.update(sharedSecret + salt);
    return hash.digest().slice(0, this.config.aes.keyLength);
  }

  generateIV() {
    return crypto.randomBytes(this.config.aes.ivLength);
  }

  encryptAES(plaintext, key, iv) {
    const cipher = crypto.createCipheriv(
      this.config.aes.algorithm,
      key,
      iv
    );
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptAES(ciphertext, key, iv) {
    try {
      const decipher = crypto.createDecipheriv(
        this.config.aes.algorithm,
        key,
        iv
      );
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('[CryptoService] AES decryption error:', error.message);
      return null;
    }
  }

  // ==================== RSA-2048 ====================

  generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: this.config.rsa.modulusLength,
      publicExponent: this.config.rsa.publicExponent,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  signRSA(message, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  verifyRSASignature(message, signature, publicKey) {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('[CryptoService] RSA verification error:', error.message);
      return false;
    }
  }

  encryptRSA(plaintext, publicKey) {
    const buffer = Buffer.from(plaintext, 'utf8');
    const encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString('base64');
  }

  decryptRSA(ciphertext, privateKey) {
    try {
      const buffer = Buffer.from(ciphertext, 'base64');
      const decrypted = crypto.privateDecrypt(privateKey, buffer);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[CryptoService] RSA decryption error:', error.message);
      return null;
    }
  }

  // ==================== SHA-256 ====================

  hash(data) {
    return crypto.createHash(this.config.hash.algorithm)
      .update(data)
      .digest('hex');
  }

  hashWithSalt(data, salt = this.config.salt) {
    return crypto.createHash(this.config.hash.algorithm)
      .update(data + salt)
      .digest('hex');
  }

  // ==================== Challenge 1 Artifacts ====================

  generateCryptoArtifacts(sessionId) {
    // 1. Generate DH params
    const dhParams = this.generateDHParams();

    // 2. Generate RSA key pair
    const rsaKeys = this.generateRSAKeyPair();

    // 3. Create the secret message
    const secretMessage = this.generateSecretMessage();

    // 4. Generate AES IV
    const iv = this.generateIV();

    // 5. We'll encrypt the message once the DH exchange is complete
    // For now, store the components

    return {
      sessionId,
      dh: {
        prime: dhParams.prime,
        generator: dhParams.generator,
        serverPublicKey: dhParams.serverPublicKey,
        serverPrivateKey: dhParams.serverPrivateKey, // Store securely, don't send to client
        hint: `The year ${this.sutYear} marks the beginning...`
      },
      rsa: {
        publicKey: rsaKeys.publicKey,
        privateKey: rsaKeys.privateKey // Store securely
      },
      aes: {
        iv: iv.toString('hex')
      },
      message: secretMessage,
      createdAt: new Date().toISOString()
    };
  }

  generateSecretMessage() {
    return `THE LEGACY OF SURANAREE LIVES ON. Established in ${this.sutYear}, the university stands as a beacon of knowledge. Located in Nakhon Ratchasima, Thailand, with postal code 30000. This message has been protected by the sacred cryptographic arts. VERIFICATION CODE: SUT_LEGACY_${this.sutYear}_VERIFIED`;
  }

  // Complete artifacts with encrypted data after DH exchange
  completeArtifacts(artifacts, sharedSecret) {
    // Derive AES key from shared secret
    const aesKey = this.generateAESKey(sharedSecret);

    // Encrypt the secret message
    const iv = Buffer.from(artifacts.aes.iv, 'hex');
    const encryptedMessage = this.encryptAES(artifacts.message, aesKey, iv);

    // Sign the message
    const signature = this.signRSA(artifacts.message, artifacts.rsa.privateKey);

    return {
      ...artifacts,
      aes: {
        ...artifacts.aes,
        encryptedData: encryptedMessage
      },
      signature: signature
    };
  }

  // Verify player's solution
  verifyChallenge1Solution(decryptedMessage, expectedMessage, signature, publicKey) {
    // Verify the message content
    const messageMatch = decryptedMessage.trim() === expectedMessage.trim();

    // Verify the signature
    const signatureValid = this.verifyRSASignature(expectedMessage, signature, publicKey);

    return {
      messageValid: messageMatch,
      signatureValid: signatureValid,
      complete: messageMatch && signatureValid
    };
  }
}

export default new CryptoService();
