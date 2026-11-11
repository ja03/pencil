import type { NextRequest } from "next/server";
import { errorResponse } from "@/server/http/errors";

// Any /api path without its own route gets JSON, not the HTML 404 page.
function notFound(request: NextRequest): Response {
  const { pathname } = new URL(request.url);
  return errorResponse("NOT_FOUND", `No API route for ${request.method} ${pathname}.`);
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
