# 📦 Deployment Guide

This guide provides step-by-step instructions for deploying the microservices demo in various environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Production Deployment](#production-deployment)
5. [Monitoring & Logging](#monitoring--logging)

---

## Local Development

### Quick Start

```bash
# Clone repository
git clone https://github.com/WandileM7/S2_demo.git
cd S2_demo

# Start with Docker Compose
docker-compose up -d

# Access services
open http://localhost:3000
```

### Development Mode

Run services individually for development:

```bash
# Terminal 1 - Backend
cd services/backend
npm install
npm run dev

# Terminal 2 - Frontend
cd services/frontend
npm install
npm run dev
```

---

## Docker Deployment

### Option 1: Docker Compose (Recommended for local/staging)

```bash
# Build and start all services
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up everything
docker-compose down -v --rmi all
```

### Option 2: Manual Docker Commands

```bash
# Create network
docker network create microservices-network

# Build images
docker build -t backend-service:v1 ./services/backend
docker build -t frontend-service:v1 ./services/frontend

# Run backend
docker run -d \
  --name backend \
  --network microservices-network \
  -p 3001:3001 \
  backend-service:v1

# Run frontend
docker run -d \
  --name frontend \
  --network microservices-network \
  -p 3000:3000 \
  -e BACKEND_URL=http://backend:3001 \
  frontend-service:v1

# Test
curl http://localhost:3000/health
curl http://localhost:3001/health
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (minikube, kind, or cloud provider)
- kubectl configured
- Docker images available

### Option 1: Using kubectl

#### Step 1: Prepare Images

```bash
# Build images
docker build -t backend-service:latest ./services/backend
docker build -t frontend-service:latest ./services/frontend

# For minikube: Load images
minikube image load backend-service:latest
minikube image load frontend-service:latest

# For cloud: Push to registry
docker tag backend-service:latest YOUR_REGISTRY/backend-service:latest
docker tag frontend-service:latest YOUR_REGISTRY/frontend-service:latest
docker push YOUR_REGISTRY/backend-service:latest
docker push YOUR_REGISTRY/frontend-service:latest
```

#### Step 2: Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply configurations
kubectl apply -f k8s/configmap.yaml

# Deploy services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Verify deployment
kubectl get all -n microservices-demo

# Check pod status
kubectl get pods -n microservices-demo -w
```

#### Step 3: Access the Application

**For minikube:**
```bash
# Start tunnel
minikube tunnel

# Get service URL
minikube service frontend -n microservices-demo --url
```

**For cloud providers:**
```bash
# Get external IP
kubectl get svc frontend -n microservices-demo

# Wait for LoadBalancer IP
kubectl get svc frontend -n microservices-demo -w
```

**Port forwarding (any environment):**
```bash
kubectl port-forward -n microservices-demo service/frontend 8080:80
open http://localhost:8080
```

### Option 2: Using Pulumi

#### Step 1: Setup Pulumi

```bash
# Install Pulumi CLI
curl -fsSL https://get.pulumi.com | sh

# Login
pulumi login

# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install
```

#### Step 2: Configure Stack

```bash
# Create new stack
pulumi stack init dev

# Configure Kubernetes context (optional)
pulumi config set kubernetes:kubeconfig ~/.kube/config
```

#### Step 3: Deploy

```bash
# Preview changes
pulumi preview

# Deploy infrastructure
pulumi up

# Get outputs
pulumi stack output frontendUrl
pulumi stack output namespace

# View all outputs
pulumi stack output --json
```

#### Step 4: Manage

```bash
# Update deployment
pulumi up

# View stack info
pulumi stack

# Destroy infrastructure
pulumi destroy

# Remove stack
pulumi stack rm dev
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security scans completed (Trivy)
- [ ] Resource limits configured
- [ ] Monitoring setup
- [ ] Backup strategy defined
- [ ] Rollback plan prepared

### Best Practices

#### 1. Use Production Images

```yaml
# Update k8s/backend-deployment.yaml
spec:
  template:
    spec:
      containers:
      - name: backend
        image: ghcr.io/wandilem7/s2_demo/backend:v1.0.0
        imagePullPolicy: Always
```

#### 2. Configure Resource Limits

Already configured in manifests:
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

#### 3. Set Up Ingress (Optional)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: microservices-ingress
  namespace: microservices-demo
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - demo.yourdomain.com
    secretName: demo-tls
  rules:
  - host: demo.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

#### 4. Enable Horizontal Pod Autoscaling

```bash
# Backend autoscaling
kubectl autoscale deployment backend \
  -n microservices-demo \
  --min=2 --max=10 \
  --cpu-percent=70

# Frontend autoscaling
kubectl autoscale deployment frontend \
  -n microservices-demo \
  --min=2 --max=10 \
  --cpu-percent=70

# Verify HPA
kubectl get hpa -n microservices-demo
```

---

## Monitoring & Logging

### Health Checks

```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend health
curl http://localhost:3000/health

# Kubernetes health checks
kubectl get pods -n microservices-demo
kubectl describe pod <pod-name> -n microservices-demo
```

### View Logs

**Docker Compose:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs --tail=100
```

**Kubernetes:**
```bash
# All pods
kubectl logs -n microservices-demo -l app=backend --tail=100
kubectl logs -n microservices-demo -l app=frontend --tail=100

# Specific pod
kubectl logs -n microservices-demo <pod-name> -f

# Previous pod (after restart)
kubectl logs -n microservices-demo <pod-name> --previous
```

### Debugging

**Check pod events:**
```bash
kubectl describe pod <pod-name> -n microservices-demo
```

**Execute commands in pod:**
```bash
kubectl exec -it <pod-name> -n microservices-demo -- sh
```

**Check service endpoints:**
```bash
kubectl get endpoints -n microservices-demo
```

---

## Rollback Procedures

### Docker Compose

```bash
# Stop current version
docker-compose down

# Start previous version
docker-compose up -d
```

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/backend -n microservices-demo
kubectl rollout history deployment/frontend -n microservices-demo

# Rollback to previous version
kubectl rollout undo deployment/backend -n microservices-demo
kubectl rollout undo deployment/frontend -n microservices-demo

# Rollback to specific revision
kubectl rollout undo deployment/backend -n microservices-demo --to-revision=2

# Check rollout status
kubectl rollout status deployment/backend -n microservices-demo
```

### Pulumi

```bash
# View stack history
pulumi stack history

# Rollback to specific version
pulumi stack select dev
pulumi refresh
pulumi up --target urn:pulumi:dev::microservices-infrastructure::kubernetes:apps/v1:Deployment::backend-deployment
```

---

## Cleanup

### Docker Compose

```bash
docker-compose down -v --rmi all
```

### Kubernetes (kubectl)

```bash
kubectl delete namespace microservices-demo
```

### Kubernetes (Pulumi)

```bash
cd infrastructure
pulumi destroy
pulumi stack rm dev
```

---

## Troubleshooting

### Common Issues

#### 1. Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n microservices-demo

# Check events
kubectl get events -n microservices-demo --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n microservices-demo
```

#### 2. ImagePullBackOff

```bash
# Verify image name
kubectl describe pod <pod-name> -n microservices-demo

# For minikube, load image again
minikube image load backend-service:latest
```

#### 3. Service not accessible

```bash
# Check service
kubectl get svc -n microservices-demo

# Check endpoints
kubectl get endpoints -n microservices-demo

# Test from pod
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n microservices-demo -- curl http://backend:3001/health
```

#### 4. Connection timeout

```bash
# Check if backend is running
kubectl get pods -n microservices-demo -l app=backend

# Check backend logs
kubectl logs -n microservices-demo -l app=backend --tail=50

# Verify service exists
kubectl get svc backend -n microservices-demo
```

---

## Security Considerations

### Production Checklist

- [ ] Use specific image tags (not `latest`)
- [ ] Run security scans (Trivy) before deployment
- [ ] Enable network policies
- [ ] Use secrets for sensitive data
- [ ] Enable RBAC
- [ ] Use TLS/SSL for external access
- [ ] Regular security updates
- [ ] Monitor security alerts

### Running Trivy Scans

```bash
# Scan images
trivy image backend-service:latest
trivy image frontend-service:latest

# Generate report
trivy image --format json --output backend-report.json backend-service:latest
```

---

For more information, see the main [README.md](README.md).
