// MUT Secure Vault - Challenge 2 Routes (Entity Authentication)
// Implements: Password, PIN, OTP, MFA

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../config/database.js';
import { authMiddleware, challengeGate, generateToken } from '../middleware/auth.js';
import { flagLimiter, pinLimiter, otpLimiter } from '../middleware/rateLimit.js';
import otpService from '../services/otpService.js';
import flagService from '../services/flagService.js';
import { STORY, AUTH_CONFIG, SUT_DATA } from '../config/constants.js';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);
router.use(challengeGate(2));

// GET /api/c2/story - Get challenge story
router.get('/story', (req, res) => {
  res.json({
    title: STORY.challenge2.title,
    description: STORY.challenge2.description,
    objectives: {
      en: [
        'Verify password (Factor 1: Something you know)',
        'Verify PIN (Factor 2: Something unique)',
        'Complete Multi-Factor Authentication (2 factors)'
      ],
      th: [
        'ยืนยันรหัสผ่าน (ปัจจัยที่ 1: สิ่งที่คุณรู้)',
        'ยืนยัน PIN (ปัจจัยที่ 2: สิ่งที่ไม่ซ้ำใคร)',
        'ทำ Multi-Factor Authentication ให้สำเร็จ (2 ปัจจัย)'
      ]
    },
    easyHints: {
      password: {
        en: 'Password = Suranaree + 1990 + ! → "Suranaree1990!"',
        th: 'รหัสผ่าน = Suranaree + 1990 + ! → "Suranaree1990!"'
      },
      pin: {
        en: 'PIN = Postal code of Nakhon Ratchasima = 30000',
        th: 'PIN = รหัสไปรษณีย์นครราชสีมา = 30000'
      }
    }
  });
});

// GET /api/c2/status - Get authentication status
router.get('/status', (req, res) => {
  try {
    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (!authState) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Auth challenge not initialized'
      });
    }

    // Check if locked
    if (authState.locked_until) {
      const lockTime = new Date(authState.locked_until);
      if (lockTime > new Date()) {
        return res.json({
          locked: true,
          lockedUntil: authState.locked_until,
          message: {
            en: 'Account temporarily locked due to failed attempts',
            th: 'บัญชีถูกล็อคชั่วคราวเนื่องจากลองผิดหลายครั้ง'
          }
        });
      }
    }

    res.json({
      factors: {
        password: {
          verified: !!authState.password_verified,
          hint: !authState.password_verified ? {
            en: 'Password = "Suranaree1990!" (University name + year + !)',
            th: 'รหัสผ่าน = "Suranaree1990!" (ชื่อมหาวิทยาลัย + ปี + !)'
          } : null
        },
        pin: {
          verified: !!authState.pin_verified,
          attempts: authState.pin_attempts,
          maxAttempts: AUTH_CONFIG.pin.maxAttempts,
          hint: !authState.pin_verified ? {
            en: 'PIN = "30000" (Nakhon Ratchasima postal code)',
            th: 'PIN = "30000" (รหัสไปรษณีย์นครราชสีมา)'
          } : null
        }
      },
      mfaComplete: !!(authState.password_verified && authState.pin_verified),
      progress: `${[authState.password_verified, authState.pin_verified].filter(Boolean).length}/2 factors complete`
    });

  } catch (error) {
    console.error('[C2] Status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/c2/password - Verify password (Factor 1)
router.post('/password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password required'
      });
    }

    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (authState.password_verified) {
      return res.json({
        success: true,
        message: { en: 'Password already verified', th: 'ยืนยันรหัสผ่านแล้ว' },
        factor: 1
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, authState.password_hash);

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C2_PASSWORD_ATTEMPT', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ success: isValid }));

    if (isValid) {
      db.prepare('UPDATE auth_challenges SET password_verified = 1 WHERE session_id = ?').run(req.sessionId);

      return res.json({
        success: true,
        message: {
          en: 'Password verified! Factor 1 complete.',
          th: 'ยืนยันรหัสผ่านสำเร็จ! ปัจจัยที่ 1 เสร็จสมบูรณ์'
        },
        factor: 1,
        nextHint: {
          en: 'Now verify your PIN (postal code of Nakhon Ratchasima)',
          th: 'ต่อไปยืนยัน PIN (รหัสไปรษณีย์ของนครราชสีมา)'
        }
      });
    }

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect password',
        th: 'รหัสผ่านไม่ถูกต้อง'
      },
      hint: {
        en: 'Try: [UniversityName][Year]! (e.g., Suranaree1990!)',
        th: 'ลอง: [ชื่อมหาวิทยาลัย][ปี]! (เช่น Suranaree1990!)'
      }
    });

  } catch (error) {
    console.error('[C2] Password error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/c2/pin - Verify PIN (Factor 2)
router.post('/pin', pinLimiter, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'PIN required'
      });
    }

    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (authState.pin_verified) {
      return res.json({
        success: true,
        message: { en: 'PIN already verified', th: 'ยืนยัน PIN แล้ว' },
        factor: 2
      });
    }

    // Check lockout
    if (authState.locked_until) {
      const lockTime = new Date(authState.locked_until);
      if (lockTime > new Date()) {
        return res.status(423).json({
          error: 'Locked',
          message: { en: 'Account locked', th: 'บัญชีถูกล็อค' },
          lockedUntil: authState.locked_until
        });
      }
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin.toString(), authState.pin_hash);

    // Update attempts
    const newAttempts = authState.pin_attempts + 1;

    if (!isValid && newAttempts >= AUTH_CONFIG.pin.maxAttempts) {
      // Lock account
      const lockUntil = new Date(Date.now() + AUTH_CONFIG.pin.lockoutMinutes * 60 * 1000);
      db.prepare(`
        UPDATE auth_challenges
        SET pin_attempts = ?, locked_until = ?
        WHERE session_id = ?
      `).run(newAttempts, lockUntil.toISOString(), req.sessionId);

      return res.status(423).json({
        error: 'Locked',
        message: {
          en: `Too many attempts. Locked for ${AUTH_CONFIG.pin.lockoutMinutes} minutes.`,
          th: `ลองมากเกินไป ล็อค ${AUTH_CONFIG.pin.lockoutMinutes} นาที`
        },
        lockedUntil: lockUntil.toISOString()
      });
    }

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C2_PIN_ATTEMPT', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ success: isValid, attempt: newAttempts }));

    if (isValid) {
      db.prepare('UPDATE auth_challenges SET pin_verified = 1, pin_attempts = 0 WHERE session_id = ?').run(req.sessionId);

      return res.json({
        success: true,
        message: {
          en: 'PIN verified! Factor 2 complete.',
          th: 'ยืนยัน PIN สำเร็จ! ปัจจัยที่ 2 เสร็จสมบูรณ์'
        },
        factor: 2,
        nextHint: {
          en: 'Now verify OTP. Your FLAG_1 generates the TOTP secret.',
          th: 'ต่อไปยืนยัน OTP FLAG_1 ของคุณสร้าง TOTP secret'
        }
      });
    }

    db.prepare('UPDATE auth_challenges SET pin_attempts = ? WHERE session_id = ?').run(newAttempts, req.sessionId);

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect PIN',
        th: 'PIN ไม่ถูกต้อง'
      },
      attemptsRemaining: AUTH_CONFIG.pin.maxAttempts - newAttempts,
      hint: {
        en: 'The PIN is a 5-digit postal code. Think Nakhon Ratchasima...',
        th: 'PIN คือรหัสไปรษณีย์ 5 หลัก ลองคิดถึงนครราชสีมา...'
      }
    });

  } catch (error) {
    console.error('[C2] PIN error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c2/otp/setup - Get OTP setup info
router.get('/otp/setup', async (req, res) => {
  try {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.sessionId);

    if (!session.flag_1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete Challenge 1 first to get FLAG_1',
        hint: 'FLAG_1 is used to generate your OTP secret'
      });
    }

    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    // Generate OTP secret from FLAG_1
    const secretData = otpService.generateSecretFromFlag(session.flag_1);

    // Store secret
    db.prepare('UPDATE auth_challenges SET otp_secret = ? WHERE session_id = ?').run(secretData.base32, req.sessionId);

    // Generate QR code
    const qrData = await otpService.generateQRCode(secretData.base32, req.user.username);

    res.json({
      success: true,
      message: {
        en: 'OTP setup ready. Scan QR code or enter secret manually.',
        th: 'ตั้งค่า OTP พร้อม สแกน QR code หรือใส่ secret ด้วยตนเอง'
      },
      qrCode: qrData.qrCode,
      secret: secretData.base32,
      instructions: otpService.getOTPHint(session.flag_1),
      algorithm: 'TOTP',
      digits: AUTH_CONFIG.otp.digits,
      period: AUTH_CONFIG.otp.step
    });

  } catch (error) {
    console.error('[C2] OTP setup error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/c2/otp/verify - Verify OTP (Factor 3)
router.post('/otp/verify', otpLimiter, (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'OTP code required'
      });
    }

    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (authState.otp_verified) {
      return res.json({
        success: true,
        message: { en: 'OTP already verified', th: 'ยืนยัน OTP แล้ว' },
        factor: 3
      });
    }

    if (!authState.otp_secret) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Setup OTP first (GET /api/c2/otp/setup)'
      });
    }

    // Verify OTP
    const isValid = otpService.verifyTOTP(authState.otp_secret, otp);

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C2_OTP_ATTEMPT', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ success: isValid }));

    if (isValid) {
      db.prepare('UPDATE auth_challenges SET otp_verified = 1 WHERE session_id = ?').run(req.sessionId);

      // Check if MFA complete (all 3 factors)
      const updated = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);
      const mfaComplete = updated.password_verified && updated.pin_verified && updated.otp_verified;

      if (mfaComplete) {
        db.prepare('UPDATE auth_challenges SET mfa_complete = 1 WHERE session_id = ?').run(req.sessionId);
      }

      return res.json({
        success: true,
        message: {
          en: 'OTP verified! Factor 3 complete.',
          th: 'ยืนยัน OTP สำเร็จ! ปัจจัยที่ 3 เสร็จสมบูรณ์'
        },
        factor: 3,
        mfaComplete: mfaComplete,
        nextHint: mfaComplete ? {
          en: 'MFA Complete! Get your FLAG_2.',
          th: 'MFA เสร็จสมบูรณ์! รับ FLAG_2 ของคุณ'
        } : null
      });
    }

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect OTP',
        th: 'OTP ไม่ถูกต้อง'
      },
      hint: {
        en: 'OTP changes every 30 seconds. Make sure your time is synchronized.',
        th: 'OTP เปลี่ยนทุก 30 วินาที ตรวจสอบให้แน่ใจว่าเวลาตรงกัน'
      }
    });

  } catch (error) {
    console.error('[C2] OTP verify error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c2/mfa/status - Check MFA completion
router.get('/mfa/status', (req, res) => {
  try {
    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.sessionId);

    const factors = {
      password: !!authState.password_verified,
      pin: !!authState.pin_verified
    };

    const mfaComplete = factors.password && factors.pin;

    let flag2 = null;
    if (mfaComplete && session.flag_1) {
      flag2 = flagService.generateFlag2(req.sessionId, session.flag_1);
      // Update MFA complete in database
      db.prepare('UPDATE auth_challenges SET mfa_complete = 1 WHERE session_id = ?').run(req.sessionId);
    }

    res.json({
      factors,
      mfaComplete,
      flag2: mfaComplete ? flag2 : null,
      message: mfaComplete ? {
        en: 'MFA Complete! Here is your FLAG_2.',
        th: 'MFA เสร็จสมบูรณ์! นี่คือ FLAG_2 ของคุณ'
      } : {
        en: `Complete both factors. Progress: ${Object.values(factors).filter(Boolean).length}/2`,
        th: `ทำให้ครบทั้ง 2 ปัจจัย ความคืบหน้า: ${Object.values(factors).filter(Boolean).length}/2`
      },
      easyHints: !mfaComplete ? {
        password: !factors.password ? 'Suranaree1990!' : null,
        pin: !factors.pin ? '30000' : null
      } : null
    });

  } catch (error) {
    console.error('[C2] MFA status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/c2/submit-flag - Submit FLAG_2
router.post('/submit-flag', flagLimiter, (req, res) => {
  try {
    const { flag } = req.body;

    if (!flag) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Flag required'
      });
    }

    const db = getDatabase();
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.sessionId);
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (!(authState.password_verified && authState.pin_verified)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete MFA first (both password and PIN factors)'
      });
    }

    // Generate expected flag
    const expectedFlag = flagService.generateFlag2(req.sessionId, session.flag_1);
    const isCorrect = flag === expectedFlag;

    // Log submission
    db.prepare(`
      INSERT INTO flag_submissions (session_id, challenge_number, submitted_flag, is_correct)
      VALUES (?, 2, ?, ?)
    `).run(req.sessionId, flag, isCorrect ? 1 : 0);

    if (isCorrect) {
      db.prepare(`
        UPDATE game_sessions SET challenge_2_complete = 1, flag_2 = ? WHERE id = ?
      `).run(flag, req.sessionId);

      // Generate new token
      const newToken = generateToken({
        ...req.user,
        challenge1Complete: true,
        challenge2Complete: true
      });

      return res.json({
        success: true,
        correct: true,
        message: {
          en: 'FLAG_2 correct! Challenge 2 complete. You have mastered authentication.',
          th: 'FLAG_2 ถูกต้อง! ด่าน 2 เสร็จสมบูรณ์ คุณได้เชี่ยวชาญการยืนยันตัวตนแล้ว'
        },
        flag: flag,
        newToken: newToken,
        next: {
          challenge: 3,
          name: 'The Hierarchy of Secrets',
          hint: {
            en: 'Navigate the access control hierarchy to reach Top Secret',
            th: 'นำทางผ่านลำดับชั้นการควบคุมการเข้าถึงไปสู่ลับที่สุด'
          }
        }
      });
    }

    res.json({
      success: false,
      correct: false,
      message: {
        en: 'Incorrect flag.',
        th: 'Flag ไม่ถูกต้อง'
      }
    });

  } catch (error) {
    console.error('[C2] Flag submit error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
