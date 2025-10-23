# 🚀 Microservices Demo - S2 Demo

A simple yet elegant microservices deployment showcasing modern DevOps practices with security scanning and infrastructure as code.

## 📋 Overview

This project demonstrates a complete microservices architecture with:
- **Two microservices**: Frontend (UI) and Backend (API)
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Kubernetes manifests
- **CI/CD**: GitHub Actions with automated testing
- **Security**: Trivy vulnerability scanning
- **Infrastructure as Code**: Pulumi for K8s provisioning

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
└────────────────────┬────────────────────────────────────┘
                     │
            ┌────────▼────────┐
            │  Frontend (x2)   │  Port 3000
            │   Node.js + UI   │
            └────────┬─────────┘
                     │
            ┌────────▼────────┐
            │  Backend (x2)    │  Port 3001
            │  Express API     │
            └──────────────────┘
```

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Node.js + Express + HTML/CSS/JS |
| **Backend** | Node.js + Express |
| **Containerization** | Docker, Docker Compose |
| **Orchestration** | Kubernetes |
| **CI/CD** | GitHub Actions |
| **Security** | Trivy Scanner |
| **IaC** | Pulumi |
| **Testing** | Jest + Supertest |

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- kubectl (for Kubernetes deployment)
- Pulumi CLI (for infrastructure provisioning)

### Local Development with Docker Compose

**Option 1: Using the quick start script (Recommended)**
```bash
# Clone repository
git clone https://github.com/WandileM7/S2_demo.git
cd S2_demo

# Run quick start script
./quickstart.sh
# Follow the interactive menu
```

**Option 2: Manual start**

1. **Clone the repository**
   ```bash
   git clone https://github.com/WandileM7/S2_demo.git
   cd S2_demo
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health checks: 
     - http://localhost:3000/health
     - http://localhost:3001/health

4. **View logs**
   ```bash
   docker-compose logs -f
   ```

5. **Stop services**
   ```bash
   docker-compose down
   ```

### Local Development without Docker

#### Backend Service

```bash
cd services/backend
npm install
npm test          # Run tests
npm start         # Start server on port 3001
```

#### Frontend Service

```bash
cd services/frontend
npm install
npm test          # Run tests
npm start         # Start server on port 3000
```

## 🐳 Docker

### Build Images Manually

```bash
# Backend
docker build -t backend-service:latest ./services/backend

# Frontend
docker build -t frontend-service:latest ./services/frontend
```

### Run Individual Containers

```bash
# Backend
docker run -d -p 3001:3001 --name backend backend-service:latest

# Frontend
docker run -d -p 3000:3000 --name frontend \
  -e BACKEND_URL=http://backend:3001 \
  frontend-service:latest
```

## ☸️ Kubernetes Deployment

### Using kubectl

1. **Apply all manifests**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/backend-deployment.yaml
   kubectl apply -f k8s/frontend-deployment.yaml
   ```

2. **Check deployment status**
   ```bash
   kubectl get all -n microservices-demo
   ```

3. **Access the application**
   ```bash
   kubectl port-forward -n microservices-demo service/frontend 8080:80
   ```
   Then visit: http://localhost:8080

4. **Clean up**
   ```bash
   kubectl delete namespace microservices-demo
   ```

### Using Pulumi

1. **Install dependencies**
   ```bash
   cd infrastructure
   npm install
   ```

2. **Configure Pulumi**
   ```bash
   pulumi login
   pulumi stack init dev
   ```

3. **Preview infrastructure**
   ```bash
   pulumi preview
   ```

4. **Deploy infrastructure**
   ```bash
   pulumi up
   ```

5. **Get outputs**
   ```bash
   pulumi stack output
   ```

6. **Destroy infrastructure**
   ```bash
   pulumi destroy
   ```

## 🔒 Security

### Trivy Security Scanning

The CI/CD pipeline automatically scans both container images and source code for vulnerabilities using Trivy.

**Run Trivy locally:**

```bash
# Scan Docker images
trivy image backend-service:latest
trivy image frontend-service:latest

# Scan filesystem
trivy fs ./services/backend
trivy fs ./services/frontend
```

### Security Features

- ✅ Automated vulnerability scanning on every build
- ✅ SARIF reports uploaded to GitHub Security tab
- ✅ Critical and High severity alerts
- ✅ Non-root container users
- ✅ Health checks for all services
- ✅ Resource limits in Kubernetes
- ✅ ReadOnly root filesystem options available

## 🔄 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) includes:

### Pipeline Stages

1. **Build & Test**
   - Install dependencies
   - Run unit tests
   - Upload test results

2. **Security Scan**
   - Build Docker images
   - Run Trivy vulnerability scanner
   - Upload SARIF to GitHub Security

3. **Build & Push** (on main branch)
   - Build production images
   - Push to GitHub Container Registry

4. **Infrastructure Validation**
   - Validate Pulumi configuration
   - Preview infrastructure changes

### Workflow Triggers

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

## 📊 API Endpoints

### Backend API (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/message` | GET | Get welcome message |
| `/api/status` | GET | Get service status |

### Frontend API (Port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main UI page |
| `/health` | GET | Health check |
| `/api/config` | GET | Get backend URL config |

## 🧪 Testing

### Run All Tests

```bash
# Backend tests
cd services/backend
npm test

# Frontend tests
cd services/frontend
npm test
```

### Test Coverage

Tests include:
- Health check endpoints
- API functionality
- Service integration
- Error handling

## 📁 Project Structure

```
S2_demo/
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # CI/CD pipeline
├── services/
│   ├── backend/                # Backend service
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── server.js
│   │   └── server.test.js
│   └── frontend/               # Frontend service
│       ├── public/
│       │   └── index.html
│       ├── Dockerfile
│       ├── package.json
│       ├── server.js
│       └── server.test.js
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── backend-deployment.yaml
│   └── frontend-deployment.yaml
├── infrastructure/             # Pulumi IaC
│   ├── index.js
│   ├── Pulumi.yaml
│   └── package.json
├── docker-compose.yml          # Local development
├── quickstart.sh               # Quick start script
├── README.md                   # This file
├── ARCHITECTURE.md             # Architecture details
├── DEPLOYMENT.md               # Deployment guide
└── CONTRIBUTING.md             # Contribution guidelines
```

## 🔧 Configuration

### Environment Variables

#### Backend Service
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

#### Frontend Service
- `PORT` - Server port (default: 3000)
- `BACKEND_URL` - Backend API URL
- `NODE_ENV` - Environment (development/production)

### Kubernetes ConfigMap

Configuration is managed via ConfigMap in `k8s/configmap.yaml`:
```yaml
BACKEND_URL: "http://backend:3001"
NODE_ENV: "production"
LOG_LEVEL: "info"
```

## 🐛 Troubleshooting

### Docker Issues

**Services not starting:**
```bash
docker-compose down
docker-compose up --build
```

**View logs:**
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Kubernetes Issues

**Pods not running:**
```bash
kubectl describe pod -n microservices-demo
kubectl logs -n microservices-demo -l app=backend
kubectl logs -n microservices-demo -l app=frontend
```

**Service not accessible:**
```bash
kubectl get svc -n microservices-demo
kubectl port-forward -n microservices-demo service/frontend 8080:80
```

## 📝 Development Notes

### Adding New Features

1. Create feature branch
2. Implement changes with tests
3. Run tests locally: `npm test`
4. Build and test Docker images
5. Submit pull request
6. CI/CD will automatically run tests and security scans

### Scaling Services

**Docker Compose:**
```bash
docker-compose up --scale backend=3 --scale frontend=2
```

**Kubernetes:**
```bash
kubectl scale deployment backend -n microservices-demo --replicas=3
kubectl scale deployment frontend -n microservices-demo --replicas=2
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning and development.

## 📚 Additional Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed architecture and design decisions
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guidelines for contributors

## 🙏 Acknowledgments

- Built with modern DevOps best practices
- Security-first approach with Trivy
- Infrastructure as Code with Pulumi
- Elegant and simple architecture

## 🌟 Features Highlights

- ✅ **Complete CI/CD Pipeline** with GitHub Actions
- ✅ **Security Scanning** with Trivy (container & filesystem)
- ✅ **Infrastructure as Code** with Pulumi
- ✅ **Docker & Kubernetes** ready
- ✅ **Rate Limiting** for DDoS protection
- ✅ **Health Checks** for reliability
- ✅ **Minimal Dependencies** for security
- ✅ **Comprehensive Tests** with Jest
- ✅ **Production Ready** configuration
- ✅ **Easy to Deploy** with multiple options

---

**Made with ❤️ for demonstrating microservices architecture**