// MUT Secure Vault - Role-Based Access Control (RBAC) Middleware
// Part of Challenge 3: Authorization

import { ROLES, SECURITY_LEVELS } from '../config/constants.js';
import { getDatabase } from '../config/database.js';

class RBACMiddleware {
  // Get user's current role
  getCurrentRole(sessionId) {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT r.* FROM roles r
      JOIN player_roles pr ON r.id = pr.role_id
      WHERE pr.session_id = ?
      ORDER BY pr.assigned_at DESC
      LIMIT 1
    `).get(sessionId);

    return result || ROLES.STUDENT;
  }

  // Check if role has permission
  hasPermission(roleId, permissionName) {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ? AND p.name = ?
    `).get(roleId, permissionName);

    return !!result;
  }

  // Check access to specific resource
  checkResourceAccess(roleId, resourceId, action = 'read') {
    const db = getDatabase();
    const columnMap = {
      read: 'can_read',
      write: 'can_write',
      execute: 'can_execute',
      delete: 'can_delete'
    };

    const column = columnMap[action] || 'can_read';

    const result = db.prepare(`
      SELECT ${column} as allowed FROM access_control_matrix
      WHERE role_id = ? AND resource_id = ?
    `).get(roleId, resourceId);

    return result?.allowed === 1;
  }

  // Middleware: Require specific role
  requireRole(roleName) {
    return (req, res, next) => {
      const role = this.getCurrentRole(req.sessionId);

      if (role.name !== roleName) {
        return res.status(403).json({
          error: 'Access Denied',
          message: `This action requires ${roleName} role`,
          currentRole: role.name,
          requiredRole: roleName
        });
      }

      req.role = role;
      next();
    };
  }

  // Middleware: Require minimum security level
  requireLevel(minLevel) {
    return (req, res, next) => {
      const role = this.getCurrentRole(req.sessionId);

      if (role.security_level < minLevel) {
        return res.status(403).json({
          error: 'Insufficient Clearance',
          message: `This resource requires security level ${minLevel}`,
          currentLevel: role.security_level,
          requiredLevel: minLevel
        });
      }

      req.role = role;
      next();
    };
  }

  // Middleware: Check resource access via ACM
  checkAccess(action = 'read') {
    return (req, res, next) => {
      const role = this.getCurrentRole(req.sessionId);
      const resourceId = req.params.id || req.params.resourceId;

      if (!resourceId) {
        return next();
      }

      const hasAccess = this.checkResourceAccess(role.id, resourceId, action);

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: `Your role (${role.name}) cannot ${action} this resource`,
          action: action,
          resourceId: resourceId
        });
      }

      req.role = role;
      next();
    };
  }

  // Assign role to session (used for exploits)
  assignRole(sessionId, roleId) {
    const db = getDatabase();

    db.prepare(`
      INSERT INTO player_roles (session_id, role_id, assigned_at)
      VALUES (?, ?, datetime('now'))
    `).run(sessionId, roleId);

    return this.getCurrentRole(sessionId);
  }
}

export default new RBACMiddleware();
