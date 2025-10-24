// This line must come before importing any instrumented module.
const tracer = require('dd-trace').init({
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
  sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE) || 1,
  appsec: process.env.DD_APPSEC_ENABLED === 'true',
  iast: process.env.DD_IAST_ENABLED === 'true',
  dataStreamsEnabled: process.env.DD_DATA_STREAMS_ENABLED === 'true',
  serviceMapping: process.env.DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED === 'true',
  repositoryUrl: process.env.DD_GIT_REPOSITORY_URL,
});

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Logging middleware with structured logging
app.use((req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    service: process.env.DD_SERVICE || 'frontend',
    env: process.env.DD_ENV || 'development',
  };
  console.log(JSON.stringify(logData));
  next();
});

// Health check
app.get('/health', (req, res) => {
  const healthData = {
    level: 'info',
    message: 'Health check requested',
    service: process.env.DD_SERVICE || 'frontend',
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(healthData));

  res.json({
    status: 'healthy',
    service: 'frontend',
    version: process.env.DD_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      apm: true,
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
      appsec: process.env.DD_APPSEC_ENABLED === 'true',
    },
  });
});

// Config endpoint
app.get('/api/config', (req, res) => {
  const logData = {
    level: 'info',
    message: 'Config requested',
    service: process.env.DD_SERVICE || 'frontend',
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(logData));

  res.json({ backendUrl: BACKEND_URL });
});

// Proxy to backend
app.get('/api/backend/message', async (req, res) => {
  const logData = {
    level: 'info',
    message: 'Proxying request to backend',
    service: process.env.DD_SERVICE || 'frontend',
    backendUrl: BACKEND_URL,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(logData));

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${BACKEND_URL}/api/message`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    const errorLog = {
      level: 'error',
      message: 'Backend request failed',
      error: error.message,
      service: process.env.DD_SERVICE || 'frontend',
      timestamp: new Date().toISOString(),
    };
    console.error(JSON.stringify(errorLog));
    res.status(500).json({ error: 'Backend service unavailable' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  const errorLog = {
    level: 'error',
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    service: process.env.DD_SERVICE || 'frontend',
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(errorLog));

  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const startupLog = {
      level: 'info',
      message: 'Frontend service started',
      port: PORT,
      backendUrl: BACKEND_URL,
      service: process.env.DD_SERVICE || 'frontend',
      version: process.env.DD_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(startupLog));
  });
}

module.exports = app;
