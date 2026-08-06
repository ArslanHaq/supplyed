import type { ReactNode } from "react";

import { getDisplayName } from "@/lib/user-display";
import type { AppPage, RouteProps } from "@/types/supplyed";

import { Icon, Logo } from "../atoms";
import { AppAccountMenu } from "../molecules";

type NavItem = {
  id: AppPage;
  label: string;
  icon: string;
};

const institutionNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "post-job", label: "Post job", icon: "plus" },
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

const individualNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "post-job", label: "Post job", icon: "plus" },
  { id: "find-teachers", label: "Teachers", icon: "search" },
  { id: "applications", label: "Applications", icon: "users" },
  { id: "messaging", label: "Messages", icon: "message" },
  { id: "calendar", label: "Schedule", icon: "calendar" },
  { id: "billing", label: "Payments", icon: "file" },
];

export function AppChrome({
  state,
  children,
  go,
  onLanding,
  onLogout,
}: Pick<RouteProps, "state" | "go"> & { children: ReactNode; onLanding: () => void; onLogout: () => void }) {
  const navItems = state.role === "institution" ? institutionNav : state.role === "teacher" ? teacherNav : individualNav;
  const fallbackUserName = state.role === "institution" ? "School workspace" : state.role === "teacher" ? "Instructor" : "Hirer";
  const userName = getDisplayName(state.accountName, state.signupEmail, fallbackUserName);
  const userSub = state.role === "institution" ? "School account" : state.role === "teacher" ? "Instructor" : "Hirer";
  const searchPlaceholder = state.role === "teacher" ? "Search jobs..." : state.role === "individual" ? "Search teachers..." : "Search teachers...";

  return (
    <div className="workspace-shell">
      <div className="app-nav">
        <Logo size={17} onClick={() => go("dashboard")} />
        <nav aria-label={`${userSub} workspace navigation`} className="app-nav-links">
          {navItems.map((item) => (
            <button key={item.id} className={`app-nav-link ${state.page === item.id ? "active" : ""}`} onClick={() => go(item.id)} type="button">
              <span className="flex items-center gap-1.5"><Icon name={item.icon} size={13} /> {item.label}</span>
            </button>
          ))}
        </nav>
        <div className="app-nav-right">
          <div className="flex items-center gap-1.5 rounded-lg bg-chalk px-3 py-1.5"><Icon name="search" size={13} /><input placeholder={searchPlaceholder} className="w-[140px] border-0 bg-transparent outline-none" /></div>
          <button aria-label="Open messages" className="notif-btn" onClick={() => go("messaging")} type="button"><Icon name="bell" size={16} /><div className="notif-dot" /></button>
          <button aria-label="Open help" className="notif-btn" type="button"><Icon name="help" size={16} /></button>
          <AppAccountMenu
            displayName={userName}
            onDashboard={() => go("dashboard")}
            onLanding={onLanding}
            onLogout={onLogout}
            roleLabel={userSub}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
