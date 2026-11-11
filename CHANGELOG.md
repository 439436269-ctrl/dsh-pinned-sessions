# Changelog

All notable changes to this plugin. Dates are the local (Asia/Shanghai) day the
change was verified on DSH Desktop 0.2.0-rc.2.

## 0.8.3 — 2026-11-11

工作区行的右键菜单只有「重命名 / 在文件夹显示 / 删除工作区」，没有置顶入口（用户截图反馈
「没指定文件夹的选项，我希望能增加」）。

- **原生工作区右键菜单里多一项**「置顶工作区」/「取消置顶工作区」，排在「重命名」之前；
  它走 DSH 的 `contextMenus` 注册表（ui-workspace 自己那三项也走这套），图标复用 ui-workspace
  已注册的 `workspace.pin` / `workspace.unpin`，所以字形与原生一致。打开菜单时按当前状态显示，
  选择后立即生效（菜单随之关闭）；置顶状态若在别处改变，`observe` 会让它下次打开就是正确标签。
- 接线放在**等待式子 fiber**（`ctx.inject(["contextMenus"], …)`）：没有该注册表的老宿主
  不加载这一项，分组与「＋」选择器照常工作。
- 自检 184 → 193：贡献项的目标族/排序/图标键/标签翻转/执行回调/空目标，以及「必须等注册表」。

## 0.8.2 — 2026-11-11

仅文档：两个 README 各加一张置顶分组的效果图（文件夹行展开、子会话缩进一级），指向仓库
`docs/pinned-workspaces.png`。图里的**会话标题与工作区名全部像素化打码**，只保留分组头、
文件夹/子行的层级、时间与图钉——代码与 0.8.1 完全一致。

## 0.8.1 — 2026-11-11

点文件夹会「没反应」：0.8.0 的置顶工作区行调用 `uiWorkspace.openWorkspace`，而那正是「在该工作区
新建会话」的入口——它只在那个工作区里建/复用一个空会话，主视图本来就停在空会话上，所以屏幕上几乎
没有变化，还会留下没人用的空会话。用户反馈「按 0.8.0 了，但是文件夹好像没法执行」。

- **文件夹行改成可展开容器**：点一下就地展开该工作区的会话（缩进一级、带原生状态点、点会话才打开），
  再点收起；展开状态存 `localStorage["@vfvrpq/dsh-pinned-sessions.expandedWorkspaces"]`，刷新仍展开。
- **点文件夹本身不再创建任何东西**；「新建会话」收成行内显式的 ＋ 按钮（`uiWorkspace.openWorkspace`），
  与「取消置顶工作区」并列，且都不会同时触发展开/收起。
- 空工作区展开时给一行「这个工作区里还没有会话」；嵌套列表按原生规则跳过子代理、空会话与已归档会话。
- 自检 175 → 184：展开后子行位置/缩进/状态、点文件夹不导航、点子会话打开、空文件夹提示、
  `workspaceSessions` 的过滤规则。

## 0.8.0 — 2026-11-10

The group could only pin Sessions. The Host has no Workspace pin at all — `workspace`
carries `pinnedSessionIds`, and `dsh-api-workspace-controller` exposes
`pinSession`/`unpinSession` only — so a pinned folder had nowhere to live.

- **Pinned Workspaces**, drawn above the pinned session rows with the same 32px row
  metrics: folder glyph, label, the directory when it differs from the label, the
  session count, the filled pin marker, and 取消置顶 on hover. Clicking a row calls
  the Host's own `uiWorkspace.openWorkspace`, so it navigates exactly like the native
  picker.
- **A `＋` picker in the group header** lists the Workspaces that are not pinned yet
  (the native Workspace header owns its own seats, so a plugin cannot extend it);
  every entry pins on select, and a fully pinned registry says
  `所有工作区都已置顶` instead of showing an empty menu.
- **One piece of state, documented**: the pin list is a JSON array of Workspace ids in
  `localStorage["@vfvrpq/dsh-pinned-sessions.pinnedWorkspaces"]`, most recently pinned
  first, mirroring the Host's own order for `pinnedSessionIds`. This deliberately
  breaks the earlier "this plugin adds no state" headline — the alternative would be a
  Host change.
- **Search and the count cover both halves** (`matched/total`), a Workspace whose id
  left the registry silently drops out instead of leaving a dangling row, and an empty
  group explains both gestures (`点 ＋ 置顶工作区，或在会话行上点图钉`).
- The self-check grew to 175 assertions: pin-order/dedup of the stored list, stale ids,
  label and path filtering, row order above sessions, the count, navigation, unpin,
  the picker's contents and its empty state.

## 0.7.0 — 2026-11-06

The pinned rows had no `⋯` menu at all: every session action except pin and archive
was reachable only from the native list further down.

- **A native-shaped `⋯` menu on every pinned row**, with the native session menu's
  items in its order and its shortcut chips: 置顶/取消置顶 · 重命名 (`Ctrl+Alt+G`) ·
  分叉会话 · 归档会话 (`Ctrl+Alt+A`) · 复制 Session ID · 复制会话路径. The ⋯ button
  sits first in the hover cluster, exactly where the native row puts it.
- **Rename opens the native modal shape** (`primitives.Modal` + 取消/重命名) seeded
  with the row title; the native dialog lives in ui-workspace's `shell.overlay` seat,
  which a plugin cannot raise, so the same shape is rebuilt over `workspaces.rename`.
- **Copy actions confirm with a short notice** (`会话 ID 已复制` / `会话路径已复制`),
  and a failure says so instead of silently doing nothing.
- **The session-path row appears only when `dsh-session-path` answers**: one probe of
  its `/api/dsh-session-path/resolve` route at mount, then the row copies through the
  same route. A host without that plugin simply shows five items.
- The self-check grew to 149 assertions: item order, labels, shortcut chips, the
  session-path separator and its absence, one action per row, the rename dialog's
  seed and buttons, and the menu's closed state.

## 0.6.0 — 2026-11-05

The pinned rows carried fewer decorations than the native rows for the very same
Sessions: no pin marker, a single hover button, a long time label, and no
highlight on the open Session. Each one is now the native row's own element.

- **The rest-state pin marker** (`已置顶`) sits where the native `.pinIndicator`
  sits — 16×20, caption color, 6px leading gap — and hides under the hover
  actions, exactly like the native row.
- **Hover actions follow the native order and gap**: 归档会话 then 置顶/取消置顶,
  in a 15px-gap cluster (`sidebar.workspaces.session.row.action` is archive at
  order 100, pin at 200). Both call the same `workspaces` methods the native
  buttons call, so one action has one implementation.
- **The time span prints the native bare unit** (`23分钟`/`2天`, never `2 天前`);
  the row tooltip keeps the hover card's "ago" form. The bucket vocabulary is the
  native sidebar's, verbatim.
- **The open Session's row is highlighted** by the native rule
  (`retainedBy.mainView`), with `aria-selected` set the way the native row sets it.
- The self-check grew to 134 assertions: marker glyph/label, hover-action order and
  ARIA, per-action behaviour (archive, unpin), the compact labels, the ago-form
  tooltip, and the selected-row rule.

## 0.5.0 — 2026-11-04

A pinned session that owns active scheduled tasks looked idle in the pinned group
while the same row further down the sidebar showed the schedule clock.

- **Idle pinned rows now carry the native scheduled-task clock.** The clock seat in
  a session row (`sidebar.session.row.leading`, owned by
  `@deepseek-ai/dsh-client-ui-schedule`) is dispatched by the row's own entry, and
  the slot runtime refuses a foreign `renderSlot` — declaring the seat a second time
  throws `slot "…" is already declared`. So the group reads the same Host catalog
  (`schedule/catalog()`) and draws the same `IconClockOutlineRegular` in the same
  16px cell: one Remote read for the whole group, refreshed on `schedule/changed`
  and `connection/reset`, released when the last row unmounts.
- **The leading cell stays exclusive, exactly like the native row**: a pending
  interaction, a live run, or an unread completion keeps its `StateDot` and the
  clock never renders beside it. Only the count you can see decides the mark — an
  inactive-only Session shows nothing, and the row tooltip gains the task count.
- **Absent Schedule face means no clock, not a broken group**: the Remote face is
  read lazily instead of being declared as a required inject, so a composition
  without `ui-schedule` still loads the group, and a refused or failed catalog read
  leaves the rows unmarked rather than throwing.
- The self-check covers the mark itself (glyph, leading cell, localized label,
  tooltip), the three exclusivity cases, zero/missing counts, and the source's read,
  refresh, release and failure paths.

## 0.4.1 — 2026-10-20

The pinned rows could look idle while the very same session was spinning in the
native list below: the status was never actually wired.

- **Session status now comes from `uiSession.sessionStatus`**, the store the native
  sidebar rows read, instead of a `useSessionStatus` prop that `apply()` never
  supplied. A run that starts *after* mount therefore lights the pinned row too;
  the summary's own `running` flag stays only as a fallback for a status map that
  does not know the Session yet.
- **The dot is the native `StateDot`**: `ongoing` renders the same rotating arc as
  the sidebar rows (a private 6px blue circle could not show motion), `done` is the
  green unread dot, and a pending approval / plan review / question is an amber dot
  whose compact label (「待审批」/「计划待审」/「待回答」) replaces the timestamp,
  mirroring the native row's precedence.
- `inject` declares `uiSession`, and the inject face exposes `statusStore`; the
  self-check now boots a fake `uiSession`, asserts the store is passed through, and
  covers ongoing / done / warning, the summary fallback, and the trailing label.

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
