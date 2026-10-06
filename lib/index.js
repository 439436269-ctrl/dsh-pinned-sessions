/**
 * @vfvrpq/dsh-pinned-sessions — host half.
 *
 * The whole feature lives in the browser half (`./client`, declared through
 * `package.json` → `dsh.client`): it fills the sidebar's `sidebar.panellist`
 * entry and the matching keyed `main` panel, reading the Client Workspace and
 * Session stores that the native UI already owns. Pinning itself is a Host
 * capability the native Workspace browser already ships
 * (`workspaces.pinSession` / `unpinSession`), so this plugin adds no Host state
 * and no Remote methods.
 *
 * The Host half still has to exist: a Loader row is a Node module, and the
 * client-modules node half resolves this package to find its browser bundle.
 */
/** Host plugin body — pinned sessions is a browser-only surface. */
function apply() {}

export { apply };
