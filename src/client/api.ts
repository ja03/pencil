import { createApi, fetchBaseQuery, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { ApiErrorBody } from "@/contracts/api-error";
import type {
  AuthResponse,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResendVerificationInput,
  ResendVerificationResponse,
  VerifyEmailInput,
  VerifyEmailResponse,
} from "@/contracts/auth";

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
    verifyEmail: build.mutation<VerifyEmailResponse, VerifyEmailInput>({
      query: (body) => ({ url: "/auth/verify-email", method: "POST", body }),
    }),
    resendVerification: build.mutation<ResendVerificationResponse, ResendVerificationInput>({
      query: (body) => ({ url: "/auth/resend-verification", method: "POST", body }),
    }),
    forgotPassword: build.mutation<ForgotPasswordResponse, ForgotPasswordInput>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
    }),
    resetPassword: build.mutation<AuthResponse, ResetPasswordInput>({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = api;

/** The shared error body from a failed request, or null for network and other errors. */
export function apiErrorOf(error: unknown): ApiErrorBody["error"] | null {
  const data = (error as FetchBaseQueryError | undefined)?.data as ApiErrorBody | undefined;
  return data?.error?.code ? data.error : null;
}
