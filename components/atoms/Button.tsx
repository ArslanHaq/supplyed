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
  loading?: boolean;
  loadingLabel?: string;
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-brand-dark text-white shadow-(--shadow-xs) hover:bg-brand-dark/90",
  secondary: "border-border-strong bg-white text-ink shadow-(--shadow-xs) hover:bg-chalk",
  ghost: "border-transparent bg-transparent text-slate hover:bg-chalk hover:text-ink",
  ink: "border-transparent bg-ink text-white hover:bg-black",
  danger: "border-danger bg-white text-danger hover:bg-danger-tint",
};

const sizeClass: Record<ButtonSize, string> = {
  "": "min-h-11 px-4 py-2.5 text-sm",
  sm: "min-h-9 px-3 py-2 text-[13px]",
  lg: "min-h-12 px-5 py-3 text-sm",
  xl: "min-h-[52px] rounded-xl px-6 py-3.5 text-[15px]",
};

export function buttonClassName({ variant = "primary", size = "", className }: ButtonStyleOptions = {}) {
  return cn(
    "ui-button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-center font-semibold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
  loading,
  loadingLabel,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const label = loading && loadingLabel ? loadingLabel : children;

  return (
    <button
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, className })}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {loading ? <span className="button-loader-mark" /> : icon ? <Icon name={icon} size={16} /> : null}
      {label ? <span>{label}</span> : null}
      {!loading && iconRight ? <Icon name={iconRight} size={16} /> : null}
    </button>
  );
}

export const Btn = Button;
