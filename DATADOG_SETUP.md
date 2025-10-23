# Datadog Observability Setup Guide

This guide explains how to set up Datadog for observability, logs, and APM monitoring using the free trial.

## Overview

Datadog integration provides:
- **APM (Application Performance Monitoring)**: Distributed tracing across services
- **Logs**: Centralized log collection and analysis
- **Metrics**: Infrastructure and application metrics
- **Real-time Monitoring**: Dashboards and alerts

## Datadog Free Trial

Datadog offers a **14-day free trial** with all Pro features:
- Full APM and distributed tracing
- Log management (15-day retention)
- Infrastructure monitoring
- Custom metrics and dashboards
- Alerts and notifications

**Sign up**: https://www.datadoghq.com/free-datadog-trial/

## Prerequisites

- Datadog account (free trial)
- Datadog API key
- Datadog APP key (optional, for API access)

## Getting Your Datadog Keys

1. **Sign up** at https://www.datadoghq.com/
2. Go to **Organization Settings** → **API Keys**
3. Copy your **API Key**
4. (Optional) Go to **Application Keys** and create an **APP Key**

## Local Development Setup

### 1. Set Environment Variables

Create a `.env` file in the project root:

```bash
# Datadog Configuration
DD_API_KEY=your_datadog_api_key_here
DD_SITE=datadoghq.com  # Use datadoghq.eu for EU region
```

**Note**: Add `.env` to `.gitignore` to keep your keys secure!

### 2. Start Services with Docker Compose

```bash
# Start all services including Datadog agent
docker-compose up -d

# Verify Datadog agent is running
docker logs datadog-agent

# Check service connectivity
curl http://localhost:3000
curl http://localhost:3001/api/message
```

### 3. View Data in Datadog

1. Go to https://app.datadoghq.com/
2. Navigate to **APM** → **Services** to see your services
3. Check **Logs** for application logs
4. View **Infrastructure** for container metrics

## Kubernetes/AKS Setup

### Prerequisites

Before deploying the Datadog agent, you need to install the Datadog Operator:

```bash
# Install the Datadog Operator using Helm
helm repo add datadog https://helm.datadoghq.com
helm repo update
helm install datadog-operator datadog/datadog-operator
```

Or follow the official installation guide: https://docs.datadoghq.com/containers/datadog_operator/

### 1. Create Datadog Secret

Update the secret in `k8s/datadog-agent.yaml` or create it via kubectl:

```bash
# Create secret from command line
kubectl create secret generic datadog-secret \
  --from-literal=api-key='YOUR_DATADOG_API_KEY' \
  --namespace=microservices-demo

# Or update the YAML file directly
kubectl apply -f k8s/datadog-agent.yaml
```

### 2. Deploy Datadog Agent

The Datadog agent now uses the DatadogAgent Custom Resource (CRD) v2alpha1, which is managed by the Datadog Operator:

```bash
# Deploy the Datadog agent using the operator
kubectl apply -f k8s/datadog-agent.yaml

# Verify deployment
kubectl get datadogagent -n microservices-demo
kubectl get pods -n microservices-demo -l agent.datadoghq.com/name=datadog

# Check logs
kubectl logs -n microservices-demo -l agent.datadoghq.com/component=agent
```

**Configuration Details:**
- Uses Datadog site: `us5.datadoghq.com`
- Log collection enabled with `containerCollectAll: true`
- AKS-specific admission controller selectors enabled
- Managed by the Datadog Operator for simplified deployment

### 3. Deploy Application Services

The backend and frontend deployments are already configured with Datadog environment variables:

```bash
# Deploy services (they will automatically connect to Datadog agent)
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Verify pods are running
kubectl get pods -n microservices-demo
```

### 4. Verify Integration

```bash
# Generate some traffic
kubectl port-forward -n microservices-demo service/frontend 8080:80
# Visit http://localhost:8080 and interact with the app

# Check Datadog agent status
kubectl exec -n microservices-demo -it \
  $(kubectl get pod -n microservices-demo -l agent.datadoghq.com/component=agent -o jsonpath='{.items[0].metadata.name}') \
  -- agent status
```

## Azure AKS Setup

For Azure deployment, add the Datadog secret to your deployment workflow:

### 1. Add GitHub Secret

Go to repository **Settings** → **Secrets and variables** → **Actions**:

Add secrets:
- `DD_API_KEY`: Your Datadog API key
- `DD_APP_KEY`: Your Datadog APP key (optional)

### 2. Update Deploy Workflow

The deploy workflow will automatically use these secrets when deploying to AKS.

### 3. Deploy

```bash
# The GitHub Actions deploy workflow will:
# 1. Deploy Datadog agent
# 2. Deploy services with Datadog integration
# 3. Configure everything automatically
```

## Features Enabled

### APM (Application Performance Monitoring)

**Backend Service**:
- Automatic tracing of HTTP requests
- Express.js middleware instrumentation
- Database query tracing (if added)

**Frontend Service**:
- HTTP request tracing
- Backend API call tracking
- User interaction monitoring

**View traces**: APM → Traces in Datadog UI

### Logs

**What's collected**:
- Application logs from both services
- Container logs
- Kubernetes events
- Error tracking

**Configuration**:
- Log injection enabled (correlates logs with traces)
- JSON formatted logs
- Automatic log collection from all containers

**View logs**: Logs → Log Explorer in Datadog UI

### Metrics

**Infrastructure Metrics**:
- CPU and memory usage
- Network traffic
- Disk I/O
- Container metrics

**Application Metrics**:
- Request rate
- Response time
- Error rate
- Custom metrics (can be added)

**View metrics**: Metrics → Explorer in Datadog UI

### Distributed Tracing

**Service Map**:
- Visualize service dependencies
- See request flow between services
- Identify bottlenecks

**Trace Analysis**:
- End-to-end request tracing
- Performance profiling
- Error identification

**View service map**: APM → Service Map in Datadog UI

## Configuration Details

### Environment Variables (Already Configured)

**Backend & Frontend**:
```yaml
DD_AGENT_HOST: <hostIP>           # Datadog agent host
DD_TRACE_AGENT_PORT: 8126         # APM port
DD_SERVICE: <service-name>        # Service identifier
DD_ENV: production                # Environment
DD_VERSION: 1.0.0                 # Version
DD_LOGS_INJECTION: true           # Correlate logs with traces
DD_TRACE_SAMPLE_RATE: 1           # 100% sampling (adjust for production)
DD_PROFILING_ENABLED: false       # CPU profiling (optional)
```

### Datadog Agent Configuration

**Enabled Features**:
- APM (Application Performance Monitoring)
- Log collection from containers
- Kubernetes events
- Process monitoring
- DogStatsD metrics
- Leader election (for cluster monitoring)

**Resource Limits** (optimized for free trial):
```yaml
requests:
  memory: 256Mi
  cpu: 200m
limits:
  memory: 512Mi
  cpu: 400m
```

## Dashboards and Alerts

### Create a Dashboard

1. Go to **Dashboards** → **New Dashboard**
2. Add widgets:
   - Service overview (APM)
   - Request rate timeseries
   - Error rate timeseries
   - Latency percentiles (p50, p95, p99)
   - Log stream

### Set Up Alerts

1. Go to **Monitors** → **New Monitor**
2. Example alerts:
   - **High Error Rate**: Alert if error rate > 5%
   - **Slow Responses**: Alert if p95 latency > 1s
   - **Service Down**: Alert if service unavailable

## Best Practices

### 1. Sampling in Production

For production with high traffic, adjust sampling rate:

```yaml
DD_TRACE_SAMPLE_RATE: 0.1  # 10% sampling
```

### 2. Custom Tags

Add custom tags for better filtering:

```javascript
const tracer = require('dd-trace').init({
  tags: {
    'team': 'platform',
    'feature': 'api'
  }
});
```

### 3. Custom Metrics

Send custom metrics:

```javascript
const tracer = require('dd-trace');
const metrics = tracer.dogstatsd;

// Increment counter
metrics.increment('api.requests', 1, ['endpoint:/api/users']);

// Record gauge
metrics.gauge('queue.size', 42);

// Timing
metrics.timing('db.query.time', 156);
```

### 4. Error Tracking

Automatically capture errors:

```javascript
const tracer = require('dd-trace');

app.use((err, req, res, next) => {
  const span = tracer.scope().active();
  if (span) {
    span.setTag('error', true);
    span.setTag('error.message', err.message);
    span.setTag('error.stack', err.stack);
  }
  res.status(500).json({ error: err.message });
});
```

## Troubleshooting

### Datadog Agent Not Connecting

**Check agent logs**:
```bash
# Docker Compose
docker logs datadog-agent

# Kubernetes
kubectl logs -n microservices-demo -l app=datadog-agent
```

**Verify API key**:
```bash
# Should show "API key ending with: XXXX"
kubectl exec -n microservices-demo -it \
  $(kubectl get pod -n microservices-demo -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}') \
  -- agent status
```

### No Traces Appearing

**Check service logs**:
```bash
# Look for Datadog tracer initialization
docker logs backend-service | grep -i datadog
kubectl logs -n microservices-demo -l app=backend
```

**Verify agent connectivity**:
```bash
# Test from application pod
kubectl exec -it <pod-name> -n microservices-demo -- \
  nc -zv $(kubectl get pod -l app=datadog-agent -n microservices-demo -o jsonpath='{.items[0].status.hostIP}') 8126
```

### No Logs Appearing

**Check log collection is enabled**:
```yaml
DD_LOGS_ENABLED: true
DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: true
```

**Verify permissions**:
```bash
# Agent needs access to log files
kubectl describe daemonset -n microservices-demo datadog-agent
```

## Cost Management

### Free Trial (14 days)

- All features included
- Unlimited hosts
- 15-day log retention
- Full APM and tracing

### After Free Trial

**Free Tier** (limited):
- 5 hosts
- 1-day log retention
- Basic metrics

**Optimize costs**:
1. Reduce trace sampling rate
2. Filter logs (exclude debug/info)
3. Use metric aggregation
4. Set log retention policies

### Monitor Usage

Check usage in Datadog:
1. Go to **Organization Settings** → **Usage**
2. Monitor:
   - Host count
   - Custom metrics
   - Log volume
   - APM spans

## Additional Resources

- **Datadog Docs**: https://docs.datadoghq.com/
- **APM Setup**: https://docs.datadoghq.com/tracing/
- **Log Collection**: https://docs.datadoghq.com/logs/
- **Kubernetes Integration**: https://docs.datadoghq.com/containers/kubernetes/

## Quick Reference

### View in Datadog UI

| Data Type | Location |
|-----------|----------|
| Service Performance | APM → Services |
| Traces | APM → Traces |
| Service Map | APM → Service Map |
| Logs | Logs → Log Explorer |
| Metrics | Metrics → Explorer |
| Infrastructure | Infrastructure → List |
| Dashboards | Dashboards |
| Alerts | Monitors |

### Common Commands

```bash
# Docker Compose
docker-compose up -d datadog-agent
docker-compose logs -f datadog-agent

# Kubernetes
kubectl apply -f k8s/datadog-agent.yaml
kubectl get pods -n microservices-demo -l app=datadog-agent
kubectl logs -n microservices-demo -l app=datadog-agent --tail=50

# Generate test traffic
curl http://localhost:3000
for i in {1..100}; do curl http://localhost:3001/api/message; done
```

## Summary

✅ **APM**: Full distributed tracing across services  
✅ **Logs**: Centralized log management with correlation  
✅ **Metrics**: Infrastructure and application metrics  
✅ **Dashboards**: Pre-built and custom dashboards  
✅ **Alerts**: Real-time monitoring and notifications  
✅ **Free Trial**: 14 days with all Pro features  

Datadog provides comprehensive observability for your microservices with minimal configuration!
