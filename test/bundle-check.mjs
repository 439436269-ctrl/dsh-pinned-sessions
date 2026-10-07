/**
 * Static + render smoke test for the @vfvrpq/dsh-pinned-sessions client bundle.
 *
 * It never touches the running DSH: it registers the bundle against a fake
 * `window.__ModuleLoader__`, materializes the factory with a stub `require`
 * (real React for `createElement`, a hook shim so the section can be called
 * outside a renderer, stub primitives for the icons), runs `apply()` against a
 * fake Client Context, and asserts the element tree the pure pieces return.
 *
 * The DOM-mounting half (`PinnedSectionMount`) needs a renderer and a real
 * sidebar, so it is covered by the Playwright pass described in VERIFY.md; here
 * only its anchor selector is pinned down.
 *
 * Run: <bundled node> test/bundle-check.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const profile = process.env.DSH_PROFILE_DIR ?? join(process.env.HOME ?? "", ".dsh/profiles/desktop");
/**
 * Resolve React from whichever place has it: the DSH profile first (a real
 * install resolves it there), then this package's own node_modules so a bare
 * `npm i && npm test` works in CI. The bundle itself never imports React — this
 * seam exists only to render the component tree outside a browser.
 * @returns the React module.
 */
function loadReact() {
	const tried = [];
	for (const base of [profile, root]) {
		try {
			return createRequire(join(base, "package.json"))("react");
		} catch (error) {
			tried.push(`${base}: ${error.code ?? error.message}`);
		}
	}
	throw new Error(`react is required to run this test but was not found:\n  ${tried.join("\n  ")}\nRun \`npm i\`, or point DSH_PROFILE_DIR at a profile that has react.`);
}
const React = loadReact();

let failures = 0;
function check(label, condition, extra) {
	const ok = Boolean(condition);
	if (!ok) failures += 1;
	console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || extra === undefined ? "" : ` — ${extra}`}`);
}

//#region package + patch declarations
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
check("package name is stable", pkg.name === "@vfvrpq/dsh-pinned-sessions", pkg.name);
check('exports["./client"] resolves to a bundle', typeof pkg.exports?.["./client"]?.default === "string");
check("dsh.client.platform is web", pkg.dsh?.client?.platform === "web");
check("dsh.client.inject names the sidebar + workspace hosts", ["@deepseek-ai/dsh-client-ui-sidebar", "@deepseek-ai/dsh-client-ui-workspace"].every((name) => pkg.dsh?.client?.inject?.includes(name)));
check("engines.dsh declares a DSH range", typeof pkg.engines?.dsh === "string");
const patch = readFileSync(join(root, pkg.dsh?.bundle?.patch ?? "cordis.patch.yml"), "utf8");
check("patch row name equals the package name", new RegExp(`name:\\s*'?"?${pkg.name}\\b`).test(patch));
//#endregion

//#region bundle registration + materialization
const source = readFileSync(join(root, pkg.exports["./client"].default), "utf8");

const icon = (name) => function Icon(props) {
	return React.createElement("svg", { "data-icon": name, width: props?.size });
};
const primitives = new Proxy({}, {
	get: (_target, name) => {
		if (name === "Switch") {
			return function Switch(props) {
				return React.createElement("button", {
					role: "switch",
					"aria-checked": props.checked === true ? "true" : "false",
					title: props.label,
					"data-testid": "fake-switch",
					onClick: () => props.onChange?.(props.checked !== true)
				});
			};
		}
		return typeof name === "string" && name.startsWith("Icon") ? icon(name) : undefined;
	}
});
const reactDom = { createPortal: (children, container) => React.createElement("portal", { "data-target": container?.className }, children) };

let registrations = [];
let dictionary;
let registration;
/** Materialize the bundle with a given React face and run apply() against a fake Client Context. */
function boot(reactFace) {
	const fakeWindow = { __ModuleLoader__: { load: (entry) => { registration = entry; } }, localStorage: undefined, setTimeout: () => 0 };
	new Function("window", source)(fakeWindow);
	const exported = registration.factory((name) => {
		if (name === "react") return reactFace;
		if (name === "react-dom") return reactDom;
		if (name === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected require("${name}")`);
	});
	const rows = [];
	const warning = console.warn;
	console.warn = () => {};
	exported.apply({
		sessions: { list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => {} } },
		workspaces: {
			list: { getSnapshot: () => ({ items: [], pinnedSessionIds: [], archivedSessionIds: [] }), subscribe: () => () => {} },
			pinSession: async () => {},
			unpinSession: async () => {}
		},
		uiWorkspace: { openSession: () => {} },
		locale: {
			register: (ns, dicts) => { dictionary = { ns, dicts }; return () => {}; },
			bind: (ns) => (key, params) => {
				const template = dictionary?.dicts?.zh?.[key] ?? key;
				return params === undefined ? template : template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
			}
		},
		effect: (callback) => callback(),
		slots: {
			inject: (_name, callback) => { callback(); },
			register: (options, component) => { rows.push({ options, component }); return () => {}; }
		}
	});
	console.warn = warning;
	registrations = rows;
	return { exported, rows };
}

const shimmed = { ...React, useState: () => [undefined, () => {}], useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect: () => {}, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
const booted = boot(shimmed);
check("bundle registers with the module loader", registration !== undefined);
check("registered id equals the package name", registration?.id === pkg.name, registration?.id);
check("bundle exports apply()", typeof booted.exported.apply === "function");
check("bundle exports inject[]", Array.isArray(booted.exported.inject));
check("inject declares every service the plugin reads", ["slots", "sessions", "workspaces", "uiWorkspace", "locale"].every((name) => booted.exported.inject.includes(name)), booted.exported.inject.join(","));
//#endregion

//#region apply() registrations
check("registers exactly two slot entries", registrations.length === 2, registrations.map((row) => `${row.options.name}#${row.options.id}`).join(","));
const section = registrations.find((row) => row.options.name === "shell.overlay");
const settingsEntry = registrations.find((row) => row.options.name === "settings.general.item");
check("the section mounts on the always-rendered shell.overlay seat", section?.options.name === "shell.overlay", section?.options.name);
check("the section id is stable", section?.options.id === "pinned-sessions-section", section?.options.id);
check("the section uses the pinnedSessions dictionary", section?.options.locale === "pinnedSessions");
check("the visibility switch is a settings.general.item row", settingsEntry?.options.id === "pinned-sessions" && settingsEntry?.options.order === 30, `${settingsEntry?.options.id}@${settingsEntry?.options.order}`);
check("the settings row uses the same dictionary", settingsEntry?.options.locale === "pinnedSessions");
check("zh and en dictionaries share one key set", JSON.stringify(Object.keys(dictionary.dicts.zh).sort()) === JSON.stringify(Object.keys(dictionary.dicts.en).sort()));
const injected = typeof section.options.inject === "function" ? section.options.inject() : undefined;
check("inject face exposes the stores and both mutations", injected !== undefined && typeof injected.openSession === "function" && typeof injected.unpinSession === "function" && typeof injected.sessionsStore?.getSnapshot === "function" && typeof injected.workspacesStore?.getSnapshot === "function", Object.keys(injected ?? {}).join(","));
check("anchor selector targets the workspace outlet", booted.exported.__test__?.ANCHOR_SELECTOR === 'div[data-slot="sidebar.workspaces"]', booted.exported.__test__?.ANCHOR_SELECTOR);
//#endregion

//#region visibility preference
const { enabledSource } = booted.exported.__test__;
check("the section starts visible", enabledSource.getSnapshot() === true, String(enabledSource.getSnapshot()));
let prefNotifications = 0;
const stopPref = enabledSource.subscribe(() => { prefNotifications += 1; });
enabledSource.set(false);
check("switching it off flips the shared source and notifies", enabledSource.getSnapshot() === false && prefNotifications === 1, `value=${enabledSource.getSnapshot()} notifications=${prefNotifications}`);
enabledSource.set(true);
stopPref();
check("switching it back on restores the default", enabledSource.getSnapshot() === true && prefNotifications === 2, String(enabledSource.getSnapshot()));
//#endregion

//#region render smoke test
/**
 * Expand one element tree the way a renderer would: function components are
 * invoked (only the section uses hooks, and it gets the shim), the rest keep
 * their props with their children expanded.
 */
function expand(node) {
	if (Array.isArray(node)) return node.map(expand);
	if (!React.isValidElement(node)) return node;
	if (typeof node.type === "function") return expand(node.type(node.props));
	const children = React.Children.toArray(node.props?.children).map(expand);
	return React.cloneElement(node, undefined, children.length === 0 ? undefined : children);
}
/** Render the section with a hook shim; `stateOverrides` feeds useState in call order. */
/**
 * One materialized bundle instance for every render below — the real app has
 * exactly one, and the shared preference source is module state inside it, so a
 * fresh boot per render would test a different instance than the one the
 * settings row writes to.
 */
const shimState = { overrides: [], index: 0 };
const sharedFace = {
	...React,
	useState: (initial) => {
		const slot = shimState.index++;
		const value = typeof initial === "function" ? initial() : initial;
		return [slot < shimState.overrides.length ? shimState.overrides[slot] : value, () => {}];
	},
	useCallback: (fn) => fn,
	useMemo: (fn) => fn(),
	useEffect: () => {},
	useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot()
};
const liveBundle = boot(sharedFace);
/** Render one component from the shared bundle, resetting the hook counters. */
function renderComponent(name, props, stateOverrides = []) {
	shimState.overrides = stateOverrides;
	shimState.index = 0;
	return expand(liveBundle.exported.__test__[name](props));
}
function renderSection(props, stateOverrides = []) {
	return renderComponent("PinnedSection", props, stateOverrides);
}
/** Depth-first collection by testid. */
function collect(node, testid, out = []) {
	if (Array.isArray(node)) {
		for (const child of node) collect(child, testid, out);
		return out;
	}
	if (!React.isValidElement(node)) return out;
	if (node.props?.["data-testid"] === testid) out.push(node);
	for (const child of React.Children.toArray(node.props?.children)) collect(child, testid, out);
	return out;
}
function collectByClass(node, className, out = []) {
	if (Array.isArray(node)) {
		for (const child of node) collectByClass(child, className, out);
		return out;
	}
	if (!React.isValidElement(node)) return out;
	if (typeof node.props?.className === "string" && node.props.className.split(" ").includes(className)) out.push(node);
	for (const child of React.Children.toArray(node.props?.children)) collectByClass(child, className, out);
	return out;
}
function textOf(node, out = []) {
	if (typeof node === "string" || typeof node === "number") out.push(String(node));
	else if (Array.isArray(node)) for (const child of node) textOf(child, out);
	else if (React.isValidElement(node)) textOf(node.props?.children, out);
	return out.join(" ");
}

const now = Date.now();
const sessionsA = {
	phase: "ready",
	ids: ["s1", "s2", "s3", "s4"],
	byId: {
		s1: { id: "s1", title: "插件笔记：dsh-cost-meter", updatedAt: now - 120000, running: false },
		s2: { id: "s2", title: "ds-harness-remote 使用指南", updatedAt: now - 3600000, running: true },
		s3: { id: "s3", title: "归档会话的实现方式", updatedAt: now - 7200000, running: false },
		s4: { id: "s4", title: "", displayTitle: "default-workspace", updatedAt: now - 90000000, running: false }
	}
};
const workspacesA = {
	phase: "ready",
	items: [
		{ workspaceId: "w1", title: "默认工作区", path: "/Users/x/Documents/deepseek-harness/default-workspace", sessionIds: ["s1", "s2", "s3"] },
		{ workspaceId: "w2", title: "另一个工作区", path: "/Users/x/code/other", sessionIds: ["s4"] }
	],
	pinnedSessionIds: ["s2", "s1", "s4"],
	archivedSessionIds: []
};
const t = (key, params) => {
	const template = dictionary.dicts.zh[key] ?? key;
	return params === undefined ? template : template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
};
const store = (snapshot) => ({ getSnapshot: () => snapshot, subscribe: () => () => {} });
const opened = [];
const unpinned = [];
const baseProps = {
	sessionsStore: store(sessionsA),
	workspacesStore: store(workspacesA),
	openSession: (id) => opened.push(id),
	unpinSession: (id) => unpinned.push(id),
	t
};

const tree = renderSection(baseProps);
check("section declares its testid", tree.props["data-testid"] === "pinned-sessions-section");
const head = collect(tree, "pinned-sessions-head")[0];
check("header shows the section title", textOf(head).includes("置顶"), textOf(head));
check("header carries the pinned count", collectByClass(tree, "dshps_count")[0] !== undefined && textOf(collectByClass(tree, "dshps_count")[0]) === "3", textOf(collectByClass(tree, "dshps_count")[0]));
check("header is a disclosure control, expanded by default", head?.props.role === "button" && head?.props["aria-expanded"] === "true", JSON.stringify(head?.props["aria-expanded"]));
const chip = collect(tree, "pinned-sessions-npm")[0];
const shortName = pkg.name.replace(/^@[^/]+\//u, "");
check("the header carries an npm chip", chip !== undefined && chip.type === "a", JSON.stringify(chip?.type));
check("the chip shows the package name and the package.json version", textOf(chip) === `${shortName} v${pkg.version}`, textOf(chip));
check("the chip links to this package's npm page", chip?.props.href === `https://www.npmjs.com/package/${pkg.name}`, String(chip?.props.href));
check("the chip opens in a new tab without leaking the opener", chip?.props.target === "_blank" && String(chip?.props.rel).includes("noopener"));
check("the chip tooltip names the scoped package and version", String(chip?.props.title).includes(pkg.name) && String(chip?.props.title).includes(pkg.version), String(chip?.props.title));
let chipStoppedPropagation = false;
chip?.props.onClick({ stopPropagation: () => { chipStoppedPropagation = true; } });
check("clicking the chip does not toggle the group", chipStoppedPropagation === true);
const rows = collect(tree, "pinned-sessions-row");
check("every visible pinned session gets a row", rows.length === 3, String(rows.length));
check("rows keep the pin order", JSON.stringify(rows.map((row) => row.props["data-session-id"])) === JSON.stringify(["s2", "s1", "s4"]), rows.map((row) => row.props["data-session-id"]).join(","));
check("rows are native-shaped treeitems", rows.every((row) => row.type === "li" && row.props.role === "treeitem" && row.props.tabIndex === 0));
check("pinned rows expose an unpin toggle", collect(tree, "pinned-sessions-unpin").length === 3, String(collect(tree, "pinned-sessions-unpin").length));
check("running sessions carry the state dot", collectByClass(tree, "dshps_dot").length === 1, String(collectByClass(tree, "dshps_dot").length));
check("each row shows a relative time", textOf(tree).includes("小时前") && textOf(tree).includes("分钟前"), textOf(tree).slice(0, 120));
check("rows carry the owning workspace label", collect(tree, "pinned-sessions-where").map((node) => textOf(node)).join(",") === "默认工作区,默认工作区,另一个工作区", collect(tree, "pinned-sessions-where").map((node) => textOf(node)).join(","));

/** A status map source, exactly the shape the root `sessionStatus` hook hands over. */
const statusMap = new Map([
	["s1", { running: false, completionUnread: true }],
	["s2", { running: true, completionUnread: false }]
]);
const withStatus = renderSection({ ...baseProps, useSessionStatus: () => statusMap });
check("the running dot comes from the status hook", collect(withStatus, "pinned-sessions-running").length === 1, String(collect(withStatus, "pinned-sessions-running").length));
check("a finished-but-unopened session gets the unread dot", collect(withStatus, "pinned-sessions-unread").length === 1, String(collect(withStatus, "pinned-sessions-unread").length));
check("the unread dot is styled apart from the running one", collectByClass(withStatus, "dshps_dotUnread").length === 1);
const noHook = renderSection({ ...baseProps, useSessionStatus: undefined, sessionsStore: store({ ...sessionsA, byId: { ...sessionsA.byId, s1: { ...sessionsA.byId.s1, completionUnread: true } } }) });
check("without the hook only the summary flag can light a dot", collect(noHook, "pinned-sessions-unread").length === 0, String(collect(noHook, "pinned-sessions-unread").length));

//#region settings row
const settingsTree = renderComponent("PinnedSettingsRow", { t });
check("the settings row names the group and explains it", textOf(settingsTree).includes("置顶会话区") && textOf(settingsTree).includes("工作区"), textOf(settingsTree));
check("the settings row renders the native switch", collect(settingsTree, "fake-switch").length === 1);
const switchOff = collect(settingsTree, "fake-switch")[0];
check("the switch reflects the shared preference", switchOff?.props["aria-checked"] === "true", String(switchOff?.props["aria-checked"]));
switchOff.props.onClick();
check("flipping the switch writes the shared preference", liveBundle.exported.__test__.enabledSource.getSnapshot() === false, String(liveBundle.exported.__test__.enabledSource.getSnapshot()));
const settingsOff = renderComponent("PinnedSettingsRow", { t });
check("the row re-renders switched off", collect(settingsOff, "fake-switch")[0]?.props["aria-checked"] === "false");
liveBundle.exported.__test__.enabledSource.set(true);
check("and can be switched back on", liveBundle.exported.__test__.enabledSource.getSnapshot() === true);
//#endregion
rows[0].props.onClick();
check("clicking a row opens that session", JSON.stringify(opened) === JSON.stringify(["s2"]), JSON.stringify(opened));
const unpinButton = collect(rows[0], "pinned-sessions-unpin")[0];
unpinButton.props.onClick({ stopPropagation: () => {} });
check("the unpin toggle unpins without opening", JSON.stringify(unpinned) === JSON.stringify(["s2"]) && opened.length === 1, JSON.stringify(unpinned));

const collapsed = renderSection(baseProps, [true]);
check("a collapsed section hides its rows", collect(collapsed, "pinned-sessions-row").length === 0 && collect(collapsed, "pinned-sessions-list").length === 0);
check("a collapsed section still shows its header", collect(collapsed, "pinned-sessions-head")[0]?.props["aria-expanded"] === "false");
check("a collapsed section hides the empty-state hint too", collect(collapsed, "pinned-sessions-hint").length === 0);

const emptyTree = renderSection({ ...baseProps, workspacesStore: store({ ...workspacesA, pinnedSessionIds: [] }) });
check("an empty section shows the pin hint", collect(emptyTree, "pinned-sessions-hint").length === 1 && textOf(emptyTree).includes("点图钉"), textOf(emptyTree));

const archived = renderSection({ ...baseProps, workspacesStore: store({ ...workspacesA, archivedSessionIds: ["s4"] }) });
check("archived pins stay hidden, with a note", collect(archived, "pinned-sessions-row").length === 2 && textOf(archived).includes("已归档"), textOf(archived).slice(0, 160));

const subagent = renderSection({
	...baseProps,
	sessionsStore: store({ ...sessionsA, ids: [...sessionsA.ids, "s5"], byId: { ...sessionsA.byId, s5: { id: "s5", title: "子代理会话", origin: "subagent", updatedAt: now, running: false } } }),
	workspacesStore: store({ ...workspacesA, pinnedSessionIds: [...workspacesA.pinnedSessionIds, "s5"] })
});
check("subagent sessions never surface", collect(subagent, "pinned-sessions-row").length === 3, String(collect(subagent, "pinned-sessions-row").length));

const enTree = renderSection({ ...baseProps, t: (key, params) => {
	const template = dictionary.dicts.en[key] ?? key;
	return params === undefined ? template : template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
} });
check("english copy renders from the same keys", textOf(enTree).includes("Pinned") && collect(enTree, "pinned-sessions-row").length === 3, textOf(enTree).slice(0, 80));
//#endregion

//#region outline glyph + in-group search
const iconName = (node) => React.Children.toArray(node?.props?.children)[0]?.props?.["data-icon"];
const glyph = collectByClass(tree, "dshps_glyph")[0];
check("the group glyph is the outline pin, matching the sidebar's other entries", iconName(glyph) === "IconPinOutlineRegular", String(iconName(glyph)));
/*
 * Rows do not repeat a pin marker: every row in this group is pinned, so the
 * marker would be noise and it costs title width in a 256px sidebar. The marker
 * stays on the header (navigation); a native list row keeps its own (state).
 */
check("rows do not repeat the pin marker", collectByClass(rows[0], "dshps_pin").length === 0);
check("the row tooltip carries the title, the workspace and the time", String(rows[0]?.props.title).includes("默认工作区") && String(rows[0]?.props.title).includes("小时前"), String(rows[0]?.props.title));

/*
 * Native convention, from @deepseek-ai/dsh-client-ui-workspace's Rows.module.css:
 * `<IconTriangleRightFillRegular className={clsx(arrow, row.expanded && arrowOpen)} />`
 * with `.arrowOpen{transform:rotate(90deg)}` — the arrow rotates when the group is
 * EXPANDED (▾) and stays right (▸) when collapsed. 0.2.0 had this inverted.
 */
const chevronClasses = (node) => collectByClass(node, "dshps_chevron")[0]?.props.className ?? "";
check("an expanded header rotates the disclosure arrow (native convention)", chevronClasses(tree).split(" ").includes("dshps_chevronOpen"), chevronClasses(tree));
check("a collapsed header leaves the disclosure arrow pointing right", !chevronClasses(collapsed).split(" ").includes("dshps_chevronOpen"), chevronClasses(collapsed));

check("the header exposes a search toggle", collect(tree, "pinned-sessions-search-toggle").length === 1);
check("the toggle reports its collapsed state", collect(tree, "pinned-sessions-search-toggle")[0]?.props["aria-expanded"] === "false");
check("search starts closed and renders no input", collect(tree, "pinned-sessions-search").length === 0, String(collect(tree, "pinned-sessions-search").length));
let toggleStopped = false;
collect(tree, "pinned-sessions-search-toggle")[0].props.onClick({ stopPropagation: () => { toggleStopped = true; } });
check("the search toggle does not also collapse the group", toggleStopped);

const searchTree = renderSection(baseProps, [false, true, "插件"]);
const searchInput = collect(searchTree, "pinned-sessions-search")[0];
check("an open search renders the input", searchInput !== undefined);
check("the input carries the localized placeholder", searchInput?.props.placeholder === dictionary.dicts.zh["search.placeholder"], String(searchInput?.props.placeholder));
const filteredRows = collect(searchTree, "pinned-sessions-row");
check("search narrows the rows to matching titles", filteredRows.length === 1 && filteredRows[0].props["data-session-id"] === "s1", filteredRows.map((row) => row.props["data-session-id"]).join(","));
check("the count reads matched/total while searching", textOf(collectByClass(searchTree, "dshps_count")[0]) === "1/3", textOf(collectByClass(searchTree, "dshps_count")[0]));
check("a filtered view keeps the native row shape", filteredRows.every((row) => row.type === "li" && row.props.role === "treeitem"));

let escDefault = false;
let escStopped = false;
searchInput.props.onKeyDown({ key: "Escape", preventDefault: () => { escDefault = true; }, stopPropagation: () => { escStopped = true; } });
check("Escape clears the search without reaching the sidebar", escDefault && escStopped);
let typedDefault = false;
searchInput.props.onKeyDown({ key: "a", preventDefault: () => { typedDefault = true; }, stopPropagation: () => {} });
check("ordinary keys are left to the input", typedDefault === false);

const noMatch = renderSection(baseProps, [false, true, "zzz"]);
check("a query with no match shows the no-match line", collect(noMatch, "pinned-sessions-no-match").length === 1 && collect(noMatch, "pinned-sessions-row").length === 0, textOf(noMatch).slice(0, 80));
const emptySearching = renderSection({ ...baseProps, workspacesStore: store({ ...workspacesA, pinnedSessionIds: [] }) }, [false, true, "x"]);
check("an empty pin list still shows the pin hint, not the no-match line", collect(emptySearching, "pinned-sessions-hint").length === 1 && collect(emptySearching, "pinned-sessions-no-match").length === 0);

const filterRows = booted.exported.__test__.filterRows;
check("filterRows is exported for direct testing", typeof filterRows === "function");
check("filterRows is case-insensitive and trims", filterRows([{ title: "DSH 插件笔记" }, { title: "其它" }], "dsh", t).length === 1);
check("filterRows treats a blank query as a no-op", filterRows([{ title: "A" }, { title: "B" }], "   ", t).length === 2);
check("filterRows falls back to the untitled label", filterRows([{ title: "" }, { title: "x" }], dictionary.dicts.zh["row.untitled"], t).length === 1);
//#endregion

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
