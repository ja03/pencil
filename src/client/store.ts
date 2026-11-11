import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { api } from "./api";
import { authSlice, type AuthState } from "./auth-slice";

const rootReducer = combineSlices(authSlice, api);

export type RootState = ReturnType<typeof rootReducer>;

/**
 * Factory, never a module-level store: on the server each request renders
 * with its own store, so one visitor's state can't leak into another's page.
 */
export function makeStore(preloaded?: { auth: AuthState }) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloaded,
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
