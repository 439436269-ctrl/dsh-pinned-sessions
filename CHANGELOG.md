# Changelog

All notable changes to this plugin. Dates are the local (Asia/Shanghai) day the
change was verified on DSH Desktop 0.2.0-rc.2.

## 0.4.0 — 2026-10-07

Read the other plugin that shares this feature space — [TianYa-DAO/dsh-pinned-sessions](https://github.com/TianYa-DAO/dsh-pinned-sessions)
(npm `dsh-pinned-sessions`, unrelated to this package) — and adopted the ideas that
held up, keeping the native pin as the single source of truth.

- **The group now lives inside the native list's own scroll container**, as its
  first item, instead of floating above the whole browser. It sits directly under
  the 「工作区」 header like any other group, shares the list's single scrollbar, and
  can no longer squeeze the native list when many sessions are pinned.
- **It steps aside while the native list shows search results**, so a floating
  group never covers them.
- **Rows carry the owning workspace** (`默认工作区`) next to the title — the
  reference's most useful addition for a cross-workspace list. The relative time
  moves into the row tooltip, and the redundant per-row pin marker is gone (every
  row in this group is pinned); the header keeps the outline pin.
- **Status dots come from the real session-status hook** (`useSessionStatus`):
  running (blue) and finished-but-unopened (green). Without the hook the row falls
  back to the summary's own `running` flag.
- **A Settings → 通用 switch** (「置顶会话区」) turns the group off without editing
  files; it shares one preference source with the mount, so the two can never
  disagree.
- The mount revalidates on an interval as well as on DOM mutations, so it
  recovers if the native tree is swapped without a mutation the observer sees.

Deliberately **not** adopted: a second, plugin-owned pin state (the reference's
「全局置顶」). This plugin writes the native pin instead — one concept, Host-persisted,
shared with the built-in pin UI — and does not reorder or hide native rows.

## 0.3.1 — 2026-10-07

- Documentation-only release: the published 0.3.0 tarball still carried the 0.3.0
  draft of this file (its entry said the rendering behaviour was unchanged), so the
  npm artifact described one release behind what it actually shipped. No behaviour
  change: `lib/client.js` differs only in the version constant the header chip
  prints, and `lib/index.js`, `cordis.patch.yml` and `LICENSE` are byte-identical to
  0.3.0.
- The READMEs' chip examples were refreshed from `v0.3.0` to `v0.3.1`.
- Listed in the community directory: a pull request adding
  `data/plugins/439436269-ctrl__dsh-pinned-sessions.yml` to
  [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin).

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
- The group header now carries the plugin's **npm identity** — a muted
  `dsh-pinned-sessions v0.3.0` chip linking to this package's npm page
  (`target="_blank"` + `rel="noopener noreferrer"`; the desktop shell routes it
  through `shell.openExternal`). It shows the unscoped short name because the
  sidebar is 256px wide; the full scoped name lives in the tooltip and
  `aria-label`. Clicking it never toggles the group. Six new self-checks (58 → 64)
  bind the chip's text and `href` to `package.json`, so a version bump that forgets
  `lib/client.js` fails the suite instead of shipping a stale chip.
- First npm publication: `@vfvrpq/dsh-pinned-sessions@0.3.0`
  (`dist.shasum 3c0e1f80b6a2634b58b84cee4604656233c1638f`).

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
