---
name: Deploy job trigger preference
description: The deploy job must be manually triggered, not automatic on push to master
type: feedback
---

The GitHub Actions deploy job must be triggered manually (workflow_dispatch), not automatically on push to master.

**Why:** User explicitly stated this preference — deployments should be intentional, not automatic.

**How to apply:** Use `workflow_dispatch` event trigger for any deploy job. Never wire deploys to `push` or `pull_request` events automatically.
