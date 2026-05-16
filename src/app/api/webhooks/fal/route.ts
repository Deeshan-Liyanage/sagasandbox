import { NextResponse } from "next/server"
import {
  getEdgeFunctionInvokeHeaders,
  getSupabaseAdminKey,
} from "@/lib/supabase-admin"

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = getSupabaseAdminKey()

  if (!supabaseUrl || !adminKey) {
    return NextResponse.json(
      { error: "Supabase is not configured (SUPABASE_SECRET_KEY or legacy service role)" },
      { status: 500 },
    )
  }

  const body = await request.json()

  const res = await fetch(`${supabaseUrl}/functions/v1/handle-fal-webhook`, {
    method: "POST",
    headers: getEdgeFunctionInvokeHeaders(adminKey),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("handle-fal-webhook forward failed:", text)
    return NextResponse.json({ error: "webhook forward failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
