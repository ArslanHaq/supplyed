"use client";

import { useState } from "react";

import { Btn } from "../atoms";

function copyWithFallback(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy was not available.");
}

export function PublicJobShareButton() {
  const [status, setStatus] = useState<"copied" | "error" | "idle">("idle");

  async function copyLink() {
    try {
      const url = window.location.href;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API is unavailable.");
        await navigator.clipboard.writeText(url);
      } catch {
        copyWithFallback(url);
      }
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Btn icon={status === "copied" ? "check" : "copy"} variant="secondary" onClick={copyLink}>
        {status === "copied" ? "Link copied" : "Copy job link"}
      </Btn>
      <span aria-live="polite" className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`}>
        {status === "error" ? "Could not copy. Copy the address from your browser." : status === "copied" ? "Ready to share." : ""}
      </span>
    </div>
  );
}
