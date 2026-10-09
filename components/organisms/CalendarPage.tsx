import { Btn, Toggle } from "../atoms";
import { PageHead } from "../molecules";

export function CalendarPage() {
  const days = Array.from({ length: 35 }).map((_, index) => ({ day: index < 2 ? "" : index - 1, state: index === 8 || index === 12 ? "booked" : index === 15 || index === 16 || index === 20 ? "available" : "unavailable" }));

  return (
    <div className="app-page calendar-page">
      <PageHead title="Availability calendar" subtitle="Control when you appear in instant matching and freelance briefs." actions={<Btn>Save changes</Btn>} />
      <div className="two-col">
        <div className="calendar-board card card-pad-lg">
          <div className="calendar-heading mb-[18px] flex items-center justify-between"><div><p className="workspace-kicker">Your schedule</p><h2 className="font-heading text-2xl">March 2026</h2></div><div className="flex gap-2"><Btn aria-label="Previous month" variant="secondary" size="sm">Prev</Btn><Btn aria-label="Next month" variant="secondary" size="sm">Next</Btn></div></div>
          <div className="calendar-grid grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-xs text-muted">{day}</div>)}
            {days.map((item, index) => (
              <div aria-label={item.day ? `March ${item.day}, ${item.state}` : undefined} key={index} className={`calendar-day ${item.day ? item.state : "empty"} flex aspect-square border text-sm font-medium tabular-nums`} style={{ borderColor: item.day ? "var(--border)" : "transparent", background: item.state === "available" ? "var(--se-tint)" : item.state === "booked" ? "var(--ink)" : "#fff", color: item.state === "booked" ? "#fff" : "var(--ink)" }}><span>{item.day}</span>{item.day && item.state !== "unavailable" ? <span className="calendar-day-state">{item.state === "booked" ? "Booked" : "Available"}</span> : null}</div>
            ))}
          </div>
          <div aria-label="Calendar legend" className="calendar-legend"><span><i className="available" />Available</span><span><i className="booked" />Booked</span><span><i />Unavailable</span></div>
        </div>
        <div className="sidebar-panel card-pad-lg"><div className="section-title">Availability preferences</div><div className="flex flex-col gap-3"><div className="flex items-center justify-between"><span>Show me in urgent matching</span><Toggle label="Show me in urgent matching" on onChange={() => {}} /></div><div className="flex items-center justify-between"><span>Accept half-day roles</span><Toggle label="Accept half-day roles" on onChange={() => {}} /></div><div className="flex items-center justify-between"><span>Travel up to 15 miles</span><Toggle label="Travel up to 15 miles" on={false} onChange={() => {}} /></div></div></div>
      </div>
    </div>
  );
}
