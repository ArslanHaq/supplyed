import type { AppState } from "@/types/supplyed";

import { Btn, Icon, Logo, Tag } from "../atoms";

function statusCopy(status: AppState["applicationStatus"]) {
  if (status === "rejected") {
    return {
      tag: "Action needed",
      title: "Your application needs updates.",
      copy: "An admin has reviewed the application and needs more information before approval.",
      icon: "file",
    };
  }

  if (status === "suspended") {
    return {
      tag: "Account paused",
      title: "This account is currently suspended.",
      copy: "Please contact support before continuing to the workspace.",
      icon: "shield",
    };
  }

  return {
    tag: "In review",
    title: "Your application is in review.",
    copy: "SupplyED is checking the submitted profile and verification details. You will get access once the account is approved.",
    icon: "clock",
  };
}

export function ApplicationStatusPage({ state, onLanding, onLogout }: { state: AppState; onLanding: () => void; onLogout: () => void }) {
  const copy = statusCopy(state.applicationStatus);
  const roleLabel = state.role === "teacher" ? "Teacher application" : state.role === "institution" ? "School workspace" : "Account";

  return (
    <div className="min-h-screen bg-chalk">
      <header className="flex min-h-[76px] items-center justify-between border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
        <Logo size={20} onClick={onLanding} />
        <div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={onLanding}>
            View Home
          </Btn>
          <Btn variant="ghost" onClick={onLogout}>
            Logout
          </Btn>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[960px] items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-xl border border-border bg-white p-6 shadow-(--shadow-xs) sm:p-9">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Icon name={copy.icon} size={26} />
          </div>
          <Tag>{copy.tag}</Tag>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-[48px]">{copy.title}</h1>
          <p className="mt-4 max-w-[640px] text-base leading-7 text-muted">{copy.copy}</p>

          <div className="mt-7 grid gap-3 rounded-xl border border-border bg-chalk p-4 sm:grid-cols-3">
            <div>
              <div className="label-xs">Application</div>
              <div className="mt-1 font-semibold">{roleLabel}</div>
            </div>
            <div>
              <div className="label-xs">Email</div>
              <div className="mt-1 truncate font-semibold">{state.signupEmail || "Verified"}</div>
            </div>
            <div>
              <div className="label-xs">Status</div>
              <div className="mt-1 font-semibold capitalize">{state.applicationStatus.replace("_", " ")}</div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Btn icon="message">Contact support</Btn>
            <Btn variant="secondary" onClick={onLanding}>
              Back to Home
            </Btn>
            <Btn variant="ghost" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </section>
      </main>
    </div>
  );
}
