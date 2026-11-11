"use client";

import { useRouter } from "next/navigation";
import { useLogoutMutation } from "./api";
import { signedOut } from "./auth-slice";
import { useAppDispatch } from "./store";

/**
 * Logs out and returns to the feed. The UI treats the user as signed out even
 * if the request fails, since the server re-checks every request anyway.
 */
export function useLogOut(): { logOut: () => Promise<void>; loggingOut: boolean } {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout, { isLoading }] = useLogoutMutation();

  async function logOut() {
    try {
      await logout().unwrap();
    } finally {
      dispatch(signedOut());
      router.push("/");
      router.refresh();
    }
  }

  return { logOut, loggingOut: isLoading };
}
