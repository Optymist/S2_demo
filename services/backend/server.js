// Initialize Datadog tracer first (before other imports)
const tracer = require('dd-trace').init({
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  profiling: process.env.DD_PROFILING_ENABLED === 'true'
});

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'backend', timestamp: new Date().toISOString() });
});

// API endpoints
app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from the backend microservice!' });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend service listening on port ${PORT}`);
  });
}

module.exports = app;
