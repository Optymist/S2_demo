const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");
const k8s = require("@pulumi/kubernetes");

// Configuration
const config = new pulumi.Config();
const location = config.get("location") || "eastus";
const resourceGroupName = config.get("resourceGroupName") || "microservices-demo-rg";
const aksClusterName = config.get("aksClusterName") || "microservices-aks";
const acrName = config.get("acrName") || "microservicesacr";
const nodeSize = config.get("nodeSize") || "Standard_D2s_v5";

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
        name: "Basic",
    },
    adminUserEnabled: true,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
    },
});

// Create an AKS cluster
const aksCluster = new azure.containerservice.ManagedCluster("aks-cluster", {
    resourceGroupName: resourceGroup.name,
    resourceName: aksClusterName,
    location: resourceGroup.location,
    dnsPrefix: "microservices",
    agentPoolProfiles: [{
        name: "agentpool",
        count: 1,
        vmSize: nodeSize,
        mode: "System",
        osType: "Linux",
        osDiskSizeGB: 30,
        type: "VirtualMachineScaleSets",
        enableAutoScaling: false,
    }],
    identity: {
        type: "SystemAssigned",
    },
    networkProfile: {
        networkPlugin: "azure",
        networkPolicy: "azure",
        loadBalancerSku: "standard",
        serviceCidr: "10.0.0.0/16",
        dnsServiceIP: "10.0.0.10",
    },
    enableRBAC: true,
    tags: {
        environment: pulumi.getStack(),
        project: "microservices-demo",
    },
});

// Grant AKS cluster pull access to ACR
const acrPullRole = new azure.authorization.RoleAssignment("aks-acr-pull", {
    principalId: aksCluster.identityProfile.apply(ip => ip?.kubeletidentity?.objectId || ""),
    principalType: "ServicePrincipal",
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfig().then(c => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/7f951dda-4ed3-4680-a7ca-43fe172d538d`,
    scope: registry.id,
});

// Get AKS credentials
const kubeconfig = pulumi.all([resourceGroup.name, aksCluster.name]).apply(async ([rgName, clusterName]) => {
    const credentials = await azure.containerservice.listManagedClusterUserCredentials({
        resourceGroupName: rgName,
        resourceName: clusterName,
    });
    
    if (!credentials.kubeconfigs || credentials.kubeconfigs.length === 0) {
        throw new Error("No kubeconfig returned from AKS");
    }
    
    const kubeConfigContent = credentials.kubeconfigs[0].value;
    if (!kubeConfigContent) {
        throw new Error("Kubeconfig value is empty");
    }
    
    return Buffer.from(kubeConfigContent, "base64").toString("utf8");
});

// Create a Kubernetes provider instance using the AKS cluster's kubeconfig
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
    enableServerSideApply: true,
}, { dependsOn: [aksCluster] });

// Create Namespace
const namespace = new k8s.core.v1.Namespace("microservices-namespace", {
    metadata: {
        name: "microservices-demo",
        labels: {
            name: "microservices-demo",
            environment: pulumi.getStack(),
        },
    },
}, { provider: k8sProvider, dependsOn: [k8sProvider] });

// Create ConfigMap
const configMap = new k8s.core.v1.ConfigMap("app-config", {
    metadata: {
        name: "app-config",
        namespace: "microservices-demo",
        labels: {
            app: "microservices-demo",
        },
    },
    data: {
        BACKEND_URL: "http://backend:3001",
        NODE_ENV: "production",
        LOG_LEVEL: "info",
    },
}, { provider: k8sProvider, dependsOn: [namespace] });

// Backend Deployment
const backendDeployment = new k8s.apps.v1.Deployment("backend-deployment", {
    metadata: {
        name: "backend",
        namespace: "microservices-demo",
        labels: {
            app: "backend",
            version: "v1",
        },
    },
    spec: {
        replicas: 2,
        selector: {
            matchLabels: {
                app: "backend",
            },
        },
        template: {
            metadata: {
                labels: {
                    app: "backend",
                    version: "v1",
                },
            },
            spec: {
                containers: [{
                    name: "backend",
                    image: pulumi.interpolate`${registry.loginServer}/backend-service:latest`,
                    imagePullPolicy: "Always",
                    ports: [{
                        containerPort: 3001,
                        name: "http",
                        protocol: "TCP",
                    }],
                    env: [
                        { name: "PORT", value: "3001" },
                        { name: "NODE_ENV", value: "production" },
                    ],
                    resources: {
                        requests: {
                            memory: "128Mi",
                            cpu: "100m",
                        },
                        limits: {
                            memory: "256Mi",
                            cpu: "200m",
                        },
                    },
                    livenessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3001,
                        },
                        initialDelaySeconds: 10,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                    },
                    readinessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3001,
                        },
                        initialDelaySeconds: 5,
                        periodSeconds: 5,
                        timeoutSeconds: 3,
                        failureThreshold: 2,
                    },
                }],
            },
        },
    },
}, { provider: k8sProvider, dependsOn: [namespace, configMap] });

// Backend Service
const backendService = new k8s.core.v1.Service("backend-service", {
    metadata: {
        name: "backend",
        namespace: "microservices-demo",
        labels: {
            app: "backend",
        },
    },
    spec: {
        type: "ClusterIP",
        selector: {
            app: "backend",
        },
        ports: [{
            port: 3001,
            targetPort: 3001,
            protocol: "TCP",
            name: "http",
        }],
    },
}, { provider: k8sProvider, dependsOn: [namespace] });

// Frontend Deployment
const frontendDeployment = new k8s.apps.v1.Deployment("frontend-deployment", {
    metadata: {
        name: "frontend",
        namespace: "microservices-demo",
        labels: {
            app: "frontend",
            version: "v1",
        },
    },
    spec: {
        replicas: 2,
        selector: {
            matchLabels: {
                app: "frontend",
            },
        },
        template: {
            metadata: {
                labels: {
                    app: "frontend",
                    version: "v1",
                },
            },
            spec: {
                containers: [{
                    name: "frontend",
                    image: pulumi.interpolate`${registry.loginServer}/frontend-service:latest`,
                    imagePullPolicy: "Always",
                    ports: [{
                        containerPort: 3000,
                        name: "http",
                        protocol: "TCP",
                    }],
                    env: [
                        { name: "PORT", value: "3000" },
                        { name: "BACKEND_URL", value: "http://backend:3001" },
                        { name: "NODE_ENV", value: "production" },
                    ],
                    resources: {
                        requests: {
                            memory: "128Mi",
                            cpu: "100m",
                        },
                        limits: {
                            memory: "256Mi",
                            cpu: "200m",
                        },
                    },
                    livenessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3000,
                        },
                        initialDelaySeconds: 10,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                    },
                    readinessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3000,
                        },
                        initialDelaySeconds: 5,
                        periodSeconds: 5,
                        timeoutSeconds: 3,
                        failureThreshold: 2,
                    },
                }],
            },
        },
    },
}, { provider: k8sProvider, dependsOn: [namespace, backendService, configMap] });

// Frontend Service (LoadBalancer)
const frontendService = new k8s.core.v1.Service("frontend-service", {
    metadata: {
        name: "frontend",
        namespace: "microservices-demo",
        labels: {
            app: "frontend",
        },
    },
    spec: {
        type: "LoadBalancer",
        selector: {
            app: "frontend",
        },
        ports: [{
            port: 80,
            targetPort: 3000,
            protocol: "TCP",
            name: "http",
        }],
    },
}, { provider: k8sProvider, dependsOn: [namespace] });

// Exports
exports.resourceGroupName = resourceGroup.name;
exports.aksClusterName = aksCluster.name;
exports.acrLoginServer = registry.loginServer;
exports.acrName = registry.name;
exports.frontendUrl = frontendService.status.apply(status => {
    const ingress = status?.loadBalancer?.ingress?.[0];
    return ingress ? (ingress.hostname || ingress.ip) : "Pending...";
});
exports.kubeconfig = pulumi.secret(kubeconfig);
