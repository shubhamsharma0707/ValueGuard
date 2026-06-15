/**
 * ValueGuard — Express Server Entry Point
 * Loads environment variables, configures middleware, and mounts API routes.
 * @module server
 */

'use strict';

// Load .env for local dev; in production (Railway) env vars are injected by the platform.
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const valuateRouter = require('./routes/valuate');
const trendsRouter  = require('./routes/trends');

const app  = express();
// Railway injects PORT dynamically (usually 8080). Fall back to 3000 for local dev.
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

// ─── CORS ───────────────────────────────────────────────────────────────────
// Allow: same-origin (no Origin header), localhost dev servers, and any
// *.railway.app subdomain so Railway's own domain can call the API.
const RAILWAY_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.railway\.app$/i;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / Postman
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        RAILWAY_ORIGIN_RE.test(origin)
      ) {
        return cb(null, true);
      }
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

// ─── Start Server (local only) ───────────────────────────────────────────────
// On Vercel the file is imported as a module; app.listen() must not be called.
// require.main === module is true only when run directly via `node server.js`.
if (require.main === module) {
  // Bind to 0.0.0.0 so Railway's internal proxy can reach the server.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ValueGuard running at http://localhost:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/api/locations`);
    console.log(`   POST http://localhost:${PORT}/api/valuate`);
    console.log(`   GET  http://localhost:${PORT}/api/history`);
    console.log(`   GET  http://localhost:${PORT}/api/trends/:location_id`);
  });
}

// ─── Export for Vercel serverless runtime ────────────────────────────────────
module.exports = app;
