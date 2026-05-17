import Link from "next/link"
import { redirect } from "next/navigation"

import { ProjectsHeader } from "@/app/projects/projects-header"
import { DEMO_PROJECT_ID } from "@/lib/mock-workspace"
import { isSupabaseConfigured } from "@/lib/supabase-env"
import { createAdminClient, getSupabaseAdminKey } from "@/lib/supabase-admin"

export default async function ProjectsPage() {
  if (!isSupabaseConfigured() || !getSupabaseAdminKey()) {
    redirect(`/projects/${DEMO_PROJECT_ID}`)
  }

  const supabase = createAdminClient()

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, theme, aesthetic_style, created_at")
    .order("created_at", { ascending: false })

  const projectList = projects ?? []

  return (
    <div className="min-h-screen bg-[#0e0e0f] px-6 py-10 text-[#e5e7eb]">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Your universes</h1>
            <p className="mt-2 text-sm text-[#9ca3af]">
              Create and open collaborative story sandboxes.
            </p>
          </div>
          <ProjectsHeader />
        </div>
        <ul className="mt-8 space-y-3">
          {projectList.length === 0 ? (
            <li className="rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-4 text-sm text-[#9ca3af]">
              No projects yet. Create your first universe to get started.
            </li>
          ) : (
            projectList.map((p) => (
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
