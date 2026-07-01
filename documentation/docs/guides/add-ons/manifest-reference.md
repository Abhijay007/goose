---
sidebar_position: 3
title: Manifest reference
description: client-extension.json schema for goose Desktop add-ons
---

# Manifest reference

Each add-on folder must contain `client-extension.json` at its root.

## Minimal example

```json
{
  "id": "my-addon",
  "version": "0.1.0",
  "main": "index.html",
  "contributes": {
    "chatActions": [
      {
        "id": "hello",
        "label": "Hello"
      }
    ]
  }
}
```

## Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique add-on id. Should match the install folder name. |
| `version` | yes | Semver string for display |
| `main` | yes | HTML entry relative to the add-on root |
| `engines.grc` | no | Minimum goose Desktop version (for example `>=1.40.0`) |
| `contributes` | no | Extension point declarations |

## Extension points

### chatActions

Buttons in the chat input bar.

```json
"chatActions": [
  {
    "id": "hello",
    "label": "Hello",
    "when": "session.active"
  }
]
```

### rootLinks

Sidebar pages under **Add-on pages**.

```json
"rootLinks": [
  {
    "id": "home",
    "label": "My Page",
    "when": "route.pair"
  }
]
```

Route: `/ext/<extensionId>/<viewId>`

### sidecars

Right-side panel on matching routes.

```json
"sidecars": [
  {
    "id": "session-info",
    "label": "Session",
    "defaultOpen": false,
    "when": "route.pair"
  }
]
```

### contentSuffixes

Extra UI rendered below a message.

```json
"contentSuffixes": [
  {
    "id": "image-badge",
    "when": "message.hasImage"
  }
]
```

### customRenders

Replace native rendering for matched message content.

```json
"customRenders": [
  {
    "id": "json-preview",
    "match": {
      "contentType": "code",
      "language": "json"
    },
    "display": "inline",
    "priority": 10,
    "when": "message.role.assistant"
  }
]
```

When a custom render matches, goose removes the matched code fence from the main markdown body and renders the add-on iframe instead.

## When clauses

Optional `when` on any contribution. Empty or omitted means always visible (subject to enable/disable).

### Session and route

| Clause | Meaning |
|--------|---------|
| `session.active` | A chat session is open |
| `!session.active` | No active session |
| `route.pair` | Current route is the chat view |

### Message (contentSuffix / customRender)

| Clause | Meaning |
|--------|---------|
| `message.hasText` | Message has text content |
| `message.hasImage` | Message has image attachments |
| `message.hasToolRequests` | Message includes tool calls |
| `message.role.user` | User message |
| `message.role.assistant` | Assistant message |
| `message.codeLanguage.json` | Message contains a `json` code block |

Unknown clauses default to visible and log a warning in the developer console.

## Discovery rules

1. Scan `~/.agents/client-extensions/<id>/` for installed add-ons
2. When running from source, also scan `examples/client-extensions/` as dev examples
3. Skip entries with invalid manifests or missing `main` files
4. Skip add-ons whose `engines.grc` requirement is not satisfied
5. Installed copy wins over dev example with the same id

## Config file

`~/.agents/client-extensions/config.json`:

```json
{
  "disabled": ["addon-id"],
  "enabledDev": ["hello-page"]
}
```

- Installed add-ons are enabled by default unless listed in `disabled`
- Dev examples are disabled by default unless listed in `enabledDev`
