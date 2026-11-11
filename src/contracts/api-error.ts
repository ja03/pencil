// Shared by the API and the client: every API error has this shape.

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Field name → messages, for errors tied to specific inputs. */
export type FieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
  };
};
