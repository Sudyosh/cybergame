// MUT Secure Vault - Main Server Entry Point
// CTF Game for Cybersecurity Education

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initDB, closeDatabase } from './config/database.js';
import { apiLimiter } from './middleware/rateLimit.js';

// Routes
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import challenge1Routes from './routes/challenge1.js';
import challenge2Routes from './routes/challenge2.js';
import challenge3Routes from './routes/challenge3.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// ======================
// Middleware
// ======================

// Security headers - disabled for development
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS - Allow frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-MUT-Location', 'X-System-Time']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Log incoming request
  console.log(`\n[${timestamp}] ─── REQUEST ───`);
  console.log(`  ${req.method} ${req.path}`);
  console.log(`  Headers: ${JSON.stringify({
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer ***' : 'none'
  })}`);

  // Log body for POST/PUT requests (hide password)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '***';
    if (safeBody.pin) safeBody.pin = '***';
    console.log(`  Body: ${JSON.stringify(safeBody)}`);
  }

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ─── RESPONSE ───`);
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Duration: ${duration}ms`);

    // Log error responses
    if (res.statusCode >= 400) {
      try {
        const parsed = JSON.parse(body);
        console.log(`  Error: ${parsed.error || 'Unknown'}`);
        console.log(`  Message: ${parsed.message || 'No message'}`);
      } catch (e) {
        console.log(`  Body: ${body?.substring?.(0, 200) || body}`);
      }
    }
    console.log('');

    return originalSend.call(this, body);
  };

  next();
});

// ======================
// Routes
// ======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'MUT Secure Vault',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Welcome/Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'MUT Secure Vault API',
    version: '1.0.0',
    description: {
      en: 'Classified Research Protection System - CTF Game',
      th: 'ระบบป้องกันข้อมูลวิจัยลับ - เกม CTF'
    },
    endpoints: {
      auth: '/api/auth',
      challenge1: '/api/c1',
      challenge2: '/api/c2',
      challenge3: '/api/c3',
      admin: '/api/admin'
    },
    documentation: '/api/docs'
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'MUT Secure Vault API Documentation',
    authentication: {
      register: {
        method: 'POST',
        path: '/api/auth/register',
        body: { username: 'string', email: 'string', password: 'string' }
      },
      login: {
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'string', password: 'string' },
        returns: 'JWT token'
      },
      startSession: {
        method: 'POST',
        path: '/api/auth/session/start',
        headers: { Authorization: 'Bearer <token>' },
        returns: 'Session token for game'
      }
    },
    challenge1: {
      getArtifacts: 'GET /api/c1/artifacts',
      dhExchange: 'POST /api/c1/dh/exchange',
      getEncrypted: 'GET /api/c1/encrypted',
      getSignature: 'GET /api/c1/signature',
      submitFlag: 'POST /api/c1/submit-flag'
    },
    challenge2: {
      status: 'GET /api/c2/status',
      password: 'POST /api/c2/password',
      pin: 'POST /api/c2/pin',
      otpSetup: 'GET /api/c2/otp/setup',
      otpVerify: 'POST /api/c2/otp/verify',
      mfaStatus: 'GET /api/c2/mfa/status',
      submitFlag: 'POST /api/c2/submit-flag'
    },
    challenge3: {
      whoami: 'GET /api/c3/whoami',
      roles: 'GET /api/c3/roles',
      resources: 'GET /api/c3/resources',
      accessResource: 'GET /api/c3/resources/:id',
      acm: 'GET /api/c3/acm',
      rules: 'GET /api/c3/rules',
      attributes: 'GET /api/c3/attributes',
      updateAttributes: 'POST /api/c3/attributes',
      requestAccess: 'POST /api/c3/request-access',
      declassify: 'POST /api/c3/declassify',
      finalFlag: 'GET /api/c3/final-flag',
      submitFlag: 'POST /api/c3/submit-flag'
    }
  });
});

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/c1', challenge1Routes);
app.use('/api/c2', challenge2Routes);
app.use('/api/c3', challenge3Routes);
app.use('/api/admin', adminRoutes);

// ======================
// Error Handling
// ======================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: ['/api', '/api/auth', '/api/c1', '/api/c2', '/api/c3', '/api/admin']
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ======================
// Server Startup
// ======================

async function startServer() {
  try {
    // Initialize database
    console.log('[Server] Initializing database...');
    await initDB();
    console.log('[Server] Database initialized');

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███╗   ███╗██╗   ██╗████████╗    ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
║   ████╗ ████║██║   ██║╚══██╔══╝    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
║   ██╔████╔██║██║   ██║   ██║       ██║   ██║███████║██║   ██║██║     ██║
║   ██║╚██╔╝██║██║   ██║   ██║       ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║
║   ██║ ╚═╝ ██║╚██████╔╝   ██║        ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║
║   ╚═╝     ╚═╝ ╚═════╝    ╚═╝         ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝
║                                                              ║
║   MUT Secure Vault - CTF Server                              ║
║   Suranaree University of Technology                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Server running on http://localhost:${PORT}
API Documentation: http://localhost:${PORT}/api/docs

Environment: ${process.env.NODE_ENV || 'development'}
      `);
    });

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  closeDatabase();
  process.exit(0);
});

// Start the server
startServer();

export default app;
