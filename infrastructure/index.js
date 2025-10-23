const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");
const k8s = require("@pulumi/kubernetes");

// Config
const cfg = new pulumi.Config();
const location = cfg.get("location") || process.env.LOCATION || "eastus";
const resourceGroupName = cfg.get("resourceGroupName") || "microservices-demo-rg";
const aksName = cfg.get("aksName") || "microservices-demo-aks";
const nodeCount = cfg.getNumber("nodeCount") || 1;
const nodeSize = cfg.get("nodeSize") || process.env.NODE_SIZE || "Standard_DC2s_v3";
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

  // Use agentPoolProfiles to satisfy API contract
  agentPoolProfiles: [{
    name: "systempool",
    vmSize: nodeSize,
    count: nodeCount,
    type: "VirtualMachineScaleSets",
    mode: "System",
    osType: "Linux",
  }],

  enableRBAC: true,
}, {
  customTimeouts: { create: "60m", update: "60m", delete: "60m" },
});

// 3) Kubeconfig for the new AKS
const kubeconfig = pulumi
  .all([rg.name, aks.name])
  .apply(async ([rgName, clusterName]) => {
    const res = await azure.containerservice.listManagedClusterAdminCredentials({
      resourceGroupName: rgName,
      resourceName: clusterName,
    });
    if (!res.kubeconfigs?.[0]?.value) {
      throw new Error("No kubeconfig returned from AKS");
    }
    return Buffer.from(res.kubeconfigs[0].value, "base64").toString("utf8");
  });

// 4) Kubernetes provider targeting AKS
const k8sProvider = new k8s.Provider("aks-provider", { kubeconfig }, { dependsOn: aks });

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
