import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isSupabaseConfigured } from "@/lib/supabase-env"

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith("/projects")) {
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  if (user && pathname === "/login") {
    const dest = request.nextUrl.clone()
    dest.pathname = "/projects"
    dest.search = ""
    return NextResponse.redirect(dest)
  }

  return response
}

export const config = {
  matcher: ["/projects/:path*", "/login"],
}
