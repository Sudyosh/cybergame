// MUT Secure Vault - Challenge 2 Routes (Entity Authentication)
// Implements: Email OTP, Password, PIN - 3 Factor Authentication

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { authMiddleware, challengeGate, generateToken } from '../middleware/auth.js';
import { flagLimiter, pinLimiter, otpLimiter } from '../middleware/rateLimit.js';
import flagService from '../services/flagService.js';
import emailService from '../services/emailService.js';
import { STORY, AUTH_CONFIG, SUT_DATA } from '../config/constants.js';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);
router.use(challengeGate(2));

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// GET /api/c2/story - Get challenge story
router.get('/story', (req, res) => {
  res.json({
    title: STORY.challenge2.title,
    description: STORY.challenge2.description,
    objectives: {
      en: [
        'Verify Email OTP (Factor 1: Something you receive)',
        'Verify Password (Factor 2: Something you know)',
        'Verify PIN (Factor 3: Something unique)',
        'Complete 3-Factor Authentication'
      ],
      th: [
        'ยืนยัน Email OTP (ปัจจัยที่ 1: สิ่งที่คุณได้รับ)',
        'ยืนยันรหัสผ่าน (ปัจจัยที่ 2: สิ่งที่คุณรู้)',
        'ยืนยัน PIN (ปัจจัยที่ 3: สิ่งที่ไม่ซ้ำใคร)',
        'ทำ 3-Factor Authentication ให้สำเร็จ'
      ]
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

    const emailVerified = !!authState.otp_verified; // reuse otp_verified for email OTP
    const passwordVerified = !!authState.password_verified;
    const pinVerified = !!authState.pin_verified;

    // Generate envelope hint
    const envelopeHint = emailService.generateEnvelopeHint();

    // Check if locked
    let locked = false;
    let lockedUntil = null;
    if (authState.locked_until) {
      const lockTime = new Date(authState.locked_until);
      if (lockTime > new Date()) {
        locked = true;
        lockedUntil = authState.locked_until;
      }
    }

    res.json({
      locked,
      lockedUntil,
      factors: {
        email: {
          verified: emailVerified,
          hint: !emailVerified ? {
            en: 'Enter your email to receive OTP code and hints',
            th: 'กรอกอีเมลเพื่อรับรหัส OTP และคำใบ้'
          } : null
        },
        password: {
          verified: passwordVerified,
          hint: emailVerified && !passwordVerified ? {
            en: 'Check your email for the scrambled password hint',
            th: 'ดูคำใบ้รหัสผ่านแบบสลับตัวอักษรในอีเมล'
          } : null
        },
        pin: {
          verified: pinVerified,
          attempts: authState.pin_attempts,
          maxAttempts: AUTH_CONFIG.pin.maxAttempts,
          hint: passwordVerified && !pinVerified ? {
            en: 'What is the postal code on the envelope?',
            th: 'รหัสไปรษณีย์บนซองจดหมายคืออะไร?'
          } : null,
          envelope: passwordVerified && !pinVerified ? envelopeHint : null
        }
      },
      mfaComplete: !!(emailVerified && passwordVerified && pinVerified),
      progress: `${[emailVerified, passwordVerified, pinVerified].filter(Boolean).length}/3 factors complete`,
      message: locked ? {
        en: 'Account temporarily locked due to failed attempts',
        th: 'บัญชีถูกล็อคชั่วคราวเนื่องจากลองผิดหลายครั้ง'
      } : null
    });

  } catch (error) {
    console.error('[C2] Status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'Failed to get status. Please try again.', th: 'ไม่สามารถดูสถานะได้ กรุณาลองใหม่' }
    });
  }
});

// POST /api/c2/email/send-otp - Send OTP to email (Factor 1)
router.post('/email/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email required'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP (in memory for demo, in production use database/Redis)
    otpStore.set(req.sessionId, {
      otp,
      email,
      expiresAt,
      attempts: 0
    });

    const db = getDatabase();

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C2_EMAIL_OTP_SENT', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ email }));

    // Send real email with OTP and hints
    const emailResult = await emailService.sendOTPEmail(email, otp);

    // Generate scrambled password hint for response
    const scrambledHint = emailService.generatePasswordHint('computer_engineering_#28!');

    res.json({
      success: true,
      message: {
        en: `OTP and hints sent to ${email}! Check your inbox.`,
        th: `ส่ง OTP และคำใบ้ไปที่ ${email} แล้ว! ตรวจสอบกล่องจดหมาย`
      },
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl || null, // For Ethereal test emails
      // Also show OTP for convenience (can remove in production)
      demoOTP: otp,
      expiresIn: '5 minutes',
      hints: {
        password: {
          en: `Unscramble: ${scrambledHint}`,
          th: `เรียงใหม่: ${scrambledHint}`
        },
        pin: {
          en: 'Check the envelope in your email - what is the postal code?',
          th: 'ดูซองจดหมายในอีเมล - รหัสไปรษณีย์คืออะไร?'
        }
      }
    });

  } catch (error) {
    console.error('[C2] Send OTP error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'Failed to send OTP. Please try again.', th: 'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่' }
    });
  }
});

// POST /api/c2/email/verify-otp - Verify email OTP (Factor 1)
router.post('/email/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'OTP required'
      });
    }

    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);

    if (!authState) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Auth challenge not initialized. Start a new session.', th: 'ยังไม่ได้เริ่มต้นการยืนยันตัวตน เริ่ม session ใหม่' }
      });
    }

    if (authState.otp_verified) {
      return res.json({
        success: true,
        message: { en: 'Email OTP already verified', th: 'ยืนยัน Email OTP แล้ว' },
        factor: 1,
        nextHint: {
          en: 'Check your email for the scrambled password hint',
          th: 'ดูคำใบ้รหัสผ่านแบบสลับตัวอักษรในอีเมล'
        }
      });
    }

    // Get stored OTP
    const storedData = otpStore.get(req.sessionId);

    if (!storedData) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No OTP sent. Send OTP first.',
        hint: 'POST /api/c2/email/send-otp'
      });
    }

    // Check if expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(req.sessionId);
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'OTP expired. Request a new one.', th: 'OTP หมดอายุ ขอใหม่' }
      });
    }

    // Verify OTP
    const isValid = otp === storedData.otp;

    // Log attempt
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C2_EMAIL_OTP_VERIFY', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ success: isValid }));

    if (isValid) {
      // Mark as verified (reuse otp_verified column)
      db.prepare('UPDATE auth_challenges SET otp_verified = 1 WHERE session_id = ?').run(req.sessionId);
      otpStore.delete(req.sessionId);

      // Generate scrambled hint
      const scrambledHint = emailService.generatePasswordHint('computer_engineering_#28!');

      return res.json({
        success: true,
        message: {
          en: 'Email OTP verified! Factor 1 complete.',
          th: 'ยืนยัน Email OTP สำเร็จ! ปัจจัยที่ 1 เสร็จสมบูรณ์'
        },
        factor: 1,
        nextHint: {
          en: `Unscramble: ${scrambledHint}`,
          th: `เรียงใหม่: ${scrambledHint}`
        }
      });
    }

    // Increment attempts
    storedData.attempts++;
    if (storedData.attempts >= 5) {
      otpStore.delete(req.sessionId);
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Too many attempts. Request a new OTP.', th: 'ลองมากเกินไป ขอ OTP ใหม่' }
      });
    }

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect OTP',
        th: 'OTP ไม่ถูกต้อง'
      },
      attemptsRemaining: 5 - storedData.attempts
    });

  } catch (error) {
    console.error('[C2] Verify OTP error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'OTP verification failed. Please try again.', th: 'การยืนยัน OTP ล้มเหลว กรุณาลองใหม่' }
    });
  }
});

// POST /api/c2/password - Verify password (Factor 2)
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

    if (!authState) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Auth challenge not initialized. Start a new session.', th: 'ยังไม่ได้เริ่มต้นการยืนยันตัวตน เริ่ม session ใหม่' }
      });
    }

    // Check if email OTP verified first
    if (!authState.otp_verified) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Verify Email OTP first (Factor 1)', th: 'ยืนยัน Email OTP ก่อน (ปัจจัยที่ 1)' }
      });
    }

    if (authState.password_verified) {
      const envelopeHint = emailService.generateEnvelopeHint();
      return res.json({
        success: true,
        message: { en: 'Password already verified', th: 'ยืนยันรหัสผ่านแล้ว' },
        factor: 2,
        nextHint: {
          en: 'What is the postal code on the envelope?',
          th: 'รหัสไปรษณีย์บนซองจดหมายคืออะไร?'
        },
        envelope: envelopeHint
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

      const envelopeHint = emailService.generateEnvelopeHint();

      return res.json({
        success: true,
        message: {
          en: 'Password verified! Factor 2 complete.',
          th: 'ยืนยันรหัสผ่านสำเร็จ! ปัจจัยที่ 2 เสร็จสมบูรณ์'
        },
        factor: 2,
        nextHint: {
          en: 'What is the postal code on the envelope?',
          th: 'รหัสไปรษณีย์บนซองจดหมายคืออะไร?'
        },
        envelope: envelopeHint
      });
    }

    // Generate scrambled hint for failed attempt
    const scrambledHint = emailService.generatePasswordHint('computer_engineering_#28!');

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect password',
        th: 'รหัสผ่านไม่ถูกต้อง'
      },
      hint: {
        en: `Unscramble: ${scrambledHint}`,
        th: `เรียงใหม่: ${scrambledHint}`
      }
    });

  } catch (error) {
    console.error('[C2] Password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'Password verification failed. Please try again.', th: 'การยืนยันรหัสผ่านล้มเหลว กรุณาลองใหม่' }
    });
  }
});

// POST /api/c2/pin - Verify PIN (Factor 3)
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

    if (!authState) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Auth challenge not initialized. Start a new session.', th: 'ยังไม่ได้เริ่มต้นการยืนยันตัวตน เริ่ม session ใหม่' }
      });
    }

    // Check if password verified first
    if (!authState.password_verified) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Verify Password first (Factor 2)', th: 'ยืนยันรหัสผ่านก่อน (ปัจจัยที่ 2)' }
      });
    }

    if (authState.pin_verified) {
      return res.json({
        success: true,
        message: { en: 'PIN already verified', th: 'ยืนยัน PIN แล้ว' },
        factor: 3
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
      db.prepare('UPDATE auth_challenges SET pin_verified = 1, pin_attempts = 0, mfa_complete = 1 WHERE session_id = ?').run(req.sessionId);

      return res.json({
        success: true,
        message: {
          en: 'PIN verified! Factor 3 complete. MFA Complete!',
          th: 'ยืนยัน PIN สำเร็จ! ปัจจัยที่ 3 เสร็จสมบูรณ์ MFA เสร็จสมบูรณ์!'
        },
        factor: 3,
        mfaComplete: true
      });
    }

    db.prepare('UPDATE auth_challenges SET pin_attempts = ? WHERE session_id = ?').run(newAttempts, req.sessionId);

    const envelopeHint = emailService.generateEnvelopeHint();

    res.status(401).json({
      success: false,
      message: {
        en: 'Incorrect PIN',
        th: 'PIN ไม่ถูกต้อง'
      },
      attemptsRemaining: AUTH_CONFIG.pin.maxAttempts - newAttempts,
      hint: {
        en: 'What is the postal code on the envelope?',
        th: 'รหัสไปรษณีย์บนซองจดหมายคืออะไร?'
      },
      envelope: envelopeHint
    });

  } catch (error) {
    console.error('[C2] PIN error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'PIN verification failed. Please try again.', th: 'การยืนยัน PIN ล้มเหลว กรุณาลองใหม่' }
    });
  }
});

// GET /api/c2/mfa/status - Check MFA completion and get FLAG_2
router.get('/mfa/status', (req, res) => {
  try {
    const db = getDatabase();
    const authState = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(req.sessionId);
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.sessionId);

    if (!authState || !session) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Session not found. Start a new session.', th: 'ไม่พบ session เริ่ม session ใหม่' }
      });
    }

    const factors = {
      email: !!authState.otp_verified,
      password: !!authState.password_verified,
      pin: !!authState.pin_verified
    };

    const mfaComplete = factors.email && factors.password && factors.pin;

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
        en: `Complete all 3 factors. Progress: ${Object.values(factors).filter(Boolean).length}/3`,
        th: `ทำให้ครบทั้ง 3 ปัจจัย ความคืบหน้า: ${Object.values(factors).filter(Boolean).length}/3`
      },
      hints: !mfaComplete ? {
        email: !factors.email ? { en: 'Send OTP to your email', th: 'ส่ง OTP ไปที่อีเมล' } : null,
        password: !factors.password ? { en: 'Check your email for scrambled hint', th: 'ดูคำใบ้แบบสลับในอีเมล' } : null,
        pin: !factors.pin ? { en: 'Postal code on the envelope', th: 'รหัสไปรษณีย์บนซอง' } : null
      } : null
    });

  } catch (error) {
    console.error('[C2] MFA status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'Failed to get MFA status. Please try again.', th: 'ไม่สามารถดูสถานะ MFA ได้ กรุณาลองใหม่' }
    });
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

    if (!authState || !session) {
      return res.status(400).json({
        error: 'Bad Request',
        message: { en: 'Session not found. Start a new session.', th: 'ไม่พบ session เริ่ม session ใหม่' }
      });
    }

    if (!(authState.otp_verified && authState.password_verified && authState.pin_verified)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete MFA first (all 3 factors: Email OTP, Password, PIN)'
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

      // Generate new token (exclude old iat and exp)
      const { iat, exp, ...userWithoutExp } = req.user;
      const newToken = generateToken({
        ...userWithoutExp,
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
    res.status(500).json({
      error: 'Internal Server Error',
      message: { en: 'Flag submission failed. Please try again.', th: 'การส่ง Flag ล้มเหลว กรุณาลองใหม่' }
    });
  }
});

export default router;
