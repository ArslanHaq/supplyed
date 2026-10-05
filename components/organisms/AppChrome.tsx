import type { ReactNode } from "react";

import { useConversationStream, useUnreadMessages } from "@/features/conversations/use-conversations";
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
  // Teachers and schools message each other; one live connection keeps every screen up to date.
  const messagingEnabled = state.role === "teacher" || state.role === "institution";
  useConversationStream(messagingEnabled);
  const unread = useUnreadMessages({ enabled: messagingEnabled }).data?.total ?? 0;

  return (
    <div className="workspace-shell">
      <div className="app-nav">
        <Logo size={17} onClick={() => go("dashboard")} />
        <nav aria-label={`${userSub} workspace navigation`} className="app-nav-links">
          {navItems.map((item) => (
            <button key={item.id} className={`app-nav-link ${state.page === item.id ? "active" : ""}`} onClick={() => go(item.id)} type="button">
              <span className="flex items-center gap-1.5">
                <Icon name={item.icon} size={13} /> {item.label}
                {item.id === "messaging" && unread > 0 ? (
                  <span aria-label={`${unread} unread`} className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-[18px] text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </nav>
        <div className="app-nav-right">
          <div className="flex items-center gap-1.5 rounded-lg bg-chalk px-3 py-1.5"><Icon name="search" size={13} /><input placeholder={searchPlaceholder} className="w-[140px] border-0 bg-transparent outline-none" /></div>
          <button aria-label="Open messages" className="notif-btn" onClick={() => go("messaging")} type="button"><Icon name="bell" size={16} />{unread > 0 ? <div className="notif-dot" /> : null}</button>
          <button aria-label="Open help" className="notif-btn" type="button"><Icon name="help" size={16} /></button>
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
      </div>
      {children}
    </div>
  );
}
