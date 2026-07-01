---
sidebar_position: 4
title: Host protocol
description: postMessage API between goose Desktop and add-on iframes
---

# Host protocol

goose Desktop loads add-on UI in sandboxed iframes and communicates via `window.postMessage`.

## Host → add-on messages

### grc/action

Sent when the user clicks a chat action button.

```json
{
  "type": "grc/action",
  "actionId": "hello",
  "context": {
    "sessionId": "abc-123",
    "route": "/pair"
  }
}
```

### grc/activate

Sent when a root link page or sidecar iframe loads.

```json
{
  "type": "grc/activate",
  "viewId": "home",
  "viewKind": "rootLink",
  "context": {
    "sessionId": null,
    "route": "/ext/hello-page/home"
  }
}
```

`viewKind` is `rootLink` or `sidecar`.

### grc/render

Sent when a message decoration slot should render.

```json
{
  "type": "grc/render",
  "slotId": "json-preview",
  "slotKind": "customRender",
  "context": {
    "sessionId": "abc-123",
    "route": "/pair",
    "messageId": "msg-1",
    "role": "assistant",
    "hasText": true,
    "hasImage": false,
    "hasToolRequests": false,
    "codeLanguages": ["json"]
  },
  "payload": {
    "textPreview": "Here is the result...",
    "codeBlocks": [
      { "language": "json", "content": "{\"ok\": true}" }
    ],
    "matchedLanguage": "json"
  }
}
```

## Add-on → host messages

### grc/ui/showMessage

Show a toast in Desktop.

```json
{ "type": "grc/ui/showMessage", "text": "Done!" }
```

### grc/chat/setInput

Set the chat input text (chat actions only).

```json
{ "type": "grc/chat/setInput", "text": "Hello goose" }
```

### grc/resize

Set iframe height for message decoration slots.

```json
{ "type": "grc/resize", "height": 120 }
```

Height is clamped to 480px.

## Example listener

```javascript
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "grc/render") return;

  if (data.slotKind === "contentSuffix") {
    document.body.textContent = "Badge for this message";
    window.parent.postMessage({ type: "grc/resize", height: 28 }, "*");
  }
});
```

See `examples/client-extensions/` in the goose repo for working implementations.
