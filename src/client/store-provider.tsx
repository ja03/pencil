"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import type { CurrentUser } from "@/contracts/auth";
import { makeStore } from "./store";

/** Creates this render's store, seeded with the user the server resolved. */
export function StoreProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  const [store] = useState(() => makeStore({ auth: { user } }));
  return <Provider store={store}>{children}</Provider>;
}
