/**
 * Standardized API Response Helpers
 *
 * Provides a consistent response shape across all API routes:
 *   - Success: { data: T } or { data: T, message: string }
 *   - Error:   { message: string, code?: string }
 *
 * Usage:
 *   return apiSuccess(data);
 *   return apiError('Not found', 404);
 *   return apiValidationError('classroom_id required');
 */

import { NextResponse } from 'next/server';

// ─── Standard Success Response ───────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function apiMessage(message: string, status = 200): NextResponse {
  return NextResponse.json({ message }, { status });
}

// ─── Standard Error Responses ────────────────────────────────────────

export function apiError(
  message: string,
  status = 500,
  code?: string
): NextResponse {
  const body: { message: string; code?: string } = { message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

export function apiBadRequest(message = 'Bad request'): NextResponse {
  return apiError(message, 400, 'BAD_REQUEST');
}

export function apiUnauthorized(message = 'Authentication required'): NextResponse {
  return apiError(message, 401, 'UNAUTHORIZED');
}

export function apiForbidden(message = 'Forbidden'): NextResponse {
  return apiError(message, 403, 'FORBIDDEN');
}

export function apiNotFound(message = 'Not found'): NextResponse {
  return apiError(message, 404, 'NOT_FOUND');
}

export function apiValidationError(message: string): NextResponse {
  return apiError(message, 400, 'VALIDATION_ERROR');
}

export function apiInternalError(message = 'Internal server error'): NextResponse {
  return apiError(message, 500, 'INTERNAL_ERROR');
}
