import { Assets, Sprite, VideoSource, type Texture } from "pixi.js";

export type MapVideoLayer = {
  sprite: Sprite;
  url: string;
};

export async function loadMapVideoLayer(
  animatedFilename: string,
  width: number,
  height: number,
): Promise<MapVideoLayer | null> {
  const url = `/uploads/${animatedFilename}`;
  try {
    const texture = (await Assets.load({
      src: url,
      loadParser: "loadVideo",
      data: {
        loop: true,
        muted: true,
        autoPlay: true,
        playsinline: true,
        preload: true,
        crossorigin: false,
        alphaMode: "no-premultiply-alpha",
      },
    })) as Texture;

    const started = await ensureVideoPlaying(texture);
    if (!started) {
      await Assets.unload(url).catch(() => undefined);
      return null;
    }

    const sprite = new Sprite(texture);
    sprite.width = width;
    sprite.height = height;
    sprite.eventMode = "none";
    return { sprite, url };
  } catch {
    await Assets.unload(url).catch(() => undefined);
    return null;
  }
}

export async function ensureVideoPlaying(texture: Texture): Promise<boolean> {
  const source = texture.source;
  if (!(source instanceof VideoSource)) {
    return false;
  }
  const video = source.resource;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  if (!video.paused && !video.ended) {
    return true;
  }

  try {
    await video.play();
    return !video.paused;
  } catch {
    return false;
  }
}
