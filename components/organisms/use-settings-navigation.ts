"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

/** Keep the clicked destination selected while smooth scrolling passes other sections. */
export function useSettingsNavigation(sectionIds: string[], ready: boolean) {
  const [activeSection, setActiveSection] = useState("settings-profile");
  const destination = useRef<string | null>(null);
  const sectionKey = sectionIds.join(",");

  useEffect(() => {
    if (!ready) return;
    const ids = sectionKey.split(",");
    let frame = 0;
    const update = () => {
      if (destination.current) return;
      const sections = ids.map(id => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node));
      const reached = sections.filter(node => node.getBoundingClientRect().top <= 150);
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3;
      const active = atBottom ? sections.at(-1) : reached.at(-1) ?? sections[0];
      if (active) setActiveSection(active.id);
    };
    const followHash = () => {
      const id = window.location.hash.slice(1);
      if (!ids.includes(id)) { destination.current = null; update(); return; }
      destination.current = id;
      setActiveSection(id);
      frame = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    const resumeTracking = () => { destination.current = null; update(); };
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) resumeTracking();
    };
    followHash();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("wheel", resumeTracking, { passive: true });
    window.addEventListener("touchstart", resumeTracking, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", followHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("wheel", resumeTracking);
      window.removeEventListener("touchstart", resumeTracking);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", followHash);
    };
  }, [sectionKey, ready]);

  function navigate(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    const id = anchor?.hash.slice(1);
    if (!id || !sectionIds.includes(id)) return;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    destination.current = id;
    setActiveSection(id);
    // Retain Next's history state. Native fragment entries can lose the route
    // snapshot needed when returning from Security with the browser Back button.
    window.history.replaceState(window.history.state, "", `#${id}`);
    section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  return { activeSection, navigate };
}
