// MUT Secure Vault - JWT Authentication Middleware

import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from '../config/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'MUT_SECURE_VAULT_JWT_SECRET_1990';

// Generate JWT token
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: AUTH_CONFIG.jwt.algorithm,
    expiresIn: AUTH_CONFIG.jwt.expiresIn
  });
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export function authMiddleware(req, res, next) {
  // Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided',
      hint: 'Include Authorization: Bearer <token> header'
    });
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      hint: 'Please login again to get a new token'
    });
  }

  // Attach user info to request
  req.user = decoded;
  req.sessionId = decoded.sessionId;

  next();
}

// Optional auth - doesn't fail if no token
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.sessionId = decoded.sessionId;
    }
  }

  next();
}

// Challenge gate middleware - ensures previous challenges are completed
export function challengeGate(requiredChallenge) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Challenge 1 has no requirements
    if (requiredChallenge === 1) {
      return next();
    }

    // Challenge 2 requires Challenge 1 complete
    if (requiredChallenge === 2 && !req.user.challenge1Complete) {
      return res.status(403).json({
        error: 'Challenge Locked',
        message: 'Complete Challenge 1 (Cryptography) first',
        hint: 'You must obtain FLAG_1 before proceeding'
      });
    }

    // Challenge 3 requires Challenge 2 complete
    if (requiredChallenge === 3 && !req.user.challenge2Complete) {
      return res.status(403).json({
        error: 'Challenge Locked',
        message: 'Complete Challenge 2 (Authentication) first',
        hint: 'You must obtain FLAG_2 before proceeding'
      });
    }

    next();
  };
}

export default {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth,
  challengeGate
};
