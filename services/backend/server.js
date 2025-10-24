// This line must come before importing any instrumented module.
const tracer = require('dd-trace').init({
  logInjection: true,
  analytics: true,
  runtimeMetrics: true,
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
  sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE) || 1,
  // App Security (RASP)
  appsec: process.env.DD_APPSEC_ENABLED === 'true',
  // IAST for vulnerability detection
  iast: process.env.DD_IAST_ENABLED === 'true',
  // Data Streams Monitoring
  dataStreamsEnabled: process.env.DD_DATA_STREAMS_ENABLED === 'true',
  // Remove integration service names
  serviceMapping: process.env.DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED === 'true',
  // Git metadata
  repositoryUrl: process.env.DD_GIT_REPOSITORY_URL,
});

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware with structured logging for Datadog
app.use((req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    service: process.env.DD_SERVICE || 'backend',
    env: process.env.DD_ENV || 'development',
  };
  console.log(JSON.stringify(logData));
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    level: 'info',
    message: 'Health check requested',
    service: process.env.DD_SERVICE || 'backend',
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(healthData));

  res.json({
    status: 'healthy',
    service: 'backend',
    timestamp: new Date().toISOString(),
    env: process.env.DD_ENV || process.env.NODE_ENV,
    version: process.env.DD_VERSION || '1.0.0',
    datadogAgent: process.env.DD_AGENT_HOST || 'not configured',
    features: {
      apm: true,
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
      logsInjection: process.env.DD_LOGS_INJECTION === 'true',
      appsec: process.env.DD_APPSEC_ENABLED === 'true',
      iast: process.env.DD_IAST_ENABLED === 'true',
      dataStreams: process.env.DD_DATA_STREAMS_ENABLED === 'true',
    },
  });
});

// API endpoints
app.get('/api/message', (req, res) => {
  const logData = {
    level: 'info',
    message: 'Message endpoint called',
    service: process.env.DD_SERVICE || 'backend',
    endpoint: '/api/message',
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(logData));

  res.json({
    message: 'Hello from the backend microservice!',
    timestamp: new Date().toISOString(),
    service: 'backend',
  });
});

app.get('/api/status', (req, res) => {
  const logData = {
    level: 'info',
    message: 'Status endpoint called',
    service: process.env.DD_SERVICE || 'backend',
    endpoint: '/api/status',
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(logData));

  res.json({
    status: 'running',
    version: process.env.DD_VERSION || '1.0.0',
    uptime: process.uptime(),
    env: process.env.DD_ENV || process.env.NODE_ENV,
    datadogEnabled: !!process.env.DD_AGENT_HOST,
    datadogService: process.env.DD_SERVICE || 'backend',
    features: {
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
      appsec: process.env.DD_APPSEC_ENABLED === 'true',
      iast: process.env.DD_IAST_ENABLED === 'true',
      sca: process.env.DD_APPSEC_SCA_ENABLED === 'true',
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  const errorLog = {
    level: 'error',
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    service: process.env.DD_SERVICE || 'backend',
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(errorLog));

  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    const startupLog = {
      level: 'info',
      message: 'Backend service started',
      port: PORT,
      env: process.env.DD_ENV || process.env.NODE_ENV,
      service: process.env.DD_SERVICE || 'backend',
      version: process.env.DD_VERSION || '1.0.0',
      datadogAgent: process.env.DD_AGENT_HOST || 'Not configured',
      repository: process.env.DD_GIT_REPOSITORY_URL || 'Not set',
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(startupLog));
  });
}

module.exports = app;
