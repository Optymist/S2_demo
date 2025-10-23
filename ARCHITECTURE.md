# Architecture Documentation

## System Overview

This microservices demo implements a simple, secure, and scalable architecture using modern DevOps practices.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Build & Test │→ │ Trivy Scan   │→ │ Build & Push Images  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                  GitHub Container Registry                       │
│              (Docker Images: frontend, backend)                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      Namespace: microservices-demo         │  │
│  │  ┌──────────────────────┐     ┌──────────────────────┐    │  │
│  │  │   LoadBalancer       │     │    ConfigMap         │    │  │
│  │  │   (External Access)  │     │    (Configuration)   │    │  │
│  │  └──────────┬───────────┘     └──────────────────────┘    │  │
│  │             │                                               │  │
│  │             ↓                                               │  │
│  │  ┌──────────────────────┐                                  │  │
│  │  │  Frontend Service    │                                  │  │
│  │  │  (ClusterIP: 80)     │                                  │  │
│  │  └──────────┬───────────┘                                  │  │
│  │             │                                               │  │
│  │  ┌──────────▼───────────────────────────────────────────┐  │  │
│  │  │         Frontend Deployment (2 replicas)             │  │  │
│  │  │  ┌────────────────┐      ┌────────────────┐          │  │  │
│  │  │  │  Pod: Frontend │      │  Pod: Frontend │          │  │  │
│  │  │  │  - Node.js     │      │  - Node.js     │          │  │  │
│  │  │  │  - Express     │      │  - Express     │          │  │  │
│  │  │  │  - Port: 3000  │      │  - Port: 3000  │          │  │  │
│  │  │  │  - Rate Limit  │      │  - Rate Limit  │          │  │  │
│  │  │  └────────┬───────┘      └────────┬───────┘          │  │  │
│  │  └───────────┼──────────────────────┼──────────────────┘  │  │
│  │              │                      │                      │  │
│  │              └──────────┬───────────┘                      │  │
│  │                         │                                  │  │
│  │                         ↓                                  │  │
│  │              ┌──────────────────────┐                      │  │
│  │              │  Backend Service     │                      │  │
│  │              │  (ClusterIP: 3001)   │                      │  │
│  │              └──────────┬───────────┘                      │  │
│  │                         │                                  │  │
│  │              ┌──────────▼───────────────────────────────┐  │  │
│  │              │    Backend Deployment (2 replicas)       │  │  │
│  │              │  ┌────────────────┐  ┌────────────────┐  │  │  │
│  │              │  │  Pod: Backend  │  │  Pod: Backend  │  │  │  │
│  │              │  │  - Node.js     │  │  - Node.js     │  │  │  │
│  │              │  │  - Express     │  │  - Express     │  │  │  │
│  │              │  │  - Port: 3001  │  │  - Port: 3001  │  │  │  │
│  │              │  │  - REST API    │  │  - REST API    │  │  │  │
│  │              │  └────────────────┘  └────────────────┘  │  │  │
│  │              └──────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               ↑
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                        Pulumi (Infrastructure as Code)            │
│  - Provisions Kubernetes resources                               │
│  - Manages deployments, services, and configurations             │
│  - Version-controlled infrastructure                             │
└──────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Service
- **Technology**: Node.js + Express
- **Port**: 3000 (internal), 80 (external via LoadBalancer)
- **Replicas**: 2 (for high availability)
- **Features**:
  - Static file serving
  - Rate limiting (100 requests per 15 minutes per IP)
  - Health check endpoint
  - Configuration API

### Backend Service
- **Technology**: Node.js + Express
- **Port**: 3001 (internal ClusterIP)
- **Replicas**: 2 (for high availability)
- **Features**:
  - REST API endpoints
  - CORS enabled
  - Health check endpoint
  - Status monitoring

## Security Features

### Container Security
1. **Trivy Scanning**: All images scanned for vulnerabilities
2. **Minimal Base Image**: Using Alpine Linux (small attack surface)
3. **No Dev Dependencies**: Production images exclude development dependencies
4. **Health Checks**: Built-in Docker health checks

### Application Security
1. **Rate Limiting**: Frontend protected against DDoS
2. **CORS Configuration**: Backend has CORS properly configured
3. **Secrets Management**: Environment-based configuration
4. **Least Privilege**: GitHub Actions use minimal permissions

### Infrastructure Security
1. **Resource Limits**: CPU and memory limits on all pods
2. **Readiness Probes**: Ensure pods are ready before receiving traffic
3. **Liveness Probes**: Automatic pod restarts on failure
4. **Network Policies**: Service-to-service communication control

## Deployment Options

### 1. Local Development (Docker Compose)
```bash
docker-compose up
```
- Fastest for development
- Easy debugging
- Local testing

### 2. Kubernetes (kubectl)
```bash
kubectl apply -f k8s/
```
- Production-like environment
- Manual deployment control
- Direct Kubernetes interaction

### 3. Kubernetes (Pulumi)
```bash
cd infrastructure && pulumi up
```
- Infrastructure as Code
- Version controlled
- Automated deployments
- Rollback capability

## CI/CD Pipeline

### Stages

1. **Build & Test**
   - Install dependencies
   - Run unit tests
   - Generate coverage reports

2. **Security Scan**
   - Build Docker images
   - Run Trivy vulnerability scanner
   - Check for HIGH/CRITICAL vulnerabilities
   - Upload SARIF to GitHub Security

3. **Build & Push** (main branch only)
   - Tag images with SHA and branch
   - Push to GitHub Container Registry
   - Maintain version history

4. **Infrastructure Validation** (optional)
   - Validate Pulumi configuration
   - Preview infrastructure changes

### Triggers
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

## Scalability

### Horizontal Scaling
```bash
# Scale deployments
kubectl scale deployment frontend --replicas=5 -n microservices-demo
kubectl scale deployment backend --replicas=5 -n microservices-demo
```

### Auto-scaling (HPA)
```bash
# Enable auto-scaling
kubectl autoscale deployment frontend \
  --min=2 --max=10 --cpu-percent=70 -n microservices-demo
```

## Monitoring

### Health Endpoints
- Frontend: `http://frontend:3000/health`
- Backend: `http://backend:3001/health`

### Kubernetes Monitoring
```bash
# Check pod status
kubectl get pods -n microservices-demo

# View logs
kubectl logs -f deployment/frontend -n microservices-demo
kubectl logs -f deployment/backend -n microservices-demo

# Check resource usage
kubectl top pods -n microservices-demo
```

## Network Flow

1. **External Request** → LoadBalancer (port 80)
2. **LoadBalancer** → Frontend Service (port 80)
3. **Frontend Service** → Frontend Pods (port 3000)
4. **Frontend Pod** → Backend Service (port 3001)
5. **Backend Service** → Backend Pods (port 3001)
6. **Backend Pod** → Response back through the chain

## Data Flow

```
User Browser
    ↓ HTTP
LoadBalancer (External IP)
    ↓
Frontend Service (ClusterIP)
    ↓
Frontend Pod
    ↓ REST API
Backend Service (ClusterIP)
    ↓
Backend Pod
    ↓
Response (JSON)
```

## Configuration Management

### Environment Variables
- **Frontend**: `PORT`, `BACKEND_URL`, `NODE_ENV`
- **Backend**: `PORT`, `NODE_ENV`

### ConfigMap
Centralized configuration in `k8s/configmap.yaml`:
- Backend URL
- Environment settings
- Log levels

## Disaster Recovery

### Backup Strategy
- Git-based source control
- Container image versioning
- Infrastructure as Code (Pulumi state)

### Rollback Procedures
```bash
# Kubernetes rollback
kubectl rollout undo deployment/frontend -n microservices-demo

# Pulumi rollback
pulumi stack history
pulumi up --target <specific-resource>
```

## Future Enhancements

1. **Service Mesh**: Implement Istio/Linkerd for advanced traffic management
2. **Observability**: Add Prometheus + Grafana for monitoring
3. **Logging**: Centralized logging with ELK stack
4. **Database**: Add PostgreSQL or MongoDB
5. **Caching**: Implement Redis for performance
6. **API Gateway**: Add Kong or Ambassador
7. **Certificate Management**: Automated TLS with cert-manager
8. **Secrets Management**: Integrate with Vault or Sealed Secrets

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| **Application** | Node.js, Express |
| **Containerization** | Docker, Docker Compose |
| **Orchestration** | Kubernetes |
| **IaC** | Pulumi |
| **CI/CD** | GitHub Actions |
| **Security Scanning** | Trivy |
| **Registry** | GitHub Container Registry (GHCR) |
| **Testing** | Jest, Supertest |
| **Monitoring** | Kubernetes health checks |

## Best Practices Implemented

✅ Container security scanning
✅ Minimal base images
✅ Multi-stage builds (if applicable)
✅ Health checks
✅ Resource limits
✅ Rate limiting
✅ CORS configuration
✅ Infrastructure as Code
✅ Version control
✅ Automated testing
✅ CI/CD pipeline
✅ Comprehensive documentation
✅ Security-first approach

---

For more information, see:
- [README.md](README.md) - Quick start guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment instructions
