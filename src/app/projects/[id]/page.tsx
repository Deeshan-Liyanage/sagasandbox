import { notFound } from "next/navigation"

import { WorkspaceClient } from "./WorkspaceClient"
import {
  DEMO_PROJECT_ID,
  getMockCharacters,
  getMockEvents,
  getMockPins,
  getMockProject,
} from "@/lib/mock-workspace"
import { isSupabaseConfigured } from "@/lib/supabase-env"
import { createClient } from "@/lib/supabase-server"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params

  if (!isSupabaseConfigured() || id === DEMO_PROJECT_ID) {
    return (
      <WorkspaceClient
        project={getMockProject(id)}
        initialPins={getMockPins(id)}
        initialEvents={getMockEvents(id)}
        initialCharacters={getMockCharacters(id)}
        apiAvailable={false}
      />
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  const [{ data: pins }, { data: events }, { data: characters }] =
    await Promise.all([
      supabase
        .from("location_pins")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("project_id", id)
        .order("sequence_order", { ascending: true }),
      supabase
        .from("characters")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
    ])

  return (
    <WorkspaceClient
      project={project}
      initialPins={pins ?? []}
      initialEvents={events ?? []}
      initialCharacters={characters ?? []}
      userId={user?.id}
    />
  )
}
