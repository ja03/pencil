import type { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/server/auth/session";

// Mark the cookie Secure whenever the browser reached us over HTTPS. Render
// terminates TLS at its proxy, so the app itself sees http plus this header.
// Plain-http localhost (`docker compose up`) gets a non-Secure cookie so it works.
function isHttps(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  );
}

function cookieAttributes(request: NextRequest, maxAge: number): string {
  const parts = [`Path=/`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (isHttps(request)) parts.push("Secure");
  return parts.join("; ");
}

/** Adds the 7-day session cookie to `response`. */
export function setSessionCookie(
  response: Response,
  request: NextRequest,
  token: string,
): Response {
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; ${cookieAttributes(request, SESSION_MAX_AGE_SECONDS)}`,
  );
  return response;
}

/** Adds a header that deletes the session cookie. */
export function clearSessionCookie(response: Response, request: NextRequest): Response {
  response.headers.append("set-cookie", `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`);
  return response;
}
