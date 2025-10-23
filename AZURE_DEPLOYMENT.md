# Azure Deployment Guide

This guide explains how to deploy the microservices to Azure using your free trial account.

## Prerequisites

1. **Azure Account**: Free trial account (https://azure.microsoft.com/free/)
2. **Azure CLI**: Install from https://docs.microsoft.com/cli/azure/install-azure-cli
3. **Pulumi**: Install from https://www.pulumi.com/docs/get-started/install/
4. **kubectl**: Install from https://kubernetes.io/docs/tasks/tools/

## Azure Free Trial Limits

The infrastructure is optimized for Azure free trial:
- **AKS**: 1 node cluster with B2s VMs (affordable)
- **ACR**: Basic tier (free for 12 months)
- **Resource Group**: Single resource group
- **Load Balancer**: Standard SKU (included)

## Setup Steps

### 1. Login to Azure

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Verify
az account show
```

### 2. Create Service Principal for GitHub Actions

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "microservices-demo-sp" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth

# Save the JSON output - you'll need it for GitHub secrets
```

### 3. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

**Required Secrets:**
- `AZURE_CREDENTIALS`: The JSON output from service principal creation
- `AZURE_CONTAINER_REGISTRY`: Your ACR name (e.g., `microservicesacr.azurecr.io`)
- `ACR_USERNAME`: ACR admin username (get from Azure portal)
- `ACR_PASSWORD`: ACR admin password (get from Azure portal)
- `PULUMI_ACCESS_TOKEN`: Your Pulumi access token
- `AZURE_RESOURCE_GROUP`: `microservices-demo-rg`
- `AKS_CLUSTER_NAME`: `microservices-aks`
- `ARM_CLIENT_ID`: From service principal JSON
- `ARM_CLIENT_SECRET`: From service principal JSON
- `ARM_TENANT_ID`: From service principal JSON
- `ARM_SUBSCRIPTION_ID`: Your Azure subscription ID

### 4. Deploy Infrastructure with Pulumi

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Login to Pulumi
pulumi login

# Create a new stack for development
pulumi stack init dev

# Set Azure configuration
pulumi config set location eastus
pulumi config set resourceGroupName microservices-demo-rg
pulumi config set aksClusterName microservices-aks
pulumi config set acrName YOUR_UNIQUE_ACR_NAME  # Must be globally unique!

# Set Azure credentials
export ARM_CLIENT_ID="xxx"
export ARM_CLIENT_SECRET="xxx"
export ARM_TENANT_ID="xxx"
export ARM_SUBSCRIPTION_ID="xxx"

# Deploy using Azure-specific infrastructure
cp index-azure.js index.js
pulumi up

# Wait for deployment (5-10 minutes)
```

### 5. Verify Deployment

```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group microservices-demo-rg \
  --name microservices-aks

# Verify cluster
kubectl get nodes
kubectl get pods -n microservices-demo

# Get service endpoints
kubectl get svc -n microservices-demo

# Get frontend URL
pulumi stack output frontendUrl
```

### 6. Access Your Application

Once deployed, get the frontend URL:

```bash
# Get the public IP
kubectl get svc frontend -n microservices-demo

# Or use pulumi output
pulumi stack output frontendUrl
```

Visit the URL in your browser to see your application!

## Manual Deployment (Without GitHub Actions)

If you want to deploy manually:

```bash
# 1. Build and push images to ACR
az acr login --name YOUR_ACR_NAME

docker build -t YOUR_ACR_NAME.azurecr.io/backend-service:latest ./services/backend
docker build -t YOUR_ACR_NAME.azurecr.io/frontend-service:latest ./services/frontend

docker push YOUR_ACR_NAME.azurecr.io/backend-service:latest
docker push YOUR_ACR_NAME.azurecr.io/frontend-service:latest

# 2. Deploy with Pulumi
cd infrastructure
cp index-azure.js index.js
pulumi up
```

## Cost Optimization

To minimize costs on your free trial:

1. **Stop AKS when not in use:**
   ```bash
   az aks stop --name microservices-aks --resource-group microservices-demo-rg
   ```

2. **Start AKS when needed:**
   ```bash
   az aks start --name microservices-aks --resource-group microservices-demo-rg
   ```

3. **Delete resources when done:**
   ```bash
   pulumi destroy
   # or
   az group delete --name microservices-demo-rg --yes
   ```

## Monitoring

```bash
# View pod logs
kubectl logs -f deployment/backend -n microservices-demo
kubectl logs -f deployment/frontend -n microservices-demo

# View pod status
kubectl get pods -n microservices-demo -w

# Describe pods for troubleshooting
kubectl describe pod POD_NAME -n microservices-demo
```

## Scaling

```bash
# Scale deployments
kubectl scale deployment backend --replicas=3 -n microservices-demo
kubectl scale deployment frontend --replicas=3 -n microservices-demo

# Enable autoscaling (requires metrics server)
kubectl autoscale deployment backend \
  --min=2 --max=5 --cpu-percent=70 \
  -n microservices-demo
```

## Troubleshooting

### Images not pulling
```bash
# Verify ACR access
az aks check-acr --name microservices-aks \
  --resource-group microservices-demo-rg \
  --acr YOUR_ACR_NAME.azurecr.io
```

### Pods not starting
```bash
# Check events
kubectl get events -n microservices-demo --sort-by='.lastTimestamp'

# Check pod details
kubectl describe pod POD_NAME -n microservices-demo
```

### Service not accessible
```bash
# Check service
kubectl get svc -n microservices-demo

# Check endpoints
kubectl get endpoints -n microservices-demo
```

## CI/CD Pipeline

The GitHub Actions workflows are separated by concern:

1. **Build** (`.github/workflows/build.yml`): Builds application code
2. **Test** (`.github/workflows/test.yml`): Runs unit tests
3. **Security** (`.github/workflows/security.yml`): Scans for vulnerabilities
4. **Deploy** (`.github/workflows/deploy.yml`): Deploys to Azure

Each workflow runs independently and can be triggered separately.

## Next Steps

- Set up monitoring with Azure Monitor
- Configure alerts for cluster health
- Add Application Insights for application monitoring
- Set up backup and disaster recovery
- Implement GitOps with ArgoCD or Flux

## Support

For issues:
1. Check Azure Portal for resource status
2. Review pod logs with `kubectl logs`
3. Check GitHub Actions workflow runs
4. Review Pulumi state with `pulumi stack`

## Cleanup

To remove all resources:

```bash
# Using Pulumi
cd infrastructure
pulumi destroy

# Or delete resource group
az group delete --name microservices-demo-rg --yes --no-wait
```

**Note**: Always verify resources are deleted to avoid unexpected charges!
