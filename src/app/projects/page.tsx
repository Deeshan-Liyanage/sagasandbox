import Link from "next/link"
import { redirect } from "next/navigation"

import { isSupabaseConfigured } from "@/lib/supabase-env"
import { DEMO_PROJECT_ID } from "@/lib/mock-workspace"
import { createClient } from "@/lib/supabase-server"

export default async function ProjectsPage() {
  if (!isSupabaseConfigured()) {
    redirect(`/projects/${DEMO_PROJECT_ID}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/projects")
  }

  const { data: owned } = await supabase
    .from("projects")
    .select("id, name, theme, aesthetic_style, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)

  const memberIds =
    memberRows?.map((r) => r.project_id).filter((id) => id !== user.id) ?? []

  const { data: shared } =
    memberIds.length > 0
      ? await supabase
          .from("projects")
          .select("id, name, theme, aesthetic_style, created_at")
          .in("id", memberIds)
      : { data: [] }

  const projects = [...(owned ?? []), ...(shared ?? [])]

  return (
    <div className="min-h-screen bg-[#0e0e0f] px-6 py-10 text-[#e5e7eb]">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">Your universes</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Connected to Supabase. API routes for create/edit ship with Agent A.
        </p>
        <ul className="mt-8 space-y-3">
          {projects.length === 0 ? (
            <li className="rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-4 text-sm text-[#9ca3af]">
              No projects yet. Use the universe initializer once Agent A lands{" "}
              <code className="text-[#7c3aed]">POST /api/projects</code>.
            </li>
          ) : (
            projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-4 transition hover:border-[#7c3aed]/50"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-[#9ca3af]">
                    {p.theme} · {p.aesthetic_style}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
        <Link
          href={`/projects/${DEMO_PROJECT_ID}`}
          className="mt-6 inline-block text-sm text-[#7c3aed] hover:underline"
        >
          Open demo workspace (mock data)
        </Link>
      </div>
    </div>
  )
}
