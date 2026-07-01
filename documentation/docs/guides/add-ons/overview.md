---
sidebar_position: 1
title: Overview
description: What add-ons are and how they extend goose Desktop
---

# Add-ons overview

Add-ons let you extend **goose Desktop** with custom UI that loads outside the main app bundle. Each add-on is a folder with a `client-extension.json` manifest and an HTML entry point.

Add-ons are **not** MCP Extensions:

| | Add-ons (GRC) | MCP Extensions |
|---|---------------|----------------|
| **Purpose** | Custom Desktop UI | Tools, prompts, resources for the agent |
| **Runs in** | Sandboxed iframe in Desktop | MCP server process |
| **Managed from** | Add-ons sidebar page | Extensions page / CLI |
| **Install location** | `~/.agents/client-extensions/` | goose config / extensions list |

## Extension points

Add-ons register into fixed UI slots:

- **chatAction** — buttons in the chat input bar
- **rootLink** — sidebar entries that open a full-page view
- **sidecar** — optional right-side panel on chat routes
- **contentSuffix** — extra UI below a specific message
- **customRender** — replace how matched message content renders (for example a JSON preview)

## Isolation and safety

- Add-ons run in sandboxed iframes (`allow-scripts` only)
- Invalid manifests are skipped at discovery time
- Disabled add-ons are removed from all slots without uninstalling
- Failed add-ons fail open — the rest of Desktop keeps working

## Where add-ons live

Installed add-ons:

```text
~/.agents/client-extensions/<id>/
  client-extension.json
  index.html
  ...
```

Enable/disable state is stored in:

```text
~/.agents/client-extensions/config.json
```

When running goose Desktop from source, example add-ons under `examples/client-extensions/` are discovered as **dev examples** and are opt-in from the Add-ons page.

## Next steps

- [Install and manage add-ons](/docs/guides/add-ons/install-and-manage)
- [Browse example add-ons](/add-ons)
- [Build an add-on](/docs/guides/add-ons/build-an-add-on)
