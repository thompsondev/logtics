import { NextResponse } from "next/server";
import { ApiResponse, PaginatedResponse } from "@/types";

export function ok<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, message });
}

export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function paginated<T>(result: PaginatedResponse<T>): NextResponse<ApiResponse<PaginatedResponse<T>>> {
  return NextResponse.json({ success: true, data: result });
}

export function badRequest(error: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function unauthorized(error = "Unauthorized"): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 401 });
}

export function forbidden(error = "Forbidden"): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 403 });
}

export function notFound(error = "Not found"): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 404 });
}

export function serverError(error = "Internal server error"): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 500 });
}
