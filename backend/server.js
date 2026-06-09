/**
 * ValueGuard — Express Server Entry Point
 * Loads environment variables, configures middleware, and mounts API routes.
 * @module server
 */

'use strict';

require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');
const valuateRouter = require('./routes/valuate');
const trendsRouter  = require('./routes/trends');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---
// Trends router must be mounted BEFORE the catch-all valuate router
app.use('/api/trends', trendsRouter);
app.use('/api', valuateRouter);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ValueGuard API is running', version: '2.0.0' });
});

// --- Frontend ---
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('[ValueGuard Error]', err.stack);
  res.status(500).json({ error: 'Internal server error. Please try again.' });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`ValueGuard running at http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/locations`);
  console.log(`   POST http://localhost:${PORT}/api/valuate`);
  console.log(`   GET  http://localhost:${PORT}/api/history`);
  console.log(`   GET  http://localhost:${PORT}/api/trends/:location_id`);
});
