// MUT Secure Vault - Challenge 1 Routes (Cryptography)
// Implements: AES-256, RSA-2048, Diffie-Hellman, SHA-256, Digital Signatures

import { Router } from 'express';
import { getDatabase } from '../config/database.js';
import { authMiddleware, challengeGate, generateToken } from '../middleware/auth.js';
import { flagLimiter } from '../middleware/rateLimit.js';
import cryptoService from '../services/cryptoService.js';
import flagService from '../services/flagService.js';
import { STORY, SUT_DATA } from '../config/constants.js';

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

// Hidden clues configuration for puzzle
const HIDDEN_CLUES = {
  // Full keyword: SURANAREE1990 (split into 5 parts)
  fragment1: 'U1VS',           // Base64 of "SUR"
  fragment2: 'QU5B',           // Base64 of "ANA" - in HTTP header
  fragment3: '524545',         // Hex of "REE" - in HTML comment hint
  fragment4: '19',             // Plain - hidden in console hint
  fragment5: 'OTA=',           // Base64 of "90" - in artifacts
  keyword: 'SURANAREE1990'
};

// Caesar Cipher puzzle for AES Salt
const SALT_CIPHER = {
  // Original: suranaree
  // Caesar shift +17: s→j, u→l, r→i, a→r, n→e, a→r, r→i, e→v, e→v
  cipherText: 'jlirerivv',
  shift: 17,
  plainText: 'suranaree',
  hint: 'Caesar cipher - find the right shift to decode'
};

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

    // Set hidden clue in HTTP header (Fragment 2)
    res.setHeader('X-Vault-Fragment', HIDDEN_CLUES.fragment2);
    res.setHeader('X-Vault-Hint', 'Decode me (Base64) for fragment 2 of 5');

    // Return artifacts (public data only) with hidden clues
    res.json({
      success: true,
      message: {
        en: 'Cryptographic artifacts downloaded. Begin your decryption journey.',
        th: 'ดาวน์โหลดสิ่งประดิษฐ์การเข้ารหัสแล้ว เริ่มการถอดรหัสของคุณ'
      },
      // Hidden puzzle data
      _vault_data: {
        fragment1: HIDDEN_CLUES.fragment1,  // Base64 encoded
        encoding: 'base64',
        hint: 'This is fragment 1 of 5. Decode it.'
      },
      artifacts: {
        diffieHellman: {
          prime: artifacts.dh_prime,
          generator: artifacts.dh_generator,
          hint: {
            en: 'The year 1990 marks the beginning of SUT. This number is significant...',
            th: 'ปี 1990 คือจุดเริ่มต้นของ มทส. ตัวเลขนี้มีความสำคัญ...'
          },
          // Hidden clue fragment 5
          _metadata: {
            created: '1990-07-27',
            created_be: '27-07-2533',
            note_flag: 'The founding date in Buddhist Era format (DDMMYYYY) might be useful...',
            fragment5: HIDDEN_CLUES.fragment5,
            note: 'Base64 encoded fragment 5 of 5'
          }
        },
        rsa: {
          publicKey: artifacts.rsa_public_key,
          hint: {
            en: 'This key will verify the signature of the decrypted message.',
            th: 'คีย์นี้จะใช้ตรวจสอบลายเซ็นของข้อความที่ถอดรหัสแล้ว'
          },
          // Hidden clue hint for fragment 3
          _debug: {
            hex_fragment3: HIDDEN_CLUES.fragment3,
            note: 'Hex encoded fragment 3 of 5'
          }
        },
        aes: {
          iv: artifacts.aes_iv,
          hint: {
            en: 'AES-256-CBC encryption. The key comes from SHA256(shared_secret + salt). But what is the salt?',
            th: 'การเข้ารหัส AES-256-CBC คีย์มาจาก SHA256(shared_secret + salt) แต่ salt คืออะไร?'
          },
          // Caesar Cipher puzzle for salt
          _cipher_puzzle: {
            cipherText: SALT_CIPHER.cipherText,
            algorithm: 'Caesar Cipher',
            hint: {
              en: 'The salt is encrypted with Caesar cipher. Find the right shift to decode it.',
              th: 'salt ถูกเข้ารหัสด้วย Caesar cipher หาค่า shift ที่ถูกต้องเพื่อถอดรหัส'
            },
            shift: SALT_CIPHER.shift
          },
          // Hidden clue hint for fragment 4
          _console_hint: 'Check browser console for fragment 4. Hint: the founding year has two parts...'
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
  - Compute: key = SHA256(shared_secret + "suranaree")
  - Use first 32 bytes as AES-256 key

Step 3: Decrypt the message
  - GET /api/c1/encrypted
  - Use AES-256-CBC with derived key and provided IV

Step 4: Verify signature
  - Use RSA public key to verify the signature
  - GET /api/c1/signature

Step 5: Generate FLAG_1
  - FLAG_1 = MUT{SHA256(message + "????????" + signature_hex)[:32]}
`,
        th: `
ขั้นตอนที่ 1: ทำ Diffie-Hellman key exchange
  - สร้าง private key ของคุณ (ตัวเลขสุ่ม)
  - คำนวณ public key: A = g^a mod p
  - ส่ง public key ไปที่ POST /api/c1/dh/exchange
  - รับ public key ของเซิร์ฟเวอร์
  - คำนวณ shared secret: S = B^a mod p

ขั้นตอนที่ 2: สร้าง AES key
  - คำนวณ: key = SHA256(shared_secret + "suranaree")
  - ใช้ 32 bytes แรกเป็น AES-256 key

ขั้นตอนที่ 3: ถอดรหัสข้อความ
  - GET /api/c1/encrypted
  - ใช้ AES-256-CBC กับ key ที่สร้างและ IV ที่ให้มา

ขั้นตอนที่ 4: ตรวจสอบลายเซ็น
  - ใช้ RSA public key ตรวจสอบลายเซ็น
  - GET /api/c1/signature

ขั้นตอนที่ 5: สร้าง FLAG_1
  - FLAG_1 = MUT{SHA256(message + "????????" + signature_hex)[:32]}
`
      }
    });

  } catch (error) {
    console.error('[C1] Artifacts error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate artifacts' });
  }
});

// POST /api/c1/verify-keyword - Verify the puzzle keyword to unlock crypto calculator
router.post('/verify-keyword', (req, res) => {
  try {
    const { keyword } = req.body;
    const sessionId = req.sessionId;
    const db = getDatabase();

    if (!keyword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Keyword required'
      });
    }

    // Check if keyword is correct (case-insensitive)
    const isCorrect = keyword.toUpperCase() === HIDDEN_CLUES.keyword;

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_KEYWORD_ATTEMPT', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({
      keyword: keyword.substring(0, 20),
      correct: isCorrect
    }));

    if (isCorrect) {
      res.json({
        success: true,
        unlocked: true,
        message: {
          en: 'Correct! The vault keyword has been accepted. Crypto Calculator is now unlocked.',
          th: 'ถูกต้อง! รหัสห้องนิรภัยได้รับการยอมรับ Crypto Calculator ถูกปลดล็อกแล้ว'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        unlocked: false,
        message: {
          en: 'Incorrect keyword. Keep searching for the hidden fragments.',
          th: 'รหัสไม่ถูกต้อง ค้นหา fragments ที่ซ่อนอยู่ต่อไป'
        },
        hint: {
          en: 'There are 5 fragments hidden in various places: API response, HTTP headers, and encoded data.',
          th: 'มี 5 fragments ซ่อนอยู่ในที่ต่างๆ: API response, HTTP headers, และ encoded data'
        }
      });
    }

  } catch (error) {
    console.error('[C1] Verify keyword error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to verify keyword' });
  }
});

// GET /api/c1/puzzle-hint - Get hints for finding fragments
router.get('/puzzle-hint', (req, res) => {
  res.json({
    title: {
      en: 'The Vault Keyword Puzzle',
      th: 'ปริศนารหัสห้องนิรภัย'
    },
    description: {
      en: 'Before accessing the Crypto Calculator, you must find the hidden keyword. 5 fragments are scattered across the vault.',
      th: 'ก่อนเข้าถึง Crypto Calculator คุณต้องค้นหารหัสลับที่ซ่อนไว้ 5 fragments กระจายอยู่ทั่วห้องนิรภัย'
    },
    fragments: [
      {
        id: 1,
        location: { en: 'Look in the API response data', th: 'ดูใน API response data' },
        encoding: 'Base64',
        hint: { en: '_vault_data contains the first piece', th: '_vault_data มีชิ้นส่วนแรก' }
      },
      {
        id: 2,
        location: { en: 'Check the HTTP response headers', th: 'ตรวจสอบ HTTP response headers' },
        encoding: 'Base64',
        hint: { en: 'X-Vault-Fragment header holds a secret', th: 'X-Vault-Fragment header เก็บความลับ' }
      },
      {
        id: 3,
        location: { en: 'Hidden in RSA artifact data', th: 'ซ่อนอยู่ใน RSA artifact data' },
        encoding: 'Hex',
        hint: { en: '_debug field has what you need', th: '_debug field มีสิ่งที่คุณต้องการ' }
      },
      {
        id: 4,
        location: { en: 'The founding year, first half', th: 'ปีก่อตั้ง ครึ่งแรก' },
        encoding: 'Plain',
        hint: { en: '19XX - what comes before XX?', th: '19XX - อะไรมาก่อน XX?' }
      },
      {
        id: 5,
        location: { en: 'DH metadata contains the last piece', th: 'DH metadata มีชิ้นสุดท้าย' },
        encoding: 'Base64',
        hint: { en: '_metadata.fragment5 completes the puzzle', th: '_metadata.fragment5 ทำให้ปริศนาสมบูรณ์' }
      }
    ],
    finalHint: {
      en: 'Decode all fragments and combine them in order (1-2-3-4-5) to form the keyword.',
      th: 'ถอดรหัส fragments ทั้งหมดและรวมกันตามลำดับ (1-2-3-4-5) เพื่อสร้างรหัส'
    }
  });
});

// POST /api/c1/verify-salt - Verify the Caesar cipher solution for AES salt
router.post('/verify-salt', (req, res) => {
  try {
    const { salt } = req.body;
    const sessionId = req.sessionId;
    const db = getDatabase();

    if (!salt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Salt required'
      });
    }

    // Check if salt is correct (case-insensitive)
    const isCorrect = salt.toLowerCase() === SALT_CIPHER.plainText.toLowerCase();

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_SALT_ATTEMPT', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({
      salt: salt.substring(0, 10),
      correct: isCorrect
    }));

    if (isCorrect) {
      res.json({
        success: true,
        correct: true,
        message: {
          en: 'Correct! You have decoded the Caesar cipher. The salt is "suranaree" (the university name).',
          th: 'ถูกต้อง! คุณถอดรหัส Caesar cipher สำเร็จ salt คือ "suranaree" (ชื่อมหาวิทยาลัย)'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        correct: false,
        message: {
          en: 'Incorrect salt. Remember: Caesar cipher shifts each character.',
          th: 'salt ไม่ถูกต้อง จำไว้: Caesar cipher เลื่อนตัวอักษรแต่ละตัว'
        },
        hint: {
          en: 'Cipher text is "jlirerivv". Try different shift values - the result should be a word.',
          th: 'cipher text คือ "jlirerivv" ลอง shift ค่าต่างๆ - ผลลัพธ์ควรเป็นคำที่มีความหมาย'
        }
      });
    }

  } catch (error) {
    console.error('[C1] Verify salt error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to verify salt' });
  }
});

// GET /api/c1/salt-hint - Get hint for Caesar cipher puzzle
router.get('/salt-hint', (req, res) => {
  res.json({
    title: {
      en: 'The Caesar Cipher Puzzle',
      th: 'ปริศนา Caesar Cipher'
    },
    description: {
      en: 'To derive the AES key, you need the secret salt. It has been encrypted using Caesar cipher.',
      th: 'เพื่อสร้าง AES key คุณต้องหา salt ลับ มันถูกเข้ารหัสด้วย Caesar cipher'
    },
    cipher: {
      text: SALT_CIPHER.cipherText,
      algorithm: 'Caesar Cipher',
      shift: SALT_CIPHER.shift,
      direction: 'backward'
    },
    example: {
      en: 'Caesar cipher shifts each letter. With shift=1 backward: B→A, C→B, 1→0, etc.',
      th: 'Caesar cipher เลื่อนตัวอักษรแต่ละตัว ด้วย shift=1 ย้อนกลับ: B→A, C→B, 1→0 เป็นต้น'
    },
    solution_format: {
      en: 'The salt should be 9 letters (a word)',
      th: 'salt ควรมี 9 ตัวอักษร (คำภาษาอังกฤษ)'
    }
  });
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
        en: 'Shared secret computed. Now: AES_KEY = SHA256(shared_secret + "suranaree")[:32]',
        th: 'คำนวณ shared secret แล้ว ต่อไป: AES_KEY = SHA256(shared_secret + "suranaree")[:32]'
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
        en: 'Decrypt using: AES_KEY = SHA256(shared_secret + "suranaree")[:32]',
        th: 'ถอดรหัสด้วย: AES_KEY = SHA256(shared_secret + "suranaree")[:32]'
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

    // Update database - mark exchange as complete
    const updateResult = db.prepare(`
      UPDATE crypto_artifacts
      SET dh_client_public = ?, dh_shared_secret = ?, aes_encrypted_data = ?, rsa_signature = ?, exchange_complete = 1, artifact_downloaded = 1
      WHERE session_id = ?
    `).run(clientPublic.toString(16), sharedSecretHex, encryptedData, signature, sessionId);

    console.log(`[C1] Easy decrypt - session ${sessionId}: updated ${updateResult.changes} rows`);

    // Log
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C1_EASY_DECRYPT', ?, datetime('now'))
    `).run(sessionId, req.user.playerId, JSON.stringify({ mode: 'easy' }));

    res.json({
      success: true,
      mode: 'easy',
      message: {
        en: 'Easy mode: DH exchange and decryption done automatically!',
        th: 'โหมดง่าย: ทำ DH exchange และถอดรหัสให้อัตโนมัติแล้ว!'
      },
      decryptedMessage: artifacts.secret_message,
      signature: signature,
      hints: {
        formula: 'FLAG_1 = MUT{SHA256(message + "????????" + signature)[:32]}',
        steps: {
          en: [
            '1. Concatenate: message + "????????" + signature',
            '2. Hash it with SHA256',
            '3. Take first 32 characters of the hex result',
            '4. Wrap with MUT{...}'
          ],
          th: [
            '1. ต่อกัน: message + "????????" + signature',
            '2. Hash ด้วย SHA256',
            '3. ตัดเอา 32 ตัวอักษรแรกของผลลัพธ์ hex',
            '4. ครอบด้วย MUT{...}'
          ]
        },
        python: {
          en: 'Use module: hashlib, function: sha256(), method: .hexdigest()',
          th: 'ใช้ module: hashlib, function: sha256(), method: .hexdigest()'
        }
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

    if (!artifacts) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No artifacts found. Call /api/c1/artifacts or /api/c1/easy-decrypt first',
        hint: 'สำหรับโหมดง่าย: GET /api/c1/easy-decrypt'
      });
    }

    if (!artifacts.exchange_complete) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'DH exchange not complete. Call /api/c1/easy-decrypt or complete the DH exchange manually',
        hint: 'สำหรับโหมดง่าย: GET /api/c1/easy-decrypt'
      });
    }

    // Generate expected flag using: SHA256(message + "27072533" + signature)
    const expectedFlag = flagService.generateFlag1(
      sessionId,
      artifacts.secret_message,
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

      // Generate new token with updated progress (exclude old iat and exp)
      const { iat, exp, ...userWithoutExp } = req.user;
      const newToken = generateToken({
        ...userWithoutExp,
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
        en: 'FLAG_1 = MUT{SHA256(decrypted_message + "????????" + signature_hex)[:32]}',
        th: 'FLAG_1 = MUT{SHA256(decrypted_message + "????????" + signature_hex)[:32]}'
      }
    });

  } catch (error) {
    console.error('[C1] Flag submit error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Flag submission failed' });
  }
});

export default router;
