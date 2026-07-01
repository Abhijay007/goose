---
sidebar_position: 5
title: Build an add-on
description: Create a goose Desktop add-on from scratch
---

# Build an add-on

This guide walks through creating a minimal add-on with a chat action button.

## 1. Create the folder

```text
my-addon/
  client-extension.json
  index.html
```

## 2. Write the manifest

```json
{
  "id": "my-addon",
  "version": "0.1.0",
  "engines": {
    "grc": ">=1.40.0"
  },
  "main": "index.html",
  "contributes": {
    "chatActions": [
      {
        "id": "greet",
        "label": "Greet"
      }
    ]
  }
}
```

## 3. Write the HTML entry

```html
<!doctype html>
<html lang="en">
  <body>
    <script>
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || data.type !== "grc/action") return;

        if (data.actionId === "greet") {
          window.parent.postMessage(
            { type: "grc/ui/showMessage", text: "Hello from my add-on!" },
            "*"
          );
        }
      });
    </script>
  </body>
</html>
```

## 4. Install in Desktop

1. Open goose Desktop → **Add-ons**
2. Click **Install add-on** and select your `my-addon` folder
3. Enable the add-on
4. Open a chat — you should see the **Greet** button

## 5. Try other extension points

Copy patterns from the repo examples:

| Example | Extension points |
|---------|------------------|
| `hello-chat-action` | chatAction |
| `hello-page` | rootLink |
| `hello-sidecar` | sidecar |
| `message-decorations` | contentSuffix, customRender |

Browse them in the [add-ons marketplace](/add-ons) or under `examples/client-extensions/` in the repo.

## 6. Submit to the marketplace

To list your add-on on [goose-docs.ai/add-ons](/add-ons):

1. Add an entry to `documentation/static/add-ons.json` (alphabetical by `id`)
2. Open a PR with your add-on source (or a link to your repository)
3. Follow [CONTRIBUTING_ADDONS.md](https://github.com/aaif-goose/goose/blob/main/CONTRIBUTING_ADDONS.md)

## Further reading

- [Manifest reference](/docs/guides/add-ons/manifest-reference)
- [Host protocol](/docs/guides/add-ons/host-protocol)
- [Install and manage](/docs/guides/add-ons/install-and-manage)
