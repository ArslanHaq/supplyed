import { Icon } from "./Icon";

export function VerifyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success bg-success-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.8px] text-success">
      <Icon name="shield" size={11} />
      DBS Verified
    </span>
  );
}
