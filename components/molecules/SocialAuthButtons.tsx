import { cn } from "@/lib/cn";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  intent?: "login" | "signup";
  onGoogle?: () => void;
  onMicrosoft?: () => void;
};

const socialProviders = [
  {
    id: "google",
    name: "Google",
    mark: <span className="font-sans text-[18px] font-bold leading-none text-[#4285F4]">G</span>,
  },
  {
    id: "microsoft",
    name: "Microsoft",
    mark: (
      <span className="grid h-4 w-4 grid-cols-2 gap-0.5">
        <span className="bg-[#F25022]" />
        <span className="bg-[#7FBA00]" />
        <span className="bg-[#00A4EF]" />
        <span className="bg-[#FFB900]" />
      </span>
    ),
  },
];

export function SocialAuthButtons({ disabled = false, intent = "login", onGoogle, onMicrosoft }: SocialAuthButtonsProps) {
  const action = intent === "signup" ? "Sign up" : "Continue";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {socialProviders.map((provider) => (
          <button
            key={provider.id}
            aria-label={`${action} with ${provider.name}`}
            className={cn(
              "flex h-12 cursor-pointer items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink transition",
              "hover:border-brand hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={disabled}
            onClick={provider.id === "google" ? onGoogle : onMicrosoft}
            title={`${action} with ${provider.name}`}
            type="button"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chalk">{provider.mark}</span>
            <span>{provider.name}</span>
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        <span className="h-px flex-1 bg-border" />
        <span>Email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
