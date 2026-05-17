import { type NextRequest, NextResponse } from "next/server"

// Auth is disabled — all routes are publicly accessible.
export function middleware(_request: NextRequest) {
  void _request
  return NextResponse.next()
}

export const config = {
  matcher: ["/projects/:path*", "/login"],
}
