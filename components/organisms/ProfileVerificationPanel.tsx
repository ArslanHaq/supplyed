import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitProfileReviewAction } from "@/features/onboarding/verification-actions";
import type { RouteProps } from "@/types/supplyed";
import { Btn, Icon, Tag } from "../atoms";

export function ProfileVerificationPanel({
  state,
  go,
  toast,
  embedded = false,
}: Pick<RouteProps, "state" | "go" | "toast"> & { embedded?: boolean }) {
  const client = useQueryClient();
  const submit = useMutation({
    mutationFn: submitProfileReviewAction,
    onSuccess: async (result) => {
      toast({
        title: result.ok ? "Review requested" : "Could not submit",
        msg: result.message ?? "Please refresh and try again.",
        tone: result.ok ? "success" : "danger",
      });
      await client.invalidateQueries({ queryKey: ["onboarding"] });
    },
    onError: () => toast({ title: "Could not submit", msg: "Please try again.", tone: "danger" }),
  });
  if (state.isFullyVerified) return null;
  const status = state.applicationStatus;
  const labels: Record<string, string> = {
    approved: "Verification incomplete",
    none: "Setup incomplete",
    pending_review: "Pending review",
    rejected: "Action needed",
    suspended: "Suspended",
    deactivated: "Inactive",
  };
  const canSubmit = ["none", "rejected", "deactivated"].includes(status);
  const title = status === "pending_review" ? "Your profile is under review" : "Complete your account verification";
  const action = state.role === "teacher" ? "apply for roles" : "publish jobs";
  return (
    <div className={embedded ? "mb-6" : "verification-notice-wrap"}>
      <section className="verification-notice" aria-label="Account verification">
        <div className="verification-notice-icon">
          <Icon name="shield" size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <Tag tone="amber">{labels[status] || "Verification incomplete"}</Tag>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            You can browse and manage your account. Complete verification to {action}.
          </p>
          <details className="verification-notice-details">
            <summary className="cursor-pointer text-xs font-medium text-slate">What needs to be verified?</summary>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              {["Email address", "Phone number", "Active profile", "All documents approved"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Icon name="circle" size={10} />
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" variant="ghost" onClick={() => go("find-jobs")}>
                Browse jobs
              </Btn>
              {canSubmit ? (
                <Btn size="sm" variant="secondary" loading={submit.isPending} onClick={() => submit.mutate()}>
                  Submit for review
                </Btn>
              ) : null}
            </div>
          </details>
        </div>
        <Btn
          className="verification-notice-action"
          variant="secondary"
          size="sm"
          iconRight="arrow"
          onClick={() => go("settings")}
        >
          Review verification
        </Btn>
      </section>
    </div>
  );
}
