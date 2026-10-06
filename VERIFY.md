# VERIFY — @vfvrpq/dsh-pinned-sessions（本机实测记录）

> 0.3.0 之前本插件叫 `dsh-pinned-sessions`；因 npm 同名冲突改名（详见 §6）。下文历史记录保留
> 当时的实测原样，只有「当前状态」类章节（§1 计数、§5 安装形态）跟着更新。

环境：DSH Desktop 0.2.0-rc.2（Electron 桌面端，profile = `desktop`，DSH_HOME = `~/.dsh`）。
验证时间：2026-10-05。

## 0. 形态演进

- **0.1.0（已废弃）**：侧栏入口（`sidebar.panellist`，order 20）+ `main` 页面，点开一页看全局
  置顶列表。用户反馈「我希望是像工作区一样的表达」→ 改为内联分组。
- **0.2.0**：不再注册任何面板/页面，改成在侧栏「工作区」上方内联一个「置顶」分组。
- **0.2.1**：分组头图钉由实心改**描边**（对齐「插件 / 自动化任务」那排侧栏图标的线性
  风格；行内的图钉状态标记仍保持实心，用来区分「状态」与「导航」）；分组头新增 **🔍 就地搜索**
  （按标题、大小写不敏感、忽略首尾空格；打开即展开分组，Esc 或再点一次关闭并清空；过滤时计数显示
  `命中/总数`，无命中单独一行提示）。
- **0.2.2**：修掉折叠箭头方向反了的 bug（0.2.0 起就有）。
- **0.3.0（当前）**：改名 `@vfvrpq/dsh-pinned-sessions`（npm 同名冲突，见 §6）；补
  `publishConfig.access=public` 与 `devDependencies.react`；自检改为不依赖 profile 的 react
  查找。渲染逻辑未动。

### 折叠箭头方向：原生约定与本次修复

原生 `@deepseek-ai/dsh-client-ui-workspace` 的 `Rows.module.css` + 行组件：

```js
// 分组头（projectRow）里
<IcоnTriangleRightFillRegular className={clsx(arrow, row.expanded && arrowOpen)} />
```

```css
.jJkEga_arrowOpen{transform:rotate(90deg)}
```

即：**展开**才把右向箭头旋转 90° 变成下向（`▾`），**收起**保持右向（`▸`）。
本插件 0.2.0–0.2.1 写的是 `collapsed ? chevronOpen : chevron`，正好相反 → 0.2.2 改成
`collapsed ? chevron : chevron chevronOpen`，并在自检里加了两条断言把它钉死。

> 顺带发现（**未改**，待定）：原生箭头用的是**实心三角** `IconTriangleRightFillRegular`，
> 本插件用的是描边 `IconChevronRightOutlineRegular`。若要像素级对齐原生，这颗也要换；
> 但用户此前明确偏好线性（描边）图标，故先不动。

## 1. 静态与渲染自检（可重复）

```
<bundled node> --check lib/client.js
<bundled node> test/bundle-check.mjs        # 58 项全过
```

覆盖：包声明（`exports["./client"]`、`dsh.client.platform`、`engines.dsh`、patch 行名 = 包名）、
bundle 注册 id、`apply()` **只注册 1 个槽位**（`shell.overlay` id=`pinned-sessions-section`）、
inject face 的四个成员、中英文字典键集一致、锚点选择器
（`div[data-slot="sidebar.workspaces"]`）、置顶顺序与数量、运行圆点、取消置顶按钮（且不触发
打开）、折叠态（行/提示都隐藏、aria-expanded=false）、空态提示、归档提示、子代理过滤、英文文案；
0.2.1 追加：分组头是 `IconPinOutlineRegular` 而行内标记是 `IconPinFillRegular`（把「空心图标」
钉成回归项）、搜索按钮存在且 `aria-expanded=false`、搜索默认不渲染输入框、点击搜索不会连带折叠、
输入框带本地化占位符、查询收窄行、计数变 `命中/总数`、Esc 只拦自己的按键（普通按键不拦）、
无命中提示与空态提示互斥、`filterRows` 的大小写/空白/未命名回退；
0.2.2 追加：**展开态**头部箭头带 `dshps_chevronOpen`、**收起态**不带（对齐原生
`.arrowOpen` 挂 `row.expanded` 的约定）。

## 2. 真实 DSH Web 客户端端到端（Playwright 驱动）

临时 profile：`dsh pinnedverify --from-default-profile web --no-open --port 0`，Playwright 打开它
打印的 `http://127.0.0.1:<port>/?token=…`，操作真实数据（与桌面端共用同一份 `~/.dsh` 存储）；
验证后已删除该 profile。

| 断言 | 结果 |
| --- | --- |
| 分组渲染在侧栏、且位置正确 | ✅ `.dshps_host` 是 `div[data-slot="sidebar.workspaces"]` 的**前一个兄弟**、父节点就是同一个 region area；侧栏文本顺序为 插件 → **置顶 1 → 行** → 工作区 → 默认工作区 |
| 与原生行度量像素对齐 | ✅ 我的分组头/行盒 = 原生分组头/原生行盒（x=12、w=256、h=34/32），行标题 x 均为 40px |
| 点行打开会话 | ✅ 打开 `session-99808fba…`，分组留在侧栏不动 |
| 取消置顶 | ✅ 数量 1→0、行消失、出现空态提示「在会话行上点图钉即可置顶」；原生侧栏的置顶标记同时归零；`workspace.json` 的 `pinnedSessionIds` 变空 |
| 原生置顶 → 分组实时更新 | ✅ 点原生行操作「置顶会话」后，分组立刻回到「置顶 1 + 该行」，存储恢复为原始的单条置顶 |
| 折叠 + 跨刷新保留 | ✅ 点头部 → 行/提示消失、`aria-expanded=false`、`localStorage["dsh-pinned-sessions.collapsed"]="true"`；刷新后仍是收起态；再点即可展开 |
| 原生回归：分组折叠/展开 | ✅ 点「默认工作区」头 → 原生会话行 5→0；再点恢复；期间我的分组不受影响 |
| 原生回归：搜索 | ✅ 点「搜索会话」输入「插件」→ 5 条结果带工作区来源；分组仍在；清空后恢复 |
| 原生回归：点原生行 | ✅ 正常打开会话，原生列表 5 行完好 |

截图：`browser-screenshots/pinned-inline-01-section.png`（收起态/单行）、
`pinned-inline-02-expanded.png`（展开态，与工作区分组并列）。

### 2b. 0.2.1 追加验证（空心图钉 + 就地搜索）

同样的临时 profile 配方，另加一步 `dsh plugin --profile pinnedverify add <源码目录>`（该 profile 的
`dsh.profile.bundles` 会自动带上包名）。验证时间 2026-10-06。

| 断言 | 结果 |
| --- | --- |
| 分组头图钉是描边、行内标记是实心 | ✅ 头部 svg 两条 path：一条 `fill=(none)`+`stroke=currentColor`、一条 `fill=currentColor`；行内 `.dshps_pin` 的两条 path **都是** `fill=currentColor`——两者在 DOM 层就能区分 |
| 原生度量未被破坏 | ✅ 分组头 34px（x=12, w=256）、行 32px（x=12, w=256）；挂载点仍 `x=12, w=268, h=66`（= 34 + 32） |
| 搜索按钮 | ✅ `aria-label="搜索置顶会话"`、初始 `aria-expanded="false"`、默认不渲染输入框 |
| 打开搜索 | ✅ 输入框出现、`autoFocus` 生效（`document.activeElement` 就是它）、盒 `x=20, w=240, h=28`（与分组 8px 内缩对齐）、圆角 12px、背景透明、按钮标签变「关闭搜索」 |
| 正向过滤 | ✅ 输入 `dsh` → 计数 `1/1`、1 行、`title="插件笔记：dsh-cost-meter"` |
| 无命中 | ✅ 输入 `zzz` → 计数 `0/1`、0 行、出现「没有匹配的置顶会话」，且**不**出现空态提示「在会话行上点图钉即可置顶」 |
| Esc 关闭并清空 | ✅ 输入框移除、`aria-expanded` 回 `false`、标签回「搜索置顶会话」、计数回 `1`、行恢复 |
| 折叠箭头方向 | ✅ 0.2.2 修复：源码比对原生 `Rows.module.css` 的 `.arrowOpen{rotate(90deg)}` 挂在 `row.expanded` 上，插件原先挂在 `collapsed` 上；改后由自检两条断言覆盖（本轮未再起临时 profile 目视，CSS 规则本身未动） |

截图（放在工作区根的 `browser-screenshots/`，与 0.2.0 那批同处）：
`pinned-inline-03-search-open.png`（搜索打开、hover 态显示折叠箭头）、
`pinned-inline-04-search-filtered.png`（输入 `dsh`、计数 `1/1`、分组头显示**空心**图钉）、
`pinned-inline-05-preview-modal.png`（临时 profile 首开的预览版模态框，会拦指针事件）。

踩坑：临时 profile 首次打开会弹「预览版说明」模态框，其遮罩会拦截 Playwright 的指针事件
（`page.click` 超时报 mask intercepts pointer events）；先点掉「继续」再操作。另外 React 的
`onKeyDown` 用合成 `KeyboardEvent` 派发是**有效**的，但 state 更新是异步的——派发后立刻读 DOM
会看到旧结果，需要等一帧再断言（本次据此误判过一次「Esc 没生效」）。

## 3. 热载入 / 热更新（不用重启应用）

- 把 `- insert: [{id: dsh-pinned-sessions, name: dsh-pinned-sessions}]` 追加进 profile 的
  `cordis.patch.yml` 后，**运行中的 Host 立刻把插件纳入启动图**：重新拉 index HTML 即出现
  `dsh-pinned-sessions/client.js&rev=…`。
- 改 `lib/client.js` 后无需重启、也不用碰 Host：再拉 index，`rev` 按内容重新哈希，页面刷新
  即看到新代码（0.1.0 期间实测 `b50bd775a018` → `05c3b11150ff`）。
- 坑：往**还留着模板裸 `[]`** 的 `cordis.patch.yml` 后面 `cat >>` 追加，会得到「一个文件两个
  YAML 文档」的非法内容，loader 静默忽略（本次在临时 profile 上踩到，改成整份重写后立刻生效）。

## 4. desktop profile 组合校验（离线）

把 desktop profile 的 `package.json` / `cordis.patch.yml` / `cordis.yml` + `node_modules`（`cp -al`
硬链接）复制成临时 profile，跑 `dsh --profile desktopcheck --dump-config`（desktop 本体被桌面端
独占，CLI 拒绝直接 dump）：退出码 0、无 stderr，组合树中本插件**恰好 1 行**，且全局 `- id:`
无重复。
另外用 `js-yaml` 解析真实的 `~/.dsh/profiles/desktop/cordis.patch.yml`：11 个条目、其中我的
insert 行 1 条、`dsh.profile.bundles` 里**没有**本插件（避免重复挂载）。

## 5. 本机安装形态

```
~/.dsh/profiles/desktop/package.json          # dependencies: "@vfvrpq/dsh-pinned-sessions": "file:…/dsh-pinned-sessions"
~/.dsh/profiles/desktop/cordis.patch.yml      # - insert: [{ id: dsh-pinned-sessions, name: '@vfvrpq/dsh-pinned-sessions' }]
~/.dsh/profiles/desktop/node_modules/@vfvrpq/dsh-pinned-sessions -> 源码目录（软链，改动即时生效）
```

（0.3.0 改名前的记录里写的是 `dsh-pinned-sessions`；`dsh.profile.bundles` 与
`node_modules` 下的名字随包名一起变了，行 `id` 保持 `dsh-pinned-sessions` 不变——它只是本地行标识。）

## 6. 0.3.0 改名（npm 同名冲突）与随之暴露的重复挂载

**为什么改名**：`dsh-pinned-sessions` 这个 npm 名已被**另一位作者**的另一个插件占用
（`tianya-dao` / `github.com/TianYa-DAO/dsh-pinned-sessions`，做的是「按运行状态把会话排到侧栏
顶部」，功能不同），本包无法以该名发布。按用户决定改为 scoped **`@vfvrpq/dsh-pinned-sessions`**；
GitHub 仓库名仍用 `dsh-pinned-sessions`（无 scope 的尾巴）。

改名落点（缺一不可）：

| 落点 | 旧 | 新 |
|---|---|---|
| `package.json` `name` | `dsh-pinned-sessions` | `@vfvrpq/dsh-pinned-sessions` |
| `package.json` | — | 新增 `publishConfig.access=public`（scoped 包默认受限） |
| `cordis.patch.yml` `name` | `dsh-pinned-sessions` | `@vfvrpq/dsh-pinned-sessions`（**行 `id` 不变**） |
| `lib/client.js` bundle `id` / tagId / `dataset.plugin` / `COLLAPSED_KEY` / 日志前缀 | 旧名 | 新名 |
| `test/bundle-check.mjs` 的包名断言 | 旧名 | 新名 |
| profile 依赖键 + `node_modules` 软链 + profile 补丁行的 `name` | 旧名 | 新名 |

**踩到的真坑（`--dump-config` 抓出来的）**：用 `dsh plugin add <目录>` 改名重装时，CLI 会自动把
**新包名追加进 `dsh.profile.bundles`**——而 profile 补丁层里本来就有同 id 的 insert 行，于是组合树
里同一行出现**两次**（`# == @vfvrpq/dsh-pinned-sessions` 与 `# == …/cordis.patch.yml` 各一份），
正是 §3/README 警告过的「挂载两次、槽位注册撞车」。处置：**从 `dsh.profile.bundles` 里删掉它**，
只留补丁层那一行；复跑 dump-config 确认回落到 1 行、全局无重复 id。

**改名后的解析复核**（`createRequire(profile/package.json)`）：四个子路径出口全部解析成功——
`.` → `lib/index.js`、`/package.json`、`/client` → `lib/client.js`、`/cordis.patch.yml`。

**测试可移植性**：自检原先硬依赖 profile 里 hoisted 的 `react`，CI 上没有 profile 会直接崩。
改为「先 profile、再本包 `node_modules`」两段查找，并加 `devDependencies.react`，于是
`npm i && npm test` 在裸环境也能跑；两者都找不到时报出带排查建议的错误。

未验证项：桌面端**当前那个已打开的窗口**里的实际显示——桌面 Host 的 Web 认证是每进程密钥 +
签名 cookie（`dsh-client-connection` 的 `dsh-auth-*`），外部拿不到 token，无法像临时 profile
那样自动化点开它；需要用户在该窗口按 ⌘R 刷新后目视确认。（本轮改名只动标识符、未动渲染逻辑，
58 项自检全过，模块解析与组合均离线复核。）
