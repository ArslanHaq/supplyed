import { type FormEvent, type ReactNode, useState } from "react";

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
  const [navSearch, setNavSearch] = useState("");
  // Teachers and schools message each other; one live connection keeps every screen up to date.
  const messagingEnabled = state.role === "teacher" || state.role === "institution";
  useConversationStream(messagingEnabled);
  const unreadQuery = useUnreadMessages({ enabled: messagingEnabled });
  const isClient = useMounted();
  // The browser cache can already contain data while the server renders zero unread.
  const unread = isClient && messagingEnabled ? unreadQuery.data?.total ?? 0 : 0;

  function submitNavSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.role !== "institution") return;
    const search = navSearch.trim().slice(0, 100);
    go("find-teachers", search ? { search } : undefined);
  }

  return (
    <div className="workspace-shell">
      <div className="app-nav">
        <Logo size={21} onClick={() => go("dashboard")} />
        <nav aria-label={`${userSub} workspace navigation`} className="app-nav-links">
          {navItems.map((item) => (
            <button key={item.id} aria-current={state.page === item.id ? "page" : undefined} className={`app-nav-link ${state.page === item.id ? "active" : ""}`} onClick={() => go(item.id)} type="button">
              <span className="flex items-center gap-2">
                <Icon name={item.icon} size={16} /> {item.label}
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
      </div>
      {children}
    </div>
  );
}
