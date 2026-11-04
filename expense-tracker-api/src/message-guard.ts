const otpPattern = /\b(otp|one[ -]?time password|verification code)\b/i;
const financialPattern =
  /\b(debited|credited|spent|received|transferred|transaction|txn|inr|rs\.?)\b|₹/i;

/**
 * Bank alerts often end with "never share your OTP". Those still describe a payment.
 * A message that is only an OTP has no payment language and must not be sent to Gemini.
 */
export function isOtpOnly(message: string): boolean {
  return otpPattern.test(message) && !financialPattern.test(message);
}
