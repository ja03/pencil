import { setGoogleVerifier, type GoogleIdentity } from "@/server/auth/google";

/**
 * Switches Google sign-in on with a fake ID-token verifier, never real
 * Google. A "token" is whatever string a test registered with `token()`;
 * anything else fails verification. The per-test setup switches Google off
 * again afterwards.
 *
 *   const google = fakeGoogle();
 *   const credential = google.token({ googleId: "g-1", email: "ada@example.com" });
 *   await call(POST, { method: "POST", body: { credential } });
 */
export function fakeGoogle() {
  const identities = new Map<string, GoogleIdentity>();
  setGoogleVerifier({
    async verify(idToken) {
      return identities.get(idToken) ?? null;
    },
  });
  return {
    /** A credential the fake verifies as this identity. Email verified unless said otherwise. */
    token(identity: Omit<GoogleIdentity, "emailVerified"> & { emailVerified?: boolean }): string {
      const credential = `fake-google-token-${identities.size + 1}`;
      identities.set(credential, { emailVerified: true, ...identity });
      return credential;
    },
  };
}
