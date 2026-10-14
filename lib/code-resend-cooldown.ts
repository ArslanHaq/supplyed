const codeResendCooldownMs = 60 * 1000;

export const codeResendCooldownSeconds = 60;

export function nextCodeResendAvailableAt(now = Date.now()) {
  return now + codeResendCooldownMs;
}

export function secondsUntilCodeResend(availableAt?: number, now = Date.now()) {
  if (!availableAt) return 0;

  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

export function formatCodeResendCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
