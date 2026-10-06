"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { Tone } from "@/types/supplyed";

const sizeClass = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

const toneClass: Record<Exclude<Tone, "">, string> = {
  purple: "bg-accent-purple-tint text-accent-purple",
  amber: "bg-warning-tint text-warning",
  green: "bg-success-tint text-success",
};

export function Avatar({
  name,
  size = "md",
  src,
  tone = "",
}: {
  name: string;
  size?: keyof typeof sizeClass;
  src?: string | null;
  tone?: Tone;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  useEffect(() => {
    if (!src) return;

    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (active) setLoadedSrc(src);
    };
    image.onerror = () => {
      if (active) setLoadedSrc(null);
    };
    image.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  const showImage = Boolean(src && loadedSrc === src);

  return (
    <div
      aria-label={`${name} profile`}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint font-bold text-brand",
        sizeClass[size],
        tone ? toneClass[tone] : null,
      )}
      role="img"
    >
      {showImage ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}
