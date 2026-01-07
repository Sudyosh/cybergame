// MUT Secure Vault - Rate Limiting Middleware

import rateLimit from 'express-rate-limit';

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Rate Limited',
    message: 'Too many requests. Please slow down.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limit (login/register)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute
  message: {
    error: 'Rate Limited',
    message: 'Too many authentication attempts. Please wait.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Challenge submission rate limit
export const flagLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 flag submissions per minute
  message: {
    error: 'Rate Limited',
    message: 'Too many flag submissions. No brute forcing!',
    retryAfter: '60 seconds',
    hint: 'Think carefully before submitting. Solve the challenge properly.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// PIN verification rate limit
export const pinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 attempts per 5 minutes
  message: {
    error: 'Rate Limited',
    message: 'Too many PIN attempts. Account temporarily locked.',
    retryAfter: '5 minutes',
    hint: 'The PIN is a 5-digit number related to the university location.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP verification rate limit
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: {
    error: 'Rate Limited',
    message: 'Too many OTP attempts. Please wait.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  apiLimiter,
  authLimiter,
  flagLimiter,
  pinLimiter,
  otpLimiter
};
