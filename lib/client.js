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
			".dshps_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshps_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
			".dshps_slot{flex:none;width:16px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}",
			".dshps_dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}",
			".dshps_dotUnread{background:var(--dsw-alias-state-success-primary)}",
			".dshps_where{flex:0 1 auto;min-width:0;max-width:40%;margin-right:6px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshps_setting{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l2);display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0}",
			".dshps_settingTitle{font-size:14px;line-height:20px}",
			".dshps_settingDesc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}",
			".dshps_title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;margin:0 6px 0 4px}",
			".dshps_time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;font-variant-numeric:tabular-nums}",
			".dshps_actions{flex:none;display:none;align-items:center;gap:10px}",
			".dshps_row:hover .dshps_actions{display:inline-flex}",
			".dshps_row:hover .dshps_time{display:none}",
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
			"section.aria": "置顶会话",
			"section.count": "{count}",
			"section.countFiltered": "{matched}/{count}",
			"section.hint": "在会话行上点图钉即可置顶",
			"section.noMatch": "没有匹配的置顶会话",
			"section.note.archived": "另有 {count} 个已归档的置顶会话未在此显示",
			"section.collapse": "收起置顶会话",
			"section.expand": "展开置顶会话",
			"search.open": "搜索置顶会话",
			"search.placeholder": "搜索置顶会话",
			"search.close": "关闭搜索",
			"chip.open": "在 npm 上打开 {name} v{version}",
			"row.unread": "待查看",
			"setting.title": "置顶会话区",
			"setting.description": "在侧栏「工作区」列表顶部显示置顶会话分组。",
			"action.unpin": "取消置顶",
			"row.open": "打开会话“{title}”",
			"row.running": "进行中",
			"row.untitled": "未命名会话",
			"time.justNow": "刚刚",
			"time.minutes": "{n} 分钟前",
			"time.hours": "{n} 小时前",
			"time.days": "{n} 天前",
			"time.older": "{date}"
		};
		/** English copy, same key set. */
		const en = {
			"section.title": "Pinned",
			"section.aria": "Pinned sessions",
			"section.count": "{count}",
			"section.countFiltered": "{matched}/{count}",
			"section.hint": "Pin a session from its row to keep it here",
			"section.noMatch": "No pinned session matches that search",
			"section.note.archived": "{count} archived pinned session(s) are hidden here",
			"section.collapse": "Collapse pinned sessions",
			"section.expand": "Expand pinned sessions",
			"search.open": "Search pinned sessions",
			"search.placeholder": "Search pinned sessions",
			"search.close": "Close search",
			"chip.open": "Open {name} v{version} on npm",
			"row.unread": "Unread",
			"setting.title": "Pinned sessions group",
			"setting.description": "Show a pinned-sessions group at the top of the sidebar's session list.",
			"action.unpin": "Unpin session",
			"row.open": "Open session “{title}”",
			"row.running": "Running",
			"row.untitled": "Untitled session",
			"time.justNow": "just now",
			"time.minutes": "{n} min ago",
			"time.hours": "{n} h ago",
			"time.days": "{n} d ago",
			"time.older": "{date}"
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
		const PACKAGE_VERSION = "0.4.0";
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
		 * Subscribe one framework store to React.
		 * @param store - observable store exposing getSnapshot/subscribe.
		 * @returns the current snapshot.
		 */
		function useSnapshot(store) {
			const subscribe = react.useCallback((listener) => store.subscribe(listener), [store]);
			const getSnapshot = react.useCallback(() => store.getSnapshot(), [store]);
			return react.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
		function archivedPinnedCount(sessions, workspaces) {
			const archived = new Set(workspaces.archivedSessionIds ?? []);
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
				const title = String(item.title ?? "").trim();
				if (title === "default-workspace") return t("workspace.defaultName");
				if (title !== "") return title;
				const base = baseName(item.path);
				return base !== "" ? base : String(item.path ?? "");
			}
			return "";
		}
		/** One status reading, tolerating a host without the status hook. */
		function statusOf(statuses, sessionId) {
			return statuses !== undefined && statuses !== null && typeof statuses.get === "function" ? statuses.get(sessionId) : undefined;
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
		/** Compact relative timestamp. */
		function formatTime(updatedAt, t) {
			if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return "";
			const delta = Date.now() - updatedAt;
			if (delta < 60000) return t("time.justNow");
			const minutes = Math.floor(delta / 60000);
			if (minutes < 60) return t("time.minutes", { n: minutes });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return t("time.hours", { n: hours });
			const days = Math.floor(hours / 24);
			if (days < 30) return t("time.days", { n: days });
			const date = new Date(updatedAt);
			const pad = (value) => String(value).padStart(2, "0");
			return t("time.older", { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` });
		}
		//#endregion
		//#region components
		/** One pinned session, drawn with the native session-row metrics. */
		function PinnedRow(props) {
			const { summary, status, where, t, onOpen, onUnpin } = props;
			const label = rowLabel(summary, t);
			const running = status?.running === true || summary.running === true;
			/** A finished-but-unopened session is the second attention state worth a dot. */
			const unread = !running && status?.completionUnread === true;
			const dotClass = running ? "dshps_dot" : unread ? "dshps_dot dshps_dotUnread" : null;
			const dotLabel = running ? t("row.running") : t("row.unread");
			return h(
				"li",
				{
					className: "dshps_row",
					role: "treeitem",
					tabIndex: 0,
					title: [label, where, formatTime(summary.updatedAt, t)].filter((part) => part !== "").join(" · "),
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
					{ className: "dshps_slot" },
					dotClass === null ? null : h("span", { className: dotClass, role: "img", "aria-label": dotLabel, "data-testid": running ? "pinned-sessions-running" : "pinned-sessions-unread" })
				),
				h("span", { className: "dshps_title" }, label),
				where === "" ? null : h("span", { className: "dshps_where", "data-testid": "pinned-sessions-where" }, where),
				h("span", { className: "dshps_time" }, formatTime(summary.updatedAt, t)),
				h(
					"span",
					{ className: "dshps_actions" },
					h(
						"button",
						{
							type: "button",
							className: "dshps_iconButton",
							"aria-label": t("action.unpin"),
							title: t("action.unpin"),
							"data-testid": "pinned-sessions-unpin",
							onClick: (event) => {
								event.stopPropagation();
								onUnpin(summary.id);
							}
						},
						h(primitives.IconPinOutlineRegular, { size: 14 })
					)
				)
			);
		}
		/** The 「置顶」 group: a native-shaped header plus its session rows. */
		function PinnedSection(props) {
			const { sessionsStore, workspacesStore, openSession, unpinSession, useSessionStatus, t } = props;
			const sessions = useSnapshot(sessionsStore);
			const workspaces = useSnapshot(workspacesStore);
			/** The root status hook is optional: without it the summary's own flag still shows. */
			const statuses = typeof useSessionStatus === "function" ? useSessionStatus((state) => state) : undefined;
			const [collapsed, setCollapsed] = react.useState(readCollapsed);
			const [searchOpen, setSearchOpen] = react.useState(false);
			const [query, setQuery] = react.useState("");
			useMinuteClock();
			const ids = pinnedSessionIds(sessions, workspaces);
			const archivedCount = archivedPinnedCount(sessions, workspaces);
			const pinned = ids.flatMap((id) => {
				const summary = sessions.byId[id];
				return summary === undefined ? [] : [summary];
			});
			/** A non-blank query is what makes the count read `matched/total`. */
			const searching = query.trim() !== "";
			const rows = filterRows(pinned, query, t);
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
					h("span", { className: "dshps_count" }, searching ? t("section.countFiltered", { matched: rows.length, count: ids.length }) : t("section.count", { count: ids.length })),
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
					: ids.length === 0
						? h("p", { className: "dshps_hint", "data-testid": "pinned-sessions-hint" }, t("section.hint"))
						: rows.length === 0
							? h("p", { className: "dshps_hint", "data-testid": "pinned-sessions-no-match" }, t("section.noMatch"))
							: h(
							"ul",
							{ className: "dshps_list", role: "group", "data-testid": "pinned-sessions-list" },
							rows.map((summary) => h(PinnedRow, {
								key: summary.id,
								summary,
								status: statusOf(statuses, summary.id),
								where: owningWorkspaceLabel(workspaces, summary.id, t),
								t,
								onOpen: openSession,
								onUnpin: unpinSession
							}))
						),
				!collapsed && archivedCount > 0 ? h("p", { className: "dshps_note" }, t("section.note.archived", { count: archivedCount })) : null
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
			"locale"
		];
		/**
		 * Register the sidebar section.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "@vfvrpq/dsh-pinned-sessions: dictionaries");
			const { sessions, workspaces, uiWorkspace } = ctx;
			const face = () => ({
				sessionsStore: sessions.list,
				workspacesStore: workspaces.list,
				openSession: (sessionId) => {
					uiWorkspace.openSession(sessionId);
				},
				unpinSession: (sessionId) => {
					workspaces.unpinSession(sessionId).catch((reason) => {
						console.warn("@vfvrpq/dsh-pinned-sessions: unpin rejected:", reason);
					});
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
		exports.__test__ = { PinnedSection, PinnedRow, PinnedSettingsRow, enabledSource, pinnedSessionIds, archivedPinnedCount, owningWorkspaceLabel, filterRows, formatTime, rowLabel, ANCHOR_SELECTOR };
		return module.exports;
	}
});
