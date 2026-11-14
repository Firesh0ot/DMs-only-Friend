import { describe, expect, it, vi } from "vitest";
import { Texture, VideoSource } from "pixi.js";
import { ensureVideoPlaying } from "./mapVideoLayer";

function fakeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const state = {
    paused: true,
    ended: false,
    loop: false,
    muted: false,
    playsInline: false,
  };
  const video = {
    get paused() {
      return state.paused;
    },
    get ended() {
      return state.ended;
    },
    get loop() {
      return state.loop;
    },
    set loop(value: boolean) {
      state.loop = value;
    },
    get muted() {
      return state.muted;
    },
    set muted(value: boolean) {
      state.muted = value;
    },
    get playsInline() {
      return state.playsInline;
    },
    set playsInline(value: boolean) {
      state.playsInline = value;
    },
    setAttribute: vi.fn(),
    play: vi.fn(async () => {
      state.paused = false;
    }),
    ...overrides,
  } as unknown as HTMLVideoElement;
  return video;
}

describe("ensureVideoPlaying", () => {
  it("configures loop/mute and starts a paused VideoSource", async () => {
    const video = fakeVideo();
    const source = Object.create(VideoSource.prototype) as VideoSource;
    Object.defineProperty(source, "resource", { value: video });
    const texture = { source } as unknown as Texture;

    await expect(ensureVideoPlaying(texture)).resolves.toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.play).toHaveBeenCalled();
  });

  it("returns false when the texture is not a video", async () => {
    const texture = { source: {} } as unknown as Texture;
    await expect(ensureVideoPlaying(texture)).resolves.toBe(false);
  });

  it("returns false when play() is rejected", async () => {
    const video = fakeVideo({
      play: vi.fn(async () => {
        throw new Error("autoplay blocked");
      }),
    } as Partial<HTMLVideoElement>);
    const source = Object.create(VideoSource.prototype) as VideoSource;
    Object.defineProperty(source, "resource", { value: video });
    const texture = { source } as unknown as Texture;

    await expect(ensureVideoPlaying(texture)).resolves.toBe(false);
  });
});
