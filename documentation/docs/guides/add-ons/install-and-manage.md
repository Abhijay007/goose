---
sidebar_position: 2
title: Install and manage
description: Install, enable, disable, and uninstall add-ons in goose Desktop
---

# Install and manage add-ons

All add-on management happens in **goose Desktop → Add-ons** in the sidebar.

## Install an add-on

1. Open **Add-ons**.
2. Click **Install add-on**.
3. Select a folder that contains `client-extension.json`.
4. Enable the add-on with the toggle if it is not already enabled.

The add-on is copied to `~/.agents/client-extensions/<id>/`.

You can also install from the [add-ons marketplace](/add-ons) by cloning or downloading an add-on folder, then using **Install add-on**.

## Enable and disable

Use the toggle on each add-on card. Disabled add-ons stay installed but do not contribute UI slots.

Changes apply immediately — nav links, chat actions, sidecars, and message decorations update without restarting the app. Use **Reload** if you changed files on disk.

## Uninstall

For **Installed** add-ons, click **Uninstall** on the card and confirm. This deletes the folder from `~/.agents/client-extensions/`.

**Dev examples** (when running from source) cannot be uninstalled from disk — disable them instead.

## Dev examples from the repo

When you run goose Desktop from a local checkout, add-ons in `examples/client-extensions/` appear as **Dev example**. They are **off by default**. Enable the ones you want to try from the Add-ons page.

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Add-on does not appear | Check manifest id, `main` path, and `engines.grc` version |
| Slot missing after enable | Click Reload; confirm `when` clause matches current route/session |
| Page route broken after disable | goose navigates back to chat automatically |
| Install fails “already installed” | Uninstall the existing copy or pick a different id |

See the [manifest reference](/docs/guides/add-ons/manifest-reference) for schema details.
