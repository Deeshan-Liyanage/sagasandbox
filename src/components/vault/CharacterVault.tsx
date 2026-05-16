"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import type { Character, CharacterRole } from "@/types/app";
import { getVisualTraits } from "@/types/app";
import { RemoteImage } from "@/components/shared/RemoteImage";
import { cn } from "@/lib/cn";

interface CharacterVaultProps {
  projectId: string;
  characters: Character[];
  onCharactersChange: Dispatch<SetStateAction<Character[]>>;
}

const emptyTraits = {
  hair: "",
  build: "",
  clothing: "",
  features: "",
};

export function CharacterVault({
  projectId,
  characters,
  onCharactersChange,
}: CharacterVaultProps) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "primary" as CharacterRole,
    description: "",
    visual_traits: { ...emptyTraits },
    voice_id: "",
  });
  const [uploading, setUploading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          description: form.description,
          visual_traits: form.visual_traits,
        }),
      });
      if (!res.ok) throw new Error("Failed to create character");
      const { character } = (await res.json()) as { character: Character };
      onCharactersChange((prev) => [...prev, character]);
      setShowForm(false);
      setForm({
        name: "",
        role: "primary",
        description: "",
        visual_traits: { ...emptyTraits },
        voice_id: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function patchCharacter(
    id: string,
    body: Partial<Character> & { visual_traits?: Character["visual_traits"] },
  ) {
    const res = await fetch(`/api/projects/${projectId}/characters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Update failed");
    const { character } = (await res.json()) as { character: Character };
    onCharactersChange((prev) =>
      prev.map((c) => (c.id === id ? character : c)),
    );
    return character;
  }

  async function handleUpload(cId: string, file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/projects/${projectId}/characters/${cId}/upload`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error("Upload failed");
      const { reference_image_url } = (await res.json()) as {
        reference_image_url: string;
      };
      onCharactersChange((prev) =>
        prev.map((c) =>
          c.id === cId ? { ...c, reference_image_url } : c,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Character Vault</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-[#7c3aed] px-2 py-1 text-xs font-medium text-white"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {error ? <p className="text-xs text-[#ef4444]">{error}</p> : null}

      {characters.length === 0 && !showForm ? (
        <p className="py-8 text-center text-sm text-[#9ca3af]">
          Create your first character to anchor visual identity across scenes.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setEditingId(c.id === editingId ? null : c.id)}
            className={cn(
              "rounded-lg border border-[#2a2a2e] bg-[#141416] p-2 text-left transition hover:border-[#7c3aed]/50",
              editingId === c.id && "border-[#7c3aed]",
            )}
          >
            <Portrait character={c} />
            <p className="mt-2 truncate text-sm font-medium">{c.name}</p>
            {c.role ? (
              <span className="text-[10px] uppercase tracking-wide text-[#7c3aed]">
                {c.role}
              </span>
            ) : null}
            <p className="mt-1 line-clamp-2 text-xs text-[#9ca3af]">
              {getVisualTraits(c.visual_traits).hair ?? c.description ?? "—"}
            </p>
          </button>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-2 border-t border-[#2a2a2e] pt-4">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-sm text-white"
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as CharacterRole })
            }
            className="w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-sm text-white"
          >
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-sm text-white"
            rows={2}
          />
          {(["hair", "build", "clothing", "features"] as const).map((key) => (
            <input
              key={key}
              placeholder={key}
              value={form.visual_traits[key] ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  visual_traits: {
                    ...form.visual_traits,
                    [key]: e.target.value,
                  },
                })
              }
              className="w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-xs text-white"
            />
          ))}
          <button
            type="submit"
            className="w-full rounded bg-[#7c3aed] py-1.5 text-xs font-medium text-white"
          >
            Save character
          </button>
        </form>
      ) : null}

      {editingId ? (
        <CharacterEditPanel
          character={characters.find((c) => c.id === editingId)!}
          uploading={uploading}
          onPatch={patchCharacter}
          onUpload={handleUpload}
        />
      ) : null}
    </div>
  );
}

function Portrait({ character }: { character: Character }) {
  if (character.generated_portrait_url) {
    return (
      <RemoteImage
        src={character.generated_portrait_url}
        alt={character.name}
        width={128}
        height={128}
        className="aspect-square h-auto w-full rounded-md object-cover"
      />
    );
  }
  const label =
    character.reference_image_url && !character.generated_portrait_url
      ? "Generating portrait…"
      : "No portrait";
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-[#252528] text-center text-[10px] text-[#9ca3af]">
      {label}
    </div>
  );
}

function CharacterEditPanel({
  character,
  uploading,
  onPatch,
  onUpload,
}: {
  character: Character;
  uploading: boolean;
  onPatch: (
    id: string,
    body: Partial<Character> & { visual_traits?: Character["visual_traits"] },
  ) => Promise<Character>;
  onUpload: (id: string, file: File) => Promise<void>;
}) {
  const [voiceId, setVoiceId] = useState(character.voice_id ?? "");

  return (
    <div className="space-y-2 border-t border-[#2a2a2e] pt-3 text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[#9ca3af]">
        <Upload className="h-3 w-3" />
        Reference image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(character.id, file);
          }}
        />
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </label>
      <label className="block text-xs text-[#9ca3af]">
        ElevenLabs voice ID
        <input
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          onBlur={() => void onPatch(character.id, { voice_id: voiceId })}
          className="mt-1 w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-white"
        />
      </label>
    </div>
  );
}
