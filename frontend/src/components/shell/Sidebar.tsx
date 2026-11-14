/** Collapsible navigation (Spec 4 section 4.3). */

import type { SnapshotSummary } from "../../features/report/reportSnapshot";

export type View = "new" | "reports" | "repositories" | "settings";

const ICONS: Record<string, string> = {
  new: "M12 5v14M5 12h14",
  reports: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  repositories: "M4 6h16M4 12h16M4 18h16",
  settings: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6 7.3 4 7l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z",

  collapse: "M15 6l-6 6 6 6",
  expand: "M9 6l6 6-6 6",
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

export interface SidebarProps {
  view: View;
  collapsed: boolean;
  recent: SnapshotSummary[];
  activeId: string | null;
  onNavigate(view: View): void;
  onToggle(): void;
  onOpenRecent(id: string): void;

}

export function Sidebar({ view, collapsed, recent, activeId, onNavigate, onToggle, onOpenRecent }: SidebarProps) {
  const item = (target: View, icon: keyof typeof ICONS, label: string) => (
    <button
      type="button"
      className="sx-nav-item"
      aria-current={view === target ? "page" : undefined}
      onClick={() => onNavigate(target)}
      title={collapsed ? label : undefined}
      aria-label={label}
    >
      <Icon name={icon} />
      <span className="sx-label">{label}</span>
    </button>
  );
  return (
    <aside className="sx-sidebar" id="app-sidebar" aria-label="Sean navigation" data-testid="sidebar">
      <div className="sx-brand">
        <img className="sx-logo" src="/sean-favicon.png" alt="" width={24} height={24} />
        <span className="sx-wordmark">Sean</span>
      </div>
      <nav className="sx-nav" aria-label="Main">
        {item("new", "new", "New Investigation")}
        {item("reports", "reports", "Saved Reports")}
        {item("repositories", "repositories", "Repositories")}
        {item("settings", "settings", "Settings")}
      </nav>

      {!collapsed && recent.length > 0 ? (
        <>
          <p className="sx-nav-group" id="recent-heading">Recent investigations</p>
          <ul className="sx-recent" aria-labelledby="recent-heading" style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="recent">
            {recent.slice(0, 6).map((r) => (
              <li key={r.id}>
                <button type="button" className="sx-nav-item" aria-current={r.id === activeId ? "true" : undefined} onClick={() => onOpenRecent(r.id)} title={r.title}>
                  <span className="sx-recent-title"><bdi>{r.title}</bdi></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <span className="sx-spacer" />
      <button type="button" className="sx-nav-item" onClick={onToggle} aria-expanded={!collapsed} aria-controls="app-sidebar" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} data-testid="sidebar-toggle">
        <Icon name={collapsed ? "expand" : "collapse"} />
        <span className="sx-label">{collapsed ? "Expand" : "Collapse"}</span>
      </button>
    </aside>
  );
}
