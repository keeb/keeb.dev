import { z } from "npm:zod@4";

const InputSchema = z.object({
  apiUrl: z.string().describe("Proxmox API base URL (e.g., https://10.0.0.4:8006)"),
  username: z.string().optional().describe("Proxmox username for authentication"),
  password: z.string().optional().describe("Proxmox password for authentication"),
  realm: z.string().default("pam").describe("Authentication realm (pam, pve, etc.)"),
  ticket: z.string().optional().describe("Authentication ticket from previous login"),
  csrfToken: z.string().optional().describe("CSRF prevention token from previous login"),
  node: z.string().optional().describe("Proxmox node name for VM operations"),
  vmid: z.union([z.number(), z.string()]).optional().describe("VM ID for single VM operations"),
  skipTlsVerify: z.boolean().default(true).describe("Skip TLS certificate verification"),
  // VM creation parameters
  vmName: z.string().optional().describe("Name for the new VM"),
  memory: z.number().optional().describe("Memory in MB (default 2048)"),
  cores: z.number().optional().describe("Number of CPU cores (default 2)"),
  sockets: z.number().optional().describe("Number of CPU sockets (default 1)"),
  diskSize: z.number().optional().describe("Disk size in GB (default 32)"),
  diskStorage: z.string().optional().describe("Storage pool for disk (default 'local-lvm')"),
  networkBridge: z.string().optional().describe("Network bridge (default 'vmbr0')"),
  osType: z.string().optional().describe("OS type (default 'l26' for Linux 2.6+)"),
});

const DataSchema = z.object({
  ticket: z.string().optional(),
  csrfToken: z.string().optional(),
  username: z.string().optional(),
  vms: z.array(z.object({
    vmid: z.number(),
    name: z.string().optional(),
    status: z.string(),
    mem: z.number().optional(),
    maxmem: z.number().optional(),
    cpu: z.number().optional(),
    cpus: z.number().optional(),
    uptime: z.number().optional(),
    netin: z.number().optional(),
    netout: z.number().optional(),
    diskread: z.number().optional(),
    diskwrite: z.number().optional(),
  })).optional(),
  vm: z.object({
    vmid: z.number(),
    name: z.string().optional(),
    status: z.string(),
    qmpstatus: z.string().optional(),
    pid: z.number().optional(),
    mem: z.number().optional(),
    maxmem: z.number().optional(),
    cpu: z.number().optional(),
    cpus: z.number().optional(),
    uptime: z.number().optional(),
    netin: z.number().optional(),
    netout: z.number().optional(),
    diskread: z.number().optional(),
    diskwrite: z.number().optional(),
    ha: z.object({
      managed: z.number(),
    }).optional(),
  }).optional(),
  vmConfig: z.record(z.unknown()).optional(),
  guestNetwork: z.array(z.object({
    name: z.string(),
    "hardware-address": z.string().optional(),
    "ip-addresses": z.array(z.object({
      "ip-address": z.string(),
      "ip-address-type": z.string(),
      prefix: z.number().optional(),
    })).optional(),
  })).optional(),
  guestInfo: z.object({
    id: z.string().optional(),
    "kernel-release": z.string().optional(),
    "kernel-version": z.string().optional(),
    machine: z.string().optional(),
    name: z.string().optional(),
    "pretty-name": z.string().optional(),
    version: z.string().optional(),
    "version-id": z.string().optional(),
  }).optional(),
  nodeStatus: z.object({
    cpu: z.number().optional(),
    cpuinfo: z.object({
      cpus: z.number().optional(),
      cores: z.number().optional(),
      sockets: z.number().optional(),
      model: z.string().optional(),
      mhz: z.string().optional(),
    }).optional(),
    memory: z.object({
      total: z.number().optional(),
      used: z.number().optional(),
      free: z.number().optional(),
    }).optional(),
    rootfs: z.object({
      total: z.number().optional(),
      used: z.number().optional(),
      free: z.number().optional(),
      avail: z.number().optional(),
    }).optional(),
    uptime: z.number().optional(),
    kversion: z.string().optional(),
    pveversion: z.string().optional(),
  }).optional(),
  storage: z.array(z.object({
    storage: z.string(),
    type: z.string().optional(),
    content: z.string().optional(),
    total: z.number().optional(),
    used: z.number().optional(),
    avail: z.number().optional(),
    active: z.number().optional(),
    enabled: z.number().optional(),
    shared: z.number().optional(),
  })).optional(),
  nodes: z.array(z.object({
    node: z.string(),
    status: z.string().optional(),
    cpu: z.number().optional(),
    maxcpu: z.number().optional(),
    mem: z.number().optional(),
    maxmem: z.number().optional(),
    uptime: z.number().optional(),
    type: z.string().optional(),
  })).optional(),
  timestamp: z.string(),
});

async function fetchWithCurl(url, options) {
  const { method = "GET", headers = {}, body, skipTlsVerify } = options;

  const args = ["-s", "-S"]; // Silent but show errors

  if (skipTlsVerify) {
    args.push("-k"); // Insecure mode for self-signed certs
  }

  args.push("-X", method);

  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    args.push("-H", `${key}: ${value}`);
  }

  // Add body for POST requests
  if (body) {
    args.push("-d", body);
  }

  // Include response headers in output
  args.push("-i");
  args.push(url);

  // @ts-ignore - Deno API
  const command = new Deno.Command("curl", { args });
  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`curl failed with code ${code}: ${errorText}`);
  }

  const output = new TextDecoder().decode(stdout);

  // Parse the response - split headers from body
  const headerEndIndex = output.indexOf("\r\n\r\n");
  const headersText = output.substring(0, headerEndIndex);
  const bodyText = output.substring(headerEndIndex + 4);

  // Parse status from first line
  const statusLine = headersText.split("\r\n")[0];
  const statusMatch = statusLine.match(/HTTP\/[\d.]+ (\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 0;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusLine,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  };
}

async function waitForTask(apiUrl, node, upid, ticket, csrfToken, skipTlsVerify) {
  const encodedUpid = encodeURIComponent(upid);
  const url = `${apiUrl}/api2/json/nodes/${node}/tasks/${encodedUpid}/status`;
  let pollCount = 0;

  console.log(`[waitForTask] Waiting for task: ${upid}`);

  while (true) {
    pollCount++;
    const response = await fetchWithCurl(url, {
      method: "GET",
      headers: {
        "Cookie": `PVEAuthCookie=${ticket}`,
        ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
      },
      skipTlsVerify,
    });

    if (!response.ok) {
      console.log(`[waitForTask] Task status check failed: ${response.status}`);
      throw new Error(`Task status check failed: ${response.status}`);
    }

    const result = await response.json();
    const status = result.data?.status;

    if (status === "stopped") {
      const exitstatus = result.data?.exitstatus;
      console.log(`[waitForTask] Task completed after ${pollCount} poll(s): ${exitstatus}`);
      return {
        success: exitstatus === "OK",
        exitstatus,
      };
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export const model = {
  type: "proxmox/api",
  version: 1,
  inputAttributesSchema: InputSchema,
  dataAttributesSchema: DataSchema,
  methods: {
    authenticate: {
      description: "Authenticate with Proxmox API and obtain session ticket and CSRF token",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, skipTlsVerify } = input.attributes;

        console.log(`[authenticate] Authenticating with Proxmox API`);
        console.log(`[authenticate] API URL: ${apiUrl}`);
        console.log(`[authenticate] Username: ${username}@${realm || "pam"}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const response = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[authenticate] Authentication failed: ${response.status}`);
          throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const { ticket, CSRFPreventionToken } = result.data;

        console.log(`[authenticate] Authentication successful, ticket obtained`);

        return {
          data: {
            id: input.id,
            attributes: {
              ticket,
              csrfToken: CSRFPreventionToken,
              username: `${username}@${realm || "pam"}`,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    listVms: {
      description: "List all VMs on a Proxmox node",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, node, skipTlsVerify } = input.attributes;

        if (!ticket || !node) {
          throw new Error("Ticket and node are required to list VMs");
        }

        const listUrl = `${apiUrl}/api2/json/nodes/${node}/qemu`;

        const response = await fetchWithCurl(listUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to list VMs: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const vms = result.data.map((vm) => ({
          vmid: vm.vmid,
          name: vm.name,
          status: vm.status,
          mem: vm.mem,
          maxmem: vm.maxmem,
          cpu: vm.cpu,
          cpus: vm.cpus,
          uptime: vm.uptime,
          netin: vm.netin,
          netout: vm.netout,
          diskread: vm.diskread,
          diskwrite: vm.diskwrite,
        }));

        return {
          data: {
            id: input.id,
            attributes: {
              vms,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    syncVms: {
      description: "Authenticate and list all VMs on a Proxmox node in one operation",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;

        console.log(`[syncVms] Starting VM sync for node: ${node}`);
        console.log(`[syncVms] API URL: ${apiUrl}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node) {
          throw new Error("Node is required to list VMs");
        }

        // Step 1: Authenticate
        console.log(`[syncVms] Authenticating as user: ${username}@${realm || "pam"}`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          const errorText = await authResponse.text();
          console.log(`[syncVms] Authentication failed: ${authResponse.status}`);
          throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText} - ${errorText}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;
        console.log(`[syncVms] Authentication successful, obtained ticket`);

        // Step 2: List VMs
        console.log(`[syncVms] Fetching VM list from node: ${node}`);
        const listUrl = `${apiUrl}/api2/json/nodes/${node}/qemu`;

        const listResponse = await fetchWithCurl(listUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.log(`[syncVms] Failed to list VMs: ${listResponse.status}`);
          throw new Error(`Failed to list VMs: ${listResponse.status} ${listResponse.statusText} - ${errorText}`);
        }

        const listResult = await listResponse.json();
        const vms = listResult.data.map((vm) => ({
          vmid: vm.vmid,
          name: vm.name,
          status: vm.status,
          mem: vm.mem,
          maxmem: vm.maxmem,
          cpu: vm.cpu,
          cpus: vm.cpus,
          uptime: vm.uptime,
          netin: vm.netin,
          netout: vm.netout,
          diskread: vm.diskread,
          diskwrite: vm.diskwrite,
        }));

        console.log(`[syncVms] Found ${vms.length} VMs`);
        for (const vm of vms) {
          console.log(`[syncVms]   - VM ${vm.vmid}: ${vm.name || '(unnamed)'} [${vm.status}]`);
        }
        console.log(`[syncVms] Sync complete`);

        return {
          data: {
            id: input.id,
            attributes: {
              ticket,
              csrfToken: CSRFPreventionToken,
              username: `${username}@${realm || "pam"}`,
              vms,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getVm: {
      description: "Get detailed status of a specific VM",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, node, vmid, skipTlsVerify } = input.attributes;

        if (!ticket || !node || vmid === undefined) {
          throw new Error("Ticket, node, and vmid are required to get VM details");
        }

        const vmUrl = `${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/status/current`;

        const response = await fetchWithCurl(vmUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get VM: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const vm = result.data;

        return {
          data: {
            id: input.id,
            attributes: {
              vm: {
                vmid: vm.vmid,
                name: vm.name,
                status: vm.status,
                qmpstatus: vm.qmpstatus,
                pid: vm.pid,
                mem: vm.mem,
                maxmem: vm.maxmem,
                cpu: vm.cpu,
                cpus: vm.cpus,
                uptime: vm.uptime,
                netin: vm.netin,
                netout: vm.netout,
                diskread: vm.diskread,
                diskwrite: vm.diskwrite,
                ha: vm.ha,
              },
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getVmConfig: {
      description: "Get the configuration of a specific VM including disks, network, and hardware settings",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, node, vmid, skipTlsVerify } = input.attributes;

        if (!ticket || !node || vmid === undefined) {
          throw new Error("Ticket, node, and vmid are required to get VM config");
        }

        const configUrl = `${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/config`;

        const response = await fetchWithCurl(configUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get VM config: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        return {
          data: {
            id: input.id,
            attributes: {
              vmConfig: result.data,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getVmGuestNetwork: {
      description: "Get network interfaces from VM guest agent (requires qemu-guest-agent running in VM)",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[getVmGuestNetwork] Getting guest network for VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to get guest network");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        // Authenticate
        console.log(`[getVmGuestNetwork] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[getVmGuestNetwork] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        console.log(`[getVmGuestNetwork] Querying guest agent for network interfaces`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[getVmGuestNetwork] Failed to get guest network: ${response.status}`);
          throw new Error(`Failed to get guest network: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const interfaces = result.data?.result || [];

        console.log(`[getVmGuestNetwork] Found ${interfaces.length} interface(s)`);
        for (const iface of interfaces) {
          const ips = iface["ip-addresses"] || [];
          const ipv4 = ips.filter(ip => ip["ip-address-type"] === "ipv4").map(ip => ip["ip-address"]);
          console.log(`[getVmGuestNetwork]   - ${iface.name}: ${ipv4.join(", ") || "(no IPv4)"}`);
        }

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              guestNetwork: interfaces,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getVmGuestInfo: {
      description: "Get guest OS information from VM guest agent (requires qemu-guest-agent running in VM)",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[getVmGuestInfo] Getting guest OS info for VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to get guest info");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        // Authenticate
        console.log(`[getVmGuestInfo] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[getVmGuestInfo] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        console.log(`[getVmGuestInfo] Querying guest agent for OS info`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/agent/get-osinfo`, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[getVmGuestInfo] Failed to get guest info: ${response.status}`);
          throw new Error(`Failed to get guest info: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const osInfo = result.data?.result || {};

        console.log(`[getVmGuestInfo] OS: ${osInfo["pretty-name"] || osInfo.name || "unknown"}`);
        console.log(`[getVmGuestInfo] Kernel: ${osInfo["kernel-release"] || "unknown"}`);

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              guestInfo: osInfo,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getNodeStatus: {
      description: "Get detailed status of a Proxmox node including CPU, memory, and system info",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, node, skipTlsVerify } = input.attributes;

        if (!ticket || !node) {
          throw new Error("Ticket and node are required to get node status");
        }

        const statusUrl = `${apiUrl}/api2/json/nodes/${node}/status`;

        const response = await fetchWithCurl(statusUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get node status: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const data = result.data;

        return {
          data: {
            id: input.id,
            attributes: {
              nodeStatus: {
                cpu: data.cpu,
                cpuinfo: data.cpuinfo,
                memory: data.memory,
                rootfs: data.rootfs,
                uptime: data.uptime,
                kversion: data.kversion,
                pveversion: data.pveversion,
              },
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getStorage: {
      description: "List all storage on a Proxmox node",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, node, skipTlsVerify } = input.attributes;

        if (!ticket || !node) {
          throw new Error("Ticket and node are required to list storage");
        }

        const storageUrl = `${apiUrl}/api2/json/nodes/${node}/storage`;

        const response = await fetchWithCurl(storageUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get storage: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        return {
          data: {
            id: input.id,
            attributes: {
              storage: result.data,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getClusterNodes: {
      description: "List all nodes in the Proxmox cluster",
      execute: async (input, _context) => {
        const { apiUrl, ticket, csrfToken, skipTlsVerify } = input.attributes;

        if (!ticket) {
          throw new Error("Ticket is required to list cluster nodes");
        }

        const nodesUrl = `${apiUrl}/api2/json/nodes`;

        const response = await fetchWithCurl(nodesUrl, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            ...(csrfToken && { "CSRFPreventionToken": csrfToken }),
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get cluster nodes: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        return {
          data: {
            id: input.id,
            attributes: {
              nodes: result.data,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    fullInfrastructureScan: {
      description: "Comprehensive scan of entire Proxmox infrastructure including nodes, storage, and all VMs with configs",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;

        console.log(`[fullInfrastructureScan] Starting full infrastructure scan`);
        console.log(`[fullInfrastructureScan] API URL: ${apiUrl}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        // Step 1: Authenticate
        console.log(`[fullInfrastructureScan] Step 1: Authenticating as ${username}@${realm || "pam"}`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[fullInfrastructureScan] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;
        const headers = {
          "Cookie": `PVEAuthCookie=${ticket}`,
          "CSRFPreventionToken": CSRFPreventionToken,
        };
        console.log(`[fullInfrastructureScan] Authentication successful`);

        // Step 2: Get all cluster nodes
        console.log(`[fullInfrastructureScan] Step 2: Fetching cluster nodes`);
        const nodesResponse = await fetchWithCurl(`${apiUrl}/api2/json/nodes`, {
          method: "GET",
          headers,
          skipTlsVerify: skipTlsVerify ?? true,
        });
        const nodesResult = await nodesResponse.json();
        const nodes = nodesResult.data;
        console.log(`[fullInfrastructureScan] Found ${nodes.length} node(s): ${nodes.map(n => n.node).join(', ')}`);

        // Use specified node or first available
        const targetNode = node || nodes[0]?.node;
        console.log(`[fullInfrastructureScan] Target node: ${targetNode}`);

        // Step 3: Get node status
        console.log(`[fullInfrastructureScan] Step 3: Fetching node status for ${targetNode}`);
        const nodeStatusResponse = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${targetNode}/status`, {
          method: "GET",
          headers,
          skipTlsVerify: skipTlsVerify ?? true,
        });
        const nodeStatusResult = await nodeStatusResponse.json();
        console.log(`[fullInfrastructureScan] Node status retrieved`);

        // Step 4: Get storage
        console.log(`[fullInfrastructureScan] Step 4: Fetching storage pools`);
        const storageResponse = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${targetNode}/storage`, {
          method: "GET",
          headers,
          skipTlsVerify: skipTlsVerify ?? true,
        });
        const storageResult = await storageResponse.json();
        console.log(`[fullInfrastructureScan] Found ${storageResult.data.length} storage pool(s)`);

        // Step 5: Get all VMs
        console.log(`[fullInfrastructureScan] Step 5: Fetching VM list`);
        const vmsResponse = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${targetNode}/qemu`, {
          method: "GET",
          headers,
          skipTlsVerify: skipTlsVerify ?? true,
        });
        const vmsResult = await vmsResponse.json();
        console.log(`[fullInfrastructureScan] Found ${vmsResult.data.length} VM(s)`);

        // Step 6: Get config for each VM
        console.log(`[fullInfrastructureScan] Step 6: Fetching config for each VM`);
        const vmsWithConfig = await Promise.all(
          vmsResult.data.map(async (vm) => {
            console.log(`[fullInfrastructureScan]   - Fetching config for VM ${vm.vmid} (${vm.name || 'unnamed'})`);
            const configResponse = await fetchWithCurl(
              `${apiUrl}/api2/json/nodes/${targetNode}/qemu/${vm.vmid}/config`,
              { method: "GET", headers, skipTlsVerify: skipTlsVerify ?? true }
            );
            const configResult = await configResponse.json();
            return {
              vmid: vm.vmid,
              name: vm.name,
              status: vm.status,
              mem: vm.mem,
              maxmem: vm.maxmem,
              cpu: vm.cpu,
              cpus: vm.cpus,
              uptime: vm.uptime,
              netin: vm.netin,
              netout: vm.netout,
              config: configResult.data,
            };
          })
        );

        console.log(`[fullInfrastructureScan] Scan complete`);
        console.log(`[fullInfrastructureScan] Summary: ${nodes.length} nodes, ${storageResult.data.length} storage pools, ${vmsWithConfig.length} VMs`);

        return {
          data: {
            id: input.id,
            attributes: {
              ticket,
              csrfToken: CSRFPreventionToken,
              username: `${username}@${realm || "pam"}`,
              nodes,
              nodeStatus: {
                cpu: nodeStatusResult.data.cpu,
                cpuinfo: nodeStatusResult.data.cpuinfo,
                memory: nodeStatusResult.data.memory,
                rootfs: nodeStatusResult.data.rootfs,
                uptime: nodeStatusResult.data.uptime,
                kversion: nodeStatusResult.data.kversion,
                pveversion: nodeStatusResult.data.pveversion,
              },
              storage: storageResult.data,
              vms: vmsWithConfig,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    getNextVmId: {
      description: "Get the next available VM ID from the cluster",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, skipTlsVerify } = input.attributes;

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        // Authenticate
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        const url = `${apiUrl}/api2/json/cluster/nextid`;

        const response = await fetchWithCurl(url, {
          method: "GET",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get next VM ID: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        return {
          data: {
            id: input.id,
            attributes: {
              vmid: result.data,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    createVm: {
      description: "Create a new VM with PXE boot enabled for automatic provisioning",
      execute: async (input, _context) => {
        const {
          apiUrl, username, password, realm, node, skipTlsVerify,
          vmName, memory, cores, sockets, diskSize, diskStorage, networkBridge, osType,
        } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[createVm] Starting VM creation on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node) {
          throw new Error("Node is required to create VM");
        }

        // Authenticate
        console.log(`[createVm] Authenticating as ${username}@${realm || "pam"}`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[createVm] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;
        const headers = {
          "Cookie": `PVEAuthCookie=${ticket}`,
          "CSRFPreventionToken": CSRFPreventionToken,
        };
        console.log(`[createVm] Authentication successful`);

        // Get next VM ID if not provided
        if (!vmid) {
          console.log(`[createVm] Fetching next available VM ID`);
          const nextIdUrl = `${apiUrl}/api2/json/cluster/nextid`;
          const nextIdResponse = await fetchWithCurl(nextIdUrl, {
            method: "GET",
            headers,
            skipTlsVerify: skipTlsVerify ?? true,
          });

          if (!nextIdResponse.ok) {
            throw new Error(`Failed to get next VM ID: ${await nextIdResponse.text()}`);
          }

          const nextIdResult = await nextIdResponse.json();
          vmid = parseInt(nextIdResult.data, 10);
          console.log(`[createVm] Got next VM ID: ${vmid}`);
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        const finalName = vmName || `vm-${vmid}`;

        console.log(`[createVm] Creating VM ${vmid} with name: ${finalName}`);
        console.log(`[createVm] Specs: ${memory ?? 2048}MB RAM, ${cores ?? 2} cores, ${diskSize ?? 32}GB disk`);

        // Build form data with defaults
        const params = new URLSearchParams({
          vmid: String(vmid),
          name: finalName,
          memory: String(memory ?? 2048),
          cores: String(cores ?? 2),
          sockets: String(sockets ?? 1),
          ostype: osType ?? "l26",
          boot: "order=net0;scsi0",
          net0: `virtio,bridge=${networkBridge ?? "vmbr0"}`,
          scsi0: `${diskStorage ?? "local-lvm"}:${diskSize ?? 32},format=raw`,
          scsihw: "virtio-scsi-single",
        });

        // POST to create VM
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[createVm] Failed to create VM: ${response.status}`);
          throw new Error(`Failed to create VM: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle response and poll task
        const result = await response.json();
        const upid = result.data;
        console.log(`[createVm] VM creation task started, waiting for completion...`);
        const taskResult = await waitForTask(apiUrl, node, upid, ticket, CSRFPreventionToken, skipTlsVerify ?? true);

        if (taskResult.success) {
          console.log(`[createVm] VM ${vmid} (${finalName}) created successfully`);
        } else {
          console.log(`[createVm] VM creation failed: ${taskResult.exitstatus}`);
        }

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              name: finalName,
              success: taskResult.success,
              exitstatus: taskResult.exitstatus,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    startVm: {
      description: "Start a VM",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[startVm] Starting VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to start VM");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        // Authenticate
        console.log(`[startVm] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[startVm] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        console.log(`[startVm] Sending start command for VM ${vmid}`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/status/start`, {
          method: "POST",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[startVm] Failed to start VM: ${response.status}`);
          throw new Error(`Failed to start VM: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const upid = result.data;
        console.log(`[startVm] Start task initiated, waiting for completion...`);
        const taskResult = await waitForTask(apiUrl, node, upid, ticket, CSRFPreventionToken, skipTlsVerify ?? true);

        if (taskResult.success) {
          console.log(`[startVm] VM ${vmid} started successfully`);
        } else {
          console.log(`[startVm] VM ${vmid} start failed: ${taskResult.exitstatus}`);
        }

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              success: taskResult.success,
              exitstatus: taskResult.exitstatus,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    stopVm: {
      description: "Stop a VM",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[stopVm] Stopping VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to stop VM");
        }

        // Authenticate
        console.log(`[stopVm] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[stopVm] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        console.log(`[stopVm] Sending stop command for VM ${vmid}`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/status/stop`, {
          method: "POST",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[stopVm] Failed to stop VM: ${response.status}`);
          throw new Error(`Failed to stop VM: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const upid = result.data;
        console.log(`[stopVm] Stop task initiated, waiting for completion...`);
        const taskResult = await waitForTask(apiUrl, node, upid, ticket, CSRFPreventionToken, skipTlsVerify ?? true);

        if (taskResult.success) {
          console.log(`[stopVm] VM ${vmid} stopped successfully`);
        } else {
          console.log(`[stopVm] VM ${vmid} stop failed: ${taskResult.exitstatus}`);
        }

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              success: taskResult.success,
              exitstatus: taskResult.exitstatus,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    updateVmConfig: {
      description: "Update VM configuration (memory, CPU, etc.). VM must be stopped for most changes.",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify, memory, cores, sockets } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[updateVmConfig] Updating config for VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to update VM config");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        // Authenticate
        console.log(`[updateVmConfig] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[updateVmConfig] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        // Build config update params
        const params = new URLSearchParams();
        if (memory !== undefined) {
          params.append("memory", String(memory));
          console.log(`[updateVmConfig] Setting memory to ${memory} MB`);
        }
        if (cores !== undefined) {
          params.append("cores", String(cores));
          console.log(`[updateVmConfig] Setting cores to ${cores}`);
        }
        if (sockets !== undefined) {
          params.append("sockets", String(sockets));
          console.log(`[updateVmConfig] Setting sockets to ${sockets}`);
        }

        if (params.toString() === "") {
          throw new Error("No configuration changes specified (memory, cores, or sockets)");
        }

        console.log(`[updateVmConfig] Sending config update for VM ${vmid}`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}/config`, {
          method: "PUT",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          body: params.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[updateVmConfig] Failed to update VM config: ${response.status}`);
          throw new Error(`Failed to update VM config: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log(`[updateVmConfig] VM ${vmid} configuration updated successfully`);

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              success: true,
              updatedConfig: {
                ...(memory !== undefined && { memory }),
                ...(cores !== undefined && { cores }),
                ...(sockets !== undefined && { sockets }),
              },
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },

    deleteVm: {
      description: "Delete a VM",
      execute: async (input, _context) => {
        const { apiUrl, username, password, realm, node, skipTlsVerify } = input.attributes;
        let { vmid } = input.attributes;

        console.log(`[deleteVm] Deleting VM ${vmid} on node: ${node}`);

        if (!username || !password) {
          throw new Error("Username and password are required for authentication");
        }

        if (!node || vmid === undefined) {
          throw new Error("Node and vmid are required to delete VM");
        }

        // Ensure vmid is a number
        vmid = typeof vmid === 'string' ? parseInt(vmid, 10) : vmid;

        // Authenticate
        console.log(`[deleteVm] Authenticating`);
        const authUrl = `${apiUrl}/api2/json/access/ticket`;
        const formData = new URLSearchParams();
        formData.append("username", `${username}@${realm || "pam"}`);
        formData.append("password", password);

        const authResponse = await fetchWithCurl(authUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!authResponse.ok) {
          console.log(`[deleteVm] Authentication failed`);
          throw new Error(`Authentication failed: ${await authResponse.text()}`);
        }

        const authResult = await authResponse.json();
        const { ticket, CSRFPreventionToken } = authResult.data;

        console.log(`[deleteVm] Sending delete command for VM ${vmid}`);
        const response = await fetchWithCurl(`${apiUrl}/api2/json/nodes/${node}/qemu/${vmid}`, {
          method: "DELETE",
          headers: {
            "Cookie": `PVEAuthCookie=${ticket}`,
            "CSRFPreventionToken": CSRFPreventionToken,
          },
          skipTlsVerify: skipTlsVerify ?? true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[deleteVm] Failed to delete VM: ${response.status}`);
          throw new Error(`Failed to delete VM: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const upid = result.data;
        console.log(`[deleteVm] Delete task initiated, waiting for completion...`);
        const taskResult = await waitForTask(apiUrl, node, upid, ticket, CSRFPreventionToken, skipTlsVerify ?? true);

        if (taskResult.success) {
          console.log(`[deleteVm] VM ${vmid} deleted successfully`);
        } else {
          console.log(`[deleteVm] VM ${vmid} deletion failed: ${taskResult.exitstatus}`);
        }

        return {
          data: {
            id: input.id,
            attributes: {
              vmid,
              success: taskResult.success,
              exitstatus: taskResult.exitstatus,
              ticket,
              csrfToken: CSRFPreventionToken,
              timestamp: new Date().toISOString(),
            },
          },
        };
      },
    },
  },
};
