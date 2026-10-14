export type PhoneOtpChallenge = {
  phone: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
};

export type VerifiedPhoneUser = {
  id: string;
  phone: string;
  phoneVerified: boolean;
};
