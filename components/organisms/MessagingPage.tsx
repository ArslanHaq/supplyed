import { seedMessages } from "@/data/supplyed";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn } from "../atoms";
import { PageHead } from "../molecules";

export function MessagingPage({ state, setState, role }: Pick<RouteProps, "state" | "setState" | "role">) {
  const activeMessage = seedMessages.find((item) => item.id === state.selectedMessage) || seedMessages[0];

  return (
    <div className="app-page">
      <PageHead
        title="Messages"
        subtitle={
          role === "teacher"
            ? "Stay in touch with schools and placement details."
            : role === "individual"
              ? "Coordinate safely with verified teachers from the hiring account."
              : "Coordinate quickly with candidates and schools."
        }
      />
      <div className="three-panel">
        <div className="card overflow-hidden">
          {seedMessages.map((message) => (
            <div key={message.id} className={`msg-list-item ${activeMessage.id === message.id ? "active" : ""}`} onClick={() => setState((current) => ({ ...current, selectedMessage: message.id }))}>
              <Avatar name={message.with} size="sm" tone={message.tone} />
              <div className="flex-1"><div className="font-medium">{message.with}</div><div className="text-xs text-[var(--muted)]">{message.lastMsg}</div></div>
              <div className="text-xs text-[var(--muted)]">{message.time}</div>
            </div>
          ))}
        </div>
        <div className="card card-pad-lg">
          <div className="mb-[18px] flex items-center justify-between"><div className="flex items-center gap-2.5"><Avatar name={activeMessage.with} size="md" tone={activeMessage.tone} /><div><div className="font-semibold">{activeMessage.with}</div><div className="text-xs text-[var(--muted)]">Active now</div></div></div><Btn variant="ghost" size="sm" icon="moreH">More</Btn></div>
          <div className="flex min-h-[380px] flex-col gap-2.5">
            {activeMessage.thread.map((item, index) => (
              <div key={index} className={`msg-bubble ${item.from === "me" ? "out" : "in"}`}>
                {item.text}
                <div className="mt-1.5 text-xs opacity-70">{item.time}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2"><input className="input" placeholder="Write a message..." /><Btn icon="send">Send</Btn></div>
        </div>
      </div>
    </div>
  );
}
