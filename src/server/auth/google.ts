import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/server/env";

/** Who Google says signed in, read from a verified ID token. */
export type GoogleIdentity = {
  /** Google's stable account id. Unlike the email, it never changes. */
  googleId: string;
  /** As Google gives it; the auth service lowercases it like every email Pencil stores. */
  email: string;
  /** Whether Google has confirmed the user owns `email`. */
  emailVerified: boolean;
};

/**
 * Checks a Google ID token (the `credential` Google Identity Services hands
 * the browser): the Google boundary. Returns null for a token that is
 * forged, expired, or meant for another app.
 */
export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Google's signing keys. jose caches them and refetches when Google rotates.
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Verifies ID tokens against Google's published keys, for one OAuth client id. */
export class GoogleIdTokenVerifier implements GoogleTokenVerifier {
  constructor(private readonly clientId: string) {}

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    try {
      const { payload } = await jwtVerify(idToken, googleKeys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.clientId,
        algorithms: ["RS256"],
      });
      if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
      return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
      };
    } catch {
      return null;
    }
  }
}

/** The verifier for a client id: Google's when there is one, otherwise none. */
export function verifierForClientId(clientId: string | undefined): GoogleTokenVerifier | null {
  return clientId ? new GoogleIdTokenVerifier(clientId) : null;
}

let override: { verifier: GoogleTokenVerifier | null } | undefined;

/**
 * The verifier Google sign-in uses: Google's when `GOOGLE_CLIENT_ID` is set,
 * otherwise none, and Google sign-in is off. Tests replace it with a fake
 * through `setGoogleVerifier`; nothing in tests ever calls Google.
 */
export function googleVerifier(): GoogleTokenVerifier | null {
  return override ? override.verifier : verifierForClientId(env().GOOGLE_CLIENT_ID);
}

/**
 * Replaces the verifier; null switches Google sign-in off as if no client id
 * were set, and nothing goes back to the real one. Tests only.
 */
export function setGoogleVerifier(verifier?: GoogleTokenVerifier | null): void {
  override = verifier === undefined ? undefined : { verifier };
}

/** The client id the browser's Google button needs, or null when Google sign-in is off. */
export function googleClientId(): string | null {
  return env().GOOGLE_CLIENT_ID ?? null;
}
