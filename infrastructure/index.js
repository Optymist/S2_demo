const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");
const k8s = require("@pulumi/kubernetes");

// Config
const cfg = new pulumi.Config();
const location = cfg.get("location") || process.env.LOCATION || "eastus";
const resourceGroupName = cfg.get("resourceGroupName") || "microservices-demo-rg";
const aksName = cfg.get("aksName") || "microservices-demo-aks";
const nodeCount = cfg.getNumber("nodeCount") || 2;
const nodeSize = cfg.get("nodeSize") || "Standard_DS2_v2";
const dnsPrefix = cfg.get("dnsPrefix") || `${aksName}-dns`;

// 1) Resource Group
const rg = new azure.resources.ResourceGroup("rg", {
  resourceGroupName,
  location,
});

// 2) AKS cluster (managed identity)
const aks = new azure.containerservice.ManagedCluster("aks", {
  resourceGroupName: rg.name,
  location,
  dnsPrefix,
  identity: { type: "SystemAssigned" },
  defaultNodePool: {
    name: "systempool",
    vmSize: nodeSize,
    nodeCount,
    type: "VirtualMachineScaleSets",
    mode: "System",
  },
  enableRBAC: true,
}, {
  // AKS create can take 10–20+ minutes
  customTimeouts: { create: "60m", update: "60m", delete: "60m" },
});

// 3) Kubeconfig for the new AKS
const creds = pulumi.all([rg.name, aks.name]).apply(([rgName, clusterName]) =>
  azure.containerservice.listManagedClusterAdminCredentials({
    resourceGroupName: rgName,
    resourceName: clusterName,
  })
);
const kubeconfig = creds.kubeconfigs[0].value.apply((b64) =>
  Buffer.from(b64, "base64").toString()
);

// 4) Kubernetes provider targeting AKS
const k8sProvider = new k8s.Provider("aks-provider", { kubeconfig });

// 5) Apply your existing YAML manifests using the provider
const appManifests = new k8s.yaml.ConfigGroup(
  "app-manifests",
  {
    files: [
      "../k8s/namespace.yaml",
      "../k8s/configmap.yaml",
      "../k8s/backend-deployment.yaml",
      "../k8s/frontend-deployment.yaml",
      "../k8s/datadog-agent.yaml",
    ],
  },
  { provider: k8sProvider } // <= this tells Pulumi to use AKS
);

// 6) Optional: export outputs
exports.resourceGroup = rg.name;
exports.aksName = aks.name;
exports.kubeconfig = kubeconfig;
