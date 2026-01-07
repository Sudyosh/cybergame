// MUT Secure Vault - Attribute-Based Access Control (ABAC) Middleware
// Part of Challenge 3: Authorization
// Contains INTENTIONAL VULNERABILITY for CTF exploitation

import { getDatabase } from '../config/database.js';

class ABACMiddleware {
  // Get all attributes for a session
  getAttributes(sessionId) {
    const db = getDatabase();
    const results = db.prepare(`
      SELECT attribute_name, attribute_value
      FROM player_attributes
      WHERE session_id = ?
    `).all(sessionId);

    const attributes = {};
    results.forEach(row => {
      attributes[row.attribute_name] = row.attribute_value;
    });

    return attributes;
  }

  // Set attribute for session
  // VULNERABILITY: This method doesn't validate the caller's role!
  setAttribute(sessionId, name, value) {
    const db = getDatabase();

    // Check if attribute exists
    const existing = db.prepare(`
      SELECT id FROM player_attributes
      WHERE session_id = ? AND attribute_name = ?
    `).get(sessionId, name);

    if (existing) {
      db.prepare(`
        UPDATE player_attributes
        SET attribute_value = ?
        WHERE session_id = ? AND attribute_name = ?
      `).run(value, sessionId, name);
    } else {
      db.prepare(`
        INSERT INTO player_attributes (session_id, attribute_name, attribute_value)
        VALUES (?, ?, ?)
      `).run(sessionId, name, value);
    }

    return this.getAttributes(sessionId);
  }

  // Check if user has required attribute
  hasAttribute(sessionId, name, requiredValue = null) {
    const attributes = this.getAttributes(sessionId);

    if (!(name in attributes)) {
      return false;
    }

    if (requiredValue === null) {
      return true;
    }

    return attributes[name] === requiredValue;
  }

  // Evaluate ABAC policy
  evaluatePolicy(sessionId, policy) {
    const attributes = this.getAttributes(sessionId);

    // Policy format: { attribute: "value" } or { attribute: ["value1", "value2"] }
    for (const [attr, required] of Object.entries(policy)) {
      const userValue = attributes[attr];

      if (!userValue) {
        return false;
      }

      if (Array.isArray(required)) {
        if (!required.includes(userValue)) {
          return false;
        }
      } else if (userValue !== required) {
        return false;
      }
    }

    return true;
  }

  // Middleware: Require specific attributes
  requireAttributes(policy) {
    return (req, res, next) => {
      const attributes = this.getAttributes(req.sessionId);
      const passed = this.evaluatePolicy(req.sessionId, policy);

      if (!passed) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Required attributes not met',
          requiredPolicy: policy,
          yourAttributes: attributes,
          hint: 'Some resources require specific attributes like clearance_training or department'
        });
      }

      req.attributes = attributes;
      next();
    };
  }

  // VULNERABLE ENDPOINT: Update attribute without proper authorization
  // This is the intentional vulnerability for Challenge 3
  updateAttributeEndpoint() {
    return (req, res) => {
      const { attribute, value } = req.body;

      if (!attribute || !value) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Attribute name and value required'
        });
      }

      // VULNERABILITY: No role check! Any authenticated user can set any attribute
      // In a real system, only admins should be able to modify attributes

      const attributes = this.setAttribute(req.sessionId, attribute, value);

      // Log the suspicious activity
      const db = getDatabase();
      db.prepare(`
        INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        req.sessionId,
        req.user.playerId,
        'ATTRIBUTE_UPDATE',
        JSON.stringify({ attribute, value, source: 'api' })
      );

      res.json({
        success: true,
        message: 'Attribute updated',
        attributes: attributes
      });
    };
  }

  // Initialize default attributes for new session
  initializeAttributes(sessionId, playerId) {
    const db = getDatabase();

    const defaultAttributes = {
      department: 'general',
      clearance_training: 'none',
      faculty: 'unassigned',
      academic_year: '1',
      project_type: 'public'
    };

    for (const [name, value] of Object.entries(defaultAttributes)) {
      db.prepare(`
        INSERT OR IGNORE INTO player_attributes (session_id, attribute_name, attribute_value)
        VALUES (?, ?, ?)
      `).run(sessionId, name, value);
    }

    return this.getAttributes(sessionId);
  }
}

export default new ABACMiddleware();
