export type MapUploadParts = {
  map: File;
  dd2vtt?: File;
  image?: File;
  animated?: File;
};

export function resolveMapUploadParts(
  selected: File[],
  optionalWebm: File | null,
): MapUploadParts | { error: string } {
  if (selected.length === 0 && !optionalWebm) {
    return { error: "Choose a map file" };
  }

  const packageFile = selected.find((file) => isMapPackageFileName(file.name));
  if (packageFile) {
    const others = selected.filter((file) => file !== packageFile);
    const fromSelectionWebm = others.find((file) => isWebmFileName(file.name)) ?? null;
    const webm = fromSelectionWebm ?? optionalWebm;
    const baseCandidates = others.filter((file) => !isWebmFileName(file.name));
    if (baseCandidates.length !== 1) {
      return {
        error: "Map package multi-select needs exactly one base .dd2vtt/.uvtt or image beside the JSON",
      };
    }
    const base = baseCandidates[0]!;
    const parts: MapUploadParts = { map: packageFile };
    if (isDd2vttFileName(base.name)) {
      parts.dd2vtt = base;
    } else if (isImageFileName(base.name)) {
      parts.image = base;
    } else {
      return { error: "Map package base must be .dd2vtt/.uvtt or png/jpg/webp" };
    }
    if (webm) {
      if (!isWebmFileName(webm.name)) {
        return { error: "Animated layer must be a .webm file" };
      }
      parts.animated = webm;
    }
    return parts;
  }

  const mapFile =
    selected.find((file) => isDd2vttFileName(file.name) || isImageFileName(file.name)) ?? null;
  if (!mapFile) {
    if (optionalWebm || selected.some((file) => isWebmFileName(file.name))) {
      return { error: "Attach WebM together with a base map (png/jpg/webp/.dd2vtt)" };
    }
    return { error: "Choose a png/jpg/webp, .dd2vtt, or .dmsmap.json/.map.json package" };
  }

  const selectedWebm = selected.find((file) => isWebmFileName(file.name)) ?? null;
  const animated = selectedWebm ?? optionalWebm;
  const parts: MapUploadParts = { map: mapFile };
  if (animated) {
    if (!isWebmFileName(animated.name)) {
      return { error: "Animated layer must be a .webm file" };
    }
    parts.animated = animated;
  }
  return parts;
}

export function appendMapUploadFormData(
  body: FormData,
  parts: MapUploadParts,
  options: { gridPx: string; name?: string },
): void {
  body.append("map", parts.map);
  body.append("gridPx", options.gridPx);
  if (options.name?.trim()) {
    body.append("name", options.name.trim());
  }
  if (parts.dd2vtt) {
    body.append("dd2vtt", parts.dd2vtt);
  }
  if (parts.image) {
    body.append("image", parts.image);
  }
  if (parts.animated) {
    body.append("animated", parts.animated);
  }
}

function isMapPackageFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".dmsmap.json") || lower.endsWith(".map.json");
}

function isWebmFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".webm");
}

function isDd2vttFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".dd2vtt") || lower.endsWith(".uvtt");
}

function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name);
}
