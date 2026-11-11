/**
 * @vfvrpq/dsh-pinned-sessions — browser half (inline sidebar section).
 *
 * Expression: a 「置顶」 group that sits in the sidebar exactly where a Workspace
 * group sits — a 34px header row with a pin glyph + count (click to collapse)
 * and 32px session rows under it, in pin order, mirroring the native row
 * metrics. Clicking a row opens the session; hovering one reveals 取消置顶.
 *
 * Why a portal instead of a slot: the sidebar's browsing region between the
 * global panel rows and the foot is declared as ONE `single` slot
 * (`sidebar.workspaces`), owned by @deepseek-ai/dsh-client-ui-workspace, and it
 * exposes no "extra group" seat. Shadowing that slot would mean reimplementing
 * the whole browser (search, views, drag ordering, menus, hover cards), so this
 * plugin instead mounts next to the renderer's own outlet anchor
 * (`div[data-slot="sidebar.workspaces"]`, `display: contents`) and stays out of
 * the native component's way: it never touches the browser's DOM subtree, and
 * if the anchor is missing it simply renders nothing.
 *
 * State is read from the native stores (`sessions.list`, `workspaces.list`) and
 * written through the native API (`workspaces.pin`/`unpinSession`), so the
 * section and the sidebar always agree.
 */
window.__ModuleLoader__.load({
	id: "@vfvrpq/dsh-pinned-sessions",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let reactDom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = react.createElement;
		//#region styles
		/** Row metrics mirror @deepseek-ai/dsh-client-ui-workspace's Rows.module.css. */
		const CSS = [
			".dshps_host{box-sizing:border-box;flex:none;display:flex;flex-direction:column;padding-bottom:6px;margin-bottom:2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
			".dshps_section{display:flex;flex-direction:column}",
			".dshps_head{box-sizing:border-box;height:34px;border-radius:var(--dsw-radius-md);padding:0 8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}",
			".dshps_head:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshps_head:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
			".dshps_glyph{flex:none;width:16px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}",
			".dshps_chevron{flex:none;width:16px;height:20px;display:none;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);transition:transform .15s var(--ds-ease-in-out)}",
			".dshps_head:hover .dshps_glyph{display:none}",
			".dshps_head:hover .dshps_chevron{display:inline-flex}",
			".dshps_chevronOpen{transform:rotate(90deg)}",
			".dshps_headTitle{flex:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}",
			".dshps_count{flex:none;color:var(--dsw-alias-label-caption);font-size:10px;line-height:16px;font-variant-numeric:tabular-nums}",
			".dshps_chip{flex:0 1 auto;min-width:0;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption);font-size:10px;line-height:16px;text-decoration:none;font-variant-numeric:tabular-nums}",
			".dshps_chip:hover{color:var(--dsw-alias-label-secondary);text-decoration:underline}",
			".dshps_chip:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:var(--dsw-radius-xs)}",
			".dshps_list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column}",
			".dshps_row{box-sizing:border-box;height:32px;border-radius:var(--dsw-radius-md);padding:0 8px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px));cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);display:flex;align-items:center}",
			".dshps_row:hover,.dshps_rowSelected,.dshps_rowMenuOpen{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshps_row:hover .dshps_actions,.dshps_rowMenuOpen .dshps_actions{display:inline-flex}",
			".dshps_row:hover .dshps_time,.dshps_row:hover .dshps_pinIndicator,.dshps_rowMenuOpen .dshps_time,.dshps_rowMenuOpen .dshps_pinIndicator{display:none}",
			".dshps_notice{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;padding:8px 14px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-elevated);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-md,0 6px 22px rgba(0,0,0,.35));font-size:13px;line-height:18px;pointer-events:none}",
			".dshps_error{margin:8px 0 0;color:var(--dsw-alias-state-warning-primary);font-size:12px;line-height:18px}",
			".dshps_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
			".dshps_slot{flex:none;width:16px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}",
			".dshps_where{flex:0 1 auto;min-width:0;max-width:40%;margin-right:6px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshps_setting{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l2);display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0}",
			".dshps_settingTitle{font-size:14px;line-height:20px}",
			".dshps_settingDesc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}",
			".dshps_title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;margin:0 6px 0 4px}",
			".dshps_time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;font-variant-numeric:tabular-nums}",
			".dshps_pinIndicator{flex:none;width:16px;height:20px;margin-left:6px;color:var(--dsw-alias-label-caption);display:inline-flex;align-items:center;justify-content:center}",
			".dshps_actions{flex:none;display:none;align-items:center;gap:15px}",
			".dshps_iconButton{box-sizing:border-box;width:16px;height:16px;padding:0;border:none;border-radius:var(--dsw-radius-xs);background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}",
			".dshps_iconButton:hover{color:var(--dsw-alias-label-primary)}",
			".dshps_iconButton:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
			".dshps_headActions{flex:none;display:inline-flex;align-items:center;gap:8px}",
			".dshps_search{padding:0 8px 6px}",
			".dshps_input{box-sizing:border-box;width:100%;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;line-height:20px}",
			".dshps_input::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".dshps_input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;border-color:var(--dsw-alias-state-business-primary)}",
			".dshps_input::-webkit-search-cancel-button{display:none}",
			".dshps_hint{margin:0;padding:0 8px 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}",
			".dshps_pickerEmpty{margin:0;padding:8px 10px;max-width:220px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".dshps_wsChevron{flex:none;width:14px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);transition:transform .15s var(--ds-ease-in-out)}",
			".dshps_nestedRow{padding-inline-start:32px}",
			".dshps_nestedEmpty{margin:0;padding:2px 8px 4px 32px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".dshps_note{margin:0;padding:0 8px 6px;color:var(--dsw-alias-label-caption);font-size:10px;line-height:16px}"
		].join("");
		const tagId = "@vfvrpq/dsh-pinned-sessions/PinnedSection.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@vfvrpq/dsh-pinned-sessions";
			tag.dataset.pluginCss = tagId;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region dictionaries
		/** Simplified Chinese copy — the key-set source of truth. */
		const zh = {
			"section.title": "置顶",
			"section.aria": "置顶会话与工作区",
			"section.count": "{count}",
			"section.countFiltered": "{matched}/{count}",
			"section.hint": "点 ＋ 置顶工作区，或在会话行上点图钉",
			"section.noMatch": "没有匹配的置顶项",
			"section.note.archived": "另有 {count} 个已归档的置顶会话未在此显示",
			"section.collapse": "收起置顶会话",
			"section.expand": "展开置顶会话",
			"search.open": "搜索置顶会话",
			"search.placeholder": "搜索置顶会话",
			"search.close": "关闭搜索",
			"picker.open": "置顶工作区",
			"picker.aria": "选择要置顶的工作区",
			"picker.empty": "所有工作区都已置顶",
			"row.sessions": "{count} 个会话",
			"row.workspacePin": "置顶工作区",
			"action.unpinWorkspace": "取消置顶工作区",
			"workspace.expand": "展开“{name}”",
			"workspace.collapse": "收起“{name}”",
			"workspace.newSession": "在“{name}”里新建会话",
			"workspace.empty": "这个工作区里还没有会话",
			"chip.open": "在 npm 上打开 {name} v{version}",
			"row.unread": "待查看",
			"row.schedule": "{count} 个自动化任务",
			"row.pinned": "已置顶",
			"actions.session": "会话“{name}”的操作",
			"setting.title": "置顶区",
			"setting.description": "在侧栏「工作区」列表顶部显示置顶会话与置顶工作区分组。",
			"actions.pin": "置顶会话",
			"actions.unpin": "取消置顶",
			"actions.archive": "归档会话",
			"menu.pinSession": "置顶会话",
			"menu.pinWorkspace": "置顶工作区",
			"menu.unpinWorkspace": "取消置顶工作区",
			"menu.unpinSession": "取消置顶",
			"menu.archiveSession": "归档会话",
			"menu.rename": "重命名",
			"menu.fork": "分叉会话",
			"menu.sessionId": "复制 Session ID",
			"menu.sessionPath": "复制会话路径",
			"rename.title": "重命名会话",
			"rename.field": "会话名称",
			"rename.confirm": "重命名",
			"rename.cancel": "取消",
			"rename.close": "关闭",
			"toast.sessionIdCopied": "会话 ID 已复制",
			"toast.sessionPathCopied": "会话路径已复制",
			"toast.copyFailed": "复制失败",
			"row.open": "打开会话“{title}”",
			"row.running": "进行中",
			"row.waitingApproval": "等待审批",
			"row.planReview": "计划待审",
			"row.waitingAnswer": "等待回答",
			"status.compact.approval": "待审批",
			"status.compact.planReview": "计划待审",
			"status.compact.answer": "待回答",
			"row.untitled": "未命名会话",
			/* Relative-time vocabulary is the native sidebar's, verbatim. */
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前"
		};
		/** English copy, same key set. */
		const en = {
			"section.title": "Pinned",
			"section.aria": "Pinned sessions and Workspaces",
			"section.count": "{count}",
			"section.countFiltered": "{matched}/{count}",
			"section.hint": "Pin a Workspace with ＋, or pin a session from its row",
			"section.noMatch": "No pinned item matches that search",
			"section.note.archived": "{count} archived pinned session(s) are hidden here",
			"section.collapse": "Collapse pinned sessions",
			"section.expand": "Expand pinned sessions",
			"search.open": "Search pinned sessions",
			"search.placeholder": "Search pinned sessions",
			"search.close": "Close search",
			"picker.open": "Pin a Workspace",
			"picker.aria": "Choose a Workspace to pin",
			"picker.empty": "Every Workspace is already pinned",
			"row.sessions": "{count} session(s)",
			"row.workspacePin": "Pinned Workspace",
			"action.unpinWorkspace": "Unpin Workspace",
			"workspace.expand": "Expand “{name}”",
			"workspace.collapse": "Collapse “{name}”",
			"workspace.newSession": "New session in “{name}”",
			"workspace.empty": "No sessions in this Workspace yet",
			"chip.open": "Open {name} v{version} on npm",
			"row.unread": "Unread",
			"row.schedule": "{count} scheduled task(s)",
			"row.pinned": "Pinned",
			"actions.session": "Session “{name}” actions",
			"setting.title": "Pinned group",
			"setting.description": "Show pinned sessions and pinned Workspaces at the top of the sidebar's session list.",
			"actions.pin": "Pin session",
			"actions.unpin": "Unpin session",
			"actions.archive": "Archive session",
			"menu.pinSession": "Pin session",
			"menu.pinWorkspace": "Pin Workspace",
			"menu.unpinWorkspace": "Unpin Workspace",
			"menu.unpinSession": "Unpin session",
			"menu.archiveSession": "Archive session",
			"menu.rename": "Rename",
			"menu.fork": "Fork session",
			"menu.sessionId": "Copy Session ID",
			"menu.sessionPath": "Copy session path",
			"rename.title": "Rename session",
			"rename.field": "Session name",
			"rename.confirm": "Rename",
			"rename.cancel": "Cancel",
			"rename.close": "Close",
			"toast.sessionIdCopied": "Session ID copied",
			"toast.sessionPathCopied": "Session path copied",
			"toast.copyFailed": "Copy failed",
			"row.open": "Open session “{title}”",
			"row.running": "Running",
			"row.waitingApproval": "Waiting for approval",
			"row.planReview": "Waiting for plan review",
			"row.waitingAnswer": "Waiting for an answer",
			"status.compact.approval": "Approval",
			"status.compact.planReview": "Plan review",
			"status.compact.answer": "Answer",
			"row.untitled": "Untitled session",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago"
		};
		//#endregion
		//#region package identity
		/**
		 * The published identity of this plugin, shown in the group header and linked
		 * to its npm page. These two literals are duplicated from package.json on
		 * purpose (a client bundle cannot read its own manifest at runtime), so
		 * `test/bundle-check.mjs` asserts both against package.json — a version bump
		 * that forgets this file fails the suite instead of shipping a stale chip.
		 */
		const PACKAGE_NAME = "@vfvrpq/dsh-pinned-sessions";
		const PACKAGE_VERSION = "0.8.3";
		/** The sidebar is 256px wide: drop the scope for display, keep it in the link. */
		const PACKAGE_SHORT_NAME = PACKAGE_NAME.replace(/^@[^/]+\//u, "");
		const NPM_URL = `https://www.npmjs.com/package/${PACKAGE_NAME}`;
		//#endregion
		//#region selectors
		/** Collapse choice survives reloads; a denied storage keeps the section expanded. */
		const COLLAPSED_KEY = "@vfvrpq/dsh-pinned-sessions.collapsed";
		function readCollapsed() {
			try {
				return window.localStorage?.getItem(COLLAPSED_KEY) === "true";
			} catch {
				return false;
			}
		}
		function writeCollapsed(value) {
			try {
				window.localStorage?.setItem(COLLAPSED_KEY, value ? "true" : "false");
			} catch {
				/* storage denied — the in-memory choice still applies */
			}
		}
		/** Visibility choice, owned by the Settings row and read by the mount. */
		const ENABLED_KEY = "@vfvrpq/dsh-pinned-sessions.enabled";
		function readEnabled() {
			try {
				return window.localStorage?.getItem(ENABLED_KEY) !== "false";
			} catch {
				return true;
			}
		}
		/**
		 * One shared source for the visibility switch: the Settings row writes it,
		 * the sidebar mount subscribes to it, and both live in this bundle instance,
		 * so the two surfaces can never disagree.
		 */
		const enabledSource = (() => {
			let value = readEnabled();
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				set: (next) => {
					value = next === true;
					try {
						window.localStorage?.setItem(ENABLED_KEY, value ? "true" : "false");
					} catch {
						/* storage denied — the in-memory choice still applies */
					}
					for (const listener of listeners) listener();
				}
			};
		})();
		/**
		 * Pinned Workspaces, which the Host does not model: `workspace` only carries
		 * `pinnedSessionIds`, and its controller exposes pin/unpin for Sessions alone
		 * (no `pinWorkspace` exists in any Host package). So this list is the one
		 * piece of state this plugin owns — one namespaced localStorage key, no
		 * parallel copy of anything the Host already persists.
		 *
		 * Order is "most recently pinned first", the Host's own convention for
		 * `pinnedSessionIds`, so both halves of the group read the same way.
		 */
		const PINNED_WORKSPACES_KEY = "@vfvrpq/dsh-pinned-sessions.pinnedWorkspaces";
		/** Which pinned Workspaces are expanded in the group, so a reload keeps them open. */
		const EXPANDED_KEY = "@vfvrpq/dsh-pinned-sessions.expandedWorkspaces";
		/** @returns the expanded Workspace ids, or an empty list when storage is denied. */
		function readExpandedWorkspaces() {
			try {
				const raw = window.localStorage?.getItem(EXPANDED_KEY);
				if (typeof raw !== "string" || raw === "") return Object.freeze([]);
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return Object.freeze([]);
				return Object.freeze(parsed.filter((id) => typeof id === "string" && id !== ""));
			} catch {
				return Object.freeze([]);
			}
		}
		/** @returns the stored Workspace ids, or an empty list when storage is denied. */
		function readPinnedWorkspaces() {
			try {
				const raw = window.localStorage?.getItem(PINNED_WORKSPACES_KEY);
				if (typeof raw !== "string" || raw === "") return Object.freeze([]);
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return Object.freeze([]);
				const seen = new Set();
				for (const id of parsed) {
					if (typeof id === "string" && id !== "") seen.add(id);
				}
				return Object.freeze([...seen]);
			} catch {
				return Object.freeze([]);
			}
		}
		/** The same shared-source shape as the visibility switch: one writer, one read. */
		const pinnedWorkspaceSource = (() => {
			let value = readPinnedWorkspaces();
			const listeners = new Set();
			const publish = (next) => {
				value = Object.freeze(next);
				try {
					window.localStorage?.setItem(PINNED_WORKSPACES_KEY, JSON.stringify(value));
				} catch {
					/* storage denied — the in-memory list still applies */
				}
				for (const listener of listeners) listener();
			};
			return {
				getSnapshot: () => value,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				/** Replace the whole list (tests and any future bulk edit use this). */
				set: (next) => {
					const seen = new Set();
					for (const id of Array.isArray(next) ? next : []) {
						if (typeof id === "string" && id !== "") seen.add(id);
					}
					publish([...seen]);
				},
				/** Pin or unpin one Workspace; a pin goes to the front like the Host's. */
				toggle: (workspaceId) => {
					if (typeof workspaceId !== "string" || workspaceId === "") return;
					if (value.includes(workspaceId)) publish(value.filter((id) => id !== workspaceId));
					else publish([workspaceId, ...value]);
				}
			};
		})();
		/**
		 * Subscribe one framework store to React.
		 * @param store - observable store exposing getSnapshot/subscribe.
		 * @returns the current snapshot.
		 */
		function useSnapshot(store) {
			const subscribe = react.useCallback((listener) => store.subscribe(listener), [store]);
			const getSnapshot = react.useCallback(() => store.getSnapshot(), [store]);
			return react.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
		}
		/**
		 * A status store for hosts that cannot supply `uiSession.sessionStatus`.
		 * `useSyncExternalStore` needs one stable store identity, so the fallback is
		 * module-level rather than a fresh object per render.
		 */
		const EMPTY_STATUSES = new Map();
		const EMPTY_STATUS_STORE = { getSnapshot: () => EMPTY_STATUSES, subscribe: () => () => {} };
		/** An empty shortcut catalog for hosts that expose none. */
		const EMPTY_SHORTCUTS = Object.freeze([]);
		const EMPTY_SHORTCUTS_STORE = { getSnapshot: () => EMPTY_SHORTCUTS, subscribe: () => () => {} };
		/** How long a copy confirmation stays up, matching the app's notice beat. */
		const NOTICE_MS = 1800;
		/** The route `dsh-session-path` registers for resolving one Session's log path. */
		const SESSION_PATH_ROUTE = "/api/dsh-session-path/resolve";
		/**
		 * Put `text` on the clipboard, falling back to the legacy selection path.
		 * @param text - the text to copy.
		 * @returns whether the clipboard accepted it.
		 */
		async function writeClipboard(text) {
			try {
				if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === "function") {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch {
				/* fall through to the legacy path */
			}
			try {
				const area = document.createElement("textarea");
				area.value = text;
				area.setAttribute("readonly", "");
				area.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0";
				document.body.appendChild(area);
				try {
					area.select();
					return document.execCommand("copy") === true;
				} finally {
					area.remove();
				}
			} catch {
				return false;
			}
		}
		/**
		 * Session id → number of its active scheduled tasks. Empty until the first
		 * catalog read settles, so a row never flashes a mark it cannot back.
		 */
		const EMPTY_SCHEDULE_MARKS = Object.freeze(Object.create(null));
		/** The source every row reads on a host without a Schedule face. */
		const EMPTY_SCHEDULE_MARKS_SOURCE = { getSnapshot: () => EMPTY_SCHEDULE_MARKS, subscribe: () => () => {} };
		/**
		 * Create the scheduled-task mark source: the ONE Host catalog read shared by
		 * every pinned row, so N rows cost one query instead of one each.
		 *
		 * This mirrors the native mark's source — `@deepseek-ai/dsh-client-ui-schedule`
		 * projects `schedule/catalog()` onto the `sidebar.session.row.leading` seat of
		 * each idle Session row. A plugin cannot dispatch another entry's seat (the
		 * slot runtime rejects a `renderSlot` the caller did not declare, and a second
		 * declaration of an owned seat throws), so the only way to keep the pinned
		 * group honest is to read the same catalog and draw the same glyph.
		 *
		 * The Remote face is attached separately, from a sub-fiber that injects it:
		 * cordis refuses to read an undeclared service (`cannot get property
		 * "remote.schedule" without inject`) and has no optional inject, so a
		 * REQUIRED declaration would keep this whole group from loading on a
		 * composition that has no Schedule face. A waiting sub-fiber gets the face
		 * when the composition has one and simply never runs when it does not.
		 *
		 * Subscriptions follow the framework subscribers: the first row to mount
		 * starts the reads and the `schedule/changed` invalidation, the last one to
		 * leave releases them and drops the snapshot.
		 *
		 * @returns the observable source plus {@link attach}, which wires the face.
		 */
		function createScheduleMarks() {
			let snapshot = EMPTY_SCHEDULE_MARKS;
			const listeners = new Set();
			/** The Remote face, once the sub-fiber that injects it runs. */
			let deps;
			let disposers = [];
			let epoch = 0;
			const publish = (next) => {
				snapshot = next;
				for (const listener of listeners) listener();
			};
			/**
			 * One catalog read. A refresh only publishes when it is still the newest
			 * request, so a slow answered read cannot overwrite a newer one.
			 */
			const read = async () => {
				if (deps === undefined) return;
				const current = ++epoch;
				let result;
				try {
					result = await deps.list();
				} catch {
					return;
				}
				if (current !== epoch || listeners.size === 0 || deps === undefined) return;
				if (result === undefined || result === null || result.ok !== true) return;
				const counts = Object.create(null);
				for (const record of Array.isArray(result.value) ? result.value : []) {
					if (record === null || typeof record !== "object") continue;
					if (record.status !== "active" || typeof record.sessionId !== "string") continue;
					counts[record.sessionId] = (counts[record.sessionId] ?? 0) + 1;
				}
				publish(Object.freeze(counts));
			};
			const invalidate = () => {
				void read();
			};
			/** Follow the Remote invalidation only while something is watching. */
			const follow = () => {
				if (deps === undefined || disposers.length !== 0) return;
				disposers = [deps.subscribeChanged(invalidate), deps.subscribeReset(invalidate)];
				invalidate();
			};
			const release = () => {
				for (const dispose of disposers) dispose();
				disposers = [];
				epoch += 1;
				snapshot = EMPTY_SCHEDULE_MARKS;
			};
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					if (listeners.size === 1) follow();
					return () => {
						listeners.delete(listener);
						if (listeners.size !== 0) return;
						release();
					};
				},
				/**
				 * Wire the Remote face and start reading when a row is already waiting.
				 * @param next - the catalog call plus its two invalidation sources.
				 * @returns a disposer that unwires the face.
				 */
				attach: (next) => {
					deps = next;
					if (listeners.size > 0) follow();
					return () => {
						release();
						deps = undefined;
					};
				}
			};
		}
		/** Active scheduled-task count for one Session; 0 when the catalog has none. */
		function scheduleCountOf(marks, sessionId) {
			const count = marks === undefined || marks === null ? undefined : marks[sessionId];
			return typeof count === "number" && Number.isFinite(count) ? count : 0;
		}
		/** Re-render once a minute so relative timestamps stay honest. */
		function useMinuteClock() {
			const [, setTick] = react.useState(0);
			react.useEffect(() => {
				const timer = window.setInterval(() => setTick((value) => value + 1), 60000);
				return () => window.clearInterval(timer);
			}, []);
		}
		/** Session ids that are pinned, visible and not archived, in pin order. */
		function pinnedSessionIds(sessions, workspaces) {
			const archived = new Set(workspaces.archivedSessionIds ?? []);
			const ids = [];
			for (const id of workspaces.pinnedSessionIds ?? []) {
				const summary = sessions.byId[id];
				if (summary === undefined || summary.origin === "subagent" || summary.blank || archived.has(id)) continue;
				ids.push(id);
			}
			return ids;
		}
		/** Pinned-but-archived sessions, which this section deliberately hides. */
		function archivedPinnedCount(sessions, workspaces) {			const archived = new Set(workspaces.archivedSessionIds ?? []);
			let count = 0;
			for (const id of workspaces.pinnedSessionIds ?? []) {
				const summary = sessions.byId[id];
				if (summary === undefined || summary.origin === "subagent" || summary.blank) continue;
				if (archived.has(id)) count += 1;
			}
			return count;
		}
		/** Last path segment, tolerant of POSIX and Windows separators. */
		function baseName(path) {
			const trimmed = String(path ?? "").replace(/[/\\]+$/u, "");
			const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return trimmed.slice(separator + 1);
		}
		/**
		 * Display label of one Workspace, by the native rule
		 * (`workspaceDisplayTitle`): the Host stores its own default directory as
		 * `default-workspace` and every native surface swaps in the localized name;
		 * an untitled Workspace falls back to its last path segment.
		 * @param item - one `workspaces.list` row.
		 * @param t - the bound dictionary.
		 * @returns the label, never blank for a row that has a path.
		 */
		function workspaceLabelOf(item, t) {
			const title = String(item?.title ?? "").trim();
			if (title === "default-workspace") return t("workspace.defaultName");
			if (title !== "") return title;
			const base = baseName(item?.path);
			return base !== "" ? base : String(item?.path ?? "");
		}
		/**
		 * The pinned Workspaces that still exist, in pin order.
		 * A Workspace deleted from the registry silently drops out instead of leaving
		 * a dangling row, exactly like a pinned session whose summary disappeared.
		 * @param workspaces - workspace list snapshot.
		 * @param pinnedIds - the plugin's own pinned Workspace ids.
		 * @returns the matching workspace rows, most recently pinned first.
		 */
		function pinnedWorkspaceItems(workspaces, pinnedIds) {
			const byId = new Map();
			for (const item of workspaces.items ?? []) {
				if (typeof item?.workspaceId === "string") byId.set(item.workspaceId, item);
			}
			const rows = [];
			for (const id of Array.isArray(pinnedIds) ? pinnedIds : []) {
				const item = byId.get(id);
				if (item !== undefined) rows.push(item);
			}
			return rows;
		}
		/**
		 * The Sessions listed inside one Workspace, in the Workspace's own manual order,
		 * skipping what the native tree never shows: subagent rows, the blank "new
		 * session" placeholders, and archived ones.
		 * @param workspaces - workspace list snapshot (for the archive set).
		 * @param sessions - session list snapshot.
		 * @param item - one pinned workspace row.
		 * @returns that Workspace's visible session summaries.
		 */
		function workspaceSessions(workspaces, sessions, item) {
			const archived = new Set(workspaces.archivedSessionIds ?? []);
			const rows = [];
			for (const id of Array.isArray(item?.sessionIds) ? item.sessionIds : []) {
				const summary = sessions.byId?.[id];
				if (summary === undefined || summary.origin === "subagent" || summary.blank || archived.has(id)) continue;
				rows.push(summary);
			}
			return rows;
		}
		/**
		 * Narrow pinned Workspace rows the same way `filterRows` narrows Sessions:
		 * by label, plus the path because a Workspace is often recognised by its
		 * directory rather than its title.
		 * @param items - pinned Workspace rows, in pin order.
		 * @param query - raw search text.
		 * @param t - the bound dictionary.
		 * @returns the matching subset, still in pin order.
		 */
		function filterWorkspaceItems(items, query, t) {
			const needle = String(query ?? "").trim().toLowerCase();
			if (needle === "") return items;
			return items.filter((item) => workspaceLabelOf(item, t).toLowerCase().includes(needle) || String(item?.path ?? "").toLowerCase().includes(needle));
		}
		/**
		 * Display label of the workspace that owns a session, by the native rule
		 * (`workspaceDisplayTitle`): the Host stores its own default directory as
		 * `default-workspace`, and every native surface swaps in the localized name.
		 * @param workspaces - workspace list snapshot.
		 * @param sessionId - session whose owning label is wanted.
		 * @param t - the bound dictionary.
		 * @returns the label, or an empty string for an ungrouped session.
		 */
		function owningWorkspaceLabel(workspaces, sessionId, t) {
			for (const item of workspaces.items ?? []) {
				if (!Array.isArray(item.sessionIds) || !item.sessionIds.includes(sessionId)) continue;
				return workspaceLabelOf(item, t);
			}
			return "";
		}
		/** One status reading, tolerating a host without a status store. */
		function statusOf(statuses, sessionId) {
			return statuses !== undefined && statuses !== null && typeof statuses.get === "function" ? statuses.get(sessionId) : undefined;
		}
		/**
		 * The Session the sidebar highlights, by the native browser's own rule: the
		 * one Session the main view still retains a reference to.
		 * @param sessions - session list snapshot.
		 * @returns that Session id, or undefined when nobody is retained.
		 */
		function currentSessionOf(sessions) {
			for (const id of sessions.ids ?? []) {
				const summary = sessions.byId?.[id];
				if (summary !== undefined && (summary.retainedBy?.mainView ?? 0) > 0) return id;
			}
			return undefined;
		}
		/**
		 * Project one Session's unified status into the native row vocabulary.
		 *
		 * Precedence mirrors `sessionStatuses()` in
		 * @deepseek-ai/dsh-client-ui-workspace: a pending interaction outranks live
		 * activity, which outranks the finished-but-unopened reminder. The store is
		 * authoritative once it knows the Session; `summary.running` is only the
		 * mount-time fallback, because the list snapshot keeps the flag it loaded
		 * with while later runs arrive as `api-session/status` events.
		 *
		 * @param status - `{ running, pendingInteraction, completionUnread }` or undefined.
		 * @param summary - the session summary, for the fallback flag.
		 * @param t - dictionary lookup.
		 * @returns the dot state, its accessible label, an optional compact trailing
		 * label that replaces the relative time, and the test id.
		 */
		function statusView(status, summary, t) {
			switch (status?.pendingInteraction?.kind) {
				case "approval":
					return { state: "warning", label: t("row.waitingApproval"), trailing: t("status.compact.approval"), testid: "pinned-sessions-warning" };
				case "plan-review":
					return { state: "warning", label: t("row.planReview"), trailing: t("status.compact.planReview"), testid: "pinned-sessions-warning" };
				case "question":
					return { state: "warning", label: t("row.waitingAnswer"), trailing: t("status.compact.answer"), testid: "pinned-sessions-warning" };
				default:
					break;
			}
			const running = status === undefined ? summary.running === true : status.running === true;
			if (running) return { state: "ongoing", label: t("row.running"), trailing: undefined, testid: "pinned-sessions-running" };
			/** A finished-but-unopened session is the second attention state worth a dot. */
			if (status?.completionUnread === true) return { state: "done", label: t("row.unread"), trailing: undefined, testid: "pinned-sessions-unread" };
			return { state: "idle", label: "", trailing: undefined, testid: undefined };
		}
		/** Row label for one session summary. */
		function rowLabel(summary, t) {
			const title = String(summary.title ?? "").trim();
			if (title !== "") return title;
			const display = String(summary.displayTitle ?? "").trim();
			if (display !== "") return display;
			return t("row.untitled");
		}
		/**
		 * Narrow pinned rows to those whose label contains `query`, case-insensitively.
		 * A blank query is a no-op, so the unfiltered list rides the same code path.
		 * @param rows - pinned session summaries, in pin order.
		 * @param query - raw search text.
		 * @param t - dictionary lookup.
		 * @returns the matching subset, still in pin order.
		 */
		function filterRows(rows, query, t) {
			const needle = String(query ?? "").trim().toLowerCase();
			if (needle === "") return rows;
			return rows.filter((summary) => rowLabel(summary, t).toLowerCase().includes(needle));
		}
		/**
		 * Relative distance in the native sidebar's own buckets, so a pinned row reads
		 * `1天` exactly where the native row below reads `1天` (`relativeTime` in
		 * @deepseek-ai/dsh-client-ui-primitives, reproduced here so the row and its
		 * tooltip never disagree about the unit).
		 *
		 * @param updatedAt - epoch ms of the Session's last update.
		 * @param now - epoch ms to measure against.
		 * @returns the native unit token and its count.
		 */
		function relativeParts(updatedAt, now) {
			const delta = Math.max(0, now - updatedAt);
			const minute = 60000;
			const hour = 60 * minute;
			const day = 24 * hour;
			if (delta < minute) return { unit: "now", n: 0 };
			const minutes = Math.floor(delta / minute);
			if (minutes < 60) return { unit: "minutes", n: minutes };
			const hours = Math.floor(delta / hour);
			if (hours < 24) return { unit: "hours", n: hours };
			const days = Math.floor(delta / day);
			if (days < 30) return { unit: "days", n: days };
			const months = Math.floor(days / 30);
			if (months < 12) return { unit: "months", n: months };
			return { unit: "years", n: Math.floor(days / 365) };
		}
		/** The bare unit text (`1天`), exactly what the native row's time span prints. */
		function compactTime(updatedAt, now, t) {
			const { unit, n } = relativeParts(updatedAt, now);
			return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
		}
		/**
		 * Compact relative timestamp for the row's leading time span.
		 * @param updatedAt - epoch ms.
		 * @param t - bound dictionary.
		 * @param now - epoch ms to measure against (defaults to the current clock).
		 */
		function formatTime(updatedAt, t, now = Date.now()) {
			if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return "";
			return compactTime(updatedAt, now, t);
		}
		/**
		 * The same distance in the hover card's "ago" form (`1天前`), which is what the
		 * native row tooltip says; the row itself stays bare like the native time span.
		 */
		function formatTimeAgo(updatedAt, t, now = Date.now()) {
			if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return "";
			const { unit } = relativeParts(updatedAt, now);
			return unit === "now" ? t("time.now") : t("time.ago", { t: compactTime(updatedAt, now, t) });
		}
		//#endregion
		//#region components
		/**
		 * One menu row, drawn with the native `MenuItemButton` so the pinned menu and
		 * the native `⋯` menu share icons, label metrics and shortcut chips.
		 * @param props - locale lookup, icon, label, optional shortcut row, separators,
		 * the select handler and the test id.
		 */
		function MenuRow(props) {
			const { t, label, icon, shortcut, separatorBefore, onSelect, testid } = props;
			return h(
				primitives.MenuItemButton,
				{
					icon: h(icon, { size: 16 }),
					shortcut,
					...(separatorBefore === true ? { separatorBefore: true } : {}),
					onSelect,
					"data-testid": testid
				},
				label
			);
		}
		/**
		 * The pinned row's `⋯` menu: the native session menu, item for item (pin,
		 * rename, fork, archive, copy id) plus the session-path copy that
		 * `dsh-session-path` contributes to the native list.
		 *
		 * The native menu's items live in the `sidebar.workspaces.session.menu.item`
		 * seat, which a plugin can neither dispatch nor re-declare, so the same
		 * actions are rebuilt here over the same `workspaces` / `uiWorkspace` calls.
		 * @param props - row identity, open state, close handler and one callback per item.
		 */
		function PinnedMenu(props) {
			const { summary, label, pinned, open, shortcuts, hasPathCopy, t, onClose, onPin, onRename, onFork, onArchive, onCopyId, onCopyPath } = props;
			const sessionId = summary.id;
			const shortcutOf = (id) => {
				const rows = Array.isArray(shortcuts) ? shortcuts : [];
				const row = rows.find((entry) => entry?.id === id);
				return row === undefined ? undefined : row;
			};
			const anchor = h(
				"button",
				{
					type: "button",
					className: "dshps_iconButton",
					"aria-label": t("actions.session", { name: label }),
					"aria-haspopup": "menu",
					"aria-expanded": open ? "true" : "false",
					title: t("actions.session", { name: label }),
					"data-testid": "pinned-sessions-menu",
					onClick: (event) => {
						event.stopPropagation();
						props.onToggle?.();
					}
				},
				h(primitives.IconEllipsisOutlineRegular, { size: 14 })
			);
			return h(
				primitives.Menu,
				{
					open,
					onClose,
					portal: true,
					closeOnPointerLeave: true,
					anchor
				},
				h(MenuRow, { t, label: t(pinned === false ? "menu.pinSession" : "menu.unpinSession"), icon: pinned === false ? primitives.IconPinOutlineRegular : primitives.IconPinFillRegular, onSelect: () => { onClose(); onPin?.(sessionId); }, testid: "pinned-sessions-menu-pin" }),
				h(MenuRow, { t, label: t("menu.rename"), icon: primitives.IconEditOutlineRegular, shortcut: shortcutOf("session.rename"), onSelect: () => { onClose(); onRename?.(sessionId, label); }, testid: "pinned-sessions-menu-rename" }),
				h(MenuRow, { t, label: t("menu.fork"), icon: primitives.IconBranchOutlineRegular, shortcut: shortcutOf("session.fork"), onSelect: () => { onClose(); onFork?.(sessionId); }, testid: "pinned-sessions-menu-fork" }),
				h(MenuRow, { t, label: t("menu.archiveSession"), icon: primitives.IconArchiveOutlineRegular, shortcut: shortcutOf("session.archive"), onSelect: () => { onClose(); onArchive?.(sessionId); }, testid: "pinned-sessions-menu-archive" }),
				h(MenuRow, { t, label: t("menu.sessionId"), icon: primitives.IconCopyOutlineRegular, onSelect: () => { onClose(); onCopyId?.(sessionId); }, testid: "pinned-sessions-menu-session-id" }),
				hasPathCopy === true
					? h(MenuRow, { t, label: t("menu.sessionPath"), icon: primitives.IconCopyOutlineRegular, separatorBefore: true, onSelect: () => { onClose(); onCopyPath?.(sessionId); }, testid: "pinned-sessions-menu-session-path" })
					: null
			);
		}
		/**
		 * The rename dialog: the native one's shape (`primitives.Modal` + two buttons),
		 * because the native dialog lives in ui-workspace's `shell.overlay` seat and a
		 * plugin cannot raise it.
		 * @param props - the Session, its current title, the dictionary, close and commit.
		 */
		function RenameDialog(props) {
			const { sessionId, title, t, onClose, onCommit } = props;
			const [draft, setDraft] = react.useState(title);
			const [busy, setBusy] = react.useState(false);
			const [error, setError] = react.useState(null);
			const trimmed = draft.trim();
			const close = () => {
				if (!busy) onClose();
			};
			const confirm = () => {
				if (busy || trimmed === "") return;
				setBusy(true);
				setError(null);
				Promise.resolve(onCommit(sessionId, trimmed)).then(() => {
					setBusy(false);
				}, (reason) => {
					setBusy(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return h(
				primitives.Modal,
				{
					open: true,
					onClose: close,
					closeLabel: t("rename.close"),
					title: t("rename.title"),
					footer: h(
						react.Fragment,
						null,
						h(primitives.Button, { variant: "outline", disabled: busy, onClick: close }, t("rename.cancel")),
						h(primitives.Button, { variant: "primary", disabled: busy || trimmed === "", onClick: confirm }, t("rename.confirm"))
					)
				},
				h("input", {
					className: "dshps_input",
					value: draft,
					"aria-label": t("rename.field"),
					"data-modal-autofocus": true,
					"data-testid": "pinned-sessions-rename-input",
					disabled: busy,
					onFocus: (event) => event.target.select(),
					onChange: (event) => {
						setDraft(event.target.value);
						setError(null);
					},
					onKeyDown: (event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						confirm();
					}
				}),
				error === null ? null : h("p", { className: "dshps_error", role: "alert" }, error)
			);
		}
		/** One pinned session, drawn with the native session-row metrics. */
		function PinnedRow(props) {
			const { summary, status, scheduleCount, where, selected, pinned, shortcuts, hasPathCopy, t, onOpen, onPin, onRename, onFork, onArchive, onCopyId, onCopyPath } = props;
			const label = rowLabel(summary, t);
			const view = statusView(status, summary, t);
			const [menuOpen, setMenuOpen] = react.useState(false);
			/**
			 * The leading 16px cell is exclusive, exactly like the native row: a live
			 * state (pending interaction, spinning run, unread completion) owns it and
			 * the scheduled-task clock never appears beside that dot. An idle row with
			 * an active task shows the same clock the native row shows further down.
			 */
			const scheduleText = scheduleCount === undefined || scheduleCount < 1 ? "" : t("row.schedule", { count: scheduleCount });
			const marksSchedule = view.state === "idle" && scheduleText !== "";
			/** A warning's compact label takes the timestamp's place, exactly like the native row. */
			const timeText = view.trailing ?? formatTime(summary.updatedAt, t);
			const timeTitle = formatTimeAgo(summary.updatedAt, t);
			const pinnedNow = pinned !== false;
			const action = (key, icon, iconName, run) => h(
				"button",
				{
					type: "button",
					className: "dshps_iconButton",
					"aria-label": t(key),
					title: t(key),
					"data-testid": `pinned-sessions-${iconName}`,
					onClick: (event) => {
						event.stopPropagation();
						run();
					}
				},
				h(icon, { size: 14 })
			);
			return h(
				"li",
				{
					className: selected === true ? "dshps_row dshps_rowSelected" : menuOpen ? "dshps_row dshps_rowMenuOpen" : "dshps_row",
					role: "treeitem",
					tabIndex: 0,
					"aria-selected": selected === true ? "true" : "false",
					title: [label, where, timeTitle, view.label, marksSchedule ? scheduleText : "", pinnedNow ? t("row.pinned") : ""].filter((part) => part !== "").join(" · "),
					"aria-label": t("row.open", { title: label }),
					"data-testid": "pinned-sessions-row",
					"data-session-id": summary.id,
					onClick: () => onOpen(summary.id),
					onKeyDown: (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						onOpen(summary.id);
					}
				},
				h(
					"span",
					marksSchedule
						? { className: "dshps_slot", role: "img", "aria-label": scheduleText, title: scheduleText, "data-testid": "pinned-sessions-schedule" }
						: view.state === "idle" ? { className: "dshps_slot" } : { className: "dshps_slot", role: "img", "aria-label": view.label, "data-testid": view.testid },
					/*
					 * The native `StateDot`, not a private circle: `ongoing` is the
					 * same rotating arc the sidebar's own rows show, and warning/done
					 * inherit the theme's status colors. Without it a running pinned
					 * Session looked idle while its row further down spun.
					 */
					view.state !== "idle" ? h(primitives.StateDot, { state: view.state }) : marksSchedule ? h(primitives.IconClockOutlineRegular, { size: 14 }) : null
				),
				h("span", { className: "dshps_title" }, label),
				where === "" ? null : h("span", { className: "dshps_where", "data-testid": "pinned-sessions-where" }, where),
				h("span", { className: "dshps_time", "aria-hidden": view.trailing === undefined ? undefined : true }, timeText),
				/*
				 * The native rest-state pin marker: a filled glyph on every pinned row,
				 * hidden while the hover actions replace it — the same swap the native
				 * row performs with `.pinIndicator`.
				 */
				h(
					"span",
					{ className: "dshps_pinIndicator", role: "img", "aria-label": t("row.pinned"), title: t("row.pinned"), "data-testid": "pinned-sessions-pin-indicator" },
					h(primitives.IconPinFillRegular, { size: 14 })
				),
				/*
				 * Hover actions in the native row's own order: the `⋯` menu first, then
				 * `sidebar.workspaces.session.row.action` (archive at order 100, pin at
				 * 200), all at the native 15px gap.
				 */
				h(
					"span",
					{ className: "dshps_actions" },
					h(PinnedMenu, {
						summary,
						label,
						pinned: pinnedNow,
						open: menuOpen,
						shortcuts,
						hasPathCopy,
						t,
						onClose: () => setMenuOpen(false),
						onToggle: () => setMenuOpen((value) => !value),
						onPin,
						onRename,
						onFork,
						onArchive,
						onCopyId,
						onCopyPath
					}),
					action("menu.archiveSession", primitives.IconArchiveOutlineRegular, "archive", () => onArchive?.(summary.id)),
					action(pinnedNow ? "menu.unpinSession" : "menu.pinSession", pinnedNow ? primitives.IconPinFillRegular : primitives.IconPinOutlineRegular, "pin", () => onPin?.(summary.id))
				)
			);
		}
		/**
		 * One pinned Workspace, drawn with the pinned session row's own 32px metrics:
		 * a disclosure chevron, the folder glyph, the label, the session count, the pin
		 * marker, and two hover actions (new session in it, unpin). Clicking the row
		 * expands or collapses the Workspace's own Sessions in place — a folder opens,
		 * it does not create anything.
		 * @param props - the workspace row, its session count, expanded state, the
		 * dictionary, toggle, new-session and unpin callbacks.
		 */
		function PinnedWorkspaceRow(props) {
			const { item, count, expanded, t, onToggle, onNewSession, onUnpin } = props;
			const label = workspaceLabelOf(item, t);
			const base = baseName(item?.path);
			const where = base !== "" && base !== label ? base : "";
			const sessions = t("row.sessions", { count });
			return h(
				"li",
				{
					className: "dshps_row",
					role: "treeitem",
					tabIndex: 0,
					"aria-expanded": expanded === true ? "true" : "false",
					title: [label, String(item?.path ?? ""), sessions, t("row.workspacePin")].filter((part) => part !== "").join(" · "),
					"aria-label": expanded === true ? t("workspace.collapse", { name: label }) : t("workspace.expand", { name: label }),
					"data-testid": "pinned-workspace-row",
					"data-workspace-id": item.workspaceId,
					"data-expanded": expanded === true ? "true" : "false",
					onClick: () => onToggle(item.workspaceId),
					onKeyDown: (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						onToggle(item.workspaceId);
					}
				},
				/*
				 * The native disclosure arrow, in front of the folder glyph, so a pinned
				 * Workspace reads exactly like a group in the tree below.
				 */
				h("span", { className: expanded === true ? "dshps_wsChevron dshps_chevronOpen" : "dshps_wsChevron", "aria-hidden": "true" }, h(primitives.IconChevronRightOutlineRegular, { size: 14 })),
				h("span", { className: "dshps_slot", "aria-hidden": "true" }, h(primitives.IconFolderOpenOutlineRegular, { size: 14 })),
				h("span", { className: "dshps_title" }, label),
				where === "" ? null : h("span", { className: "dshps_where", "data-testid": "pinned-workspace-where" }, where),
				h("span", { className: "dshps_time", "aria-hidden": "true" }, sessions),
				h(
					"span",
					{ className: "dshps_pinIndicator", role: "img", "aria-label": t("row.workspacePin"), title: t("row.workspacePin"), "data-testid": "pinned-workspace-pin-indicator" },
					h(primitives.IconPinFillRegular, { size: 14 })
				),
				h(
					"span",
					{ className: "dshps_actions" },
					h(
						"button",
						{
							type: "button",
							className: "dshps_iconButton",
							"aria-label": t("workspace.newSession", { name: label }),
							title: t("workspace.newSession", { name: label }),
							"data-testid": "pinned-workspace-new-session",
							onClick: (event) => {
								event.stopPropagation();
								onNewSession(item.workspaceId);
							}
						},
						h(primitives.IconPlusOutlineRegular, { size: 14 })
					),
					h(
						"button",
						{
							type: "button",
							className: "dshps_iconButton",
							"aria-label": t("action.unpinWorkspace"),
							title: t("action.unpinWorkspace"),
							"data-testid": "pinned-workspace-unpin",
							onClick: (event) => {
								event.stopPropagation();
								onUnpin(item.workspaceId);
							}
						},
						h(primitives.IconPinFillRegular, { size: 14 })
					)
				)
			);
		}
		/**
		 * One Session listed under an expanded pinned Workspace: the same 32px row
		 * metrics as a pinned session, indented one step, with the native state dot in
		 * the leading cell. Clicking it opens that Session.
		 * @param props - the summary, its live status, the selected flag, dictionary, open.
		 */
		function WorkspaceSessionRow(props) {
			const { summary, status, selected, t, onOpen } = props;
			const label = rowLabel(summary, t);
			const view = statusView(status, summary, t);
			const timeText = view.trailing ?? formatTime(summary.updatedAt, t);
			return h(
				"li",
				{
					className: selected === true ? "dshps_row dshps_nestedRow dshps_rowSelected" : "dshps_row dshps_nestedRow",
					role: "treeitem",
					tabIndex: 0,
					"aria-selected": selected === true ? "true" : "false",
					title: [label, formatTimeAgo(summary.updatedAt, t), view.label].filter((part) => part !== "").join(" · "),
					"aria-label": t("row.open", { title: label }),
					"data-testid": "pinned-workspace-session",
					"data-session-id": summary.id,
					onClick: () => onOpen(summary.id),
					onKeyDown: (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						onOpen(summary.id);
					}
				},
				h("span", { className: "dshps_slot", role: view.state === "idle" ? undefined : "img", "aria-label": view.state === "idle" ? undefined : view.label, "data-testid": view.testid }, view.state === "idle" ? null : h(primitives.StateDot, { state: view.state })),
				h("span", { className: "dshps_title" }, label),
				h("span", { className: "dshps_time", "aria-hidden": "true" }, timeText)
			);
		}
		/** The 「置顶」 group: a native-shaped header plus its session rows. */
		function PinnedSection(props) {
			const { sessionsStore, workspacesStore, statusStore, scheduleMarks, shortcutsStore, openSession, openWorkspace, pinSession, unpinSession, archiveSession, renameSession, forkSession, copySessionPath, t } = props;
			const sessions = useSnapshot(sessionsStore);
			const workspaces = useSnapshot(workspacesStore);
			/**
			 * `uiSession.sessionStatus` — the same store the native sidebar rows read,
			 * so a run that starts after mount lights this row too.
			 */
			const statuses = useSnapshot(statusStore ?? EMPTY_STATUS_STORE);
			/**
			 * The shared Host task catalog, projected per row the way the native
			 * `sidebar.session.row.leading` seat does: one read for the whole group.
			 */
			const marks = useSnapshot(scheduleMarks ?? EMPTY_SCHEDULE_MARKS_SOURCE);
			/** The global shortcut catalog, so menu rows carry the native key chips. */
			const shortcuts = useSnapshot(shortcutsStore ?? EMPTY_SHORTCUTS_STORE);
			/**
			 * The Session the main view is showing, by the native browser's own rule —
			 * `retainedBy.mainView` — so a pinned row highlights exactly when the
			 * native row for the same Session highlights.
			 */
			const currentSessionId = currentSessionOf(sessions);
			const togglePin = (sessionId) => {
				if ((workspaces.pinnedSessionIds ?? []).includes(sessionId)) unpinSession(sessionId);
				else pinSession(sessionId);
			};
			const [collapsed, setCollapsed] = react.useState(readCollapsed);
			const [searchOpen, setSearchOpen] = react.useState(false);
			const [query, setQuery] = react.useState("");
			/** `{ sessionId, title }` while the rename dialog is open, else null. */
			const [renaming, setRenaming] = react.useState(null);
			/** Transient confirmation line for the copy actions. */
			const [notice, setNotice] = react.useState(null);
			/** Whether dsh-session-path's copy route answered once for this app. */
			const [hasPathCopy, setHasPathCopy] = react.useState(false);
			/** Whether the Workspace picker (the header's ＋) is showing its menu. */
			const [pickerOpen, setPickerOpen] = react.useState(false);
			/** Pinned Workspaces whose Sessions are unfolded inside the group. */
			const [expandedIds, setExpandedIds] = react.useState(readExpandedWorkspaces);
			useMinuteClock();
			const ids = pinnedSessionIds(sessions, workspaces);
			/*
			 * The Workspace half of the group. `workspaces.list` is the Host's own
			 * registry, so a renamed or deleted Workspace propagates without this
			 * plugin knowing; only the pin choice itself lives here (the Host models
			 * pins for Sessions, not for Workspaces).
			 */
			const pinnedWorkspaceIds = useSnapshot(pinnedWorkspaceSource);
			/**
			 * Probe the session-path copy route once, with a real Session id: the item
			 * only exists while the `dsh-session-path` plugin answers there, and a host
			 * without it simply never shows the row (its 404 HTML is not JSON).
			 */
			react.useEffect(() => {
				const probeId = ids[0];
				if (probeId === undefined || typeof fetch !== "function") return undefined;
				let alive = true;
				fetch(`${SESSION_PATH_ROUTE}?sessionId=${encodeURIComponent(probeId)}`, { headers: { accept: "application/json" } })
					.then((response) => response.ok ? response.json() : null)
					.then((body) => {
						if (alive && body !== null && body.ok === true) setHasPathCopy(true);
					})
					.catch(() => {});
				return () => {
					alive = false;
				};
			}, [ids[0]]);
			/** Clear the copy confirmation on its own after the native notice's beat. */
			react.useEffect(() => {
				if (notice === null) return undefined;
				const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
				return () => window.clearTimeout(timer);
			}, [notice]);
			const announce = (text) => setNotice({ text, at: Date.now() });
			const copyId = (sessionId) => {
				void writeClipboard(sessionId).then((ok) => {
					announce(t(ok ? "toast.sessionIdCopied" : "toast.copyFailed"));
				});
			};
			const copyPath = (sessionId) => {
				void (copySessionPath === undefined ? Promise.reject(new Error("no session-path face")) : copySessionPath(sessionId))
					.then((ok) => {
						announce(t(ok === true ? "toast.sessionPathCopied" : "toast.copyFailed"));
					})
					.catch(() => {
						announce(t("toast.copyFailed"));
					});
			};
			const openRename = (sessionId, title) => setRenaming({ sessionId, title });
			const settleRename = () => setRenaming(null);
			const commitRename = async (sessionId, title) => {
				if (renameSession === undefined) return;
				await renameSession(sessionId, title);
				setRenaming(null);
			};
			const archivedCount = archivedPinnedCount(sessions, workspaces);
			const pinned = ids.flatMap((id) => {
				const summary = sessions.byId[id];
				return summary === undefined ? [] : [summary];
			});
			/** A non-blank query is what makes the count read `matched/total`. */
			const searching = query.trim() !== "";
			const rows = filterRows(pinned, query, t);
			/* The Workspace rows ride the same query, drawn above the session rows. */
			const workspaceItems = pinnedWorkspaceItems(workspaces, pinnedWorkspaceIds);
			const workspaceRows = filterWorkspaceItems(workspaceItems, query, t);
			const totalCount = workspaceItems.length + ids.length;
			const matchedCount = workspaceRows.length + rows.length;
			/** Workspaces the picker can still offer (everything not pinned yet). */
			const pickable = (workspaces.items ?? []).filter((item) => !pinnedWorkspaceIds.includes(item.workspaceId));
			const toggleWorkspace = (workspaceId) => pinnedWorkspaceSource.toggle(workspaceId);
			/** Folder semantics: a click unfolds the Workspace's Sessions, it creates nothing. */
			const toggleExpanded = (workspaceId) => setExpandedIds((current) => {
				const next = current.includes(workspaceId) ? current.filter((id) => id !== workspaceId) : [...current, workspaceId];
				try {
					window.localStorage?.setItem(EXPANDED_KEY, JSON.stringify(next));
				} catch {
					/* storage denied — the in-memory choice still applies */
				}
				return next;
			});
			const toggle = () => setCollapsed((value) => {
				writeCollapsed(!value);
				return !value;
			});
			/** Opening the search expands the group; closing it clears the query. */
			const toggleSearch = () => {
				if (searchOpen) {
					setQuery("");
					setSearchOpen(false);
					return;
				}
				setSearchOpen(true);
				if (collapsed) {
					setCollapsed(false);
					writeCollapsed(false);
				}
			};
			return h(
				"section",
				{ className: "dshps_section", "aria-label": t("section.aria"), "data-testid": "pinned-sessions-section" },
				h(
					"div",
					{
						className: "dshps_head",
						role: "button",
						tabIndex: 0,
						"aria-expanded": collapsed ? "false" : "true",
						"aria-label": collapsed ? t("section.expand") : t("section.collapse"),
						"data-testid": "pinned-sessions-head",
						onClick: toggle,
						onKeyDown: (event) => {
							if (event.key !== "Enter" && event.key !== " ") return;
							event.preventDefault();
							toggle();
						}
					},
					h("span", { className: "dshps_glyph", "aria-hidden": "true" }, h(primitives.IconPinOutlineRegular, { size: 16 })),
					h("span", { className: collapsed ? "dshps_chevron" : "dshps_chevron dshps_chevronOpen", "aria-hidden": "true" }, h(primitives.IconChevronRightOutlineRegular, { size: 16 })),
					h("span", { className: "dshps_headTitle" }, t("section.title")),
					h("span", { className: "dshps_count" }, searching ? t("section.countFiltered", { matched: matchedCount, count: totalCount }) : t("section.count", { count: totalCount })),
					h(
						"a",
						{
							className: "dshps_chip",
							href: NPM_URL,
							target: "_blank",
							rel: "noopener noreferrer",
							title: t("chip.open", { name: PACKAGE_NAME, version: PACKAGE_VERSION }),
							"aria-label": t("chip.open", { name: PACKAGE_NAME, version: PACKAGE_VERSION }),
							"data-testid": "pinned-sessions-npm",
							/*
							 * The header is a collapse toggle, so the chip must swallow its
							 * own pointer and key events — without preventing the default,
							 * which is what opens the npm page.
							 */
							onClick: (event) => {
								event.stopPropagation();
							},
							onKeyDown: (event) => {
								event.stopPropagation();
							}
						},
						`${PACKAGE_SHORT_NAME} v${PACKAGE_VERSION}`
					),
					h(
						"span",
						{ className: "dshps_headActions" },
						/*
						 * The Workspace picker: the Host's own Workspace rows carry no
						 * seat a plugin may extend, so pinning starts here instead of
						 * from the native workspace header.
						 */
						h(
							primitives.Menu,
							{
								open: pickerOpen,
								onClose: () => setPickerOpen(false),
								portal: true,
								closeOnPointerLeave: true,
								anchor: h(
									"button",
									{
										type: "button",
										className: "dshps_iconButton",
										"aria-label": t("picker.open"),
										title: t("picker.open"),
										"aria-haspopup": "menu",
										"aria-expanded": pickerOpen ? "true" : "false",
										"data-testid": "pinned-workspace-picker",
										onClick: (event) => {
											event.stopPropagation();
											setPickerOpen((value) => !value);
										}
									},
									h(primitives.IconPlusOutlineRegular, { size: 14 })
								)
							},
							pickable.length === 0
								? h("p", { className: "dshps_pickerEmpty", "data-testid": "pinned-workspace-picker-empty" }, t("picker.empty"))
								: pickable.map((item) => h(MenuRow, {
									key: item.workspaceId,
									t,
									label: workspaceLabelOf(item, t),
									icon: primitives.IconFolderOpenOutlineRegular,
									onSelect: () => {
										setPickerOpen(false);
										toggleWorkspace(item.workspaceId);
									},
									testid: "pinned-workspace-pick"
								}))
						),
						h(
							"button",
							{
								type: "button",
								className: "dshps_iconButton",
								"aria-label": searchOpen ? t("search.close") : t("search.open"),
								title: searchOpen ? t("search.close") : t("search.open"),
								"aria-expanded": searchOpen ? "true" : "false",
								"data-testid": "pinned-sessions-search-toggle",
								onClick: (event) => {
									event.stopPropagation();
									toggleSearch();
								}
							},
							h(primitives.IconSearchOutlineRegular, { size: 14 })
						)
					)
				),
				!collapsed && searchOpen
					? h(
						"div",
						{ className: "dshps_search" },
						h("input", {
							type: "search",
							className: "dshps_input",
							value: query,
							autoFocus: true,
							placeholder: t("search.placeholder"),
							"aria-label": t("search.placeholder"),
							"data-testid": "pinned-sessions-search",
							onChange: (event) => setQuery(event.target.value),
							onKeyDown: (event) => {
								if (event.key !== "Escape") return;
								event.preventDefault();
								event.stopPropagation();
								setQuery("");
								setSearchOpen(false);
							}
						})
					)
					: null,
				collapsed
					? null
					: totalCount === 0
						? h("p", { className: "dshps_hint", "data-testid": "pinned-sessions-hint" }, t("section.hint"))
						: matchedCount === 0
							? h("p", { className: "dshps_hint", "data-testid": "pinned-sessions-no-match" }, t("section.noMatch"))
							: h(
							"ul",
							{ className: "dshps_list", role: "group", "data-testid": "pinned-sessions-list" },
							[
								/* Folders above Sessions: the group's Workspace rows first. */
								...workspaceRows.flatMap((item) => {
									const expanded = expandedIds.includes(item.workspaceId);
									const children = expanded ? workspaceSessions(workspaces, sessions, item) : [];
									const folderRow = h(PinnedWorkspaceRow, {
										key: `workspace:${item.workspaceId}`,
										item,
										count: Array.isArray(item.sessionIds) ? item.sessionIds.length : 0,
										expanded,
										t,
										onToggle: toggleExpanded,
										onNewSession: openWorkspace ?? (() => {}),
										onUnpin: toggleWorkspace
									});
									if (!expanded) return [folderRow];
									if (children.length === 0) {
										return [folderRow, h("li", { key: `workspace:${item.workspaceId}:empty`, className: "dshps_nestedEmpty", "data-testid": "pinned-workspace-empty" }, t("workspace.empty"))];
									}
									return [
										folderRow,
										...children.map((summary) => h(WorkspaceSessionRow, {
											key: `${item.workspaceId}:${summary.id}`,
											summary,
											status: statusOf(statuses, summary.id),
											selected: summary.id === currentSessionId,
											t,
											onOpen: openSession
										}))
									];
								}),
								...rows.map((summary) => h(PinnedRow, {
									key: summary.id,
									summary,
									status: statusOf(statuses, summary.id),
									scheduleCount: scheduleCountOf(marks, summary.id),
									where: owningWorkspaceLabel(workspaces, summary.id, t),
									selected: summary.id === currentSessionId,
									pinned: (workspaces.pinnedSessionIds ?? []).includes(summary.id),
									shortcuts,
									hasPathCopy,
									t,
									onOpen: openSession,
									onPin: togglePin,
									onRename: openRename,
									onFork: forkSession,
									onArchive: archiveSession,
									onCopyId: copyId,
									onCopyPath: copyPath
								}))
							]
						),
				!collapsed && archivedCount > 0 ? h("p", { className: "dshps_note" }, t("section.note.archived", { count: archivedCount })) : null,
				renaming === null ? null : h(RenameDialog, {
					key: renaming.sessionId,
					sessionId: renaming.sessionId,
					title: renaming.title,
					t,
					onClose: settleRename,
					onCommit: commitRename
				}),
				notice === null ? null : h("div", { className: "dshps_notice", role: "status", "data-testid": "pinned-sessions-notice" }, notice.text)
			);
		}
		//#endregion
		//#region sidebar mount
		/** The renderer's outlet anchor for the native Workspace browser. */
		const ANCHOR_SELECTOR = 'div[data-slot="sidebar.workspaces"]';
		/** Belt-and-braces revalidation interval; the observer alone can miss a swap. */
		const RECONCILE_MS = 1500;
		/** The native browser root rendered by the `sidebar.workspaces` occupant. */
		function sidebarRoot() {
			if (typeof document === "undefined") return null;
			const region = document.querySelector(ANCHOR_SELECTOR);
			return region === null ? null : region.firstElementChild;
		}
		/** The list area inside the browser root (header stays outside it). */
		function listAreaOf(root) {
			for (const child of root.children) {
				if (typeof child.className === "string" && child.className.includes("listArea")) return child;
			}
			return null;
		}
		/**
		 * The rows' own scroll container: the element whose scoped class token ends
		 * in `list`. The pinned section goes in at its top so the two share one
		 * scroll region instead of the section squeezing the list's height.
		 */
		function scrollerOf(listArea) {
			for (const element of listArea.querySelectorAll("div")) {
				const className = element.className;
				if (typeof className !== "string") continue;
				for (const token of className.split(/\s+/u)) {
					if (/(^|_)list$/u.test(token)) return element;
				}
			}
			return null;
		}
		/** Whether the browser is collapsed to its rail (no list to mount into). */
		function isRail(root) {
			return typeof root.className === "string" && /(^|\s)[^\s]*rail(\s|$)/u.test(root.className);
		}
		/**
		 * The native browser keeps the pinned section out of the way while it shows
		 * search results, where a floating group on top would just cover them.
		 */
		function searchShowing(listArea) {
			return listArea.querySelector('[class*="searchResultRow"]') !== null;
		}
		/**
		 * Own the host node at the top of the native list's scroll container.
		 *
		 * The section is additive: when the container cannot be found (rail state,
		 * search results, an unknown future layout) the host is detached and the
		 * native list renders exactly as shipped.
		 *
		 * @param active - whether the visibility preference allows mounting.
		 * @returns the element to portal into, or null.
		 */
		function useListScrollerHost(active) {
			const [host, setHost] = react.useState(null);
			react.useEffect(() => {
				if (!active || typeof document === "undefined") {
					setHost(null);
					return void 0;
				}
				const node = document.createElement("div");
				node.className = "dshps_host";
				node.setAttribute("data-dsh-pinned-sessions", "");
				let attached = false;
				let disposed = false;
				let observer = null;
				const detach = () => {
					if (node.parentNode !== null) node.parentNode.removeChild(node);
					if (attached) {
						attached = false;
						setHost(null);
					}
				};
				const ensure = () => {
					if (disposed) return;
					const root = sidebarRoot();
					const listArea = root === null || isRail(root) ? null : listAreaOf(root);
					const scroller = listArea === null || searchShowing(listArea) ? null : scrollerOf(listArea);
					if (scroller === null) {
						detach();
						return;
					}
					if (node.parentNode !== scroller || node !== scroller.firstElementChild) {
						scroller.insertBefore(node, scroller.firstChild);
					}
					if (!attached) {
						attached = true;
						setHost(node);
					}
				};
				ensure();
				observer = new MutationObserver(() => {
					ensure();
				});
				const observedRoot = sidebarRoot();
				if (observedRoot !== null) {
					observer.observe(observedRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
				}
				const timer = window.setInterval(ensure, RECONCILE_MS);
				return () => {
					disposed = true;
					window.clearInterval(timer);
					if (observer !== null) observer.disconnect();
					detach();
				};
			}, [active]);
			return host;
		}
		/** Sidebar section: mounts into the list, or nothing while switched off. */
		function PinnedSectionMount(props) {
			const enabled = react.useSyncExternalStore(enabledSource.subscribe, enabledSource.getSnapshot, enabledSource.getSnapshot);
			const host = useListScrollerHost(enabled);
			if (host === null) return null;
			return reactDom.createPortal(h(PinnedSection, props), host);
		}
		/** Settings → General row: the visibility switch for the sidebar section. */
		function PinnedSettingsRow(props) {
			const { t } = props;
			const enabled = react.useSyncExternalStore(enabledSource.subscribe, enabledSource.getSnapshot, enabledSource.getSnapshot);
			return h(
				"div",
				{ className: "dshps_setting", "data-testid": "pinned-sessions-setting" },
				h(
					"div",
					null,
					h("div", { className: "dshps_settingTitle" }, t("setting.title")),
					h("div", { className: "dshps_settingDesc" }, t("setting.description"))
				),
				h(primitives.Switch, {
					checked: enabled,
					label: t("setting.title"),
					onChange: (next) => enabledSource.set(next)
				})
			);
		}
		//#endregion
		//#region plugin
		/** Dictionary namespace owned by this plugin. */
		const NS = "pinnedSessions";
		/** Client services this plugin reads. */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"uiWorkspace",
			"uiSession",
			"locale"
		];
		/**
		 * Register the sidebar section.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "@vfvrpq/dsh-pinned-sessions: dictionaries");
			const { sessions, workspaces, uiWorkspace, uiSession } = ctx;
			/**
			 * The shortcut catalog, read without declaring it: the menu rows fall back
			 * to label-only when a composition exposes no shortcut service.
			 */
			const shortcuts = (() => {
				try {
					return typeof ctx.get === "function" ? ctx.get("shortcuts") : undefined;
				} catch {
					return undefined;
				}
			})();
			/**
			 * The scheduled-task mark source. Its Remote face is wired from a waiting
			 * sub-fiber instead of a required `inject`: cordis refuses an undeclared
			 * service read, and a required declaration would keep this whole group
			 * from loading on a composition without the Schedule face — there the
			 * sub-fiber simply never runs and the rows carry no clock.
			 */
			const scheduleMarks = createScheduleMarks();
			if (typeof ctx.inject === "function") {
				ctx.inject(["remote", "remote.schedule"], (inner) => scheduleMarks.attach({
					list: () => inner.remote.schedule.catalog(),
					subscribeChanged: (listener) => inner.remote.$on("schedule/changed", listener),
					subscribeReset: (listener) => inner.on("connection/reset", listener)
				}));
			}
			/**
			 * The Workspace row's own context menu (重命名 / 在文件夹显示 / 删除工作区) is not a
			 * slot: ui-workspace contributes those items through the generic `contextMenus`
			 * registry, so this plugin adds one more entry to that same menu instead of
			 * drawing a competing one. A waiting sub-fiber keeps the group loading on a
			 * host that predates the registry.
			 */
			if (typeof ctx.inject === "function") {
				const labels = ctx.locale.bind(NS);
				ctx.inject(["contextMenus"], (inner) => {
					inner.effect(() => inner.contextMenus.register({
						id: "pinned-sessions.workspace-pin",
						target: "workspace",
						/* Before 重命名 (100), so pinning sits first like it does on a session. */
						order: 50,
						/* The label flips while the menu stays open, once the pin lands. */
						observe: () => [pinnedWorkspaceSource],
						resolve: (value) => {
							const workspaceId = value?.workspaceId;
							if (typeof workspaceId !== "string" || workspaceId === "") return [];
							const pinned = pinnedWorkspaceSource.getSnapshot().includes(workspaceId);
							return [{
								id: "toggle",
								label: labels(pinned ? "menu.unpinWorkspace" : "menu.pinWorkspace"),
								/*
								 * ui-workspace already registers these two keys on the
								 * `contextMenu.icon` seat, so the entry carries the native
								 * pin glyph without shipping an icon of its own.
								 */
								icon: { key: pinned ? "workspace.unpin" : "workspace.pin" },
								run: () => pinnedWorkspaceSource.toggle(workspaceId)
							}];
						}
					}));
				});
			}
			const face = () => ({
				sessionsStore: sessions.list,
				workspacesStore: workspaces.list,
				/**
				 * Live Session status, shared with the native rows: `running`,
				 * `pendingInteraction` and `completionUnread`. Reading the summary's
				 * own `running` flag is not enough — that snapshot keeps the value it
				 * loaded with, while later runs arrive as `api-session/status` events.
				 */
				statusStore: uiSession.sessionStatus,
				/** Active scheduled-task counts for every Session, from the Host catalog. */
				scheduleMarks,
				/** The global shortcut catalog, for the menu rows' native key chips. */
				shortcutsStore: shortcuts?.catalog,
				openSession: (sessionId) => {
					uiWorkspace.openSession(sessionId);
				},
				/*
				 * Workspace navigation is the Host's own: `openWorkspace` prepares the
				 * target and commits the navigation, so a pinned Workspace row behaves
				 * exactly like picking that Workspace in the native picker.
				 */
				openWorkspace: (workspaceId) => {
					const opened = uiWorkspace.openWorkspace(workspaceId);
					if (opened !== undefined && typeof opened.catch === "function") {
						opened.catch((reason) => {
							console.warn("@vfvrpq/dsh-pinned-sessions: openWorkspace rejected:", reason);
						});
					}
				},
				/*
				 * The same pin/archive surface the native row's hover buttons call
				 * (`workspaces.pinSession` / `unpinSession` / `archiveSession`), so both
				 * rows perform one action with one implementation.
				 */
				pinSession: (sessionId) => {
					workspaces.pinSession(sessionId).catch((reason) => {
						console.warn("@vfvrpq/dsh-pinned-sessions: pin rejected:", reason);
					});
				},
				unpinSession: (sessionId) => {
					workspaces.unpinSession(sessionId).catch((reason) => {
						console.warn("@vfvrpq/dsh-pinned-sessions: unpin rejected:", reason);
					});
				},
				archiveSession: (sessionId) => {
					workspaces.archiveSession(sessionId).catch((reason) => {
						console.warn("@vfvrpq/dsh-pinned-sessions: archive rejected:", reason);
					});
				},
				renameSession: (sessionId, title) => workspaces.rename(sessionId, title),
				forkSession: (sessionId) => {
					uiWorkspace.forkSession(sessionId, undefined, { allowMigration: false }).catch((reason) => {
						console.warn("@vfvrpq/dsh-pinned-sessions: fork rejected:", reason);
					});
				},
				/**
				 * Copy one Session's log path through `dsh-session-path`'s own route: the
				 * menu row only appears once that route answered (see the section probe),
				 * so a host without the plugin never offers the action.
				 * @returns whether the clipboard accepted the path.
				 */
				copySessionPath: async (sessionId) => {
					if (typeof fetch !== "function") return false;
					const response = await fetch(`${SESSION_PATH_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`, { headers: { accept: "application/json" } });
					const body = await response.json().catch(() => null);
					if (!response.ok || body === null || body.ok !== true) return false;
					const text = typeof body.value?.text === "string" && body.value.text !== "" ? body.value.text : body.value?.logPath ?? "";
					if (text === "") return false;
					return writeClipboard(text);
				}
			});
			/*
			 * `shell.overlay` is the always-mounted application surface seat; the
			 * component contributes no overlay content of its own — it only portals
			 * the section into the sidebar.
			 */
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "pinned-sessions-section",
				locale: NS,
				inject: face
			}, PinnedSectionMount));
			/*
			 * Settings → General carries the on/off switch, so turning the group off
			 * never means editing a config file by hand.
			 */
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "pinned-sessions",
				order: 30,
				locale: NS
			}, PinnedSettingsRow));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		/** Test seam: the pure pieces `test/bundle-check.mjs` exercises directly. */
		exports.__test__ = { PinnedSection, PinnedRow, PinnedMenu, RenameDialog, PinnedSettingsRow, PinnedWorkspaceRow, WorkspaceSessionRow, enabledSource, pinnedWorkspaceSource, pinnedSessionIds, archivedPinnedCount, pinnedWorkspaceItems, workspaceSessions, filterWorkspaceItems, workspaceLabelOf, owningWorkspaceLabel, filterRows, formatTime, formatTimeAgo, rowLabel, statusView, createScheduleMarks, scheduleCountOf, currentSessionOf, EMPTY_SCHEDULE_MARKS_SOURCE, ANCHOR_SELECTOR };
		return module.exports;
	}
});
