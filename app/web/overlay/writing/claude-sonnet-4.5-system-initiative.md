---
title: Using Claude Sonnet 4.5 with System Initiative
date: 2025-09-29
tags:
  - ai
  - automation
  - claude
---

Anthropic just dropped [Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5) with bold claims about being their "best coding model" and having "30+ hour focus." Time to stress-test those claims with [System Initiative](https://systeminit.com), where AI mistakes don't just break code, they break production infrastructure.

System Initiative isn't just another infrastructure-as-code tool. It's AI-native infrastructure automation that translates natural language into precise infrastructure changes. 

> "We need to update the load balancers to be more aggressive with their health checks"

The AI agent figures out exactly what needs to change, validates it against policies, and proposes the modifications for human review.

The promise is compelling: infrastructure management that amplifies human intent rather than requiring you to learn another domain-specific language.

# The problem with traditional infrastructure

Most infrastructure tools require you to think like the computer: 
- Write YAML
- Understand resource dependencies  
- Debug cryptic error messages

System Initiative flips this. You describe what you want in natural language, and the AI handles the translation to infrastructure reality.

This can only happen if your AI agent is good. Really good. It's doing the hardest part of infrastructure work: understanding intent, modeling complex systems and their relationships, and generating safe changes.

# Why Claude Sonnet 4.5 matters

Anthropic claims Claude Sonnet 4.5 is their *"best coding model"* and *"strongest model for building complex agents."* More importantly, it can:

> **"maintain focus for over 30 hours on complex tasks"** 

Exactly what you need when an AI is managing your production infrastructure.

System Initiative's approach only works if the underlying AI can work collaboratively with a deterministic tool to understand nuanced infrastructure requirements, reason about complex system dependencies, generate safe validated changes, and debug failures while adapting accordingly.

# The experiment

I tested Claude's ability to work with System Initiative across three scenarios that mirror real infrastructure work:

1. **Intent translation** - Converting business requirements to infrastructure changes
2. **Complex operations** - Managing multi-service deployments with dependencies  
3. **Incident response** - Debugging production issues and proposing fixes

## Session 1: Intent translation

Started with a realistic scenario:

> "Our application is getting slow during peak traffic. We need better load balancing and auto-scaling to handle the load."

Claude broke this down systematically. It analyzed current infrastructure topology in System Initiative's graph model, identified bottlenecks in the existing load balancer configuration, and proposed specific changes: health check intervals, scaling policies, connection limits. Finally, it generated a change set that addressed the root performance issues.

Claude's ability to reason about the infrastructure holistically was notable. Rather than just suggesting more servers, it identified that:
- Health checks were too conservative, causing slow failover
- Auto-scaling policies weren't responsive enough to traffic spikes

## Session 2: Complex operations 


Next up, managing user access across multiple services. System Initiative provides high fidelity models for your favorite tools - AWS, Tailscale, PostHog, Hubspot, and other services through a unified interface.

Claude excelled at this complexity. Given a request like:

> "Remove Sarah from the engineering team and revoke her access"

Claude could query the unified graph to find all of Sarah's access points, instruct System Initiative to take action across a number of services, create comprehensive change sets with proper sequencing, and build audit trails for compliance.

Watch John Watson do it. It's pretty cool.
<iframe width="560" height="315" src="https://www.youtube.com/embed/qEwlU27Q_nE?si=toVuVNcH_VH6dxH7" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>


## Session 3: Incident response

One of my colleagues noticed an endpoint was returning a 503 in a staging environment. 
From a blank workspace, the System Initiative AI Agent needed to discover and analyse 603 AWS components to figure this problem out. It's now been fixed in **~15 minutes** after having spend more than 2 hours trying to fix it the week before.

```
Fixed 503 Error - Summary

Problem: Frontend /v1/traces returning 503 errors

Root Causes:
1. Target group health checks wrong - Fixed port 4318→13133, expect 200 not 404
2. ECS containers crash-looping - Bad image with deprecated logging exporter
3. Zero healthy targets - No containers registering with load balancer

Solution:
- Updated task definition to working image digest (sha256:3ea9da00...)
- Fixed health check configuration (port 13133, HTTP 200)
- Updated ECS service to deploy new task definition
- Added security group rule for health check port

Result: Containers start successfully, pass health checks, register with ALB, telemetry endpoint works
```

# The bigger pattern and why it matters

**System Initiative + Claude** represents something new in infrastructure automation. Instead of forcing humans to think like computers, it lets computers understand human intent and translate that to infrastructure reality.

Infrastructure work has always been bottlenecked by **the gap between what we want to accomplish and the complexity of actually implementing it**. The barrier to adoption is too high; DevOps practitioners need to be continuously learning new tools and ecosystems... developers want nothing to do with it.

System Initiative **inverts this relationship**. The result isn't just *faster* infrastructure work - it's **more accessible** infrastructure work, collaboratively, with experts, safely.

# Conclusion

Claude Sonnet 4.5's capabilities **align remarkably well** with System Initiative's AI-native approach. The combination creates infrastructure automation that feels genuinely different:
- More intuitive
- More accessible  
- Still rigorous and safe

It's not *replacing* infrastructure expertise, it's **amplifying** it. When both sides do what they're best at, infrastructure work becomes **more effective**.

System Initiative's bet on AI-native infrastructure automation is paying off, especially with models like Claude Sonnet 4.5 that can reason about complex systems and maintain focus on long-running tasks.

Sometimes the right AI doesn't just make hard problems easier, it makes them fundamentally different.
