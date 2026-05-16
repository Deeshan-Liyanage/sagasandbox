/**
 * Demo seed — run after Supabase schema is applied (Agent B).
 * Usage: npx tsx scripts/seed-demo.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/db";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerIdEnv = process.env.DEMO_OWNER_ID;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!ownerIdEnv) {
  console.error("Set DEMO_OWNER_ID to an auth.users UUID for the demo owner");
  process.exit(1);
}

const ownerId: string = ownerIdEnv;

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1024",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1024",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1024",
];

async function main() {
  const existing = await supabase
    .from("projects")
    .select("id")
    .eq("name", "The Obsidian Covenant")
    .maybeSingle();

  if (existing.data?.id) {
    console.log("Demo project already exists:", existing.data.id);
    return;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: "The Obsidian Covenant",
      theme: "dark_fantasy",
      aesthetic_style: "oil_painting_cinematic",
      style_config: {
        theme: "dark_fantasy",
        aesthetic_style: "oil_painting_cinematic",
        tone: "moody cinematic",
      },
    })
    .select()
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Failed to create project");
  }

  await supabase.from("project_members").insert({
    project_id: project.id,
    user_id: ownerId,
    role: "owner",
  });

  const pinDefs = [
    { label: "Obsidian Gate", description: "Ancient basalt arch wreathed in mist", x: 120, y: 200 },
    { label: "Covenant Hall", description: "Vaulted chamber of sworn oaths", x: 400, y: 280 },
    { label: "Whispering Crypt", description: "Subterranean reliquary of sealed tomes", x: 280, y: 420 },
  ];

  const pinIds: string[] = [];
  for (let i = 0; i < pinDefs.length; i++) {
    const p = pinDefs[i];
    const { data: pin } = await supabase
      .from("location_pins")
      .insert({
        project_id: project.id,
        label: p.label,
        description: p.description,
        canvas_x: p.x,
        canvas_y: p.y,
        generated_image_url: PLACEHOLDER_IMAGES[i],
        gen_status: "done",
      })
      .select("id")
      .single();
    if (pin) pinIds.push(pin.id);
  }

  const events = [
    {
      title: "The Binding Oath",
      description: "Elara swears the covenant beneath the Obsidian Gate as storm clouds gather.",
      sequence_order: 1,
      pin_id: pinIds[0],
      in_world_time: "Nightfall, Year 0",
    },
    {
      title: "Council of Shadows",
      description: "The high seers debate the prophecy in Covenant Hall.",
      sequence_order: 2,
      pin_id: pinIds[1],
      in_world_time: "Midnight vigil",
    },
    {
      title: "Secrets in Stone",
      description: "A hidden sigil glows in the Whispering Crypt.",
      sequence_order: 3,
      pin_id: pinIds[2],
      in_world_time: "Before dawn",
    },
    {
      title: "The Pact Fractures",
      description: "Elara confronts the betrayer at the gate as the covenant shatters.",
      sequence_order: 4,
      pin_id: pinIds[0],
      in_world_time: "First light",
    },
  ];

  for (const ev of events) {
    await supabase.from("timeline_events").insert({
      project_id: project.id,
      ...ev,
      gen_status: "done",
      generated_image_url: PLACEHOLDER_IMAGES[ev.sequence_order % PLACEHOLDER_IMAGES.length],
    });
  }

  await supabase.from("characters").insert([
    {
      project_id: project.id,
      name: "Elara Voss",
      role: "primary",
      description: "Oath-bound knight of the obsidian order",
      visual_traits: {
        hair: "silver",
        build: "tall",
        clothing: "black plate with violet trim",
        features: "scar across left brow",
      },
    },
    {
      project_id: project.id,
      name: "Magister Thorne",
      role: "secondary",
      description: "Archivist of the covenant halls",
      visual_traits: {
        hair: "iron grey",
        build: "lean",
        clothing: "hooded scholar robes",
        features: "lantern sigil brooch",
      },
    },
  ]);

  console.log("Demo project created:", project.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
