import type { ReactNode } from "react";

import type { AppPage, AppRole, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, Logo } from "../atoms";

type NavItem = {
  id: AppPage;
  label: string;
  icon: string;
};

const institutionNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "find-teachers", label: "Teachers", icon: "search" },
  { id: "applications", label: "Applications", icon: "users" },
  { id: "messaging", label: "Messages", icon: "message" },
  { id: "billing", label: "Billing", icon: "file" },
];

const teacherNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "find-jobs", label: "Jobs", icon: "search" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "messaging", label: "Messages", icon: "message" },
  { id: "teacher-profile", label: "Profile", icon: "user" },
];

const adminNav: NavItem[] = [
  { id: "admin", label: "Console", icon: "shield" },
  { id: "messaging", label: "Messages", icon: "message" },
];

export function AppChrome({
  state,
  setState,
  children,
  go,
  onLanding,
}: Pick<RouteProps, "state" | "setState" | "go"> & { children: ReactNode; onLanding: () => void }) {
  const navItems = state.role === "institution" ? institutionNav : state.role === "teacher" ? teacherNav : adminNav;
  const userName = state.role === "institution" ? "Greenfield Primary" : state.role === "teacher" ? "Sarah Johnson" : "Admin Team";
  const userSub = state.role === "institution" ? "School account" : state.role === "teacher" ? "Supply teacher" : "Operations";
  const roles: Array<{ v: AppRole; label: string; icon: string }> = [
    { v: "institution", label: "School", icon: "building" },
    { v: "teacher", label: "Teacher", icon: "user" },
    { v: "admin", label: "Admin", icon: "shield" },
  ];
  const selectRole = (role: AppRole) => {
    const nextPage = role === "admin" ? "admin" : "dashboard";
    setState((current) => ({ ...current, role, page: nextPage, auth: "signed-in" }));
    go(nextPage);
  };

  return (
    <div className="workspace-shell">
      <div className="workspace-topbar">
        <div className="flex items-center gap-2.5"><Logo size={18} onClick={() => go("dashboard")} /><span className="pill">Workspace</span></div>
        <div className="workspace-role-select">
          {roles.map((item) => (
            <button key={item.v} className={`workspace-role-btn ${state.role === item.v ? "active" : ""}`} onClick={() => selectRole(item.v)} type="button">
              <span className="flex items-center gap-1.5"><Icon name={item.icon} size={12} /> {item.label}</span>
            </button>
          ))}
        </div>
        <div className="workspace-crumb">{state.role === "institution" ? "School view" : state.role === "teacher" ? "Teacher view" : "Admin view"}</div>
        <Btn variant="ghost" size="sm" onClick={onLanding}>View landing</Btn>
      </div>
      <div className="app-nav">
        <Logo size={17} onClick={() => go("dashboard")} />
        <div className="app-nav-links">
          {navItems.map((item) => (
            <div key={item.id} className={`app-nav-link ${state.page === item.id ? "active" : ""}`} onClick={() => go(item.id)}>
              <span className="flex items-center gap-1.5"><Icon name={item.icon} size={13} /> {item.label}</span>
            </div>
          ))}
        </div>
        <div className="app-nav-right">
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--chalk)] px-3 py-1.5"><Icon name="search" size={13} /><input placeholder={state.role === "teacher" ? "Search jobs..." : "Search teachers..."} className="w-[140px] border-0 bg-transparent outline-none" /></div>
          <div className="notif-btn" onClick={() => go("messaging")}><Icon name="bell" size={16} /><div className="notif-dot" /></div>
          <div className="notif-btn"><Icon name="help" size={16} /></div>
          <div className="flex items-center gap-2"><Avatar name={userName} size="sm" /><div><div className="text-sm font-semibold">{userName}</div><div className="text-xs text-[var(--muted)]">{userSub}</div></div></div>
        </div>
      </div>
      {children}
    </div>
  );
}
