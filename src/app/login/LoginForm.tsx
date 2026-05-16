"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase-client"

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-[#e5e7eb]">
        Check your email for the magic link.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-[#9ca3af]">
          Email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[#2a2a2e] bg-[#0e0e0f] px-3 py-2 text-sm text-white outline-none focus:border-[#7c3aed]"
          placeholder="you@studio.com"
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send magic link"}
      </button>
    </form>
  )
}
