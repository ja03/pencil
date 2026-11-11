import { verifyEmailInput, type VerifyEmailResponse } from "@/contracts/auth";
import { getCurrentUser, verifyEmail } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";

/**
 * POST /api/auth/verify-email: use the token from a verification link. Works
 * signed out too, since the link may be opened on another device. Replies
 * with whoever is signed in here, so the page can update without a reload.
 */
export const POST = route(async (request) => {
  const { token } = await parseJson(request, verifyEmailInput);
  await verifyEmail(token);
  const body: VerifyEmailResponse = { user: await getCurrentUser(request.cookies) };
  return Response.json(body);
});
