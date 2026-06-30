"use client";

import { useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        className={cn(className, "pr-12")}
        disabled={disabled}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition hover:bg-chalk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
