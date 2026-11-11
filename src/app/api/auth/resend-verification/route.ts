import {
  EMAIL_LINK_REPLY,
  resendVerificationInput,
  type ResendVerificationResponse,
} from "@/contracts/auth";
import { resendVerification } from "@/server/auth/service";
import { clientIp } from "@/server/http/client-ip";
import { parseJson, route } from "@/server/http/route";
import { rateLimiters } from "@/server/rate-limit/limits";

/**
 * POST /api/auth/resend-verification: email a new verification link. Always
 * the same 202 reply, whether or not the account exists or is verified.
 */
export const POST = route(async (request) => {
  rateLimiters().resendVerificationPerIp.consume(clientIp(request.headers));
  const { email } = await parseJson(request, resendVerificationInput);
  rateLimiters().resendVerificationPerEmail.consume(email);
  resendVerification(email);
  const body: ResendVerificationResponse = { message: EMAIL_LINK_REPLY };
  return Response.json(body, { status: 202 });
});
