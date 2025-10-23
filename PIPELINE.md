# Pipeline Architecture - Separation of Concerns

This document explains the CI/CD pipeline architecture following the **separation of concerns** principle.

## Overview

The pipeline is split into **4 independent workflows**, each responsible for a specific concern:

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    BUILD     │  │     TEST     │  │   SECURITY   │
│  Workflow    │  │  Workflow    │  │  Workflow    │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    DEPLOY    │
                  │  Workflow    │
                  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  Azure AKS   │
                  └──────────────┘
```

## Workflows

### 1. Build Workflow (`.github/workflows/build.yml`)

**Purpose**: Compile and prepare application code

**Responsibilities**:
- Install dependencies for both services
- Build backend service
- Build frontend service
- Upload build artifacts

**Triggers**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual dispatch

**Benefits**:
- Fast feedback on build failures
- Independent of testing and security
- Can be run in parallel
- Generates artifacts for other workflows

**Jobs**:
- `build-backend`: Builds the backend service
- `build-frontend`: Builds the frontend service

---

### 2. Test Workflow (`.github/workflows/test.yml`)

**Purpose**: Execute automated tests

**Responsibilities**:
- Run unit tests for backend
- Run unit tests for frontend
- Generate test coverage reports
- Upload test results as artifacts

**Triggers**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual dispatch

**Benefits**:
- Focused on testing only
- Independent execution
- Clear test results visibility
- Parallel test execution

**Jobs**:
- `test-backend`: Runs backend tests
- `test-frontend`: Runs frontend tests

---

### 3. Security Workflow (`.github/workflows/security.yml`)

**Purpose**: Scan for security vulnerabilities

**Responsibilities**:
- Scan backend Docker images with Trivy
- Scan frontend Docker images with Trivy
- Scan backend filesystem for vulnerabilities
- Scan frontend filesystem for vulnerabilities
- Scan infrastructure code
- Upload SARIF reports to GitHub Security

**Triggers**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual dispatch
- **Scheduled**: Daily at 2 AM UTC

**Benefits**:
- Comprehensive security coverage
- Scheduled scans for new vulnerabilities
- Integration with GitHub Security tab
- Independent of build and deploy

**Jobs**:
- `scan-backend-container`: Scans backend Docker image
- `scan-backend-filesystem`: Scans backend source code
- `scan-frontend-container`: Scans frontend Docker image
- `scan-frontend-filesystem`: Scans frontend source code
- `scan-infrastructure`: Scans Pulumi infrastructure code

---

### 4. Deploy Workflow (`.github/workflows/deploy.yml`)

**Purpose**: Deploy application to Azure

**Responsibilities**:
- Build Docker images
- Push images to Azure Container Registry
- Deploy infrastructure with Pulumi (AKS, ACR, Resource Group)
- Deploy application to Kubernetes
- Verify deployment health

**Triggers**:
- Push to `main` branch only
- Manual dispatch with environment selection

**Benefits**:
- Production-only automatic deployment
- Manual control for other environments
- Complete deployment automation
- Azure-optimized

**Jobs**:
- `build-and-push-images`: Builds and pushes to ACR
- `deploy-infrastructure`: Creates/updates Azure resources with Pulumi
- `deploy-application`: Deploys K8s manifests to AKS

**Environment Options**:
- `dev`: Development environment
- `staging`: Staging environment
- `production`: Production environment

---

## Separation of Concerns Benefits

### 1. **Independence**
Each workflow can run independently without affecting others:
- Build failures don't block security scans
- Test failures don't prevent builds
- Security scans can run on schedule

### 2. **Parallel Execution**
Multiple workflows can run simultaneously:
- Build + Test + Security run in parallel on PR
- Faster overall feedback time
- Better resource utilization

### 3. **Focused Responsibilities**
Each workflow has a clear purpose:
- Easier to understand and maintain
- Simpler debugging
- Clear failure points

### 4. **Flexibility**
Can trigger workflows independently:
- Run security scans without rebuilding
- Re-run tests without redeploying
- Deploy without running tests (not recommended!)

### 5. **Scalability**
Easy to add new workflows:
- Performance testing workflow
- Integration testing workflow
- Documentation generation workflow

## Workflow Dependencies

While workflows are independent, deployment has implicit dependencies:

```
Build ──┐
        ├──> Deploy (requires all to pass)
Test ───┤
        │
Security┘
```

**Recommendation**: Set up branch protection rules requiring all workflows to pass before merging.

## Configuration

### Branch Protection Rules

Recommended settings for `main` branch:
1. Require pull request reviews
2. Require status checks to pass:
   - ✅ Build Backend Service
   - ✅ Build Frontend Service
   - ✅ Test Backend Service
   - ✅ Test Frontend Service
   - ✅ Scan Backend Container
   - ✅ Scan Frontend Container

### GitHub Secrets

Required secrets for Azure deployment:

**Azure Credentials**:
- `AZURE_CREDENTIALS`: Service principal JSON
- `AZURE_CONTAINER_REGISTRY`: ACR URL
- `ACR_USERNAME`: ACR admin username
- `ACR_PASSWORD`: ACR admin password
- `AZURE_RESOURCE_GROUP`: Resource group name
- `AKS_CLUSTER_NAME`: AKS cluster name

**Azure ARM**:
- `ARM_CLIENT_ID`: Service principal client ID
- `ARM_CLIENT_SECRET`: Service principal secret
- `ARM_TENANT_ID`: Azure tenant ID
- `ARM_SUBSCRIPTION_ID`: Azure subscription ID

**Pulumi**:
- `PULUMI_ACCESS_TOKEN`: Pulumi access token

## Running Workflows

### Automatic Triggers

**On Pull Request**:
- All workflows run automatically
- Provides complete validation
- Must pass before merge

**On Push to Main**:
- Build, Test, Security run
- Deploy runs automatically
- Application updates in Azure

**Daily Schedule**:
- Security workflow runs at 2 AM UTC
- Detects new vulnerabilities

### Manual Triggers

**Via GitHub UI**:
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"
4. Choose branch/environment

**Via GitHub CLI**:
```bash
# Run build workflow
gh workflow run build.yml

# Run test workflow
gh workflow run test.yml

# Run security workflow
gh workflow run security.yml

# Run deploy workflow with environment
gh workflow run deploy.yml -f environment=dev
```

## Monitoring Workflows

### GitHub Actions UI

View workflow runs:
1. Go to repository
2. Click "Actions" tab
3. Filter by workflow or status

### Notifications

Configure notifications:
1. Repository Settings → Notifications
2. Enable email/Slack notifications
3. Set notification preferences

### Status Badges

Add to README.md:
```markdown
![Build](https://github.com/USER/REPO/workflows/Build/badge.svg)
![Test](https://github.com/USER/REPO/workflows/Test/badge.svg)
![Security](https://github.com/USER/REPO/workflows/Security/badge.svg)
![Deploy](https://github.com/USER/REPO/workflows/Deploy/badge.svg)
```

## Troubleshooting

### Build Failures
1. Check build logs in GitHub Actions
2. Verify dependencies in package.json
3. Test locally with `npm install && npm test`

### Test Failures
1. Review test output in Actions
2. Run tests locally
3. Check test coverage reports

### Security Scan Failures
1. Review SARIF reports in Security tab
2. Check Trivy scan output
3. Update vulnerable dependencies
4. Add exceptions if needed (use sparingly)

### Deployment Failures
1. Check Azure credentials
2. Verify Pulumi state
3. Check AKS cluster status
4. Review kubectl logs

## Best Practices

### 1. Keep Workflows Fast
- Use caching for dependencies
- Parallelize independent jobs
- Skip unnecessary steps

### 2. Use Artifacts Wisely
- Share build outputs between workflows
- Set appropriate retention periods
- Clean up old artifacts

### 3. Secure Secrets
- Use GitHub Secrets, never hardcode
- Rotate credentials regularly
- Use minimal permissions

### 4. Monitor and Alert
- Set up failure notifications
- Review security scan results
- Monitor deployment health

### 5. Version Control
- Keep workflows in version control
- Review workflow changes in PRs
- Document workflow changes

## Future Enhancements

Potential additions:
- **Performance Testing**: Load testing workflow
- **E2E Testing**: Integration testing workflow
- **Chaos Engineering**: Resilience testing
- **Documentation**: Auto-generate docs
- **Release**: Automated release management
- **Rollback**: Automated rollback on failure

## Summary

The separated pipeline architecture provides:
- ✅ Clear separation of concerns
- ✅ Independent workflow execution
- ✅ Parallel processing for speed
- ✅ Focused debugging
- ✅ Flexible deployment options
- ✅ Better maintainability
- ✅ Scalable architecture

Each workflow has a single responsibility, making the entire CI/CD process more reliable, maintainable, and efficient.
