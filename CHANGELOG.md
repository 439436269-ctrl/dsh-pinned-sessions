# Changelog

All notable changes to this plugin. Dates are the local (Asia/Shanghai) day the
change was verified on DSH Desktop 0.2.0-rc.2.

## 0.3.0 — 2026-10-06

- **Renamed to `@vfvrpq/dsh-pinned-sessions`.** The unscoped name
  `dsh-pinned-sessions` is held on npm by an unrelated plugin by another author
  (`tianya-dao`, which reorders sessions by run state). The plugin identity, the
  bundle patch row name, the client bundle id, the CSS/dataset tags, the
  localStorage key and the docs all moved to the scoped name in one pass. The
  loader row `id` stays `dsh-pinned-sessions` — it is a purely local identifier.
- Added `publishConfig.access = "public"` so the scoped package publishes
  publicly without a flag.
- The self-check no longer requires a DSH profile: it looks for React in the
  profile first, then in this package's own `node_modules`, so `npm i && npm test`
  works in CI. Added `devDependencies.react` for that path.
- Rendering behaviour is unchanged in this release.

## 0.2.2 — 2026-10-06

- Fixed the group header's collapse arrow pointing the wrong way. The upstream
  convention (`@deepseek-ai/dsh-client-ui-workspace`'s `Rows.module.css`) applies
  `.arrowOpen{transform:rotate(90deg)}` when the group is **expanded**; this plugin
  had it on the collapsed state.

## 0.2.1 — 2026-10-06

- The header glyph switched from a filled pin to the **outline** pin, matching the
  line-icon style of the sidebar entries above it (插件 / 自动化任务). A row's own
  pin marker stays filled, keeping "state" distinct from "navigation".
- Added an in-place **search** to the group header: title match, case-insensitive,
  surrounding whitespace ignored. Opening it expands the group; Esc or a second
  click closes it and clears the query; the count reads `matched/total` while
  filtering; a query with no match gets its own line, distinct from the
  "nothing pinned yet" hint.

## 0.2.0 — 2026-10-05

- Rewritten as an **inline group** above the Workspace browser: the host node is
  inserted as the previous sibling of `div[data-slot="sidebar.workspaces"]` and the
  section is portalled into it, so nothing is ever written into the native
  component's DOM subtree. Registers exactly one slot (`shell.overlay`).
- Adds no state of its own: it reads `sessions.list` / `workspaces.list` and writes
  through `workspaces.pinSession` / `unpinSession`.

## 0.1.0 — 2026-10-05

- First cut: a `sidebar.panellist` entry (order 20) opening a `main` panel with the
  global pinned list. Superseded by 0.2.0 after the feedback that it should read
  like a Workspace group.
