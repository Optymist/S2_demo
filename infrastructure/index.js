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

// NEW: ACR config for attaching pull permissions
const acrName = cfg.get("acrName") || "demoday"; // set to your ACR name
const acrResourceGroupName = cfg.get("acrResourceGroupName") || resourceGroupName;

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

// NEW: Grant AcrPull to the AKS kubelet identity so it can pull from ACR
const clientCfg = azure.authorization.getClientConfigOutput();
const acrId = pulumi.interpolate`/subscriptions/${clientCfg.subscriptionId}/resourceGroups/${acrResourceGroupName}/providers/Microsoft.ContainerRegistry/registries/${acrName}`;
const acrPullRole = new azure.authorization.RoleAssignment("aks-acr-pull", {
  principalId: aks.identityProfile.apply(ip => ip?.kubeletidentity?.objectId || ""),
  principalType: "ServicePrincipal",
  roleDefinitionId: pulumi.interpolate`/subscriptions/${clientCfg.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/7f951dda-4ed3-4680-a7ca-43fe172d538d`, // AcrPull
  scope: acrId,
}, { dependsOn: aks });

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

// 5) Apply only cluster-scoped app config (namespace + configmap). Leave app pods/Datadog to dedicated workflows.
const appBase = new k8s.yaml.ConfigGroup(
  "app-base",
  {
    files: [
      "../k8s/namespace.yaml",
      "../k8s/configmap.yaml",
      // Removed: ../k8s/backend-deployment.yaml
      // Removed: ../k8s/frontend-deployment.yaml
      // Removed: ../k8s/datadog-agent.yaml (requires Datadog Operator CRDs)
    ],
  },
  { provider: k8sProvider, dependsOn: [acrPullRole] }
);

// 6) Outputs
exports.resourceGroup = rg.name;
exports.aksName = aks.name;
exports.kubeconfig = kubeconfig;
