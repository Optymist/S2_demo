const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");
const k8s = require("@pulumi/kubernetes");

const cfg = new pulumi.Config();
const location = cfg.get("location") || process.env.LOCATION || "eastus";
const resourceGroupName = cfg.get("resourceGroupName") || "microservices-demo-rg";
const aksName = cfg.get("aksName") || "microservices-demo-aks";
const nodeCount = cfg.getNumber("nodeCount") || 1;
const nodeSize = cfg.get("nodeSize") || "Standard_B2s";
const dnsPrefix = cfg.get("dnsPrefix") || `${aksName}-dns`;

// 1) Resource Group
const rg = new azure.resources.ResourceGroup("rg", {
  resourceGroupName,
  location,
});

// 2) AKS (Managed Identity)
const aks = new azure.containerservice.ManagedCluster("aks", {
  resourceGroupName: rg.name,
  location,
  dnsPrefix,
  identity: { type: "SystemAssigned" },
  // sku: { name: "Base", tier: "Free" }, // optional; can cause issues; keep commented if unsupported
  apiServerAccessProfile: { enablePrivateCluster: false },
  // Default system node pool
  defaultNodePool: {
    name: "systempool",
    vmSize: nodeSize,
    nodeCount,
    type: "VirtualMachineScaleSets",
    mode: "System",
    // orchestratorVersion: "1.29", // let Azure choose to avoid region incompatibility
  },
  enableRBAC: true,
}, {
  // AKS create can take 10–20+ minutes
  customTimeouts: { create: "60m", update: "60m", delete: "60m" },
});

// 3) Get kubeconfig (admin)
const creds = pulumi
  .all([rg.name, aks.name])
  .apply(([rgName, clusterName]) =>
    azure.containerservice.listManagedClusterAdminCredentials({
      resourceGroupName: rgName,
      resourceName: clusterName,
    })
  );

const kubeconfig = creds.kubeconfigs[0].value.apply((enc) =>
  Buffer.from(enc, "base64").toString()
);

// 4) Kubernetes provider targeting the new AKS
const k8sProvider = new k8s.Provider("aks-provider", {
  kubeconfig,
});

// 5) Deploy your Kubernetes resources using the provider
// If you already have these resources in this file, add `{ provider: k8sProvider }` to their options.
const ns = new k8s.core.v1.Namespace(
  "microservices-namespace",
  { metadata: { name: "microservices-demo" } },
  { provider: k8sProvider }
);

// ConfigMap for application configuration
const appConfig = new k8s.core.v1.ConfigMap("app-config", {
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
}, { provider: k8sProvider, dependsOn: [ns] });

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
                    image: "backend-service:latest",
                    imagePullPolicy: "IfNotPresent",
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
}, { provider: k8sProvider, dependsOn: [ns] });

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
}, { provider: k8sProvider, dependsOn: [ns] });

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
                    image: "frontend-service:latest",
                    imagePullPolicy: "IfNotPresent",
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
}, { provider: k8sProvider, dependsOn: [ns, backendService] });

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
}, { provider: k8sProvider, dependsOn: [ns] });

// Export the frontend service endpoint
exports.frontendUrl = frontendService.status.loadBalancer.ingress[0].apply(
    ingress => ingress.hostname || ingress.ip
);
exports.resourceGroup = rg.name;
exports.aksName = aks.name;
exports.namespace = ns.metadata.name;
exports.kubeconfig = kubeconfig; // avoid exporting in prod; kept for debugging
