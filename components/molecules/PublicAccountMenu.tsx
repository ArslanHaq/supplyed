"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, resetAuthFlowState, saveAppState } from "@/lib/supplyed-storage";

import { Avatar, Icon } from "../atoms";

type PublicAccountMenuProps = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

function getDisplayName(name?: string | null, email?: string | null) {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const emailName = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return emailName || "SupplyED account";
}

function getRoleLabel(role?: string | null) {
  if (role === "institution") return "School workspace";
  if (role === "teacher") return "Teacher account";
  if (role === "individual") return "Hiring account";
  if (role === "admin") return "Admin account";
  return "Verified account";
}

function getAccountLinks(role?: string | null) {
  if (role === "institution") {
    return [
      { href: "/post-auth", icon: "home", label: "Workspace", sub: "Continue to your school workspace" },
      { href: "/find-teachers", icon: "search", label: "Teachers", sub: "Review matched teachers" },
      { href: "/messaging", icon: "message", label: "Messages", sub: "Continue conversations" },
      { href: "/billing", icon: "settings", label: "Settings & billing", sub: "Manage account details" },
    ];
  }

  if (role === "teacher") {
    return [
      { href: "/post-auth", icon: "home", label: "Workspace", sub: "Continue to your teacher workspace" },
      { href: "/find-jobs", icon: "search", label: "Jobs", sub: "Review matching roles" },
      { href: "/calendar", icon: "calendar", label: "Schedule", sub: "Review availability" },
      { href: "/messaging", icon: "message", label: "Messages", sub: "Continue conversations" },
    ];
  }

  if (role === "individual") {
    return [
      { href: "/post-auth", icon: "home", label: "Workspace", sub: "Continue to your hiring workspace" },
      { href: "/find-teachers", icon: "search", label: "Teachers", sub: "Review verified teachers" },
      { href: "/calendar", icon: "calendar", label: "Schedule", sub: "Review upcoming activity" },
      { href: "/billing", icon: "settings", label: "Settings & payments", sub: "Manage account details" },
    ];
  }

  if (role === "admin") {
    return [
      { href: "/post-auth", icon: "shield", label: "Console", sub: "Open operations workspace" },
      { href: "/messaging", icon: "message", label: "Messages", sub: "Review support conversations" },
    ];
  }

  return [
    { href: "/post-auth", icon: "home", label: "Complete setup", sub: "Continue account setup" },
  ];
}

export function PublicAccountMenu({ email, name, role }: PublicAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = getDisplayName(name, email);
  const roleLabel = getRoleLabel(role);
  const accountLinks = getAccountLinks(role);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await signOut({ redirect: false });

    const nextState = resetAuthFlowState(loadAppState(), "login");

    saveAppState(nextState);
    startRouteLoading();
    router.push("/login");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-border-strong bg-white py-1 pl-1 pr-2.5 text-left transition hover:bg-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Avatar name={displayName} size="sm" />
        <span className="hidden min-w-0 max-w-[150px] sm:block">
          <span className="block truncate text-sm font-semibold leading-4 text-ink">{displayName}</span>
          <span className="block truncate text-[11px] leading-4 text-muted">{email || roleLabel}</span>
        </span>
        <Icon className="text-muted" name="chevronDown" size={15} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          role="menu"
        >
          <div className="border-b border-border bg-chalk p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={displayName} />
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{displayName}</div>
                <div className="truncate text-sm text-muted">{email || "Verified account"}</div>
                <div className="mt-2 inline-flex rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            {accountLinks.map((item) => (
              <Link
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                href={item.href}
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chalk text-brand">
                  <Icon name={item.icon} size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{item.label}</span>
                  <span className="block truncate text-xs text-muted">{item.sub}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="border-t border-border p-2">
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-danger transition hover:bg-danger-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              onClick={logout}
              role="menuitem"
              type="button"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-tint text-danger">
                <Icon name="x" size={17} />
              </span>
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
