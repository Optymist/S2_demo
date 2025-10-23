# Azure Web App Deployment Guide

This guide explains how to deploy the microservices to Azure Web Apps using the new infrastructure and deployment workflows.

## Overview

The new deployment approach uses:
- **Pulumi** with Azure Blob Storage backend for state management
- **Azure Container Registry (ACR)** for container images
- **Azure App Service (Web Apps)** for hosting containers
- **Separate workflows** for infrastructure provisioning and app deployment

## Prerequisites

1. **Azure Account**: Free trial or existing subscription
2. **Azure CLI**: Install from https://docs.microsoft.com/cli/azure/install-azure-cli
3. **Pulumi CLI**: Install from https://www.pulumi.com/docs/get-started/install/
4. **Azure Storage Account**: For Pulumi state backend

## Setup Steps

### 1. Create Azure Storage Account for Pulumi State

```bash
# Login to Azure
az login

# Create resource group for Pulumi state
az group create --name pulumi-state-rg --location eastus

# Create storage account (name must be globally unique)
az storage account create \
  --name pulumistate<your-unique-id> \
  --resource-group pulumi-state-rg \
  --location eastus \
  --sku Standard_LRS

# Create blob container
az storage container create \
  --name pulumi-state \
  --account-name pulumistate<your-unique-id>

# Get storage account key
az storage account keys list \
  --resource-group pulumi-state-rg \
  --account-name pulumistate<your-unique-id> \
  --query "[0].value" -o tsv
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
- `AZURE_STORAGE_ACCOUNT`: Your storage account name (e.g., `pulumistate123`)
- `AZURE_STORAGE_KEY`: Storage account key from step 1
- `PULUMI_ACCESS_TOKEN`: Your Pulumi access token (get from https://app.pulumi.com/)
- `ARM_CLIENT_ID`: From service principal JSON (`clientId`)
- `ARM_CLIENT_SECRET`: From service principal JSON (`clientSecret`)
- `ARM_TENANT_ID`: From service principal JSON (`tenantId`)
- `ARM_SUBSCRIPTION_ID`: From service principal JSON (`subscriptionId`)

### 4. Update Pulumi Configuration

Update the environment variables in `.github/workflows/infrastructure.yml` if needed:

```yaml
env:
  PULUMI_STACK: dev
  PULUMI_PROJECT: microservices-demo
  PULUMI_BACKEND_URL: azblob://pulumi-state
  AZURE_RESOURCE_GROUP: microservices-demo-rg
  LOCATION: eastus
```

### 5. Deploy Infrastructure

**Option 1: Via GitHub Actions** (Recommended)

```bash
# Push changes to trigger workflow
git add .
git commit -m "Update infrastructure"
git push origin main

# Or manually trigger the workflow
# Go to Actions → Infrastructure Provisioning → Run workflow
```

**Option 2: Manually with Pulumi**

```bash
# Navigate to infrastructure directory
cd infrastructure

# Login to Pulumi backend
export AZURE_STORAGE_ACCOUNT=pulumistate<your-unique-id>
export AZURE_STORAGE_KEY=<your-storage-key>
pulumi login azblob://pulumi-state

# Install dependencies
npm install

# Use Web App infrastructure
cp index-webapp.js index.js

# Create/select stack
pulumi stack init dev
# or
pulumi stack select dev

# Set configuration
pulumi config set location eastus
pulumi config set resourceGroupName microservices-demo-rg
pulumi config set acrName microservicesacr<unique>

# Deploy
pulumi up
```

### 6. Deploy Applications

**Option 1: Via GitHub Actions** (Recommended)

```bash
# Push to main branch to trigger deployment
git push origin main

# Or manually trigger the workflow
# Go to Actions → App Deployment → Run workflow
```

**Option 2: Manually**

```bash
# Login to Azure
az login

# Build and push backend
cd services/backend
az acr build --registry microservicesacr \
  --image backend-service:latest .

# Build and push frontend
cd ../frontend
az acr build --registry microservicesacr \
  --image frontend-service:latest .

# Deploy to Web Apps
az webapp config container set \
  --name microservices-backend \
  --resource-group microservices-demo-rg \
  --docker-custom-image-name microservicesacr.azurecr.io/backend-service:latest

az webapp config container set \
  --name microservices-frontend \
  --resource-group microservices-demo-rg \
  --docker-custom-image-name microservicesacr.azurecr.io/frontend-service:latest
```

## Workflows

### Infrastructure Provisioning Workflow

**Trigger**: 
- Changes to `infrastructure/**` files
- Manual workflow dispatch

**What it does**:
1. Checks out code
2. Sets up Node.js
3. Logs into Azure
4. Installs Pulumi CLI
5. Logs into Pulumi backend (Azure Blob Storage)
6. Installs dependencies
7. Runs `pulumi preview` to show changes
8. Runs `pulumi up` to apply changes
9. Exports stack outputs

### App Deployment Workflow

**Trigger**:
- Push to `main` branch
- Manual workflow dispatch

**What it does**:
1. **Build Backend**: 
   - Builds Docker image
   - Pushes to ACR
2. **Build Frontend**:
   - Builds Docker image
   - Pushes to ACR
3. **Deploy Backend**:
   - Updates Web App container configuration
   - Restarts Web App
4. **Deploy Frontend**:
   - Updates Web App container configuration
   - Restarts Web App

## Infrastructure Components

### Resource Group
- Name: `microservices-demo-rg`
- Location: `eastus`
- Contains all resources

### Azure Container Registry (ACR)
- Name: `microservicesacr` (must be unique)
- SKU: Basic (free tier eligible)
- Stores Docker images

### App Service Plan
- Name: `microservices-plan`
- SKU: B1 (Basic tier)
- Linux-based for containers
- ~$13/month (covered by free trial)

### Web Apps

**Backend Web App**:
- Name: `microservices-backend`
- Container: `backend-service:latest`
- Port: 3001
- Environment: Production

**Frontend Web App**:
- Name: `microservices-frontend`
- Container: `frontend-service:latest`
- Port: 3000
- Environment: Production
- Backend URL: Points to backend Web App

## Accessing Your Application

After deployment:

```bash
# Get Web App URLs
az webapp show \
  --name microservices-frontend \
  --resource-group microservices-demo-rg \
  --query defaultHostName -o tsv

az webapp show \
  --name microservices-backend \
  --resource-group microservices-demo-rg \
  --query defaultHostName -o tsv
```

Or use Pulumi outputs:

```bash
cd infrastructure
pulumi stack output frontendUrl
pulumi stack output backendUrl
```

Visit the frontend URL in your browser!

## Monitoring and Logs

### View Application Logs

```bash
# Stream logs from frontend
az webapp log tail \
  --name microservices-frontend \
  --resource-group microservices-demo-rg

# Stream logs from backend
az webapp log tail \
  --name microservices-backend \
  --resource-group microservices-demo-rg
```

### Enable Application Insights (Optional)

```bash
# Create Application Insights
az monitor app-insights component create \
  --app microservices-insights \
  --location eastus \
  --resource-group microservices-demo-rg

# Get instrumentation key
az monitor app-insights component show \
  --app microservices-insights \
  --resource-group microservices-demo-rg \
  --query instrumentationKey -o tsv

# Add to Web App settings
az webapp config appsettings set \
  --name microservices-backend \
  --resource-group microservices-demo-rg \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=<key>
```

## Cost Management

### Estimated Costs (Free Trial)

- **App Service Plan (B1)**: ~$13/month
- **ACR (Basic)**: Free for 12 months, then $5/month
- **Storage Account**: Minimal (~$0.02/month)
- **Web Apps**: Included in App Service Plan

**Total**: ~$13/month (covered by Azure free trial credits)

### Cost Optimization

1. **Stop when not in use**:
   ```bash
   az webapp stop --name microservices-backend --resource-group microservices-demo-rg
   az webapp stop --name microservices-frontend --resource-group microservices-demo-rg
   ```

2. **Start when needed**:
   ```bash
   az webapp start --name microservices-backend --resource-group microservices-demo-rg
   az webapp start --name microservices-frontend --resource-group microservices-demo-rg
   ```

3. **Delete when done**:
   ```bash
   pulumi destroy
   # or
   az group delete --name microservices-demo-rg --yes
   ```

## Troubleshooting

### Container Not Starting

```bash
# Check Web App logs
az webapp log tail --name microservices-backend --resource-group microservices-demo-rg

# Check container settings
az webapp config container show \
  --name microservices-backend \
  --resource-group microservices-demo-rg
```

### Image Pull Errors

```bash
# Verify ACR credentials
az acr credential show --name microservicesacr

# Verify image exists
az acr repository list --name microservicesacr

# Manually set credentials
az webapp config container set \
  --name microservices-backend \
  --resource-group microservices-demo-rg \
  --docker-registry-server-url https://microservicesacr.azurecr.io \
  --docker-registry-server-user <username> \
  --docker-registry-server-password <password>
```

### Deployment Failures

```bash
# Check deployment logs
az webapp deployment list \
  --name microservices-backend \
  --resource-group microservices-demo-rg

# View deployment details
az webapp deployment show \
  --name microservices-backend \
  --resource-group microservices-demo-rg \
  --deployment-id <id>
```

## Comparison: Web Apps vs AKS

| Feature | Azure Web Apps | Azure AKS |
|---------|----------------|-----------|
| **Setup Complexity** | Low | High |
| **Cost** | ~$13/month | ~$30/month |
| **Management** | Fully managed | Self-managed |
| **Scaling** | Auto-scaling | Manual/HPA |
| **Best For** | Simple apps | Complex microservices |
| **Free Trial** | ✅ Covered | ✅ Covered |

## Next Steps

1. Set up custom domains
2. Configure SSL certificates
3. Enable Application Insights
4. Set up deployment slots for blue-green deployments
5. Configure auto-scaling rules
6. Add Datadog integration for enhanced monitoring

## Support

For issues:
1. Check Azure Portal for resource status
2. Review Web App logs
3. Check GitHub Actions workflow runs
4. Review Pulumi state

## Cleanup

To remove all resources:

```bash
# Using Pulumi
cd infrastructure
pulumi destroy

# Or delete resource group
az group delete --name microservices-demo-rg --yes --no-wait

# Don't forget to delete Pulumi state storage
az group delete --name pulumi-state-rg --yes --no-wait
```

---

**Note**: This deployment uses Azure Web Apps for simplicity and cost-effectiveness. For production workloads with complex orchestration needs, consider using the AKS deployment option.
