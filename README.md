# dsh-pinned-sessions

> npm package: **`@vfvrpq/dsh-pinned-sessions`** · repo: `dsh-pinned-sessions`
>
> A **pinned-session group in the sidebar** for DeepSeek Harness: 「置顶」 sits where
> a Workspace group sits — a 34px header with an **outline** pin glyph, a count and
> a search button, and 32px session rows under it for every pinned session, across
> all workspaces. Pin enough of them and you can search right there.

[English](README.md) | [中文](README.zh.md)

## What it does

DSH already pins sessions (hover a row → pin glyph, or right-click → 「置顶会话」),
but the result is only a re-order **inside that session's own workspace group**: a
pinned session still scrolls away when you switch workspaces, collapse groups, or
drown in a long list.

This plugin gives the pinned set its own group, above the Workspace browser:

```
插件
自动化任务
置顶  1  dsh-pinned-sessions v0.3.1  🔍   ← this plugin
   插件笔记：dsh-cost-…   4 小时前
工作区
默认工作区
   新会话
   …
```

With the search open (the count becomes `matched/total`):

```
置顶  1/3  dsh-pinned-sessions v0.3.1  ✕
   [ 搜索置顶会话              ]
   插件笔记：dsh-cost-…   4 小时前
```

- rows are drawn with the **native session-row metrics** (32px rows, 14px titles,
  10px relative times, the same hover wash and hover-revealed actions), so the
  group is visually indistinguishable from a workspace group;
- the header carries the plugin's **npm identity** — `dsh-pinned-sessions v0.3.1` —
  as a muted chip that links to
  [`@vfvrpq/dsh-pinned-sessions`](https://www.npmjs.com/package/@vfvrpq/dsh-pinned-sessions)
  on npm (`target="_blank"`; the desktop shell turns that into `shell.openExternal`,
  so it opens in your browser instead of inside the app). The chip shows the
  **unscoped** name because the sidebar is 256px wide; its tooltip/aria-label carry
  the full scoped name, and clicking it never toggles the group;
- the header's **outline** pin matches the line-icon style of the sidebar entries
  above it (插件 / 自动化任务); a row's own pin marker stays filled, keeping
  "state" distinct from "navigation";
- clicking a row opens that session; hovering one reveals 「取消置顶」;
- the header's 🔍 filters this group in place: title match, case-insensitive,
  surrounding whitespace ignored; opening the search expands the group, and Esc or
  a second click closes it and clears the query; a query with no match gets its own
  line, distinct from the "nothing pinned yet" hint;
- the header is a disclosure control — click to collapse, and the choice survives
  reloads. When nothing is pinned the group shows a one-line hint instead of rows;
- running sessions keep the native state dot; archived pins are hidden with a
  count note; subagent sessions never appear.

It owns **no new state**: pinning is the Host capability the native Workspace
browser already ships (`dsh-api-workspace-controller` → `workspaces.pinSession` /
`unpinSession`, persisted in the `workspace` storage unit), so the sidebar and the
group always agree — pin with either one and the other updates immediately.

## How it is mounted

The sidebar's browsing region between the global panel rows and the foot is
declared as **one `single` slot** (`sidebar.workspaces`) owned by
`@deepseek-ai/dsh-client-ui-workspace`, and it exposes no "extra group" seat:

| seat | owner | what it holds |
| --- | --- | --- |
| `sidebar.panellist` (list) | ui-sidebar | the global panel rows (插件, 自动化任务, …) — a row is a button, not a group |
| `sidebar.workspaces` (single) | ui-workspace | the whole browsing region: header, search, tree, menus |

Shadowing `sidebar.workspaces` would mean reimplementing the entire browser
(search, flat/grouped views, drag ordering, menus, hover cards, archive flow), so
instead this plugin mounts **next to the renderer's own outlet anchor**
(`div[data-slot="sidebar.workspaces"]`, `display: contents`) as its previous
sibling inside the region, and portals the group into that host node:

- nothing is ever inserted into the native component's DOM subtree;
- the host node is `flex: none`, so the native browser keeps `flex: 1` and simply
  gets a little less height — the pinned group stays put while the list scrolls;
- the anchor is re-resolved through a throttled `MutationObserver`, so the group
  survives re-renders and sidebar collapse/expand;
- if the anchor ever disappears (a future DSH changes the sidebar), the plugin
  renders nothing instead of breaking anything.

## Install

```sh
dsh plugin --profile <your-profile> add @vfvrpq/dsh-pinned-sessions
```

The package is dual-face (`dsh.bundle.patch` + `dsh.client`): the Loader row
brings up the no-op Host half, and the browser half arrives through
`exports["./client"]`.

### Local development (this checkout)

```sh
cd ~/.dsh/profiles/desktop
# 1) make the package resolvable (pnpm hard-links a directory dependency, so a
#    symlink keeps edits live). The install name comes from the package's own
#    package.json, so a scoped package lands under node_modules/@vfvrpq/:
pnpm add file:/path/to/dsh-pinned-sessions     # or hand-edit package.json
ln -sfn /path/to/dsh-pinned-sessions node_modules/@vfvrpq/dsh-pinned-sessions
# 2) activate the row in your own patch layer (hot: the loader watches it)
cat >> cordis.patch.yml <<'YAML'
- insert:
    - id: dsh-pinned-sessions
      name: '@vfvrpq/dsh-pinned-sessions'
YAML
```

Then **reload the Web UI** (⌘R / F5). The boot graph is rebuilt per page load, so
an edited `lib/client.js` shows up on the next reload — no application restart.
Do **not** also add `@vfvrpq/dsh-pinned-sessions` to `dsh.profile.bundles` at the
same time: `insert` is append-only and never de-duplicates ids, so the plugin
would be mounted twice and its slot registrations would collide. (Appending that
row to a patch file that still holds the template's bare `[]` produces invalid
YAML and is silently ignored — `[]` plus a sequence is two documents in one file.)

## Develop

`lib/client.js` is the browser bundle, written by hand in the same
`window.__ModuleLoader__.load({ id, factory })` shape the build emits — plain JS
with `react.createElement`, no build step, no JSX. `apply(ctx)` registers exactly
one entry:

| registration | slot | id |
| --- | --- | --- |
| sidebar group (portals into the sidebar) | `shell.overlay` (list) | `pinned-sessions-section` |

Client services it injects: `slots`, `sessions`, `workspaces`, `uiWorkspace`,
`locale`. It reads the two stores (`sessions.list`, `workspaces.list`) through
`useSyncExternalStore` and never writes to them directly.

### Checks

```sh
<bundled node> test/bundle-check.mjs
```

Registers the bundle against a fake `window.__ModuleLoader__`, materializes the
factory with stub `require`, runs `apply()` against a fake Client Context and
renders the group with a hook shim — asserting the entry id, the dictionaries'
key parity, the anchor selector, pin order, the count, the running dot, the
unpin toggle (and that it does not also open the row), collapse, the empty hint,
the archived note, subagent filtering, the English copy, and the npm chip (its
text, its `href`, `target`/`rel`, and that clicking it does not toggle the group).

Because a client bundle cannot read its own manifest, `lib/client.js` repeats the
package name and version (`PACKAGE_NAME` / `PACKAGE_VERSION`). The chip checks
compare them against `package.json`, so a version bump that forgets the bundle
fails the suite instead of shipping a stale chip.

The DOM-mounting half needs a real sidebar, so it is covered by the Playwright
pass recorded in [VERIFY.md](VERIFY.md).

## Layout

```
lib/index.js      Host half — no-op; exists so the Loader row resolves and the
                  client-modules scan can find the package
lib/client.js     Browser half — the whole feature
cordis.patch.yml  Bundle patch: one row, id === package name
test/bundle-check.mjs
```

## Known boundaries

- The group lists **pinned, non-archived** sessions; archived pins are summarised
  in a note instead of listed (matching the native archive filter).
- Subagent sessions (`origin: "subagent"`) never appear.
- Order is the native pin order (newest pin first); this plugin adds no custom
  sorting, and the group is a flat list rather than one sub-group per workspace.
- Mounting is anchor-based, not a slot: a future sidebar rewrite that removes
  `div[data-slot="sidebar.workspaces"]` would hide the group.
