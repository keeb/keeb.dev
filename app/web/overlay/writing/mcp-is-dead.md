---
title: MCP Is Dead
date: 2026-02-03
tags:
  - ai
  - automation
  - swamp
  - mcp
---

MCP is a protocol designed by humans to grant AI controlled access to capabilities. It assumes the human is the architect and the AI is the consumer. Every tool definition, every resource schema, every prompt template—written and maintained by humans, for AI to consume.

This is backwards.

## The Assumption

Anthropic released MCP (Model Context Protocol) as a way to give AI models access to external tools and data sources. The pitch: standardize how AI connects to capabilities, and you'll get an ecosystem of reusable integrations. Write a tool definition once, use it everywhere.

The implicit assumption is that AI needs to be spoonfed. That you, the human, must carefully craft JSON schemas describing what a tool does, what parameters it takes, what it returns. You maintain these definitions. You version them. You publish them for AI to discover and consume.

MCP asks: "How do we safely expose capabilities to AI?"

Wrong question.

## The Inversion

I've been building [swamp](https://github.com/keeb/swamp), an AI-native automation framework. The design started from a different premise: what if AI could create and extend its own models of external systems?

Here's how it works. Swamp has a type system for modeling external APIs and CLIs. A type like `AWS::EC2::VPC` or `proxmox/api` defines what attributes a thing has, what methods you can call on it, what data it produces. Types have Zod schemas for validation, methods that execute against real systems, and persistent storage for the data they produce.

The key insight: Claude can write these types.

When I needed Proxmox integration for swamp, there was no Proxmox model. No MCP tool definition to import. So Claude read the Proxmox API documentation, looked at swamp's extension model system, and [built what was needed](/2026/02/03/ai-native-infrastructure/). It wrote the TypeScript. It defined the schemas. It implemented the auth flow (Proxmox uses this weird ticket-based system with CSRF tokens). It ran `swamp model method run` to test each method. It stored infrastructure state in swamp's data system.

Claude didn't consume a tool definition. It wrote one.

## Why This Matters

MCP requires a human intermediary. Someone has to:

1. Understand the external system (AWS, GitHub, Proxmox, whatever)
2. Write a tool definition that captures the relevant capabilities
3. Maintain that definition as the external system changes
4. Publish it somewhere AI can discover it

That's a lot of human effort to give AI access to something AI could just... learn directly.

With swamp, the workflow is different:

1. I say "describe my Proxmox infrastructure"
2. Claude checks what swamp models exist
3. Claude reads the Proxmox API docs
4. Claude creates a swamp extension model
5. Claude tests it with `swamp model method run`
6. Claude stores the results in swamp's data system

No human writing tool definitions. No protocol negotiation. No JSON-RPC overhead. Claude reads documentation the same way a human would, then writes code the same way a human would. Swamp provides the runtime, validation, and persistence. Claude provides the understanding.

## The Runtime Question

Here's what MCP gets wrong at a fundamental level: it treats AI as a tool consumer rather than a tool author.

MCP's architecture:

```
Human defines tool → Protocol serializes → AI consumes → AI calls
```

Swamp's architecture:

```
AI understands domain → AI creates model → AI uses model → AI evolves model
```

Swamp cuts out the human-as-tool-definer middleman.

This isn't theoretical. When we hit limitations during the Proxmox work, Claude didn't wait for someone to fix an MCP tool definition. It extended the model. Added `getVmIpByMac` when the guest agent approach didn't work. Added `fullInfrastructureScan` when we needed deeper data. Each addition tested through swamp's CLI, validated against the real system, stored for later use.

The model grew from 3 methods to 8 as we needed them. Driven by actual requirements, not speculative API coverage.

## The Memory Problem

MCP tool calls are ephemeral. You call a tool, you get a result, it's gone. There's no built-in persistence, no versioning, no way to query past invocations.

Swamp stores everything. The `.swamp/` directory is AI's memory. Model definitions live in `.swamp/definitions/`. Method outputs go to `.swamp/outputs/`. Data—versioned, immutable, tagged—lives in `.swamp/data/`. I can ask Claude questions about my infrastructure and it can query swamp's stored state to answer them.

This isn't just convenience. It's a fundamentally different model of how AI interacts with external systems. MCP treats each tool call as a discrete event. Swamp treats them as part of an ongoing, persistent understanding of the world.

## The Investment Question

Why would a technology company invest in MCP tooling?

They'd need to:
- Write and maintain tool definitions
- Keep them in sync with their actual APIs
- Publish them in formats AI can discover
- Handle versioning as both their APIs and MCP evolve

Or they could just... have good documentation. Claude can read their API docs, create a swamp model, validate it against their actual system, store versioned data about interactions, and evolve its understanding over time.

MCP is a layer of indirection that assumes AI needs to be carefully guided through tool access. But AI can read documentation. AI can write code. AI can test against real systems. AI can maintain and evolve its own models.

What exactly is MCP buying you?

## The Counter-Argument

The obvious pushback: "But MCP provides safety guarantees! Humans need to approve tool definitions!"

Sure. And swamp has that too. Model types go through validation. Methods execute in controlled environments. The human is still in the loop—they're just not writing JSON schemas by hand.

The safety argument for MCP assumes that human-authored tool definitions are inherently safer than AI-authored ones. I'm not convinced. Claude writing a Proxmox model and testing it with `swamp model method run` is arguably more rigorous than a human writing a tool definition and hoping they got the parameters right.

## Training Wheels

MCP is training wheels. It's how you'd design AI tool access if you assumed AI couldn't be trusted to understand external systems on its own. You'd carefully craft definitions, limit what AI can see, and maintain everything by hand.

Swamp is the bike. It assumes AI can read documentation, write code, test against real systems, and evolve its understanding over time. The human provides goals and oversight. The AI provides implementation.

I'm not saying MCP is useless. For simple, stable integrations where you want explicit human control over every capability, it's fine. But as AI gets better at understanding systems directly, the value proposition of hand-crafted tool definitions diminishes.

The future isn't humans writing tool definitions for AI to consume. It's AI building its own understanding of the systems it needs to interact with, with humans providing goals and guardrails.

MCP is a solution to a problem that's becoming less relevant every day.

---

*[Swamp](https://github.com/keeb/swamp) is open source. The Proxmox integration described here was built entirely by Claude using swamp's extension model system.*
