export function validateOtpCode(value: string) {
  return /^\d{6}$/.test(value.trim());
}

export function validateTwoFactorCode(value: string) {
  return /^(?:\d{6}|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i.test(value.trim());
}
