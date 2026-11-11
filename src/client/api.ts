import { createApi, fetchBaseQuery, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { ApiErrorBody } from "@/contracts/api-error";
import type { AuthResponse, LoginInput, RegisterInput } from "@/contracts/auth";

/** RTK Query client for Pencil's REST API. Later tickets inject their endpoints. */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (build) => ({
    register: build.mutation<AuthResponse, RegisterInput>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    login: build.mutation<AuthResponse, LoginInput>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),
  }),
});

export const { useRegisterMutation, useLoginMutation, useLogoutMutation } = api;

/** The shared error body from a failed request, or null for network and other errors. */
export function apiErrorOf(error: unknown): ApiErrorBody["error"] | null {
  const data = (error as FetchBaseQueryError | undefined)?.data as ApiErrorBody | undefined;
  return data?.error?.code ? data.error : null;
}
