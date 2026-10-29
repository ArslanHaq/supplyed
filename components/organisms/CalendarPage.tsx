"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { Btn, Toggle } from "../atoms";
import { PageHead } from "../molecules";

type Schedule = {
  month: string; urgentMatching: boolean; acceptHalfDay: boolean; maxTravelDistance: number;
  days: { date: string; available: boolean; bookings: { id: string; title: string }[] }[];
};
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export function CalendarPage() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  function move(amount: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(date.toISOString().slice(0, 7));
  }
  return <CalendarMonth key={month} month={month} move={move} />;
}

function CalendarMonth({ month, move }: { month: string; move: (amount: number) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["availability", month], queryFn: ({ signal }) => fetchJson<Schedule>("/api/availability", { query: { month }, signal }) });
  const [draft, setDraft] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const schedule = draft ?? query.data;
  const start = new Date(`${month}-01T12:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const past = month < today().slice(0, 7);
  function change(update: Partial<Schedule>) { if (schedule) { setDraft({ ...schedule, ...update }); setMessage(""); } }
  async function save() {
    if (!schedule || saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/availability", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, availableDates: schedule.days.filter((day) => day.available || day.bookings.length).map((day) => day.date),
          urgentMatching: schedule.urgentMatching, acceptHalfDay: schedule.acceptHalfDay, maxTravelDistance: Math.round(schedule.maxTravelDistance) }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Availability could not be saved.");
      queryClient.setQueryData(["availability", month], body);
      setDraft(null); setMessage("Availability saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Availability could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="app-page calendar-page">
    <PageHead title="Availability calendar" subtitle="Choose the dates you can work. Dates and bookings use UK time. Unchanged dates remain available."
      actions={<Btn onClick={() => void save()} disabled={!schedule || !draft || saving || past}>{saving ? "Saving..." : "Save changes"}</Btn>} />
    <div className="calendar-heading mb-[18px] flex items-center justify-between"><h2 className="font-heading text-2xl">{label}</h2>
      <div className="flex gap-2"><Btn aria-label="Previous month" variant="secondary" size="sm" disabled={saving || Boolean(draft)} onClick={() => move(-1)}>Prev</Btn>
        <Btn aria-label="Next month" variant="secondary" size="sm" disabled={saving || Boolean(draft)} onClick={() => move(1)}>Next</Btn></div></div>
    {draft && <p className="mb-3 text-sm">Save your changes before changing months. <button type="button" className="underline" disabled={saving} onClick={() => setDraft(null)}>Discard changes</button></p>}
    {query.isPending && <p role="status">Loading your availability and bookings...</p>}
    {query.error && <p role="alert">{query.error.message} <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p>}
    {message && <p role="status" className="mb-4">{message}</p>}
    {schedule && <div className="two-col"><div className="calendar-board card card-pad-lg"><div className="calendar-grid grid grid-cols-7 gap-2">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-xs text-muted">{day}</div>)}
      {Array.from({ length: offset }, (_, index) => <div key={`empty-${index}`} aria-hidden="true" />)}
      {schedule.days.map((day) => {
        const state = day.bookings.length ? "booked" : day.available ? "available" : "unavailable";
        return <button type="button" key={day.date} aria-label={`${day.date}, ${state}`} aria-pressed={day.available}
          title={day.bookings.map((booking) => booking.title).join(", ")} disabled={saving || day.date < today() || Boolean(day.bookings.length)}
          onClick={() => change({ days: schedule.days.map((entry) => entry.date === day.date ? { ...entry, available: !entry.available } : entry) })}
          className={`calendar-day ${state} flex aspect-square border text-sm font-medium tabular-nums`}>
          <span>{Number(day.date.slice(-2))}</span><span className="calendar-day-state">{state === "booked" ? "Booked" : day.available ? "Available" : "Unavailable"}</span>
        </button>;
      })}
    </div><div aria-label="Calendar legend" className="calendar-legend"><span><i className="available" />Available</span><span><i className="booked" />Booked</span><span><i />Unavailable</span></div></div>
    <fieldset disabled={saving || past} className="sidebar-panel card-pad-lg"><legend className="section-title">Availability preferences</legend><div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3">Send me job match alerts<Toggle label="Send me job match alerts" on={schedule.urgentMatching} onChange={() => change({ urgentMatching: !schedule.urgentMatching })} /></label>
      <label className="flex items-center justify-between gap-3">Accept roles of four hours or less<Toggle label="Accept roles of four hours or less" on={schedule.acceptHalfDay} onChange={() => change({ acceptHalfDay: !schedule.acceptHalfDay })} /></label>
      <label className="flex flex-col gap-2">Maximum travel distance (miles)<input className="input" type="number" min={0} max={60} value={schedule.maxTravelDistance}
        onChange={(event) => change({ maxTravelDistance: Math.max(0, Math.min(60, Number(event.target.value))) })} /></label>
    </div></fieldset></div>}
  </div>;
}
