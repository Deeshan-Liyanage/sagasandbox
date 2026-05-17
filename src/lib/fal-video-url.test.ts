import { describe, expect, it } from "vitest"

import { extractVideoUrlFromFalData } from "./fal-video-url"

describe("extractVideoUrlFromFalData", () => {
  it("reads nested video.url", () => {
    expect(
      extractVideoUrlFromFalData({
        video: { url: "https://cdn.example.com/a.mp4" },
      }),
    ).toBe("https://cdn.example.com/a.mp4")
  })

  it("walks output.video", () => {
    expect(
      extractVideoUrlFromFalData({
        output: { video: { url: "https://cdn.example.com/b.mp4" } },
      }),
    ).toBe("https://cdn.example.com/b.mp4")
  })

  it("supports videos[] arrays", () => {
    expect(
      extractVideoUrlFromFalData({
        videos: [{ url: "https://cdn.example.com/c.mp4" }],
      }),
    ).toBe("https://cdn.example.com/c.mp4")
  })

  it("supports flat video_url strings", () => {
    expect(
      extractVideoUrlFromFalData({
        video_url: "https://cdn.example.com/d.mp4",
      }),
    ).toBe("https://cdn.example.com/d.mp4")
  })
})
