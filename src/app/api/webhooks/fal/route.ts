import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SB_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 },
    )
  }

  const body = await request.json()
  const isLegacyJwt = serviceRoleKey.startsWith("eyJ")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: serviceRoleKey,
  }
  if (isLegacyJwt) {
    headers.Authorization = `Bearer ${serviceRoleKey}`
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/handle-fal-webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("handle-fal-webhook forward failed:", text)
    return NextResponse.json({ error: "webhook forward failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
