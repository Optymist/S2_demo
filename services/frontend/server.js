// Initialize Datadog tracer first (before other imports)
const tracer = require('dd-trace').init({
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
});

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend';

// Try to load axios, but don't crash if it's missing
let axios;
try {
  axios = require('axios');
} catch (e) {
  console.warn('axios not available, backend proxy endpoints will be disabled');
}

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'healthy',
    service: 'frontend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    backendUrl: BACKEND_URL,
    axiosAvailable: !!axios,
    datadogAgent: process.env.DD_AGENT_HOST || 'not configured',
  });
});

// Proxy endpoints to backend (only if axios is available)
if (axios) {
  app.get('/api/backend/health', async (req, res) => {
    try {
      console.log(`Proxying health check to backend: ${BACKEND_URL}/health`);
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
      res.json(response.data);
    } catch (error) {
      console.error('Backend health check error:', error.message);
      res.status(error.response?.status || 500).json({
        error: 'Backend service unavailable',
        details: error.message,
        backendUrl: BACKEND_URL,
      });
    }
  });

  app.get('/api/backend/message', async (req, res) => {
    try {
      console.log(`Proxying message request to backend: ${BACKEND_URL}/api/message`);
      const response = await axios.get(`${BACKEND_URL}/api/message`, { timeout: 5000 });
      res.json(response.data);
    } catch (error) {
      console.error('Backend message error:', error.message);
      res.status(error.response?.status || 500).json({
        error: 'Backend service unavailable',
        details: error.message,
        backendUrl: BACKEND_URL,
      });
    }
  });
} else {
  app.get('/api/backend/*', (req, res) => {
    res.status(503).json({ error: 'Backend proxy not available - axios not installed' });
  });
}

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frontend service listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Axios available: ${!!axios}`);
    console.log(`Datadog Agent: ${process.env.DD_AGENT_HOST || 'Not configured'}`);
    console.log(`Datadog Service: ${process.env.DD_SERVICE || 'Not set'}`);
  });
}

module.exports = app;
