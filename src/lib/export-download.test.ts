import { describe, expect, it } from "vitest";

import type { Export } from "../../types/app";

import {
  buildAnimaticArtifactFilename,
  downloadProxyUrl,
  listFilesUrl,
} from "./export-download";

const animExp = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  project_id: "p",
  type: "animatic_video",
  status: "done",
  output_url: "https://x.test/bucket/animatic.json",
  created_at: "",
  event_ids: [],
  fal_request_id: null,
} as unknown as Export;

describe("buildAnimaticArtifactFilename", () => {
  it("produces a stable mp4 filename from the export id", () => {
    const name = buildAnimaticArtifactFilename(animExp);
    expect(name).toBe("saga-animatic-aaaaaaaa.mp4");
  });
});

describe("downloadProxyUrl", () => {
  it("URI-encodes the project and export ids", () => {
    expect(downloadProxyUrl("proj 1", "exp/2", 3)).toBe(
      "/api/projects/proj%201/exports/exp%2F2/download?index=3",
    );
  });
});

describe("listFilesUrl", () => {
  it("targets the same endpoint with ?list=1", () => {
    expect(listFilesUrl("p", "e")).toBe(
      "/api/projects/p/exports/e/download?list=1",
    );
  });
});
