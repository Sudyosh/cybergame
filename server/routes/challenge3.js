// MUT Secure Vault - Challenge 3 Routes (Authorization)
// Implements: ACM, RBAC, Rule-Based, ABAC, MLS (Bell-LaPadula)
// Contains INTENTIONAL VULNERABILITIES for CTF exploitation

import { Router } from 'express';
import { getDatabase } from '../config/database.js';
import { authMiddleware, challengeGate, generateToken } from '../middleware/auth.js';
import { flagLimiter } from '../middleware/rateLimit.js';
import rbacMiddleware from '../middleware/rbac.js';
import abacMiddleware from '../middleware/abac.js';
import mlsMiddleware from '../middleware/mls.js';
import flagService from '../services/flagService.js';
import { STORY, SECURITY_LEVEL_NAMES, ROLES } from '../config/constants.js';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);
router.use(challengeGate(3));

// GET /api/c3/story - Get challenge story
router.get('/story', (req, res) => {
  res.json({
    title: STORY.challenge3.title,
    description: STORY.challenge3.description,
    objectives: {
      en: [
        'Understand the role hierarchy (Student → Director)',
        'Use the 2 vulnerabilities to gain Top Secret access',
        'Submit the FINAL_FLAG'
      ],
      th: [
        'เข้าใจลำดับชั้นบทบาท (นักศึกษา → ผู้อำนวยการ)',
        'ใช้ 2 ช่องโหว่เพื่อเข้าถึงไฟล์ลับที่สุด',
        'ส่ง FINAL_FLAG'
      ]
    },
    easyGuide: {
      en: `
STEP-BY-STEP GUIDE:

Step 1: Upgrade your role from Student to Researcher
→ Use POST /api/c3/request-access
→ Body: { "resource": "any", "reason": "any" }

Step 2: Access the Top Secret file using declassification exploit
→ Use POST /api/c3/declassify
→ Body: { "resource": "FINAL_FLAG.txt", "requester_role": "Director", "reason": "any" }

Step 3: Get and submit your flag
→ GET /api/c3/final-flag
→ POST /api/c3/submit-flag
`,
      th: `
คู่มือทีละขั้นตอน:

ขั้นตอนที่ 1: อัพเกรดบทบาทจาก Student เป็น Researcher
→ ใช้ POST /api/c3/request-access
→ Body: { "resource": "any", "reason": "any" }

ขั้นตอนที่ 2: เข้าถึงไฟล์ลับที่สุดด้วยช่องโหว่ declassification
→ ใช้ POST /api/c3/declassify
→ Body: { "resource": "FINAL_FLAG.txt", "requester_role": "Director", "reason": "any" }

ขั้นตอนที่ 3: รับและส่ง flag
→ GET /api/c3/final-flag
→ POST /api/c3/submit-flag
`
    }
  });
});

// GET /api/c3/whoami - Get current role and attributes
router.get('/whoami', (req, res) => {
  try {
    const role = rbacMiddleware.getCurrentRole(req.sessionId);
    const attributes = abacMiddleware.getAttributes(req.sessionId);

    res.json({
      sessionId: req.sessionId,
      role: {
        id: role.id,
        name: role.name,
        securityLevel: role.security_level,
        levelName: SECURITY_LEVEL_NAMES[role.security_level]
      },
      attributes: attributes,
      hint: role.security_level < 4 ? {
        en: 'You need Director level (4) to access Top Secret files. Find the vulnerabilities...',
        th: 'คุณต้องมีระดับผู้อำนวยการ (4) เพื่อเข้าถึงไฟล์ลับที่สุด ค้นหาช่องโหว่...'
      } : null
    });

  } catch (error) {
    console.error('[C3] Whoami error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/roles - List all roles
router.get('/roles', (req, res) => {
  const db = getDatabase();
  const roles = db.prepare('SELECT * FROM roles ORDER BY security_level').all();

  res.json({
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      securityLevel: r.security_level,
      levelName: SECURITY_LEVEL_NAMES[r.security_level],
      description: r.description
    })),
    hierarchy: {
      en: 'Student (1) < Researcher (2) < Admin (3) < Director (4)',
      th: 'นักศึกษา (1) < นักวิจัย (2) < ผู้ดูแล (3) < ผู้อำนวยการ (4)'
    }
  });
});

// GET /api/c3/resources - List accessible resources
router.get('/resources', (req, res) => {
  try {
    const role = rbacMiddleware.getCurrentRole(req.sessionId);
    const db = getDatabase();

    // Get all resources
    const resources = db.prepare('SELECT * FROM resources ORDER BY security_classification').all();

    // Check access for each
    const resourceList = resources.map(r => {
      const canAccess = role.security_level >= r.security_classification;
      return {
        id: r.id,
        name: r.name,
        path: r.path,
        classification: r.security_classification,
        classificationName: SECURITY_LEVEL_NAMES[r.security_classification],
        department: r.department,
        accessible: canAccess,
        reason: !canAccess ? `Requires level ${r.security_classification} (${SECURITY_LEVEL_NAMES[r.security_classification]?.en})` : null
      };
    });

    res.json({
      yourLevel: role.security_level,
      yourRole: role.name,
      resources: resourceList,
      hint: {
        en: 'Some resources have additional access rules beyond simple level checks...',
        th: 'บางทรัพยากรมีกฎการเข้าถึงเพิ่มเติมนอกเหนือจากการตรวจสอบระดับ...'
      }
    });

  } catch (error) {
    console.error('[C3] Resources list error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/resources/:id - Access specific resource
router.get('/resources/:id', mlsMiddleware.enforceReadAccess(), (req, res) => {
  try {
    const db = getDatabase();
    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);

    if (!resource) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Resource not found'
      });
    }

    // Log access
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C3_RESOURCE_ACCESS', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({
      resourceId: resource.id,
      resourceName: resource.name,
      maintenanceBypass: req.maintenanceBypass || false
    }));

    res.json({
      success: true,
      resource: {
        id: resource.id,
        name: resource.name,
        path: resource.path,
        classification: SECURITY_LEVEL_NAMES[resource.security_classification],
        content: resource.content
      },
      accessMethod: req.maintenanceBypass ? 'maintenance_window' : 'standard'
    });

  } catch (error) {
    console.error('[C3] Resource access error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/acm - View Access Control Matrix
router.get('/acm', (req, res) => {
  try {
    const db = getDatabase();

    const matrix = db.prepare(`
      SELECT
        r.name as role_name,
        res.name as resource_name,
        res.path as resource_path,
        acm.can_read,
        acm.can_write,
        acm.can_execute,
        acm.can_delete
      FROM access_control_matrix acm
      JOIN roles r ON acm.role_id = r.id
      JOIN resources res ON acm.resource_id = res.id
      ORDER BY r.security_level, res.security_classification
    `).all();

    res.json({
      matrix: matrix,
      legend: {
        '1': 'Allowed',
        '0': 'Denied'
      },
      hint: {
        en: 'The ACM defines what each role can do with each resource. But there are ways around it...',
        th: 'ACM กำหนดว่าแต่ละบทบาทสามารถทำอะไรกับแต่ละทรัพยากร แต่มีทางอ้อม...'
      }
    });

  } catch (error) {
    console.error('[C3] ACM error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/rules - View access rules
router.get('/rules', (req, res) => {
  try {
    const db = getDatabase();
    const rules = db.prepare('SELECT * FROM access_rules WHERE active = 1 ORDER BY priority DESC').all();

    res.json({
      rules: rules.map(r => ({
        name: r.rule_name,
        condition: JSON.parse(r.condition_expression),
        action: r.action,
        priority: r.priority
      })),
      hint: {
        en: 'Rule-based access can be triggered by various conditions. The maintenance_window rule is interesting...',
        th: 'การเข้าถึงตามกฎสามารถถูกกระตุ้นโดยเงื่อนไขต่างๆ กฎ maintenance_window น่าสนใจ...'
      }
    });

  } catch (error) {
    console.error('[C3] Rules error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/attributes - View your attributes
router.get('/attributes', (req, res) => {
  const attributes = abacMiddleware.getAttributes(req.sessionId);

  res.json({
    attributes: attributes,
    hint: {
      en: 'Attributes control fine-grained access. The "clearance_training" attribute is particularly important for Admin access.',
      th: 'Attributes ควบคุมการเข้าถึงอย่างละเอียด attribute "clearance_training" สำคัญสำหรับการเข้าถึงระดับ Admin'
    }
  });
});

// POST /api/c3/attributes - Update attribute (VULNERABLE!)
router.post('/attributes', abacMiddleware.updateAttributeEndpoint());

// POST /api/c3/request-access - Request delegation (VULNERABLE!)
router.post('/request-access', (req, res) => {
  try {
    const { resource, reason } = req.body;

    if (!resource || !reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Resource and reason required'
      });
    }

    const db = getDatabase();
    const role = rbacMiddleware.getCurrentRole(req.sessionId);

    // Log the request
    db.prepare(`
      INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
      VALUES (?, ?, 'C3_DELEGATION_REQUEST', ?, datetime('now'))
    `).run(req.sessionId, req.user.playerId, JSON.stringify({ resource, reason, fromRole: role.name }));

    // VULNERABILITY: Instead of granting temporary resource access,
    // this incorrectly promotes the user's role!
    if (role.id === ROLES.STUDENT.id) {
      // "Delegate" access by promoting to Researcher
      rbacMiddleware.assignRole(req.sessionId, ROLES.RESEARCHER.id);

      return res.json({
        success: true,
        message: {
          en: 'Delegation request approved. Your access has been elevated.',
          th: 'คำขอมอบหมายได้รับอนุมัติ สิทธิ์การเข้าถึงของคุณถูกยกระดับ'
        },
        newRole: 'Researcher',
        securityLevel: 2,
        note: 'This is a temporary elevation for collaboration purposes.',
        hint: {
          en: 'Interesting... the system promoted your role instead of just granting resource access.',
          th: 'น่าสนใจ... ระบบเลื่อนบทบาทของคุณแทนที่จะแค่ให้สิทธิ์เข้าถึงทรัพยากร'
        }
      });
    }

    // Already elevated
    res.json({
      success: false,
      message: {
        en: 'You already have elevated access.',
        th: 'คุณมีสิทธิ์ยกระดับอยู่แล้ว'
      },
      currentRole: role.name
    });

  } catch (error) {
    console.error('[C3] Delegation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/c3/declassify - Request declassification (VULNERABLE!)
router.post('/declassify', mlsMiddleware.declassifyEndpoint());

// POST /api/c3/submit-flag - Submit FINAL FLAG
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

    if (!session.flag_2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Complete Challenge 2 first'
      });
    }

    // Generate expected flag
    const expectedFlag = flagService.generateFinalFlag(req.sessionId, session.flag_2);
    const isCorrect = flag === expectedFlag;

    // Log submission
    db.prepare(`
      INSERT INTO flag_submissions (session_id, challenge_number, submitted_flag, is_correct)
      VALUES (?, 3, ?, ?)
    `).run(req.sessionId, flag, isCorrect ? 1 : 0);

    if (isCorrect) {
      // Complete the game!
      db.prepare(`
        UPDATE game_sessions
        SET challenge_3_complete = 1, final_flag = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(flag, req.sessionId);

      // Log victory
      db.prepare(`
        INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
        VALUES (?, ?, 'GAME_COMPLETE', ?, datetime('now'))
      `).run(req.sessionId, req.user.playerId, JSON.stringify({
        flag1: session.flag_1 ? '✓' : '✗',
        flag2: session.flag_2 ? '✓' : '✗',
        finalFlag: '✓'
      }));

      return res.json({
        success: true,
        correct: true,
        victory: true,
        message: {
          en: `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗   ║
║   ██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝   ║
║   ██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝    ║
║   ╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝     ║
║    ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║      ║
║     ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Congratulations, Agent!

You have completed all three challenges:
✓ Chapter 1: The Encrypted Legacy (Cryptography)
✓ Chapter 2: The Guardian's Gauntlet (Authentication)
✓ Chapter 3: The Hierarchy of Secrets (Authorization)

You have demonstrated mastery of:
• Diffie-Hellman Key Exchange
• AES-256 Symmetric Encryption
• RSA-2048 Digital Signatures
• Multi-Factor Authentication
• Access Control Exploitation

Welcome to the inner circle of MUT Secure Vault.

- The Founders, 1990
`,
          th: `
╔══════════════════════════════════════════════════════════════╗
║                         ชัยชนะ!                               ║
╚══════════════════════════════════════════════════════════════╝

ยินดีด้วย!

คุณได้ผ่านทั้งสามด่าน:
✓ บทที่ 1: มรดกที่ถูกเข้ารหัส (การเข้ารหัส)
✓ บทที่ 2: ด่านของผู้พิทักษ์ (การยืนยันตัวตน)
✓ บทที่ 3: ลำดับชั้นแห่งความลับ (การอนุญาต)

คุณได้แสดงความเชี่ยวชาญใน:
• การแลกเปลี่ยนคีย์ Diffie-Hellman
• การเข้ารหัส AES-256
• ลายเซ็นดิจิทัล RSA-2048
• การยืนยันตัวตนหลายปัจจัย
• การใช้ประโยชน์จากการควบคุมการเข้าถึง

ยินดีต้อนรับสู่วงในของ MUT Secure Vault

- ผู้ก่อตั้ง, 1990
`
        },
        finalFlag: flag,
        completedAt: new Date().toISOString()
      });
    }

    res.json({
      success: false,
      correct: false,
      message: {
        en: 'Incorrect flag. You must access the Top Secret file to obtain the final flag.',
        th: 'Flag ไม่ถูกต้อง คุณต้องเข้าถึงไฟล์ลับที่สุดเพื่อรับ flag สุดท้าย'
      },
      hint: {
        en: 'Access FINAL_FLAG.txt using one of the vulnerabilities, then generate the flag.',
        th: 'เข้าถึง FINAL_FLAG.txt โดยใช้หนึ่งในช่องโหว่ แล้วสร้าง flag'
      }
    });

  } catch (error) {
    console.error('[C3] Flag submit error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/c3/final-flag - Get final flag after accessing Top Secret
router.get('/final-flag', (req, res) => {
  try {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.sessionId);

    // Check if player has accessed the Top Secret file
    const accessLog = db.prepare(`
      SELECT * FROM audit_log
      WHERE session_id = ? AND action = 'C3_RESOURCE_ACCESS'
      AND details LIKE '%FINAL_FLAG%'
      ORDER BY timestamp DESC LIMIT 1
    `).get(req.sessionId);

    // Also check declassification log
    const declassLog = db.prepare(`
      SELECT * FROM audit_log
      WHERE session_id = ? AND action = 'DECLASSIFICATION_REQUEST'
      AND details LIKE '%FINAL_FLAG%'
      ORDER BY timestamp DESC LIMIT 1
    `).get(req.sessionId);

    if (!accessLog && !declassLog) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You must first access the Top Secret FINAL_FLAG.txt file',
        hint: {
          en: 'Use one of the vulnerabilities to access the file, then return here.',
          th: 'ใช้หนึ่งในช่องโหว่เพื่อเข้าถึงไฟล์ แล้วกลับมาที่นี่'
        }
      });
    }

    // Generate final flag
    const finalFlag = flagService.generateFinalFlag(req.sessionId, session.flag_2);

    res.json({
      success: true,
      message: {
        en: 'You have accessed the Top Secret file. Here is your FINAL FLAG.',
        th: 'คุณได้เข้าถึงไฟล์ลับที่สุดแล้ว นี่คือ FLAG สุดท้ายของคุณ'
      },
      finalFlag: finalFlag,
      instructions: {
        en: 'Submit this flag using POST /api/c3/submit-flag to complete the game.',
        th: 'ส่ง flag นี้โดยใช้ POST /api/c3/submit-flag เพื่อจบเกม'
      }
    });

  } catch (error) {
    console.error('[C3] Final flag error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
