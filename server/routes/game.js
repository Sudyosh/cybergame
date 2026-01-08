// MUT Secure Vault - Game Session Routes

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../config/database.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';
import abacMiddleware from '../middleware/abac.js';
import { AUTH_CONFIG, SUT_DATA } from '../config/constants.js';

const router = Router();

// POST /api/game/start - Start a new game session
router.post('/start', authMiddleware, (req, res) => {
  try {
    const db = getDatabase();
    const playerId = req.user.playerId;

    // Check if player already has a session (use most recent)
    let session = db.prepare(`
      SELECT * FROM game_sessions
      WHERE player_id = ?
      ORDER BY started_at DESC LIMIT 1
    `).get(playerId);

    if (!session) {
      // Create new session
      const result = db.prepare(`
        INSERT INTO game_sessions (player_id, started_at)
        VALUES (?, datetime('now'))
      `).run(playerId);

      session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid);

      // Initialize ABAC attributes for new session
      abacMiddleware.initializeAttributes(session.id, playerId);

      // Log session start
      db.prepare(`
        INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
        VALUES (?, ?, 'GAME_START', ?, datetime('now'))
      `).run(session.id, playerId, JSON.stringify({ newSession: true }));
    }

    // Generate new token with sessionId
    const newToken = generateToken({
      playerId: req.user.playerId,
      username: req.user.username,
      email: req.user.email,
      sessionId: session.id,
      challenge1Complete: session.challenge_1_complete === 1,
      challenge2Complete: session.challenge_2_complete === 1,
      challenge3Complete: session.challenge_3_complete === 1
    });

    res.json({
      success: true,
      message: {
        en: 'Game session started! Good luck, Agent.',
        th: 'เริ่มเกมแล้ว! ขอให้โชคดี Agent'
      },
      sessionId: session.id,
      token: newToken,
      progress: {
        challenge1: session.challenge_1_complete === 1,
        challenge2: session.challenge_2_complete === 1,
        challenge3: session.challenge_3_complete === 1
      },
      next: {
        challenge: 1,
        name: 'Cryptography',
        endpoint: '/api/c1/artifacts',
        easyMode: '/api/c1/easy-decrypt'
      }
    });

  } catch (error) {
    console.error('[Game] Start error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start game' });
  }
});

// GET /api/game/status - Get current session status
router.get('/status', authMiddleware, (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.sessionId;

    if (!sessionId) {
      return res.json({
        success: true,
        hasSession: false,
        message: {
          en: 'No active session. Start a game with POST /api/game/start',
          th: 'ยังไม่มี session ที่ใช้งาน เริ่มเกมด้วย POST /api/game/start'
        }
      });
    }

    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      hasSession: true,
      sessionId: session.id,
      progress: {
        challenge1: session.challenge_1_complete === 1,
        challenge2: session.challenge_2_complete === 1,
        challenge3: session.challenge_3_complete === 1
      },
      flags: {
        flag1: session.flag_1 || null,
        flag2: session.flag_2 || null,
        finalFlag: session.final_flag || null
      }
    });

  } catch (error) {
    console.error('[Game] Status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/game/reset - Reset current session (start over)
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    const db = getDatabase();
    const playerId = req.user.playerId;

    // Create new session (old sessions will no longer be the most recent)
    const result = db.prepare(`
      INSERT INTO game_sessions (player_id, started_at)
      VALUES (?, datetime('now'))
    `).run(playerId);

    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid);

    // Initialize Challenge 2 auth record with new password
    const challengePassword = 'computer_engineering_#28!';
    const passwordHash = await bcrypt.hash(challengePassword, AUTH_CONFIG.password.saltRounds);
    const pinHash = await bcrypt.hash(SUT_DATA.postalCode, AUTH_CONFIG.password.saltRounds);

    db.prepare(`
      INSERT INTO auth_challenges (session_id, password_hash, pin_hash)
      VALUES (?, ?, ?)
    `).run(session.id, passwordHash, pinHash);

    // Assign default Student role
    db.prepare(`
      INSERT INTO player_roles (session_id, role_id)
      VALUES (?, 1)
    `).run(session.id);

    // Initialize ABAC attributes
    abacMiddleware.initializeAttributes(session.id, playerId);

    // Log reset
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'GAME_RESET', ?, datetime('now'))
    `).run(session.id, playerId, JSON.stringify({ reset: true }));

    // Generate new token
    const newToken = generateToken({
      playerId: req.user.playerId,
      username: req.user.username,
      email: req.user.email,
      sessionId: session.id,
      challenge1Complete: false,
      challenge2Complete: false,
      challenge3Complete: false
    });

    res.json({
      success: true,
      message: {
        en: 'Game reset! Starting fresh.',
        th: 'รีเซ็ตเกมแล้ว! เริ่มใหม่'
      },
      sessionId: session.id,
      token: newToken,
      sessionToken: newToken  // For frontend compatibility
    });

  } catch (error) {
    console.error('[Game] Reset error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reset game' });
  }
});

export default router;
