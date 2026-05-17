import { describe, expect, it } from "vitest";

import type { Export } from "../../types/app";

import {
  buildAnimaticArtifactFilename,
  inferAnimaticDownloadExtension,
} from "./export-download";

const animExp = {
  id: "aaaaaaaa-bbbb-cccc-ddddeeeeeeee",
  project_id: "p",
  type: "animatic_video",
  status: "done",
  output_url: "https://x.test/bucket/animatic.json",
  created_at: "",
  event_ids: [],
  fal_request_id: null,
} as unknown as Export;

describe("inferAnimaticDownloadExtension", () => {
  it("respects pathname when present", () => {
    expect(
      inferAnimaticDownloadExtension(
        "https://example.com/obj/animatic.json?token=abc",
        "video/mp4",
        "",
      ),
    ).toBe("json");

    expect(
      inferAnimaticDownloadExtension(
        "https://example.com/animatic.mp4",
        "",
        "",
      ),
    ).toBe("mp4");
  });

  it("falls back to JSON from MIME when path has no clue", () => {
    expect(
      inferAnimaticDownloadExtension(
        "https://example.com/sign/abcdefg",
        "application/json; charset=utf-8",
        "",
      ),
    ).toBe("json");
    expect(inferAnimaticDownloadExtension("", "", "application/json")).toBe(
      "json",
    );
  });

  it("falls back to mp4 last", () => {
    expect(inferAnimaticDownloadExtension("https://q.test/x", "", "")).toBe(
      "mp4",
    );
  });
});

describe("buildAnimaticArtifactFilename", () => {
  it("pairs short id stem with inferred extension", () => {
    const name = buildAnimaticArtifactFilename(
      animExp,
      "https://host/exports/exp/animatic.json",
      null,
      "",
    );
    expect(name.startsWith("saga-animatic-aaaaaaaa")).toBe(true);
    expect(name.endsWith(".json")).toBe(true);
  });
});
