import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "ink" | "danger";
type ButtonSize = "" | "sm" | "lg" | "xl";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-[var(--se)] text-white hover:bg-[var(--se-dark)]",
  secondary: "border-[var(--border-2)] bg-white text-[var(--ink)] hover:bg-[var(--chalk)]",
  ghost: "border-transparent bg-transparent text-[var(--slate)] hover:bg-[var(--chalk)] hover:text-[var(--ink)]",
  ink: "border-transparent bg-[var(--ink)] text-white hover:bg-black",
  danger: "border-[var(--red)] bg-white text-[var(--red)] hover:bg-[var(--red-tint)]",
};

const sizeClass: Record<ButtonSize, string> = {
  "": "px-4 py-2.5 text-[13px]",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-[18px] py-3 text-sm",
  xl: "rounded-xl px-6 py-3.5 text-[15px]",
};

export function buttonClassName({ variant = "primary", size = "", className }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border text-center font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--se)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

export function Button({
  children,
  variant = "primary",
  size = "",
  icon,
  iconRight,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      type={type}
      {...props}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={14} /> : null}
    </button>
  );
}

export const Btn = Button;
