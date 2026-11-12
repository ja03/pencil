import { googleClientId } from "@/server/auth/google";
import { GoogleButton } from "./google-button";

/**
 * "or" and the Google button, under the login and register forms. Renders
 * nothing when Google sign-in isn't configured (no `GOOGLE_CLIENT_ID`), so
 * local development and tests never show it. It reads the environment, so
 * render it where the page is already dynamic (inside `SignedOutOnly`, which
 * reads the session cookie first), never in a prerendered shell.
 */
export function GoogleSignIn({ context }: { context: "signin" | "signup" }) {
  const clientId = googleClientId();
  if (!clientId) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="label-mono flex items-center gap-3 text-mut" role="separator">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton clientId={clientId} context={context} />
    </div>
  );
}
