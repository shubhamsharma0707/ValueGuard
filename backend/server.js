/**
 * ValueGuard — Express Server Entry Point
 * Loads environment variables, configures middleware, and mounts API routes.
 * @module server
 */

'use strict';

require('dotenv').config({ path: __dirname + '/.env' });

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const valuateRouter = require('./routes/valuate');
const trendsRouter  = require('./routes/trends');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security headers (Helmet) ─────────────────────────────────────────────
// Sets X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, HSTS, etc.
// contentSecurityPolicy is relaxed only enough for Chart.js CDN + Google Fonts.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", 'cdn.jsdelivr.net'],
        styleSrc:    ["'self'", 'fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc:     ["'self'", 'fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:'],
        connectSrc:  ["'self'"],
        objectSrc:   ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow Chart.js CDN workers
  })
);

// ─── CORS — only same-origin / localhost ───────────────────────────────────
const allowedOrigins = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no Origin header (same-origin, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('CORS: origin not allowed'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// ─── Rate limiting — 60 requests per minute per IP ─────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});
app.use('/api', apiLimiter);

// ─── Body parser — cap payload to 10 KB ────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ─── API Routes ─────────────────────────────────────────────────────────────
// Trends router must be mounted BEFORE the catch-all valuate router
app.use('/api/trends', trendsRouter);
app.use('/api', valuateRouter);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ValueGuard API is running', version: '2.0.0' });
});

// ─── Frontend ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ─── CORS Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'Forbidden: cross-origin requests are not allowed.' });
  }
  next(err);
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ValueGuard Error]', err.stack);
  res.status(500).json({ error: 'Internal server error. Please try again.' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ValueGuard running at http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/locations`);
  console.log(`   POST http://localhost:${PORT}/api/valuate`);
  console.log(`   GET  http://localhost:${PORT}/api/history`);
  console.log(`   GET  http://localhost:${PORT}/api/trends/:location_id`);
});
