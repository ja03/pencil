"use client";

import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorOf, useGoogleSignInMutation } from "@/client/api";
import { signedIn } from "@/client/auth-slice";
import { safeNext } from "@/client/safe-next";
import { useAppDispatch } from "@/client/store";
import { FormAlert } from "./form-field";

// The small part of Google Identity Services (accounts.google.com/gsi/client) used here.
type GoogleId = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: "popup" | "redirect";
    context?: "signin" | "signup" | "use";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with";
      shape?: "pill" | "rectangular";
      width?: number;
    },
  ): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
/** Google's button can't be wider than this. */
const MAX_BUTTON_WIDTH = 400;

type Props = { clientId: string; context: "signin" | "signup" };

/**
 * Google's own "Continue with Google" button. Google hands back an ID token,
 * which the API checks before signing the user in. Only rendered when Google
 * sign-in is configured (see `GoogleSignIn`).
 */
export function GoogleButton({ clientId, context }: Props) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const dispatch = useAppDispatch();
  const [googleSignIn] = useGoogleSignInMutation();
  const [alert, setAlert] = useState<string | null>(null);
  // `onReady` fires once the script has loaded, and again on every remount.
  const [ready, setReady] = useState(false);
  const slot = useRef<HTMLDivElement>(null);

  const onCredential = useCallback(
    async ({ credential }: { credential?: string }) => {
      if (!credential) return;
      setAlert(null);
      try {
        const { user } = await googleSignIn({ credential }).unwrap();
        dispatch(signedIn(user));
        router.replace(next);
        router.refresh();
      } catch (error) {
        setAlert(
          apiErrorOf(error)?.message ?? "Couldn't reach Pencil. Check your connection and try again.",
        );
      }
    },
    [googleSignIn, dispatch, router, next],
  );

  useEffect(() => {
    const google = window.google;
    const parent = slot.current;
    if (!ready || !google || !parent) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => void onCredential(response),
      ux_mode: "popup",
      context,
    });
    google.accounts.id.renderButton(parent, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: Math.min(parent.offsetWidth || MAX_BUTTON_WIDTH, MAX_BUTTON_WIDTH),
    });
  }, [ready, clientId, context, onCredential]);

  return (
    <>
      <Script src={GSI_SRC} strategy="afterInteractive" onReady={() => setReady(true)} />
      {alert && <FormAlert>{alert}</FormAlert>}
      {/* Google renders its button into this slot; the height keeps the layout steady while it loads. */}
      <div ref={slot} className="flex min-h-11 w-full justify-center" />
    </>
  );
}
