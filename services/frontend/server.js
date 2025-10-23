const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'frontend', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API proxy endpoint
app.get('/api/config', (req, res) => {
  res.json({ backendUrl: BACKEND_URL });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Frontend service listening on port ${PORT}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
  });
}

module.exports = app;
