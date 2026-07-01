# Contributing add-ons to the marketplace

Add-ons extend **goose Desktop** UI. The marketplace lives at https://goose-docs.ai/add-ons and is backed by `documentation/static/add-ons.json`.

This is separate from MCP Extensions (`documentation/static/servers.json`).

## Before you submit

- Your add-on must include a valid `client-extension.json` and `main` HTML entry
- Test install via goose Desktop → Add-ons → Install add-on
- Confirm `engines.grc` matches the minimum Desktop version you support
- Add-ons must be augment-only UI — no access to the host filesystem or Node APIs beyond the documented postMessage protocol

## Add a marketplace entry

Edit `documentation/static/add-ons.json` and add an object (keep entries sorted by `id`):

```json
{
  "id": "my-addon",
  "name": "My Add-on",
  "description": "One sentence describing what it does.",
  "version": "0.1.0",
  "link": "https://github.com/you/my-addon",
  "source_path": "my-addon",
  "is_example": false,
  "endorsed": false,
  "contributions": ["chatAction", "rootLink"],
  "installation_notes": "Clone the repo, then use Add-ons → Install add-on in goose Desktop.",
  "engines": {
    "grc": ">=1.40.0"
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `id` | Must match manifest `id` |
| `name` | Display name |
| `description` | Short summary for the marketplace card |
| `version` | Current version |
| `link` | Source repository or folder URL |
| `source_path` | Path hint inside the repo (for examples) |
| `is_example` | `true` for goose repo examples under `examples/client-extensions/` |
| `endorsed` | `true` if reviewed by the goose team |
| `contributions` | Extension points used: `chatAction`, `rootLink`, `sidecar`, `contentSuffix`, `customRender` |
| `installation_notes` | How to install in Desktop |
| `engines.grc` | Minimum goose Desktop version |

## Include example add-ons in the repo

To add a reference implementation:

1. Create `examples/client-extensions/<your-addon>/` with manifest + HTML
2. Add a README with try-it steps
3. Add a marketplace entry with `"is_example": true`
4. Document any new `when` clauses or protocol messages in the guides under `documentation/docs/guides/add-ons/`

## Pull request checklist

- [ ] `client-extension.json` validates against the [manifest reference](https://goose-docs.ai/docs/guides/add-ons/manifest-reference)
- [ ] Tested in goose Desktop (install, enable, disable, uninstall)
- [ ] Entry added to `documentation/static/add-ons.json`
- [ ] No secrets or hard-coded tokens in the add-on bundle

## Related docs

- [Add-ons guide](https://goose-docs.ai/docs/guides/add-ons/)
- [Build an add-on](https://goose-docs.ai/docs/guides/add-ons/build-an-add-on)
- [MCP extension contributions](https://goose-docs.ai/docs/tutorials/custom-extensions) — for agent tools, not Desktop UI
