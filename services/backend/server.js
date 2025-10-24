// Initialize Datadog tracer first (before other imports)
require('dd-trace').init({
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
});

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
    service: 'backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    datadogAgent: process.env.DD_AGENT_HOST || 'not configured',
  });
});

// API endpoints
app.get('/api/message', (req, res) => {
  console.log('Message endpoint called');
  res.json({ message: 'Hello from the backend microservice!' });
});

app.get('/api/status', (req, res) => {
  console.log('Status endpoint called');
  res.json({
    status: 'running',
    version: '1.0.0',
    uptime: process.uptime(),
    datadogEnabled: !!process.env.DD_AGENT_HOST,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend service listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Datadog Agent: ${process.env.DD_AGENT_HOST || 'Not configured'}`);
    console.log(`Datadog Service: ${process.env.DD_SERVICE || 'Not set'}`);
  });
}

module.exports = app;
