import { describe, expect, it } from "vitest";

import { parseSupabaseStorageObjectRef } from "./supabase-storage-object-path";

describe("parseSupabaseStorageObjectRef", () => {
  it("parses public bucket URL with encoded object path", () => {
    const r = parseSupabaseStorageObjectRef(
      "https://abc.supabase.co/storage/v1/object/public/exports/exports%2Fuuid%2Fanimatic.mp4",
    );
    expect(r).toEqual({
      bucket: "exports",
      objectPath: "exports/uuid/animatic.mp4",
    });
  });

  it("parses sign URL", () => {
    const r = parseSupabaseStorageObjectRef(
      "https://abc.supabase.co/storage/v1/object/sign/exports/exports%2Fuuid%2Fanimatic.mp4?token=x",
    );
    expect(r).toEqual({
      bucket: "exports",
      objectPath: "exports/uuid/animatic.mp4",
    });
  });
});
