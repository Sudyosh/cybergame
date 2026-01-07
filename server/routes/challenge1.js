// MUT Secure Vault - Challenge 1 Routes (Cryptography)
// Implements: AES-256, RSA-2048, Diffie-Hellman, SHA-256, Digital Signatures

import { Router } from 'express';
import { getDatabase } from '../config/database.js';
import { authMiddleware, challengeGate, generateToken } from '../middleware/auth.js';
import { flagLimiter } from '../middleware/rateLimit.js';
import cryptoService from '../services/cryptoService.js';
import flagService from '../services/flagService.js';
import { STORY } from '../config/constants.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(challengeGate(1));

// GET /api/c1/story - Get challenge story
router.get('/story', (req, res) => {
  res.json({
    title: STORY.challenge1.title,
    description: STORY.challenge1.description,
    objectives: {
      en: [
        'Download cryptographic artifacts',
        'Perform Diffie-Hellman key exchange',
        'Derive AES-256 key from shared secret',
        'Decrypt the legacy message',
        'Verify RSA digital signature',
        'Generate FLAG_1 from the hash'
      ],
      th: [
        'ดาวน์โหลดสิ่งประดิษฐ์การเข้ารหัส',
        'ทำการแลกเปลี่ยนคีย์ Diffie-Hellman',
        'สร้างคีย์ AES-256 จาก shared secret',
        'ถอดรหัสข้อความมรดก',
        'ตรวจสอบลายเซ็นดิจิทัล RSA',
        'สร้าง FLAG_1 จาก hash'
      ]
    }
  });
});

// GET /api/c1/artifacts - Download crypto artifacts
router.get('/artifacts', (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.sessionId;

    // Check if artifacts already exist
    let artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);

    if (!artifacts) {
      // Generate new artifacts
      const newArtifacts = cryptoService.generateCryptoArtifacts(sessionId);

      // Store in database
      db.prepare(`
        INSERT INTO crypto_artifacts (
          session_id, dh_prime, dh_generator, dh_server_public, dh_server_private,
          aes_iv, rsa_public_key, rsa_private_key, secret_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        newArtifacts.dh.prime,
        newArtifacts.dh.generator,
        newArtifacts.dh.serverPublicKey,
        newArtifacts.dh.serverPrivateKey,
        newArtifacts.aes.iv,
        newArtifacts.rsa.publicKey,
        newArtifacts.rsa.privateKey,
        newArtifacts.message
      );

      artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);
    }

    // Mark as downloaded
    db.prepare('UPDATE crypto_artifacts SET artifact_downloaded = 1 WHERE session_id = ?').run(sessionId);

    // Log the download
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_ARTIFACTS_DOWNLOAD', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({ downloaded: true }));

    // Return artifacts (public data only)
    res.json({
      success: true,
      message: {
        en: 'Cryptographic artifacts downloaded. Begin your decryption journey.',
        th: 'ดาวน์โหลดสิ่งประดิษฐ์การเข้ารหัสแล้ว เริ่มการถอดรหัสของคุณ'
      },
      artifacts: {
        diffieHellman: {
          prime: artifacts.dh_prime,
          generator: artifacts.dh_generator,
          hint: {
            en: 'The year 1990 marks the beginning of SUT. This number is significant...',
            th: 'ปี 1990 คือจุดเริ่มต้นของ มทส. ตัวเลขนี้มีความสำคัญ...'
          }
        },
        rsa: {
          publicKey: artifacts.rsa_public_key,
          hint: {
            en: 'This key will verify the signature of the decrypted message.',
            th: 'คีย์นี้จะใช้ตรวจสอบลายเซ็นของข้อความที่ถอดรหัสแล้ว'
          }
        },
        aes: {
          iv: artifacts.aes_iv,
          hint: {
            en: 'AES-256-CBC encryption. The key comes from SHA256(shared_secret + salt). Salt = "SUT1990"',
            th: 'การเข้ารหัส AES-256-CBC คีย์มาจาก SHA256(shared_secret + salt) Salt = "SUT1990"'
          }
        }
      },
      instructions: {
        en: `
Step 1: Perform Diffie-Hellman key exchange
  - Generate your private key (random number)
  - Compute your public key: A = g^a mod p
  - Send your public key to POST /api/c1/dh/exchange
  - Receive server's public key
  - Compute shared secret: S = B^a mod p

Step 2: Derive AES key
  - Compute: key = SHA256(shared_secret + "SUT1990")
  - Use first 32 bytes as AES-256 key

Step 3: Decrypt the message
  - GET /api/c1/encrypted
  - Use AES-256-CBC with derived key and provided IV

Step 4: Verify signature
  - Use RSA public key to verify the signature
  - GET /api/c1/signature

Step 5: Generate FLAG_1
  - FLAG_1 = MUT{SHA256(message + "1990" + signature_hex)[:32]}
`,
        th: `
ขั้นตอนที่ 1: ทำ Diffie-Hellman key exchange
  - สร้าง private key ของคุณ (ตัวเลขสุ่ม)
  - คำนวณ public key: A = g^a mod p
  - ส่ง public key ไปที่ POST /api/c1/dh/exchange
  - รับ public key ของเซิร์ฟเวอร์
  - คำนวณ shared secret: S = B^a mod p

ขั้นตอนที่ 2: สร้าง AES key
  - คำนวณ: key = SHA256(shared_secret + "SUT1990")
  - ใช้ 32 bytes แรกเป็น AES-256 key

ขั้นตอนที่ 3: ถอดรหัสข้อความ
  - GET /api/c1/encrypted
  - ใช้ AES-256-CBC กับ key ที่สร้างและ IV ที่ให้มา

ขั้นตอนที่ 4: ตรวจสอบลายเซ็น
  - ใช้ RSA public key ตรวจสอบลายเซ็น
  - GET /api/c1/signature

ขั้นตอนที่ 5: สร้าง FLAG_1
  - FLAG_1 = MUT{SHA256(message + "1990" + signature_hex)[:32]}
`
      }
    });

  } catch (error) {
    console.error('[C1] Artifacts error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate artifacts' });
  }
});

// POST /api/c1/dh/exchange - Perform DH key exchange
router.post('/dh/exchange', (req, res) => {
  try {
    const { clientPublicKey } = req.body;
    const sessionId = req.sessionId;

    if (!clientPublicKey) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Client public key required',
        hint: 'Send your DH public key as hex string'
      });
    }

    const db = getDatabase();
    const artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);

    if (!artifacts) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Download artifacts first (GET /api/c1/artifacts)'
      });
    }

    // Compute shared secret
    const sharedSecret = cryptoService.computeDHSharedSecret(
      clientPublicKey,
      artifacts.dh_server_private,
      artifacts.dh_prime,
      artifacts.dh_generator
    );

    if (!sharedSecret) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid client public key'
      });
    }

    // Derive AES key and encrypt the message
    const aesKey = cryptoService.generateAESKey(sharedSecret);
    const iv = Buffer.from(artifacts.aes_iv, 'hex');
    const encryptedData = cryptoService.encryptAES(artifacts.secret_message, aesKey, iv);

    // Generate signature
    const signature = cryptoService.signRSA(artifacts.secret_message, artifacts.rsa_private_key);

    // Update database
    db.prepare(`
      UPDATE crypto_artifacts
      SET dh_client_public = ?, dh_shared_secret = ?, aes_encrypted_data = ?, rsa_signature = ?, exchange_complete = 1
      WHERE session_id = ?
    `).run(clientPublicKey, sharedSecret, encryptedData, signature, sessionId);

    // Log the exchange
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_DH_EXCHANGE', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({ exchangeComplete: true }));

    res.json({
      success: true,
      message: {
        en: 'Key exchange complete! You can now derive the AES key and decrypt the message.',
        th: 'การแลกเปลี่ยนคีย์เสร็จสมบูรณ์! คุณสามารถสร้าง AES key และถอดรหัสข้อความได้แล้ว'
      },
      serverPublicKey: artifacts.dh_server_public,
      hint: {
        en: 'Shared secret computed. Now: AES_KEY = SHA256(shared_secret + "SUT1990")[:32]',
        th: 'คำนวณ shared secret แล้ว ต่อไป: AES_KEY = SHA256(shared_secret + "SUT1990")[:32]'
      }
    });

  } catch (error) {
    console.error('[C1] DH exchange error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Key exchange failed' });
  }
});

// GET /api/c1/encrypted - Get encrypted message
router.get('/encrypted', (req, res) => {
  try {
    const db = getDatabase();
    const artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(req.sessionId);

    if (!artifacts || !artifacts.exchange_complete) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete DH key exchange first (POST /api/c1/dh/exchange)'
      });
    }

    res.json({
      success: true,
      encrypted: {
        algorithm: 'AES-256-CBC',
        iv: artifacts.aes_iv,
        data: artifacts.aes_encrypted_data
      },
      hint: {
        en: 'Decrypt using: AES_KEY = SHA256(shared_secret + "SUT1990")[:32]',
        th: 'ถอดรหัสด้วย: AES_KEY = SHA256(shared_secret + "SUT1990")[:32]'
      }
    });

  } catch (error) {
    console.error('[C1] Get encrypted error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c1/signature - Get RSA signature
router.get('/signature', (req, res) => {
  try {
    const db = getDatabase();
    const artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(req.sessionId);

    if (!artifacts || !artifacts.exchange_complete) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete DH key exchange first'
      });
    }

    res.json({
      success: true,
      signature: {
        algorithm: 'RSA-SHA256',
        data: artifacts.rsa_signature
      },
      hint: {
        en: 'Verify this signature using the RSA public key from artifacts',
        th: 'ตรวจสอบลายเซ็นนี้ด้วย RSA public key จาก artifacts'
      }
    });

  } catch (error) {
    console.error('[C1] Get signature error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c1/easy-decrypt - EASY MODE: Auto DH exchange + decrypt (for beginners)
router.get('/easy-decrypt', async (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.sessionId;

    // Check if artifacts exist
    let artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);

    if (!artifacts) {
      // Generate new artifacts automatically
      const newArtifacts = cryptoService.generateCryptoArtifacts(sessionId);

      db.prepare(`
        INSERT INTO crypto_artifacts (
          session_id, dh_prime, dh_generator, dh_server_public, dh_server_private,
          aes_iv, rsa_public_key, rsa_private_key, secret_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        newArtifacts.dh.prime,
        newArtifacts.dh.generator,
        newArtifacts.dh.serverPublicKey,
        newArtifacts.dh.serverPrivateKey,
        newArtifacts.aes.iv,
        newArtifacts.rsa.publicKey,
        newArtifacts.rsa.privateKey,
        newArtifacts.message
      );

      artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);
    }

    // Auto-generate client key and do DH exchange
    const crypto = await import('crypto');
    const clientPrivate = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const p = BigInt('0x' + artifacts.dh_prime);
    const g = BigInt('0x' + artifacts.dh_generator);
    const clientPublic = modPow(g, clientPrivate, p);
    const serverPublic = BigInt('0x' + artifacts.dh_server_public);
    const sharedSecret = modPow(serverPublic, clientPrivate, p);

    // Derive AES key
    const sharedSecretHex = sharedSecret.toString(16);
    const aesKey = cryptoService.generateAESKey(sharedSecretHex);
    const iv = Buffer.from(artifacts.aes_iv, 'hex');

    // Encrypt then provide decrypted message directly
    const encryptedData = cryptoService.encryptAES(artifacts.secret_message, aesKey, iv);
    const signature = cryptoService.signRSA(artifacts.secret_message, artifacts.rsa_private_key);

    // Update database
    db.prepare(`
      UPDATE crypto_artifacts
      SET dh_client_public = ?, dh_shared_secret = ?, aes_encrypted_data = ?, rsa_signature = ?, exchange_complete = 1, artifact_downloaded = 1
      WHERE session_id = ?
    `).run(clientPublic.toString(16), sharedSecretHex, encryptedData, signature, sessionId);

    // Log
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_EASY_DECRYPT', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({ mode: 'easy' }));

    res.json({
      success: true,
      mode: 'easy',
      message: {
        en: 'Easy mode: DH exchange done automatically! Here is the decrypted message.',
        th: 'โหมดง่าย: ทำ DH exchange ให้อัตโนมัติแล้ว! นี่คือข้อความที่ถอดรหัสแล้ว'
      },
      decryptedMessage: artifacts.secret_message,
      signature: signature,
      flagFormula: {
        en: 'FLAG_1 = MUT{SHA256(message + "1990" + signature)[:32]}',
        th: 'FLAG_1 = MUT{SHA256(message + "1990" + signature)[:32]}'
      },
      example: {
        en: 'Use Python: hashlib.sha256((message + "1990" + signature).encode()).hexdigest()[:32]',
        th: 'ใช้ Python: hashlib.sha256((message + "1990" + signature).encode()).hexdigest()[:32]'
      },
      hint: {
        en: 'Just concatenate the message + "1990" + signature, then SHA256 hash it, take first 32 chars, wrap with MUT{}',
        th: 'แค่ต่อ message + "1990" + signature แล้ว hash ด้วย SHA256 ตัด 32 ตัวแรก ครอบด้วย MUT{}'
      }
    });

  } catch (error) {
    console.error('[C1] Easy decrypt error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Easy decrypt failed' });
  }
});

// Helper function for modular exponentiation
function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

// POST /api/c1/submit-flag - Submit FLAG_1
router.post('/submit-flag', flagLimiter, (req, res) => {
  try {
    const { flag } = req.body;
    const sessionId = req.sessionId;

    if (!flag) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Flag required'
      });
    }

    const db = getDatabase();
    const artifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);

    if (!artifacts || !artifacts.exchange_complete) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete the challenge steps first'
      });
    }

    // Generate expected flag
    const expectedFlag = flagService.generateFlag1(
      sessionId,
      artifacts.dh_shared_secret,
      artifacts.rsa_signature
    );

    const isCorrect = flag === expectedFlag;

    // Log submission
    db.prepare(`
      INSERT INTO flag_submissions (session_id, challenge_number, submitted_flag, is_correct)
      VALUES (?, 1, ?, ?)
    `).run(sessionId, flag, isCorrect ? 1 : 0);

    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_FLAG_SUBMIT', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({ correct: isCorrect }));

    if (isCorrect) {
      // Update session progress
      db.prepare(`
        UPDATE game_sessions SET challenge_1_complete = 1, flag_1 = ? WHERE id = ?
      `).run(flag, sessionId);

      // Generate new token with updated progress
      const newToken = generateToken({
        ...req.user,
        challenge1Complete: true
      });

      return res.json({
        success: true,
        correct: true,
        message: {
          en: 'FLAG_1 correct! Challenge 1 complete. You have mastered the cryptographic arts.',
          th: 'FLAG_1 ถูกต้อง! ด่าน 1 เสร็จสมบูรณ์ คุณได้เชี่ยวชาญศาสตร์การเข้ารหัสแล้ว'
        },
        flag: flag,
        newToken: newToken,
        next: {
          challenge: 2,
          name: "The Guardian's Gauntlet",
          hint: {
            en: 'FLAG_1 will be used to generate your OTP secret for Challenge 2',
            th: 'FLAG_1 จะถูกใช้สร้าง OTP secret สำหรับด่าน 2'
          }
        }
      });
    }

    res.json({
      success: false,
      correct: false,
      message: {
        en: 'Incorrect flag. Check your calculations.',
        th: 'Flag ไม่ถูกต้อง ตรวจสอบการคำนวณของคุณ'
      },
      hint: {
        en: 'FLAG_1 = MUT{SHA256(decrypted_message + "1990" + signature_hex)[:32]}',
        th: 'FLAG_1 = MUT{SHA256(decrypted_message + "1990" + signature_hex)[:32]}'
      }
    });

  } catch (error) {
    console.error('[C1] Flag submit error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Flag submission failed' });
  }
});

export default router;
