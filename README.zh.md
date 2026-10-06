# dsh-pinned-sessions

> npm 包名：**`@vfvrpq/dsh-pinned-sessions`** · 仓库：`dsh-pinned-sessions`
>
> DeepSeek Harness 侧栏里的**置顶会话分组**：长得跟「工作区」分组一模一样——34px 的分组头
> （**描边**图钉 + 数量 + 搜索按钮），下面一行行 32px 的会话行，把这个工作区/所有工作区里
> 被置顶的会话集中摆在这里；置顶多了还能就地搜。

[English](README.md) | 中文

## 它解决什么

DSH 本身已经支持**置顶会话**（悬停会话行点图钉，或右键 → 「置顶会话」），但效果只是把该
会话**在本工作区分组内**排到最前——切换工作区、折叠分组、或者列表一长，置顶的会话照样会
滚走。

这个插件给「置顶」单独开了一个分组，就压在「工作区」上面：

```
插件
自动化任务
置顶  1  dsh-pinned-sessions v0.3.0  🔍   ← 本插件
   插件笔记：dsh-cost-…   4 小时前
工作区
默认工作区
   新会话
   …
```

打开搜索时（数量变成 `命中/总数`）：

```
置顶  1/3  dsh-pinned-sessions v0.3.0  ✕
   [ 搜索置顶会话              ]
   插件笔记：dsh-cost-…   4 小时前
```

- 行用的是**原生会话行的同一套度量**（32px 行高、14px 标题、10px 相对时间、同样的悬停底色
  与悬停才出现的行操作），所以这个分组跟工作区分组在视觉上完全一致；
- 分组头带这个插件的 **npm 身份**——`dsh-pinned-sessions v0.3.0`，一小段灰字，点它跳到 npm 上的
  [`@vfvrpq/dsh-pinned-sessions`](https://www.npmjs.com/package/@vfvrpq/dsh-pinned-sessions)
  （`target="_blank"`；桌面壳会把它转成 `shell.openExternal`，所以在系统浏览器里打开，而不是
  应用内跳转）。侧栏只有 256px，chip 显示**去掉 scope 的短名**，完整包名放在 tooltip /
  aria-label 里；点它不会顺带折叠分组；
- 分组头的**描边**图钉与「插件 / 自动化任务」那排侧栏图标的线性风格一致（分组内的图钉状态
  标记仍是实心，用来区分「状态」与「导航」）；
- 点一行 → 打开该会话；悬停一行 → 「取消置顶」；
- 分组头的 🔍 就地过滤本分组：按标题匹配、大小写不敏感、首尾空格忽略；打开搜索会自动展开
  分组，Esc 或再点一次关闭并清空；无命中时给一行提示（与「一条都没置顶」的原生提示分开）；
- 分组头是折叠控件：点一下收起，选择会跨刷新保留；一条都没置顶时用一行灰字提示代替列表；
- 运行中的会话带原生状态圆点；已归档的置顶会话不展示但会提示数量；子代理会话永不出现。

它**不新增任何状态**：置顶是 Host 早已具备的能力（`dsh-api-workspace-controller` 的
`workspaces.pinSession` / `unpinSession`，持久化在 `workspace` 存储单元里），所以侧栏与
分组永远一致——在哪边置顶，另一边立刻跟着变。

## 挂载方式

侧栏里「全局面板行」和底部之间的浏览区域，是**一个 `single` 槽**（`sidebar.workspaces`），
由 `@deepseek-ai/dsh-client-ui-workspace` 独占，而且没有留「额外分组」的席位：

| 席位 | 属主 | 装什么 |
| --- | --- | --- |
| `sidebar.panellist`（list） | ui-sidebar | 全局面板行（插件、自动化任务…）——每行是一个按钮，不是分组 |
| `sidebar.workspaces`（single） | ui-workspace | 整个浏览区：区头、搜索、树、菜单 |

遮蔽 `sidebar.workspaces` 等于把整个浏览器重写一遍（搜索、平铺/分组视图、拖拽排序、菜单、
悬浮卡、归档流程），所以本插件改为挂在渲染器自己的出口锚点
（`div[data-slot="sidebar.workspaces"]`，`display: contents`）**前面**，作为同一区域的兄弟
节点，再把分组 portal 进去：

- 从不往原生组件的 DOM 子树里插东西；
- 宿主节点是 `flex: none`，原生浏览器继续 `flex: 1`，只是少分一点高度——置顶分组固定在上方，
  下面的会话列表自己滚；
- 用**限流的 MutationObserver** 重新解析锚点，所以重渲染、侧栏收起/展开后分组都还在；
- 万一锚点消失（将来 DSH 改了侧栏结构），插件就什么都不渲染，而不是把界面搞坏。

## 安装

```sh
dsh plugin --profile <你的 profile> add @vfvrpq/dsh-pinned-sessions
```

本包是「双面」的（`dsh.bundle.patch` + `dsh.client`）：Loader 行拉起空的 Host 半，
浏览器半通过 `exports["./client"]` 到达。

### 本机开发安装（就是当前这份）

```sh
cd ~/.dsh/profiles/desktop
# 1) 让包能被解析（pnpm 对目录依赖是硬链接，改成软链才能改完即时生效）。
#    安装名取自包自己的 package.json，所以 scoped 包落在 node_modules/@vfvrpq/ 下：
pnpm add file:/path/to/dsh-pinned-sessions     # 或直接改 package.json
ln -sfn /path/to/dsh-pinned-sessions node_modules/@vfvrpq/dsh-pinned-sessions
# 2) 在自己的补丁层激活这一行（loader 会监听该文件，秒级热载入）
cat >> cordis.patch.yml <<'YAML'
- insert:
    - id: dsh-pinned-sessions
      name: '@vfvrpq/dsh-pinned-sessions'
YAML
```

然后**刷新 Web UI**（⌘R / F5）。启动图是每次页面加载重建的，所以改完 `lib/client.js`
下一次刷新就生效，**不用重启应用**。注意：**不要**同时把 `@vfvrpq/dsh-pinned-sessions`
写进 `dsh.profile.bundles`——`insert` 只是追加、从不按 id 去重，同时写会挂载两次、槽位注册撞车。
（另外：往还留着模板裸 `[]` 的补丁文件后面追加内容会变成非法 YAML——一个文件两个文档，
loader 会静默忽略。）

## 开发

`lib/client.js` 是手写的浏览器 bundle，格式与构建产物一致
（`window.__ModuleLoader__.load({ id, factory })`），但用纯 JS + `react.createElement`，
无 JSX、无构建步骤。`apply(ctx)` 只注册一个条目：

| 注册项 | 槽位 | id |
| --- | --- | --- |
| 侧栏分组（portal 进侧栏） | `shell.overlay`（list） | `pinned-sessions-section` |

注入的客户端服务：`slots`、`sessions`、`workspaces`、`uiWorkspace`、`locale`。
两个数据源（`sessions.list`、`workspaces.list`）通过 `useSyncExternalStore` 订阅，插件
从不直接写它们。

### 自检

```sh
<bundled node> test/bundle-check.mjs
```

用假的 `window.__ModuleLoader__` 注册 bundle、用桩 `require` 物化 factory、对假 Client
Context 跑 `apply()`，再用 hook 垫片渲染分组：断言条目 id、中英文字典键集一致、锚点选择器、
置顶顺序与数量、运行圆点、取消置顶按钮（且不会同时触发打开）、折叠行为、空态提示、归档提示、
子代理过滤、英文文案，以及 npm chip（文案、`href`、`target`/`rel`，点它不会折叠分组）。

客户端 bundle 读不到自己的 package.json，所以 `lib/client.js` 里重复写了包名与版本
（`PACKAGE_NAME` / `PACKAGE_VERSION`）；chip 那几条断言会拿它们跟 `package.json` 比对，
**所以发版时忘了同步这个文件会直接测试失败**，不会带着过期版本号发出去。

DOM 挂载那一半需要真实侧栏，由 [VERIFY.md](VERIFY.md) 里记录的 Playwright 实机验证覆盖。

## 目录

```
lib/index.js      Host 半 —— 空实现；存在是为了让 Loader 行能解析、client-modules 扫描能
                  找到这个包
lib/client.js     浏览器半 —— 功能全在这里
cordis.patch.yml  bundle patch：一行，id 必须等于包名
test/bundle-check.mjs
```

## 已知边界

- 分组只列**已置顶且未归档**的会话；被归档的置顶会话以一行说明提示数量而不展示（与原生归档
  过滤一致）。
- 子代理会话（`origin: "subagent"`）永不出现。
- 顺序就是原生置顶顺序（新置顶在前）；本插件不提供自定义排序，也不按工作区分成二级分组。
- 挂载是「锚点式」而非槽位式：将来若侧栏重写、`div[data-slot="sidebar.workspaces"]` 消失，
  分组会跟着消失（不会报错）。
