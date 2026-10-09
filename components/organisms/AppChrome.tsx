import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { useConversationStream, useUnreadMessages } from "@/features/conversations/use-conversations";
import { getDisplayName } from "@/lib/user-display";
import { useMounted } from "@/lib/use-mounted";
import type { AppPage, RouteProps } from "@/types/supplyed";

import { Icon, Logo } from "../atoms";
import { AppAccountMenu } from "../molecules";
import { NotificationBell } from "./NotificationBell";

type NavItem = {
  id: AppPage;
  label: string;
  icon: string;
};

const institutionNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "find-teachers", label: "Teachers", icon: "search" },
  { id: "applications", label: "Applications", icon: "users" },
  { id: "bookings", label: "Bookings", icon: "file" },
  { id: "messaging", label: "Messages", icon: "message" },
  { id: "billing", label: "Billing", icon: "pound" },
];

const teacherNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "find-jobs", label: "Jobs", icon: "search" },
  { id: "applications", label: "Applications", icon: "users" },
  { id: "bookings", label: "Bookings", icon: "file" },
  { id: "billing", label: "Earnings", icon: "pound" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "messaging", label: "Messages", icon: "message" },
  { id: "teacher-profile", label: "Profile", icon: "user" },
];

const adminNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "billing", label: "Payments", icon: "pound" },
  { id: "security", label: "Security", icon: "shield" },
];

export function AppChrome({
  verified,
  state,
  children,
  go,
  onLanding,
  onLogout,
  onSettings,
}: Pick<RouteProps, "state" | "go"> & { children: ReactNode; verified: boolean; onLanding: () => void; onLogout: () => void; onSettings: () => void }) {
  const navItems = state.role === "admin" ? adminNav : state.role === "institution" ? institutionNav : teacherNav;
  const fallbackUserName = state.role === "admin" ? "Administrator" : state.role === "institution" ? "School workspace" : "Instructor";
  const userName = getDisplayName(state.accountName, state.signupEmail, fallbackUserName);
  const userSub = state.role === "admin" ? "Administrator" : state.role === "institution" ? "School account" : "Instructor";
  const searchPlaceholder = state.role === "admin" ? "Search admin panel..." : state.role === "teacher" ? "Search jobs..." : "Search teachers...";
  const [navSearch, setNavSearch] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const activeLabel = navItems.find((item) => item.id === state.page)?.label
    ?? ({ settings: "Settings", security: "Security", "post-job": "Post job", "job-detail": "Job details", "institution-profile": "School profile", "teacher-profile": "Teacher profile" } as Partial<Record<AppPage, string>>)[state.page]
    ?? "Workspace";
  // Teachers and schools message each other; one live connection keeps every screen up to date.
  const messagingEnabled = state.role === "teacher" || state.role === "institution";
  useConversationStream(messagingEnabled);
  const unreadQuery = useUnreadMessages({ enabled: messagingEnabled });
  const isClient = useMounted();
  // The browser cache can already contain data while the server renders zero unread.
  const unread = isClient && messagingEnabled ? unreadQuery.data?.total ?? 0 : 0;

  useEffect(() => {
    if (navigationOpen) navigationRef.current?.querySelector<HTMLButtonElement>('.workspace-quick-action, .workspace-nav-item')?.focus();
  }, [navigationOpen]);

  function submitNavSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.role !== "institution") return;
    const search = navSearch.trim().slice(0, 100);
    go("find-teachers", search ? { search } : undefined);
  }

  function navigate(page: AppPage) {
    setNavigationOpen(false);
    go(page);
  }

  return (
    <div className={`workspace-shell workspace-frame ${collapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside ref={navigationRef} className={`workspace-sidebar ${navigationOpen ? "is-open" : ""}`} id="workspace-navigation" onKeyDown={(event) => {
        if (event.key === "Escape") {
          setNavigationOpen(false);
          menuButton.current?.focus();
        }
      }}>
        <div className="workspace-brand">
          <span className="workspace-brand-full"><Logo size={25} onClick={() => navigate("dashboard")} /></span>
          <button aria-label="SupplyED dashboard" className="workspace-brand-short" onClick={() => navigate("dashboard")} type="button">S<span>ED</span></button>
        </div>
        <div className={`workspace-role ${state.role === "institution" ? "has-quick-action" : ""}`}><span className="workspace-role-mark"><Icon name={state.role === "institution" ? "building" : state.role === "admin" ? "shield" : "user"} size={18} /></span><span className="workspace-nav-copy"><strong>{userSub}</strong><span>Your SupplyED workspace</span></span></div>
        {state.role === "institution" ? (
          <button
            aria-label="Post a job"
            className="workspace-quick-action"
            onClick={() => navigate("post-job")}
            title={collapsed ? "Post a job" : undefined}
            type="button"
          >
            <Icon name="plus" size={19} />
            <span className="workspace-nav-copy">Post a job</span>
          </button>
        ) : null}
        <p className="workspace-nav-label">Workspace</p>
        <nav aria-label={`${userSub} workspace navigation`} className="workspace-navigation">
          {navItems.map((item) => (
            <button key={item.id} aria-label={item.label} title={collapsed ? item.label : undefined} aria-current={state.page === item.id ? "page" : undefined} className={`workspace-nav-item ${state.page === item.id ? "active" : ""}`} onClick={() => navigate(item.id)} type="button">
                <Icon name={item.icon} size={19} /><span className="workspace-nav-copy">{item.label}</span>
                {item.id === "messaging" && unread > 0 ? (
                  <span aria-label={`${unread} unread`} className="workspace-nav-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
            </button>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <button aria-label="Settings" title={collapsed ? "Settings" : undefined} className={`workspace-nav-item ${state.page === "settings" ? "active" : ""}`} aria-current={state.page === "settings" ? "page" : undefined} onClick={() => { setNavigationOpen(false); onSettings(); }} type="button"><Icon name="settings" size={19} /><span className="workspace-nav-copy">Settings</span></button>
          <button aria-label="View public home" title={collapsed ? "View public home" : undefined} className="workspace-nav-item" onClick={onLanding} type="button"><Icon name="arrowLeft" size={19} /><span className="workspace-nav-copy">View public home</span></button>
          <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="workspace-collapse workspace-nav-item" onClick={() => setCollapsed((value) => !value)} type="button"><Icon name={collapsed ? "chevronRight" : "arrowLeft"} size={18} /><span className="workspace-nav-copy">Collapse sidebar</span></button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button ref={menuButton} aria-label={navigationOpen ? "Close navigation" : "Open navigation"} aria-controls="workspace-navigation" aria-expanded={navigationOpen} className="workspace-menu-button" onClick={() => setNavigationOpen((value) => !value)} type="button"><Icon name={navigationOpen ? "x" : "list"} size={22} /></button>
          <span className="workspace-mobile-brand"><Logo size={22} onClick={() => navigate("dashboard")} /></span>
          <div className="workspace-breadcrumb"><span>Workspace</span><Icon name="chevronRight" size={14} /><strong>{activeLabel}</strong></div>
          <div className="workspace-topbar-actions">
          <form className="app-search" onSubmit={submitNavSearch}>
            <Icon name="search" size={16} />
            <input
              aria-label={searchPlaceholder.replace("...", "")}
              className="border-0 bg-transparent"
              onChange={(event) => setNavSearch(event.target.value)}
              placeholder={searchPlaceholder}
              value={navSearch}
            />
          </form>
          <NotificationBell live={messagingEnabled} onSettings={onSettings} />
          <AppAccountMenu
            verified={verified}
            displayName={userName}
            onDashboard={() => go("dashboard")}
            onLanding={onLanding}
            onLogout={onLogout}
            onSecurity={() => go("security")}
            onSettings={onSettings}
            roleLabel={userSub}
          />
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main>
        </div>
    </div>
  );
}
