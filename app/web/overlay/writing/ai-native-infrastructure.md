---
title: Building Infrastructure Automation with Claude and Swamp
date: 2026-02-03
tags:
  - ai
  - automation
  - swamp
  - proxmox
---

I've been building with swamp, an AI-native automation framework, and I wanted to see what happens when Claude and swamp work together on a real infrastructure problem. The prompt was simple:

> "Describe my Proxmox infrastructure. Go as deep as you need to. Use swamp. Build what you need."

What follows is a story of two systems working together: **swamp** provides the runtime, CLI, model orchestration, immutable state storage, and validation—while **Claude** writes code, makes architectural decisions, and invokes swamp's CLI to bring it all together.

## How This Works

Before diving in, here's the relationship: swamp is the framework and runtime. It provides a CLI (`swamp model create`, `swamp model method run`, etc.), a model system for defining typed resources, workflow orchestration, expression evaluation, and persistent state storage. Claude uses swamp's CLI to create models, run methods, and store infrastructure state. Claude writes the TypeScript code; swamp compiles, validates, and executes it.

Every time you see "we ran" or "we created" below, that's Claude invoking swamp commands and swamp executing them.

## The Starting Point: Nothing

Swamp had zero Proxmox support. No models, no auth, no API bindings. Just some generic stuff like echo and curl. And if you've ever worked with Proxmox's API, you know the curl model wasn't going to cut it—Proxmox uses this whole ticket-based auth flow where you POST to get a session ticket, then pass it as a cookie on subsequent requests. Plus CSRF tokens. Plus self-signed certs because it's a homelab.

So Claude looked at swamp's extension model system and said: "I can build what we need."

## Building the Extension

Swamp's extension model system is what makes this possible. You write TypeScript models that swamp compiles and executes via Deno. Claude created `extensions/models/proxmox_api.ts`:

```typescript
export const model = {
  type: "proxmox/api",
  version: 1,
  inputAttributesSchema: InputSchema,
  dataAttributesSchema: DataSchema,
  methods: { authenticate, listVms, getVm }
};
```

Swamp provides the schema validation, method execution runtime, and state persistence. Claude writes the implementation. The key insight was creating a `fetchWithCurl()` wrapper (lines 129-182 in the extension) that handles all the Proxmox quirks—self-signed certs, cookie auth, response parsing. Once that foundation was there, adding new API methods became trivial: Claude writes the code, runs `swamp model method run` to test it, swamp validates and executes.

## Then We Hit the Walls

This is where it got interesting. Swamp is still early, and we hit some edge cases. But here's the thing about working with an AI-native framework: **we found them, diagnosed them, and some got fixed during the session**.

**1. Vault expressions had validation gaps**

Wrote this:
```yaml
password: ${{ vault.get("proxmox-vault", "password") }}
```

Got an error about vaults not being configured, even though it was. The vault resolution code exists (`execution_service.ts:503-506`) but there were gaps in how it handled certain cases. We worked around it for this session, but it's now a known issue to fix.

**2. Hyphenated model names broke CEL (fixed)**

Named a model `proxmox-auth`. Tried to reference it:
```
${{ model.proxmox-auth.data.attributes.ticket }}
```

CEL parsed this as `model.proxmox` minus `auth.data.attributes.ticket`. Math on strings. Not great.

**This one got fixed during the session.** Swamp now has `transformHyphenatedModelRefs()` in the expression parser that handles this. That's the value of AI-native development—find a bug, fix it, move on.

**3. Data refresh between workflow steps (fixed)**

Step 1 authenticates and writes the ticket to its data. Step 2 tries to read that ticket:
```
Error: Identifier 'data' not found
```

The workflow wasn't refreshing the data context between steps. **Also fixed during this work**—`execution_service.ts:866-909` now updates context after each step.

## The Workarounds (and Fixes)

Some issues got fixed immediately. Others we worked around:

- **Vault issue**: Stored credentials directly in model input for this session (not ideal, but unblocked the work)
- **Naming issue**: Actually fixed in swamp's expression parser
- **Data refresh issue**: Actually fixed in swamp's execution service

The vault workaround led to a cleaner architecture anyway. Instead of a two-step workflow (authenticate, then list VMs), Claude created `syncVms`—one method that does auth internally and returns both the session tokens AND the VM list. No workflow step dependencies needed. Sometimes constraints push you toward better design.

## Going Deeper

Once the basics worked, I asked to go deeper. Each method addition follows the same pattern: Claude writes the TypeScript, then runs `swamp model method run proxmoxAuth <methodName>` to test it. Swamp compiles, executes, and stores the results.

```typescript
getVmConfig        // Full VM hardware config
getNodeStatus      // CPU, memory, kernel version
getStorage         // Storage pools with capacity
getClusterNodes    // All nodes in cluster
fullInfrastructureScan  // Everything in one call
```

The `fullInfrastructureScan` method chains all of these together: authenticate, get nodes, get storage, get VMs, get config for each VM. One call, complete infrastructure state—all stored immutably in swamp's model system for later querying.

## Actually Using It: The Memory Upgrade

Then came a real task: two VMs were running hot on memory. A Minecraft server at 95% and a Terraria server at 77%. Time to upgrade them.

Claude added `updateVmConfig` to the model—straightforward PUT request to change memory/CPU. But here's the thing: you can't just YOLO stop a game server. You need to gracefully shut down the game, then stop the VM, then change config, then start everything back up.

Problem: **How do you SSH into a VM when you don't know its IP?**

First attempt: Claude added `getVmGuestNetwork` to the model—query the QEMU guest agent for network interfaces. That's the "right" way. But: guest agent wasn't installed on these VMs. `swamp model method run proxmoxAuth getVmGuestNetwork` returned nothing useful.

So Claude extended the model again. Added `getVmIpByMac`:

```typescript
getVmIpByMac  // Correlate VM MAC address with node ARP table
```

The method grabs the MAC from the VM config (`net0: "virtio=BC:24:11:XX:XX:XX"`), then queries the ARP table on the Proxmox node and matches it up. Old school network debugging, wrapped in a clean model method.

```typescript
// From the extension model
async function getVmIpByMac(input, data) {
  const config = await getVmConfig(input, data);
  const mac = parseMacFromNet0(config.net0);
  const arpTable = await queryNodeArp(input);
  return arpTable.find(entry => entry.mac === mac)?.ip;
}
```

Claude ran the method through swamp, got the IPs, SSH'd in, gracefully stopped the game servers, then ran the upgrade through the model. Swamp stored the whole operation in memory at `proxmox-manager/memory/vm-memory-upgrade-2026-02-03.md`.

Both VMs now have more memory. Minecraft and Terraria servers are back up. No data loss.

## The Results

Running the final scan through swamp:

```bash
swamp model method run proxmoxAuth fullInfrastructureScan --json
```

Output:
- 1 node: Intel i5-12600H, 31GB RAM, Proxmox 8.x
- 3 storage pools: local SSD, LVM, NAS mount
- 9 VMs with full configs: disks, NICs, CPU types, everything

All stored as queryable data in swamp's model system. I can now ask Claude questions about my infrastructure and it can query swamp's stored state to answer them.

## What I Learned

**1. Swamp and Claude are complementary**

This isn't "AI did everything." Swamp provides the runtime, CLI, schema validation, state storage, and execution environment. Claude provides code authorship, architectural decisions, and debugging. Neither works without the other. Swamp without Claude is an empty framework. Claude without swamp has no persistent state or execution model.

**2. Extension models are the escape hatch**

When swamp's built-in models don't cover your use case, you can write real TypeScript. Claude used this to handle Proxmox's weird auth flow. Swamp compiles and executes it.

**3. AI-native development fixes bugs in real-time**

Two of the three issues we hit got fixed during the session. That's the pattern: Claude finds an edge case, looks at swamp's code, proposes a fix, we apply it, move on. The framework improves as you use it.

**4. "Build what you need" is the right prompt**

I didn't spec out an API binding library. I said "describe my infrastructure" and Claude figured out what needed to exist, building it through swamp's extension system. Exactly what was required—no more, no less.

## The Pattern

This is what AI-native automation looks like:

1. State a goal
2. Claude checks what exists in swamp
3. Claude builds what's needed, using swamp's extension system
4. Hit limitations—some get fixed immediately, others get workarounds
5. Extend as the task requires more, each method tested via `swamp model method run`

The extension model grew from 3 methods to 8 as we needed deeper infrastructure data. Each addition was driven by an actual need, not speculation about future requirements. Each method is testable in isolation via swamp's CLI.

The full extension is [proxmox_api.ts](ai-native-infrastructure/proxmox_api.ts)—about 1500 lines of TypeScript that Claude wrote to solve a real problem, executed and validated by swamp.

---

*Built with swamp and Claude. Thanks to [Matthew Sanabria](https://matthewsanabria.dev/) for feedback that improved this post.*
