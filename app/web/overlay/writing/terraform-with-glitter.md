---
title: HashiCorp’s “AI Agents” Are Just Terraform With Glitter 
date: 2025-09-25 
tags:
  - iac
  - terraform
  - ai
---

HashiCorp [wants you to believe something significant happened](https://newsroom.ibm.com/2025-09-25-hashicorp-previews-the-future-of-agentic-infrastructure-automation-with-project-infragraph) at [HashiConf](https://www.hashicorp.com/en/conferences/hashiconf) this week. They rolled out `Project Infragraph,` promised AI agents, and sprinkled their Cloud Platform with new integrations and beta servers. It sounds promising, until you scratch the surface.

Here’s the truth: this isn’t a revolution. It’s Terraform and Vault with AI glitter on top. You're still stuck with the same drift. Same brittle state files. Same pipelines that crack the moment reality changes in the cloud console. Same shit developers hate to read and write.

And that’s the fundamental problem: they can’t afford to kill the very pain that keeps their ecosystem alive. Instead, they rebrand the scaffolding and hope no one notices.


# Old Problems in New Packaging
Take a close look at the announcement:

* **AI agents to provision IaC.** Translation: a chatbot that writes Terraform. If `AI writes YAML` sounded tired two years ago, `AI writes HCL` isn’t progress, it’s parody.
* **MCP server for accessibility**. A beta shim that allows external AI tools poke at an API is not “AI-native.” It’s a patch.
* **A promise of Integrations with Ansible, Red Hat, AWS, Microsoft.** Great, more layers of duct tape. More places to break. More complexity disguised as an ecosystem.


Every one of these `innovations` has the same flaw: they depend on a foundation that was never designed for AI, never designed for real-time simulation, and never designed for modern, collaborative infrastructure work.

# There are better tools

[System Initiative](https://systeminit.com) has already shipped what they wish they could build:
* No drift because we model your system as a digital twin and allow you to reconcile between your intent and real-world seamlessly.
* Safe simulation before anything touches prod.
* Day 2 operations are treated as first-class, not afterthoughts.
* AI that’s actually trustworthy because policy is baked into the foundation, not bolted on in beta.


If you actually want to see what automation looks like when you build for AI from day one, it’s already here. You don’t need duct tape. You don’t need glitter. You need a new foundation.


# So let’s call it what it is
The difference couldn’t be clearer:
* HashiCorp is reselling the same old toolchain. System Initiative is redefining the category.
* For them, AI is a gimmick. For us, AI is the foundation.
* They’re trapped in the past. We’re building what comes next.

The real surprise isn’t that HashiCorp is trying to cash in on AI hype. The real surprise is that once you’ve seen System Initiative in action, you’ll wonder why you ever put up with Terraform glitter in the first place.

