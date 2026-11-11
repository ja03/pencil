import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CurrentUser } from "@/contracts/auth";

export type AuthState = { user: CurrentUser | null };

const initialState: AuthState = { user: null };

/** Who is signed in, as far as the UI knows. The server re-checks every request. */
export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<CurrentUser>) {
      state.user = action.payload;
    },
    signedOut(state) {
      state.user = null;
    },
  },
  selectors: {
    selectCurrentUser: (state) => state.user,
  },
});

export const { signedIn, signedOut } = authSlice.actions;
export const { selectCurrentUser } = authSlice.selectors;
