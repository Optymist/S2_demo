const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration
const config = new pulumi.Config();
const location = config.get("location") || "eastus";
const resourceGroupName = config.get("resourceGroupName") || "microservices-demo-rg";
const acrName = config.get("acrName") || "microservicesacr";
const appServicePlanName = config.get("appServicePlanName") || "microservices-plan";
const backendAppName = config.get("backendAppName") || "microservices-backend";
const frontendAppName = config.get("frontendAppName") || "microservices-frontend";

// Create an Azure Resource Group
const resourceGroup = new azure.resources.ResourceGroup("resource-group", {
    resourceGroupName: resourceGroupName,
    location: location,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
    },
});

// Create an Azure Container Registry
const registry = new azure.containerregistry.Registry("container-registry", {
    resourceGroupName: resourceGroup.name,
    registryName: acrName,
    location: resourceGroup.location,
    sku: {
        name: "Basic", // Free tier compatible
    },
    adminUserEnabled: true,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
    },
});

// Get ACR credentials
const credentials = pulumi.all([resourceGroup.name, registry.name]).apply(([rgName, regName]) =>
    azure.containerregistry.listRegistryCredentials({
        resourceGroupName: rgName,
        registryName: regName,
    })
);

const adminUsername = credentials.apply(c => c.username!);
const adminPassword = credentials.apply(c => c.passwords![0].value!);

// Create an App Service Plan (Linux-based for containers)
const appServicePlan = new azure.web.AppServicePlan("app-service-plan", {
    resourceGroupName: resourceGroup.name,
    name: appServicePlanName,
    location: resourceGroup.location,
    kind: "Linux",
    reserved: true, // Required for Linux
    sku: {
        name: "B1", // Basic tier, affordable for free trial
        tier: "Basic",
        size: "B1",
        family: "B",
        capacity: 1,
    },
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
    },
});

// Create Backend Web App
const backendApp = new azure.web.WebApp("backend-webapp", {
    resourceGroupName: resourceGroup.name,
    name: backendAppName,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    kind: "app,linux,container",
    siteConfig: {
        linuxFxVersion: pulumi.interpolate`DOCKER|${registry.loginServer}/backend-service:latest`,
        alwaysOn: false, // Set to false for Basic tier
        appSettings: [
            {
                name: "WEBSITES_ENABLE_APP_SERVICE_STORAGE",
                value: "false",
            },
            {
                name: "DOCKER_REGISTRY_SERVER_URL",
                value: pulumi.interpolate`https://${registry.loginServer}`,
            },
            {
                name: "DOCKER_REGISTRY_SERVER_USERNAME",
                value: adminUsername,
            },
            {
                name: "DOCKER_REGISTRY_SERVER_PASSWORD",
                value: adminPassword,
            },
            {
                name: "PORT",
                value: "3001",
            },
            {
                name: "NODE_ENV",
                value: "production",
            },
            {
                name: "DD_AGENT_HOST",
                value: "", // Optional: Add Datadog agent if needed
            },
            {
                name: "DD_SERVICE",
                value: "backend-service",
            },
            {
                name: "DD_ENV",
                value: pulumi.getStack(),
            },
        ],
    },
    httpsOnly: true,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
        service: "backend",
    },
});

// Create Frontend Web App
const frontendApp = new azure.web.WebApp("frontend-webapp", {
    resourceGroupName: resourceGroup.name,
    name: frontendAppName,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    kind: "app,linux,container",
    siteConfig: {
        linuxFxVersion: pulumi.interpolate`DOCKER|${registry.loginServer}/frontend-service:latest`,
        alwaysOn: false, // Set to false for Basic tier
        appSettings: [
            {
                name: "WEBSITES_ENABLE_APP_SERVICE_STORAGE",
                value: "false",
            },
            {
                name: "DOCKER_REGISTRY_SERVER_URL",
                value: pulumi.interpolate`https://${registry.loginServer}`,
            },
            {
                name: "DOCKER_REGISTRY_SERVER_USERNAME",
                value: adminUsername,
            },
            {
                name: "DOCKER_REGISTRY_SERVER_PASSWORD",
                value: adminPassword,
            },
            {
                name: "PORT",
                value: "3000",
            },
            {
                name: "BACKEND_URL",
                value: pulumi.interpolate`https://${backendApp.defaultHostName}`,
            },
            {
                name: "NODE_ENV",
                value: "production",
            },
            {
                name: "DD_AGENT_HOST",
                value: "", // Optional: Add Datadog agent if needed
            },
            {
                name: "DD_SERVICE",
                value: "frontend-service",
            },
            {
                name: "DD_ENV",
                value: pulumi.getStack(),
            },
        ],
    },
    httpsOnly: true,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
        service: "frontend",
    },
});

// Exports
exports.resourceGroupName = resourceGroup.name;
exports.acrLoginServer = registry.loginServer;
exports.acrName = registry.name;
exports.backendUrl = pulumi.interpolate`https://${backendApp.defaultHostName}`;
exports.frontendUrl = pulumi.interpolate`https://${frontendApp.defaultHostName}`;
exports.appServicePlanName = appServicePlan.name;
