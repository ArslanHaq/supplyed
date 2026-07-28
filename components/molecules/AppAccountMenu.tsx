"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Avatar, Icon } from "../atoms";

type AppAccountMenuProps = {
  displayName: string;
  onDashboard: () => void;
  onLanding: () => void;
  onLogout: () => void | Promise<void>;
  roleLabel: string;
};

type MenuAction = {
  icon: string;
  label: string;
  onSelect: () => void | Promise<void>;
  sub: string;
  tone?: "danger";
};

function AppAccountMenuItem({ icon, label, onSelect, sub, tone }: MenuAction) {
  async function selectAction() {
    await onSelect();
  }

  return (
    <button
      className={[
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2",
        tone === "danger"
          ? "text-danger hover:bg-danger-tint focus-visible:ring-danger"
          : "text-slate hover:bg-brand-tint focus-visible:ring-brand",
      ].join(" ")}
      onClick={() => void selectAction()}
      role="menuitem"
      type="button"
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "danger" ? "bg-danger-tint text-danger" : "bg-chalk text-brand",
        ].join(" ")}
      >
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </button>
  );
}

export function AppAccountMenu({
  displayName,
  onDashboard,
  onLanding,
  onLogout,
  roleLabel,
}: AppAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  function closeThen(action: () => void | Promise<void>) {
    setOpen(false);
    return action();
  }

  const actions: MenuAction[] = [
    {
      icon: "home",
      label: "Workspace home",
      onSelect: () => closeThen(onDashboard),
      sub: "Open your dashboard",
    },
    {
      icon: "arrowLeft",
      label: "View public home",
      onSelect: () => closeThen(onLanding),
      sub: "Return to the SupplyED homepage",
    },
    {
      icon: "x",
      label: "Logout",
      onSelect: () => closeThen(onLogout),
      sub: "End this session on this device",
      tone: "danger",
    },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 max-w-[300px] cursor-pointer items-center gap-2 rounded-full border border-transparent bg-white py-1 pl-1 pr-2.5 text-left transition hover:border-border hover:bg-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Avatar name={displayName} size="sm" />
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[190px] truncate text-sm font-semibold leading-4 text-ink">{displayName}</span>
          <span className="block truncate text-[11px] leading-4 text-muted">{roleLabel}</span>
        </span>
        <Icon className={`text-muted transition ${open ? "rotate-180" : ""}`} name="chevronDown" size={15} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          id={menuId}
          role="menu"
        >
          <div className="border-b border-border bg-chalk p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={displayName} />
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{displayName}</div>
                <div className="mt-2 inline-flex rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            {actions.map((action) => (
              <AppAccountMenuItem key={action.label} {...action} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
