import { Btn, Toggle } from "../atoms";
import { PageHead } from "../molecules";

export function CalendarPage() {
  const days = Array.from({ length: 35 }).map((_, index) => ({ day: index < 2 ? "" : index - 1, state: index === 8 || index === 12 ? "booked" : index === 15 || index === 16 || index === 20 ? "available" : "unavailable" }));

  return (
    <div className="app-page">
      <PageHead title="Availability calendar" subtitle="Control when you appear in instant matching and freelance briefs." actions={<Btn>Save changes</Btn>} />
      <div className="two-col">
        <div className="card card-pad-lg">
          <div className="mb-[18px] flex items-center justify-between"><div className="font-serif text-2xl">March 2026</div><div className="flex gap-2"><Btn variant="ghost" size="sm">Prev</Btn><Btn variant="ghost" size="sm">Next</Btn></div></div>
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-xs text-muted">{day}</div>)}
            {days.map((item, index) => (
              <div key={index} className="flex aspect-square items-center justify-center rounded-md border" style={{ borderColor: item.day ? "var(--border)" : "transparent", background: item.state === "available" ? "var(--se-tint)" : item.state === "booked" ? "var(--ink)" : "#fff", color: item.state === "booked" ? "#fff" : "var(--ink)" }}>{item.day}</div>
            ))}
          </div>
        </div>
        <div className="card card-pad-lg"><div className="section-title">Availability preferences</div><div className="flex flex-col gap-3"><div className="flex items-center justify-between"><span>Show me in urgent matching</span><Toggle on onChange={() => {}} /></div><div className="flex items-center justify-between"><span>Accept half-day roles</span><Toggle on onChange={() => {}} /></div><div className="flex items-center justify-between"><span>Travel up to 15 miles</span><Toggle on={false} onChange={() => {}} /></div></div></div>
      </div>
    </div>
  );
}
