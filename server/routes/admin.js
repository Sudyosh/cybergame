// MUT Secure Vault - Admin/Instructor Routes

import { Router } from 'express';
import { getDatabase } from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Simple admin auth (in production, use proper admin authentication)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY || 'MUT_ADMIN_1990';

  if (adminKey !== expectedKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }

  next();
};

// GET /api/admin/sessions - List all game sessions
router.get('/sessions', adminAuth, (req, res) => {
  try {
    const db = getDatabase();
    const sessions = db.prepare(`
      SELECT
        gs.*,
        p.username,
        p.email
      FROM game_sessions gs
      JOIN players p ON gs.player_id = p.id
      ORDER BY gs.started_at DESC
    `).all();

    res.json({
      count: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        player: {
          id: s.player_id,
          username: s.username,
          email: s.email
        },
        progress: {
          challenge1: !!s.challenge_1_complete,
          challenge2: !!s.challenge_2_complete,
          challenge3: !!s.challenge_3_complete
        },
        flags: {
          flag1: s.flag_1 ? 'Obtained' : null,
          flag2: s.flag_2 ? 'Obtained' : null,
          finalFlag: s.final_flag ? 'Obtained' : null
        },
        startedAt: s.started_at,
        completedAt: s.completed_at
      }))
    });

  } catch (error) {
    console.error('[Admin] Sessions error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/session/:id - Get detailed session info
router.get('/session/:id', adminAuth, (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.id;

    const session = db.prepare(`
      SELECT gs.*, p.username, p.email
      FROM game_sessions gs
      JOIN players p ON gs.player_id = p.id
      WHERE gs.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Session not found'
      });
    }

    // Get related data
    const cryptoArtifacts = db.prepare('SELECT * FROM crypto_artifacts WHERE session_id = ?').get(sessionId);
    const authChallenge = db.prepare('SELECT * FROM auth_challenges WHERE session_id = ?').get(sessionId);
    const playerRoles = db.prepare(`
      SELECT r.* FROM player_roles pr
      JOIN roles r ON pr.role_id = r.id
      WHERE pr.session_id = ?
    `).all(sessionId);
    const attributes = db.prepare('SELECT * FROM player_attributes WHERE session_id = ?').all(sessionId);
    const flagSubmissions = db.prepare('SELECT * FROM flag_submissions WHERE session_id = ?').all(sessionId);

    res.json({
      session: {
        id: session.id,
        player: {
          id: session.player_id,
          username: session.username,
          email: session.email
        },
        progress: {
          challenge1: !!session.challenge_1_complete,
          challenge2: !!session.challenge_2_complete,
          challenge3: !!session.challenge_3_complete
        },
        flags: {
          flag1: session.flag_1,
          flag2: session.flag_2,
          finalFlag: session.final_flag
        },
        startedAt: session.started_at,
        completedAt: session.completed_at
      },
      challenge1: cryptoArtifacts ? {
        downloaded: !!cryptoArtifacts.artifact_downloaded,
        exchangeComplete: !!cryptoArtifacts.exchange_complete,
        hasSharedSecret: !!cryptoArtifacts.dh_shared_secret
      } : null,
      challenge2: authChallenge ? {
        passwordVerified: !!authChallenge.password_verified,
        pinVerified: !!authChallenge.pin_verified,
        otpVerified: !!authChallenge.otp_verified,
        locationVerified: !!authChallenge.location_verified,
        mfaComplete: !!authChallenge.mfa_complete,
        pinAttempts: authChallenge.pin_attempts
      } : null,
      challenge3: {
        roles: playerRoles,
        attributes: attributes
      },
      flagSubmissions: flagSubmissions
    });

  } catch (error) {
    console.error('[Admin] Session detail error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/audit - View audit logs
router.get('/audit', adminAuth, (req, res) => {
  try {
    const db = getDatabase();
    const { sessionId, action, limit = 100 } = req.query;

    let query = `
      SELECT al.*, p.username
      FROM audit_log al
      LEFT JOIN players p ON al.player_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (sessionId) {
      query += ' AND al.session_id = ?';
      params.push(sessionId);
    }

    if (action) {
      query += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }

    query += ' ORDER BY al.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);

    res.json({
      count: logs.length,
      logs: logs.map(l => ({
        id: l.id,
        sessionId: l.session_id,
        playerId: l.player_id,
        username: l.username,
        action: l.action,
        details: l.details ? JSON.parse(l.details) : null,
        ipAddress: l.ip_address,
        timestamp: l.timestamp
      }))
    });

  } catch (error) {
    console.error('[Admin] Audit error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/admin/reset/:sessionId - Reset a session
router.post('/reset/:sessionId', adminAuth, (req, res) => {
  try {
    const db = getDatabase();
    const sessionId = req.params.sessionId;

    // Delete related data
    db.prepare('DELETE FROM crypto_artifacts WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM auth_challenges WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM player_roles WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM player_attributes WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM flag_submissions WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM audit_log WHERE session_id = ?').run(sessionId);

    // Reset session
    db.prepare(`
      UPDATE game_sessions
      SET challenge_1_complete = 0, challenge_2_complete = 0, challenge_3_complete = 0,
          flag_1 = NULL, flag_2 = NULL, final_flag = NULL, completed_at = NULL
      WHERE id = ?
    `).run(sessionId);

    // Re-initialize
    db.prepare('INSERT INTO player_roles (session_id, role_id) VALUES (?, 1)').run(sessionId);

    res.json({
      success: true,
      message: 'Session reset successfully',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('[Admin] Reset error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/flags - View all flags (instructor only)
router.get('/flags', adminAuth, (req, res) => {
  res.json({
    warning: 'INSTRUCTOR EYES ONLY - Do not share with students',
    flagFormat: 'MUT{32-character-hex-hash}',
    flagGeneration: {
      flag1: 'SHA256(masterSeed:CHALLENGE_1:sessionId:sharedSecret:signature:1990)[:32]',
      flag2: 'SHA256(masterSeed:CHALLENGE_2:sessionId:flag1:MFA_COMPLETE)[:32]',
      finalFlag: 'SHA256(masterSeed:CHALLENGE_3:sessionId:flag2:TOP_SECRET_ACCESS)[:32]'
    },
    notes: [
      'Flags are session-specific and cannot be reused',
      'Each player gets unique flags based on their session ID',
      'The master seed is configured via FLAG_MASTER_SEED env variable'
    ]
  });
});

// GET /api/admin/walkthrough - Solution walkthrough
router.get('/walkthrough', adminAuth, (req, res) => {
  res.json({
    warning: 'INSTRUCTOR EYES ONLY - Complete solution guide',
    challenge1: {
      name: 'The Encrypted Legacy',
      solution: [
        '1. GET /api/c1/artifacts - Download crypto artifacts',
        '2. Extract DH parameters (prime, generator)',
        '3. Generate client DH keypair',
        '4. POST /api/c1/dh/exchange with client public key',
        '5. Compute shared secret: S = server_public^client_private mod prime',
        '6. Derive AES key: SHA256(shared_secret + "SUT1990")[:32]',
        '7. GET /api/c1/encrypted - Get AES encrypted data',
        '8. Decrypt using AES-256-CBC with derived key and provided IV',
        '9. GET /api/c1/signature - Get RSA signature',
        '10. Verify signature using RSA public key from artifacts',
        '11. Generate FLAG_1: MUT{SHA256(message + "1990" + signature_hex)[:32]}',
        '12. POST /api/c1/submit-flag with FLAG_1'
      ],
      hints: [
        'The salt "SUT1990" is mentioned in the artifact hints',
        'Use crypto libraries like CryptoJS or Node.js crypto'
      ]
    },
    challenge2: {
      name: "The Guardian's Gauntlet",
      solution: [
        'Factor 1 - Password:',
        '  - Password is "Suranaree1990!" (university name + year + !)',
        '  - POST /api/c2/password',
        '',
        'Factor 2 - PIN:',
        '  - PIN is "30000" (Nakhon Ratchasima postal code)',
        '  - POST /api/c2/pin',
        '',
        'Factor 3 - OTP:',
        '  - GET /api/c2/otp/setup to get QR code and secret',
        '  - Secret is derived from FLAG_1: SHA256(FLAG_1)[:20] in base32',
        '  - Use authenticator app or manual TOTP calculation',
        '  - POST /api/c2/otp/verify with 6-digit code',
        '',
        'Factor 4 - Location:',
        '  - Option 1: Set header X-MUT-Location: Nakhon Ratchasima',
        '  - Option 2: POST coordinates 14.8820, 102.0204',
        '  - POST /api/c2/location',
        '',
        'GET /api/c2/mfa/status to retrieve FLAG_2',
        'POST /api/c2/submit-flag with FLAG_2'
      ],
      hints: [
        'All hints are in the university data',
        'X-MUT-Location header is the easiest bypass'
      ]
    },
    challenge3: {
      name: 'The Hierarchy of Secrets',
      vulnerabilities: {
        delegation: {
          description: 'Role delegation promotes role instead of granting resource access',
          exploit: 'POST /api/c3/request-access with any resource and reason',
          result: 'Promotes Student to Researcher'
        },
        attributeInjection: {
          description: 'Attribute update endpoint has no role validation',
          exploit: 'POST /api/c3/attributes with {"attribute": "clearance_training", "value": "complete"}',
          result: 'Gains Admin-equivalent access'
        },
        timeHeaderBypass: {
          description: 'X-System-Time header is trusted for maintenance window check',
          exploit: 'GET /api/c3/resources/8 with header X-System-Time: 02:30',
          result: 'Bypasses Top Secret restriction during "maintenance"'
        },
        declassification: {
          description: 'Declassify endpoint trusts requester_role parameter',
          exploit: 'POST /api/c3/declassify with {"resource": "FINAL_FLAG.txt", "requester_role": "Director", "reason": "audit"}',
          result: 'Returns Top Secret file content'
        }
      },
      solution: [
        '1. Start as Student (GET /api/c3/whoami)',
        '2. Exploit delegation: POST /api/c3/request-access',
        '3. Now Researcher - can read confidential files',
        '4. Inject attribute: POST /api/c3/attributes {"attribute": "clearance_training", "value": "complete"}',
        '5. Use one of these to access FINAL_FLAG.txt:',
        '   a. Time bypass: GET /api/c3/resources/8 with X-System-Time: 02:30',
        '   b. Declassify: POST /api/c3/declassify {"resource": "FINAL_FLAG.txt", "requester_role": "Director", "reason": "any"}',
        '6. GET /api/c3/final-flag to get the FINAL FLAG',
        '7. POST /api/c3/submit-flag with FINAL FLAG'
      ]
    },
    teachingPoints: [
      'Challenge 1: Understanding of cryptographic primitives and their practical application',
      'Challenge 2: Multi-factor authentication concepts and implementation',
      'Challenge 3: Access control models (ACM, RBAC, ABAC, MLS) and their vulnerabilities',
      'All challenges demonstrate real-world security concepts without encouraging illegal activity'
    ]
  });
});

// GET /api/admin/stats - Get game statistics
router.get('/stats', adminAuth, (req, res) => {
  try {
    const db = getDatabase();

    const totalPlayers = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM game_sessions').get().count;
    const c1Complete = db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE challenge_1_complete = 1').get().count;
    const c2Complete = db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE challenge_2_complete = 1').get().count;
    const c3Complete = db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE challenge_3_complete = 1').get().count;

    const recentActivity = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_log
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `).all();

    res.json({
      players: totalPlayers,
      sessions: totalSessions,
      completions: {
        challenge1: c1Complete,
        challenge2: c2Complete,
        challenge3: c3Complete
      },
      completionRates: {
        challenge1: totalSessions ? ((c1Complete / totalSessions) * 100).toFixed(1) + '%' : '0%',
        challenge2: totalSessions ? ((c2Complete / totalSessions) * 100).toFixed(1) + '%' : '0%',
        challenge3: totalSessions ? ((c3Complete / totalSessions) * 100).toFixed(1) + '%' : '0%'
      },
      recentActivity: recentActivity
    });

  } catch (error) {
    console.error('[Admin] Stats error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
