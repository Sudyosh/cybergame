// MUT Secure Vault - Authentication Routes

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { AUTH_CONFIG, SUT_DATA } from '../config/constants.js';
import rbacMiddleware from '../middleware/rbac.js';
import abacMiddleware from '../middleware/abac.js';

const router = Router();

// POST /api/auth/register - Register new player
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username, email, and password required'
      });
    }

    if (password.length < AUTH_CONFIG.password.minLength) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Password must be at least ${AUTH_CONFIG.password.minLength} characters`
      });
    }

    const db = getDatabase();

    // Check if user exists
    const existing = db.prepare(
      'SELECT id FROM players WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, AUTH_CONFIG.password.saltRounds);

    // Create player
    const result = db.prepare(
      'INSERT INTO players (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username, email, passwordHash);

    // Log registration
    db.prepare(`
      INSERT INTO audit_log (player_id, action, details, ip_address, timestamp)
      VALUES (?, 'REGISTER', ?, ?, datetime('now'))
    `).run(result.lastInsertRowid, JSON.stringify({ username, email }), req.ip);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      playerId: result.lastInsertRowid,
      username: username
    });

  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

// POST /api/auth/login - Login and get JWT
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password required'
      });
    }

    const db = getDatabase();

    // Find player
    const player = db.prepare(
      'SELECT * FROM players WHERE username = ?'
    ).get(username);

    if (!player) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password'
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, player.password_hash);

    if (!validPassword) {
      // Log failed attempt
      db.prepare(`
        INSERT INTO audit_log (player_id, action, details, ip_address, timestamp)
        VALUES (?, 'LOGIN_FAILED', ?, ?, datetime('now'))
      `).run(player.id, JSON.stringify({ reason: 'invalid_password' }), req.ip);

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password'
      });
    }

    // Update last login
    db.prepare('UPDATE players SET last_login = datetime("now") WHERE id = ?').run(player.id);

    // Generate token (without session - session created separately)
    const token = generateToken({
      playerId: player.id,
      username: player.username,
      email: player.email
    });

    // Log successful login
    db.prepare(`
      INSERT INTO audit_log (player_id, action, details, ip_address, timestamp)
      VALUES (?, 'LOGIN_SUCCESS', ?, ?, datetime('now'))
    `).run(player.id, JSON.stringify({ method: 'password' }), req.ip);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      player: {
        id: player.id,
        username: player.username,
        email: player.email
      }
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// POST /api/auth/session/start - Start a new game session
router.post('/session/start', async (req, res) => {
  try {
    // Get player from basic auth or existing token
    const authHeader = req.headers.authorization;
    let playerId, username;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = await import('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'MUT_SECURE_VAULT_JWT_SECRET_1990');
      playerId = decoded.playerId;
      username = decoded.username;
    } else {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Login required to start a session'
      });
    }

    const db = getDatabase();

    // Create new game session
    const result = db.prepare(`
      INSERT INTO game_sessions (player_id, started_at)
      VALUES (?, datetime('now'))
    `).run(playerId);

    const sessionId = result.lastInsertRowid;

    // Initialize Challenge 2 auth record
    const challengePassword = `Suranaree${SUT_DATA.yearEstablished}!`; // "Suranaree1990!"
    const passwordHash = await bcrypt.hash(challengePassword, AUTH_CONFIG.password.saltRounds);
    const pinHash = await bcrypt.hash(SUT_DATA.postalCode, AUTH_CONFIG.password.saltRounds);

    db.prepare(`
      INSERT INTO auth_challenges (session_id, password_hash, pin_hash)
      VALUES (?, ?, ?)
    `).run(sessionId, passwordHash, pinHash);

    // Assign default Student role
    db.prepare(`
      INSERT INTO player_roles (session_id, role_id)
      VALUES (?, 1)
    `).run(sessionId);

    // Initialize default attributes
    abacMiddleware.initializeAttributes(sessionId, playerId);

    // Generate session token with full info
    const sessionToken = generateToken({
      playerId: playerId,
      username: username,
      sessionId: sessionId,
      challenge1Complete: false,
      challenge2Complete: false,
      challenge3Complete: false
    });

    // Update session with token
    db.prepare('UPDATE game_sessions SET session_token = ? WHERE id = ?').run(sessionToken, sessionId);

    // Log session start
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, ip_address, timestamp)
      VALUES (?, ?, 'SESSION_START', ?, ?, datetime('now'))
    `).run(sessionId, playerId, JSON.stringify({ sessionId }), req.ip);

    res.status(201).json({
      success: true,
      message: 'Game session started',
      sessionId: sessionId,
      token: sessionToken,
      progress: {
        challenge1: false,
        challenge2: false,
        challenge3: false
      },
      story: {
        en: 'Welcome to MUT Secure Vault. Your journey begins with Challenge 1: The Encrypted Legacy.',
        th: 'ยินดีต้อนรับสู่ MUT Secure Vault การเดินทางของคุณเริ่มต้นที่ด่าน 1: มรดกที่ถูกเข้ารหัส'
      }
    });

  } catch (error) {
    console.error('[Auth] Session start error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start session'
    });
  }
});

// GET /api/auth/session/progress - Get current progress
router.get('/session/progress', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session token required'
      });
    }

    const jwt = await import('jsonwebtoken');
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'MUT_SECURE_VAULT_JWT_SECRET_1990');
    } catch (e) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    const db = getDatabase();
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(decoded.sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Get current role
    const role = rbacMiddleware.getCurrentRole(session.id);

    res.json({
      sessionId: session.id,
      progress: {
        challenge1: !!session.challenge_1_complete,
        challenge2: !!session.challenge_2_complete,
        challenge3: !!session.challenge_3_complete
      },
      flags: {
        flag1: session.flag_1 ? '********' : null,
        flag2: session.flag_2 ? '********' : null,
        finalFlag: session.final_flag ? '********' : null
      },
      role: role.name,
      securityLevel: role.security_level,
      startedAt: session.started_at,
      completedAt: session.completed_at
    });

  } catch (error) {
    console.error('[Auth] Progress check error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get progress'
    });
  }
});

export default router;
