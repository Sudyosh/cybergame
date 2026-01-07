// MUT Secure Vault - Multi-Level Security (MLS) Middleware
// Implements Bell-LaPadula model for Challenge 3
// Contains INTENTIONAL VULNERABILITIES for CTF exploitation

import { SECURITY_LEVELS, SECURITY_LEVEL_NAMES } from '../config/constants.js';
import { getDatabase } from '../config/database.js';
import rbacMiddleware from './rbac.js';

class MLSMiddleware {
  constructor() {
    this.levels = SECURITY_LEVELS;
    this.levelNames = SECURITY_LEVEL_NAMES;

    // Maintenance window (used for time-based access rule)
    this.maintenanceWindow = {
      start: '02:00',
      end: '03:00'
    };
  }

  // Get resource classification level
  getResourceLevel(resourceId) {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT security_classification FROM resources WHERE id = ?
    `).get(resourceId);

    return result?.security_classification || this.levels.PUBLIC;
  }

  // Get resource by path
  getResourceByPath(path) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM resources WHERE path = ?
    `).get(path);
  }

  // Bell-LaPadula: No Read Up (Simple Security)
  // Subject cannot read object at higher classification
  checkNoReadUp(subjectLevel, objectLevel) {
    return subjectLevel >= objectLevel;
  }

  // Bell-LaPadula: No Write Down (*-property)
  // Subject cannot write to object at lower classification
  checkNoWriteDown(subjectLevel, objectLevel) {
    return subjectLevel <= objectLevel;
  }

  // Check if currently in maintenance window
  isMaintenanceWindow(timeOverride = null) {
    let currentTime;

    if (timeOverride) {
      // VULNERABILITY: Trust client-provided time header
      currentTime = timeOverride;
    } else {
      const now = new Date();
      currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    return currentTime >= this.maintenanceWindow.start &&
      currentTime <= this.maintenanceWindow.end;
  }

  // Middleware: Enforce Bell-LaPadula for read operations
  enforceReadAccess() {
    return (req, res, next) => {
      const role = rbacMiddleware.getCurrentRole(req.sessionId);
      const resourceId = req.params.id || req.params.resourceId;

      if (!resourceId) {
        return next();
      }

      const resourceLevel = this.getResourceLevel(resourceId);
      const subjectLevel = role.security_level;

      // Check maintenance window bypass (VULNERABILITY)
      const timeHeader = req.headers['x-system-time'];
      if (timeHeader && this.isMaintenanceWindow(timeHeader)) {
        // During maintenance, bypass security for "system operations"
        req.maintenanceBypass = true;
        req.resourceLevel = resourceLevel;
        return next();
      }

      // Standard Bell-LaPadula: No Read Up
      if (!this.checkNoReadUp(subjectLevel, resourceLevel)) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Insufficient security clearance',
          policy: 'Bell-LaPadula: No Read Up',
          yourLevel: {
            value: subjectLevel,
            name: this.levelNames[subjectLevel]?.en
          },
          resourceLevel: {
            value: resourceLevel,
            name: this.levelNames[resourceLevel]?.en
          },
          hint: resourceLevel === this.levels.TOP_SECRET
            ? 'Top Secret files are only accessible during maintenance window (02:00-03:00)'
            : 'You need higher clearance to access this resource'
        });
      }

      req.resourceLevel = resourceLevel;
      next();
    };
  }

  // Middleware: Enforce Bell-LaPadula for write operations
  enforceWriteAccess() {
    return (req, res, next) => {
      const role = rbacMiddleware.getCurrentRole(req.sessionId);
      const resourceId = req.params.id || req.params.resourceId;

      if (!resourceId) {
        return next();
      }

      const resourceLevel = this.getResourceLevel(resourceId);
      const subjectLevel = role.security_level;

      // Standard Bell-LaPadula: No Write Down
      if (!this.checkNoWriteDown(subjectLevel, resourceLevel)) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'Cannot write to lower classification level',
          policy: 'Bell-LaPadula: No Write Down',
          yourLevel: subjectLevel,
          resourceLevel: resourceLevel
        });
      }

      next();
    };
  }

  // VULNERABLE ENDPOINT: Declassification request
  // This is an intentional vulnerability for Challenge 3
  declassifyEndpoint() {
    return (req, res) => {
      const { resource, requester_role, reason } = req.body;

      if (!resource || !requester_role || !reason) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Resource, requester_role, and reason required'
        });
      }

      // VULNERABILITY: The requester_role is taken from request body,
      // NOT validated against the actual session role!
      // A real system would check: req.user.role === 'Director'

      if (requester_role === 'Director') {
        // "Director" can declassify anything - but we don't verify they ARE a Director!
        const db = getDatabase();
        const resourceData = db.prepare(`
          SELECT * FROM resources WHERE path = ? OR name = ?
        `).get(resource, resource);

        if (!resourceData) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Resource not found'
          });
        }

        // Log the declassification (audit trail)
        db.prepare(`
          INSERT INTO audit_log (session_id, player_id, action, details, timestamp)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          req.sessionId,
          req.user.playerId,
          'DECLASSIFICATION_REQUEST',
          JSON.stringify({
            resource: resource,
            claimedRole: requester_role,
            actualRole: rbacMiddleware.getCurrentRole(req.sessionId).name,
            reason: reason
          })
        );

        return res.json({
          success: true,
          message: 'Declassification approved',
          temporary_access: true,
          resource: resourceData.name,
          content: resourceData.content,
          warning: 'This access is logged for audit purposes'
        });
      }

      return res.status(403).json({
        error: 'Access Denied',
        message: 'Only Directors can request declassification',
        providedRole: requester_role,
        hint: 'The declassification endpoint trusts the requester_role parameter...'
      });
    };
  }

  // Get security level info
  getLevelInfo(level) {
    return {
      value: level,
      name: this.levelNames[level] || { en: 'Unknown', th: 'ไม่ทราบ' }
    };
  }
}

export default new MLSMiddleware();
