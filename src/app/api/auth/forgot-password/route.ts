import {
  EMAIL_LINK_REPLY,
  forgotPasswordInput,
  type ForgotPasswordResponse,
} from "@/contracts/auth";
import { forgotPassword } from "@/server/auth/service";
import { clientIp } from "@/server/http/client-ip";
import { parseJson, route } from "@/server/http/route";
import { rateLimiters } from "@/server/rate-limit/limits";

/**
 * POST /api/auth/forgot-password: email a link to choose a new password.
 * Always the same 202 reply, whether or not the account exists.
 */
export const POST = route(async (request) => {
  rateLimiters().forgotPasswordPerIp.consume(clientIp(request.headers));
  const { email } = await parseJson(request, forgotPasswordInput);
  rateLimiters().forgotPasswordPerEmail.consume(email);
  forgotPassword(email);
  const body: ForgotPasswordResponse = { message: EMAIL_LINK_REPLY };
  return Response.json(body, { status: 202 });
});
