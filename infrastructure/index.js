const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

// Configuration
const config = new pulumi.Config();
const appName = "microservices-demo";
const namespace = "microservices-demo";

// Create Kubernetes Provider (uses default kubeconfig)
const provider = new k8s.Provider("k8s-provider", {
    enableServerSideApply: true,
});

// Create Namespace
const ns = new k8s.core.v1.Namespace("microservices-namespace", {
    metadata: {
        name: namespace,
        labels: {
            name: namespace,
            environment: "production",
        },
    },
}, { provider });

// ConfigMap for application configuration
const appConfig = new k8s.core.v1.ConfigMap("app-config", {
    metadata: {
        name: "app-config",
        namespace: namespace,
        labels: {
            app: appName,
        },
    },
    data: {
        BACKEND_URL: "http://backend:3001",
        NODE_ENV: "production",
        LOG_LEVEL: "info",
    },
}, { provider, dependsOn: [ns] });

// Backend Deployment
const backendDeployment = new k8s.apps.v1.Deployment("backend-deployment", {
    metadata: {
        name: "backend",
        namespace: namespace,
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
}, { provider, dependsOn: [ns] });

// Backend Service
const backendService = new k8s.core.v1.Service("backend-service", {
    metadata: {
        name: "backend",
        namespace: namespace,
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
}, { provider, dependsOn: [ns] });

// Frontend Deployment
const frontendDeployment = new k8s.apps.v1.Deployment("frontend-deployment", {
    metadata: {
        name: "frontend",
        namespace: namespace,
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
}, { provider, dependsOn: [ns, backendService] });

// Frontend Service (LoadBalancer)
const frontendService = new k8s.core.v1.Service("frontend-service", {
    metadata: {
        name: "frontend",
        namespace: namespace,
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
}, { provider, dependsOn: [ns] });

// Export the frontend service endpoint
exports.frontendUrl = frontendService.status.loadBalancer.ingress[0].apply(
    ingress => ingress.hostname || ingress.ip
);
exports.namespace = namespace;
exports.backendServiceName = backendService.metadata.name;
exports.frontendServiceName = frontendService.metadata.name;
