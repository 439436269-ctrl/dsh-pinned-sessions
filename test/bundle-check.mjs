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
		if (name === "StateDot") {
			return function StateDot(props) {
				return React.createElement("span", { "data-state": props.state, "data-testid": "fake-state-dot" });
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
	const subFibers = [];
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
		uiSession: { sessionStatus: { getSnapshot: () => new Map(), subscribe: () => () => {} } },
		locale: {
			register: (ns, dicts) => { dictionary = { ns, dicts }; return () => {}; },
			bind: (ns) => (key, params) => {
				const template = dictionary?.dicts?.zh?.[key] ?? key;
				return params === undefined ? template : template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
			}
		},
		effect: (callback) => callback(),
		/*
		 * `ctx.inject(deps, callback)` starts a waiting sub-fiber: it runs only once
		 * the declared services exist. The fake records it so the suite can assert
		 * BOTH halves — that the Schedule face is asked for by inject (cordis
		 * refuses an undeclared service read) and that the group itself never
		 * declares it (a required inject would block loading without the face).
		 */
		inject: (deps, callback) => { subFibers.push({ deps, callback }); return () => {}; },
		slots: {
			inject: (_name, callback) => { callback(); },
			register: (options, component) => { rows.push({ options, component }); return () => {}; }
		}
	});
	console.warn = warning;
	registrations = rows;
	return { exported, rows, subFibers };
}

const shimmed = { ...React, useState: () => [undefined, () => {}], useCallback: (fn) => fn, useMemo: (fn) => fn(), useEffect: () => {}, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
const booted = boot(shimmed);
check("bundle registers with the module loader", registration !== undefined);
check("registered id equals the package name", registration?.id === pkg.name, registration?.id);
check("bundle exports apply()", typeof booted.exported.apply === "function");
check("bundle exports inject[]", Array.isArray(booted.exported.inject));
check("inject declares every service the plugin reads", ["slots", "sessions", "workspaces", "uiWorkspace", "uiSession", "locale"].every((name) => booted.exported.inject.includes(name)), booted.exported.inject.join(","));
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
check("inject face exposes the stores and both mutations", injected !== undefined && typeof injected.openSession === "function" && typeof injected.unpinSession === "function" && typeof injected.sessionsStore?.getSnapshot === "function" && typeof injected.workspacesStore?.getSnapshot === "function" && typeof injected.statusStore?.getSnapshot === "function" && typeof injected.scheduleMarks?.getSnapshot === "function" && typeof injected.scheduleMarks?.subscribe === "function", Object.keys(injected ?? {}).join(","));
check("the mark source starts with no Session marked", Object.keys(injected.scheduleMarks.getSnapshot()).length === 0);
/*
 * The Schedule face is requested by `ctx.inject` (a waiting sub-fiber), never by
 * the group's own `inject`: cordis throws `cannot get property "remote.schedule"
 * without inject` for an undeclared read, and a required declaration would keep
 * the whole group unloaded on a composition without that face.
 */
const scheduleFiber = booted.subFibers.find((fiber) => (fiber.deps ?? []).includes("remote.schedule"));
check("the group waits for the Schedule face in a sub-fiber", scheduleFiber !== undefined, booted.subFibers.map((fiber) => (fiber.deps ?? []).join("+")).join(","));
check("the sub-fiber declares both halves of the Remote face", JSON.stringify(scheduleFiber?.deps) === JSON.stringify(["remote", "remote.schedule"]), JSON.stringify(scheduleFiber?.deps));
check("the group itself never requires the Schedule face", !booted.exported.inject.includes("remote") && !booted.exported.inject.includes("remote.schedule"), booted.exported.inject.join(","));
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
	statusStore: store(new Map()),
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
check("running sessions carry the native spinner", collect(tree, "pinned-sessions-running").length === 1, String(collect(tree, "pinned-sessions-running").length));
check("the running state is the native ongoing dot", collect(rows[0], "fake-state-dot")[0]?.props["data-state"] === "ongoing", JSON.stringify(collect(rows[0], "fake-state-dot")[0]?.props));
check("each row shows a relative time", textOf(tree).includes("小时前") && textOf(tree).includes("分钟前"), textOf(tree).slice(0, 120));
check("rows carry the owning workspace label", collect(tree, "pinned-sessions-where").map((node) => textOf(node)).join(",") === "默认工作区,默认工作区,另一个工作区", collect(tree, "pinned-sessions-where").map((node) => textOf(node)).join(","));

/** A status map source, exactly the shape `uiSession.sessionStatus` hands over. */
const statusMap = new Map([
	["s1", { running: false, completionUnread: true }],
	["s2", { running: true, completionUnread: false }]
]);
const withStatus = renderSection({ ...baseProps, statusStore: store(statusMap) });
check("the running state comes from the status store", collect(withStatus, "pinned-sessions-running").length === 1, String(collect(withStatus, "pinned-sessions-running").length));
check("a finished-but-unopened session gets the unread dot", collect(withStatus, "pinned-sessions-unread").length === 1, String(collect(withStatus, "pinned-sessions-unread").length));
check("the unread dot uses the native done state", collect(collect(withStatus, "pinned-sessions-unread")[0], "fake-state-dot")[0]?.props["data-state"] === "done");
const pending = renderSection({ ...baseProps, statusStore: store(new Map([["s2", { running: true, pendingInteraction: { kind: "approval" }, completionUnread: false }]])) });
check("a pending approval outranks live activity", collect(pending, "pinned-sessions-warning").length === 1 && collect(pending, "pinned-sessions-running").length === 0, `${collect(pending, "pinned-sessions-warning").length}/${collect(pending, "pinned-sessions-running").length}`);
check("the warning dot uses the native warning state", collect(collect(pending, "pinned-sessions-warning")[0], "fake-state-dot")[0]?.props["data-state"] === "warning");
check("a warning's compact label replaces the timestamp", textOf(pending).includes("待审批"), textOf(pending).slice(0, 120));
const summaryOnly = renderSection({ ...baseProps, statusStore: undefined });
check("without a status store the summary flag still lights the spinner", collect(summaryOnly, "pinned-sessions-running").length === 1, String(collect(summaryOnly, "pinned-sessions-running").length));

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

//#region scheduled-task mark (native `sidebar.session.row.leading` parity)
/*
 * The native sidebar draws a clock in the leading 16px cell of an IDLE row whose
 * Session owns at least one active scheduled task, and it hands that cell to the
 * row's own state dot whenever the row has something more urgent to say. A plugin
 * cannot dispatch that seat itself (the slot runtime rejects a `renderSlot` the
 * caller did not declare, and a second declaration of an owned seat throws), so
 * this group reads the same Host catalog and reproduces both halves of the rule.
 */
const marksSource = (counts) => store(Object.freeze({ ...counts }));
const withSchedule = renderSection({ ...baseProps, scheduleMarks: marksSource({ s1: 1 }) });
const scheduleMarks = collect(withSchedule, "pinned-sessions-schedule");
check("an idle pinned session with an active task carries the schedule clock", scheduleMarks.length === 1, String(scheduleMarks.length));
check("only the marked session gets the clock", scheduleMarks[0]?.props["aria-label"] === "1 个自动化任务", String(scheduleMarks[0]?.props["aria-label"]));
check("the clock sits in the native leading cell", scheduleMarks[0]?.type === "span" && scheduleMarks[0]?.props.className === "dshps_slot", String(scheduleMarks[0]?.props.className));
check("the clock is the native clock glyph", iconName(scheduleMarks[0]) === "IconClockOutlineRegular", String(iconName(scheduleMarks[0])));
check("the clock cell is announced as an image", scheduleMarks[0]?.props.role === "img" && String(scheduleMarks[0]?.props.title).includes("自动化任务"), String(scheduleMarks[0]?.props.title));
const scheduledRows = collect(withSchedule, "pinned-sessions-row");
check("the row tooltip names the scheduled task count", String(scheduledRows[1]?.props.title).includes("1 个自动化任务"), String(scheduledRows[1]?.props.title));
check("an unmarked row keeps an empty leading cell", collect(scheduledRows[0], "pinned-sessions-schedule").length === 0 && collectByClass(scheduledRows[0], "dshps_slot").length === 1);
check("a row without an active task shows no clock", collect(renderSection(baseProps), "pinned-sessions-schedule").length === 0);
check("a count of zero is not a mark", collect(renderSection({ ...baseProps, scheduleMarks: marksSource({ s1: 0 }) }), "pinned-sessions-schedule").length === 0);

const multiCount = renderSection({ ...baseProps, scheduleMarks: marksSource({ s1: 3 }) });
check("the clock reports every active task", collect(multiCount, "pinned-sessions-schedule")[0]?.props["aria-label"] === "3 个自动化任务", String(collect(multiCount, "pinned-sessions-schedule")[0]?.props["aria-label"]));

const runningMarked = renderSection({ ...baseProps, statusStore: store(new Map([["s1", { running: true, completionUnread: false }]])), scheduleMarks: marksSource({ s1: 1 }) });
const markedRunningRow = collect(runningMarked, "pinned-sessions-row").find((row) => row.props["data-session-id"] === "s1");
check("a running row keeps its spinner instead of the clock", collect(runningMarked, "pinned-sessions-schedule").length === 0 && collect(markedRunningRow, "pinned-sessions-running").length === 1, `${collect(runningMarked, "pinned-sessions-schedule").length}/${collect(markedRunningRow, "pinned-sessions-running").length}`);
const pendingMarked = renderSection({ ...baseProps, statusStore: store(new Map([["s1", { running: false, pendingInteraction: { kind: "approval" }, completionUnread: false }]])), scheduleMarks: marksSource({ s1: 1 }) });
check("a pending interaction outranks the clock", collect(pendingMarked, "pinned-sessions-schedule").length === 0 && collect(pendingMarked, "pinned-sessions-warning").length === 1);
const unreadMarked = renderSection({ ...baseProps, statusStore: store(new Map([["s1", { running: false, completionUnread: true }]])), scheduleMarks: marksSource({ s1: 1 }) });
check("an unread completion outranks the clock", collect(unreadMarked, "pinned-sessions-schedule").length === 0 && collect(unreadMarked, "pinned-sessions-unread").length === 1);

const englishMark = renderSection({ ...baseProps, scheduleMarks: marksSource({ s1: 2 }), t: (key, params) => {
	const template = dictionary.dicts.en[key] ?? key;
	return params === undefined ? template : template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
} });
check("the clock label follows the active locale", String(collect(englishMark, "pinned-sessions-schedule")[0]?.props["aria-label"]).includes("scheduled task"), String(collect(englishMark, "pinned-sessions-schedule")[0]?.props["aria-label"]));

const { createScheduleMarks, scheduleCountOf } = booted.exported.__test__;
check("the mark source factory is exported for direct testing", typeof createScheduleMarks === "function" && typeof scheduleCountOf === "function");
check("scheduleCountOf tolerates a missing or foreign entry", scheduleCountOf(undefined, "s1") === 0 && scheduleCountOf(Object.freeze({}), "s1") === 0 && scheduleCountOf({ s1: "2" }, "s1") === 0);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const catalogRows = [
	{ id: "t1", sessionId: "s1", status: "active" },
	{ id: "t2", sessionId: "s1", status: "active" },
	{ id: "t3", sessionId: "s1", status: "inactive" },
	{ id: "t4", sessionId: "s2", status: "inactive" }
];
let catalogReads = 0;
let changedListener;
let resetListener;
/** The face a waiting sub-fiber hands over once `remote.schedule` exists. */
const face = {
	list: async () => {
		catalogReads += 1;
		return { ok: true, value: catalogRows };
	},
	subscribeChanged: (listener) => {
		changedListener = listener;
		return () => { changedListener = undefined; };
	},
	subscribeReset: (listener) => {
		resetListener = listener;
		return () => { resetListener = undefined; };
	}
};

/* A host WITHOUT the Schedule face: subscribing must stay quiet, not throw. */
const facelessSource = createScheduleMarks();
let facelessNotifications = 0;
const stopFaceless = facelessSource.subscribe(() => { facelessNotifications += 1; });
await settle();
check("without a Schedule face nothing is read and nothing is marked", facelessNotifications === 0 && Object.keys(facelessSource.getSnapshot()).length === 0);
check("without a Schedule face the source stays subscribed", typeof stopFaceless === "function");
stopFaceless();

/* A host WITH the face, attached before anything subscribes. */
const markSource = createScheduleMarks();
markSource.attach(face);
check("the mark source starts with nothing marked", Object.keys(markSource.getSnapshot()).length === 0);
check("attaching alone reads nothing until a row watches", catalogReads === 0, String(catalogReads));
let markNotifications = 0;
const stopMarks = markSource.subscribe(() => { markNotifications += 1; });
check("the first subscriber performs exactly one catalog read", catalogReads === 1, String(catalogReads));
check("the first subscriber installs both invalidations", typeof changedListener === "function" && typeof resetListener === "function");
await settle();
check("only active tasks are counted", scheduleCountOf(markSource.getSnapshot(), "s1") === 2 && scheduleCountOf(markSource.getSnapshot(), "s2") === 0, JSON.stringify(markSource.getSnapshot()));
check("a settled read notifies its subscribers", markNotifications === 1, String(markNotifications));
changedListener();
await settle();
check("a schedule/changed event re-reads the catalog", catalogReads === 2 && markNotifications === 2, `${catalogReads}/${markNotifications}`);
resetListener();
await settle();
check("a connection reset re-reads the catalog", catalogReads === 3, String(catalogReads));
stopMarks();
check("the last unsubscribe releases both invalidations", changedListener === undefined && resetListener === undefined);
check("the released source drops its snapshot", Object.keys(markSource.getSnapshot()).length === 0);

/* A host WITH the face, attached AFTER a row already mounted: the read starts then. */
const lateSource = createScheduleMarks();
let lateNotifications = 0;
const stopLate = lateSource.subscribe(() => { lateNotifications += 1; });
await settle();
check("a row mounted before the face exists reads nothing yet", lateNotifications === 0);
const detachLate = lateSource.attach(face);
await settle();
check("attaching a waiting face starts the read", lateNotifications === 1 && scheduleCountOf(lateSource.getSnapshot(), "s1") === 2, `${lateNotifications}/${JSON.stringify(lateSource.getSnapshot())}`);
detachLate();
check("detaching the face drops the snapshot", Object.keys(lateSource.getSnapshot()).length === 0);
stopLate();

const failingSource = createScheduleMarks();
failingSource.attach({
	list: async () => { throw new Error("catalog unavailable"); },
	subscribeChanged: () => () => {},
	subscribeReset: () => () => {}
});
let failureNotifications = 0;
const stopFailing = failingSource.subscribe(() => { failureNotifications += 1; });
await settle();
check("a rejected catalog read leaves the rows unmarked", Object.keys(failingSource.getSnapshot()).length === 0 && failureNotifications === 0);
stopFailing();
const deniedSource = createScheduleMarks();
deniedSource.attach({
	list: async () => ({ ok: false, value: { code: "denied" } }),
	subscribeChanged: () => () => {},
	subscribeReset: () => () => {}
});
let deniedNotifications = 0;
const stopDenied = deniedSource.subscribe(() => { deniedNotifications += 1; });
await settle();
check("a refused catalog read leaves the rows unmarked", Object.keys(deniedSource.getSnapshot()).length === 0 && deniedNotifications === 0);
stopDenied();
//#endregion

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
