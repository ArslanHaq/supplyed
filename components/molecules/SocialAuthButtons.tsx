import type { SocialAuthAvailability } from "@/types/supplyed";
import { buttonClassName } from "../atoms";

type SocialAuthButtonsProps = {
  available?: Pick<SocialAuthAvailability, "google">;
  disabled?: boolean;
  intent?: "login" | "signup";
  onGoogle?: () => void;
};

export function SocialAuthButtons({
  available = { google: true },
  disabled = false,
  intent = "login",
  onGoogle,
}: SocialAuthButtonsProps) {
  const action = intent === "signup" ? "Sign up" : "Continue";
  const unavailableLabel = "Google sign-in is currently unavailable";

  return (
    <div className="social-auth">
      <button
        aria-disabled={!available.google}
        aria-label={available.google ? `${action} with Google` : unavailableLabel}
        className={buttonClassName({ variant: "secondary", size: "lg", className: `w-full ${!available.google ? "opacity-60" : ""}` })}
        disabled={disabled}
        onClick={onGoogle}
        title={available.google ? `${action} with Google` : unavailableLabel}
        type="button"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chalk">
          <span className="font-sans text-[18px] font-bold leading-none text-[#4285F4]">G</span>
        </span>
        <span>Google</span>
      </button>
      {!available.google ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          Google sign-in is currently unavailable. You can still continue with email.
        </p>
      ) : null}

      <div className="social-auth-divider my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        <span className="h-px flex-1 bg-border" />
        <span>Email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
