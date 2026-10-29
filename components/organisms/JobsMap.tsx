"use client";

import { useEffect, useRef, useState } from "react";

import type { Job } from "@/features/jobs/types";

import { Btn, Icon } from "../atoms";

type MapJob = Job & { latitude: number; longitude: number };

type BulkPostcodeResponse = {
  result?: Array<{
    query?: string;
    result?: { latitude?: number | null; longitude?: number | null } | null;
  }>;
};

export function JobsMap({ jobs, onOpen }: { jobs: Job[]; onOpen: (jobId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapJobs, setMapJobs] = useState<MapJob[]>([]);
  const [locationPending, setLocationPending] = useState(true);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void resolveLocations(jobs, controller.signal)
      .then((resolved) => setMapJobs(resolved))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMapJobs(jobs.flatMap(withStoredCoordinates));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLocationPending(false);
      });

    return () => controller.abort();
  }, [jobs]);

  useEffect(() => {
    if (!containerRef.current || mapJobs.length === 0) return;

    let disposed = false;
    let map: import("leaflet").Map | undefined;

    setMapError(false);
    void import("leaflet")
      .then((leaflet) => {
        if (disposed || !containerRef.current) return;

        map = leaflet.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const bounds = leaflet.latLngBounds([]);
        mapJobs.forEach((job) => {
          const position = leaflet.latLng(job.latitude, job.longitude);
          bounds.extend(position);

          const marker = leaflet.marker(position, {
            icon: leaflet.divIcon({
              className: "jobs-map-marker",
              html: `<span>${formatMarkerRate(job)}</span>`,
              iconAnchor: [25, 46],
              iconSize: [50, 50],
              popupAnchor: [0, -43],
            }),
            title: `${job.title} at ${job.school}`,
          }).addTo(map!);

          const popup = document.createElement("div");
          popup.className = "jobs-map-popup";
          const school = document.createElement("span");
          school.textContent = job.school;
          const title = document.createElement("strong");
          title.textContent = job.title;
          const location = document.createElement("small");
          location.textContent = [job.city, job.postalCode].filter(Boolean).join(", ") || "Location available in role details";
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "View role";
          button.addEventListener("click", () => onOpen(job.id));
          popup.append(school, title, location, button);
          marker.bindPopup(popup, { minWidth: 210 });
        });

        if (mapJobs.length === 1) map.setView(bounds.getCenter(), 13);
        else map.fitBounds(bounds, { maxZoom: 13, padding: [34, 34] });
        requestAnimationFrame(() => map?.invalidateSize());
      })
      .catch(() => setMapError(true));

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [mapJobs, onOpen]);

  return (
    <aside className="jobs-map-panel card" aria-label="Locations for jobs on this page">
      <header className="jobs-map-heading">
        <div><span className="flex items-center gap-2"><Icon name="pin" size={17} /> Map</span><small>Jobs on this page</small></div>
        {!locationPending && mapJobs.length > 0 ? <span className="jobs-map-count">{mapJobs.length}</span> : null}
      </header>
      {locationPending ? <div className="jobs-map-state" role="status"><span className="jobs-map-spinner" />Locating jobs…</div> : null}
      {!locationPending && mapJobs.length === 0 ? <div className="jobs-map-state"><Icon name="pin" size={24} /><strong>No mapped locations</strong><p>Location details are unavailable for the jobs on this page.</p></div> : null}
      {!locationPending && mapJobs.length > 0 && !mapError ? <div className="jobs-map" ref={containerRef} /> : null}
      {mapError ? <div className="jobs-map-state" role="alert"><Icon name="help" size={24} /><strong>Map unavailable</strong><p>You can still review every job in the list.</p><Btn size="sm" variant="secondary" onClick={() => { setMapError(false); setMapJobs((current) => [...current]); }}>Try again</Btn></div> : null}
    </aside>
  );
}

function withStoredCoordinates(job: Job): MapJob[] {
  return validCoordinate(job.latitude, 90) && validCoordinate(job.longitude, 180)
    ? [{ ...job, latitude: job.latitude, longitude: job.longitude }]
    : [];
}

async function resolveLocations(jobs: Job[], signal: AbortSignal): Promise<MapJob[]> {
  const resolved = jobs.flatMap(withStoredCoordinates);
  const resolvedIds = new Set(resolved.map((job) => job.id));
  const missing = jobs.filter((job) => !resolvedIds.has(job.id) && job.postalCode?.trim());
  if (missing.length === 0) return resolved;

  const response = await fetch("https://api.postcodes.io/postcodes", {
    body: JSON.stringify({ postcodes: missing.map((job) => job.postalCode) }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) return resolved;

  const payload = (await response.json()) as BulkPostcodeResponse;
  (payload.result ?? []).forEach((entry, index) => {
    const job = missing[index];
    const latitude = entry.result?.latitude;
    const longitude = entry.result?.longitude;
    if (job && validCoordinate(latitude, 90) && validCoordinate(longitude, 180)) resolved.push({ ...job, latitude, longitude });
  });
  return resolved;
}

function validCoordinate(value: number | null | undefined, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maximum;
}

function formatMarkerRate(job: Job) {
  if (!(job.rate > 0)) return "Job";
  const suffix = job.payType === "hourly" ? "/h" : job.payType === "daily" ? "/d" : "";
  return `£${Math.round(job.rate)}${suffix}`;
}
