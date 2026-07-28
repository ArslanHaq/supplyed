import { Icon } from "../../../atoms";
import { ReviewCard } from "../ReviewCard";
import type { StepComponentProps } from "../step-types";

export function ReviewStep({ controller }: StepComponentProps) {
  const { reviewGroups, setStep } = controller;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="checkCircle" size={20} />
          </div>
          <div>
            <div className="font-semibold text-brand-dark">Ready to submit</div>
            <p className="mt-1 text-sm leading-6 text-brand-dark/80">
              Review the details below. Each section can be edited without losing the information you already entered.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {reviewGroups[0] ? <ReviewCard group={reviewGroups[0]} onEdit={() => setStep(reviewGroups[0].editStep)} /> : null}
          {reviewGroups[2] ? <ReviewCard group={reviewGroups[2]} onEdit={() => setStep(reviewGroups[2].editStep)} /> : null}
        </div>
        {reviewGroups[1] ? <ReviewCard featured group={reviewGroups[1]} onEdit={() => setStep(reviewGroups[1].editStep)} /> : null}
      </div>
    </div>
  );
}
