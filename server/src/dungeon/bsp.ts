export type Rect = { x: number; y: number; w: number; h: number };

export type BspNode = {
  bounds: Rect;
  left: BspNode | null;
  right: BspNode | null;
  room: Rect | null;
};

export type DungeonGrid = {
  width: number;
  height: number;
  cells: Uint8Array;
  rooms: Rect[];
};

export type BspOptions = {
  width: number;
  height: number;
  minLeaf: number;
  maxLeaf: number;
  seed: number;
};

const FLOOR = 1;

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBspDungeon(options: BspOptions): DungeonGrid {
  const width = clampInt(options.width, 12, 80);
  const height = clampInt(options.height, 12, 80);
  const minLeaf = clampInt(options.minLeaf, 5, 20);
  const maxLeaf = Math.max(minLeaf + 1, clampInt(options.maxLeaf, minLeaf + 1, 30));
  const random = mulberry32(options.seed >>> 0);

  const root = splitNode({ x: 1, y: 1, w: width - 2, h: height - 2 }, minLeaf, maxLeaf, random);
  placeRooms(root, random);
  const rooms = collectRooms(root);
  const cells = new Uint8Array(width * height);
  for (const room of rooms) {
    fillRect(cells, width, room, FLOOR);
  }
  connectTree(root, cells, width, height);

  return { width, height, cells, rooms };
}

function splitNode(
  bounds: Rect,
  minLeaf: number,
  maxLeaf: number,
  random: () => number,
): BspNode {
  const node: BspNode = { bounds, left: null, right: null, room: null };
  const canSplitW = bounds.w >= maxLeaf || (bounds.w >= minLeaf * 2 && random() < 0.55);
  const canSplitH = bounds.h >= maxLeaf || (bounds.h >= minLeaf * 2 && random() < 0.55);
  if (!canSplitW && !canSplitH) {
    return node;
  }

  const splitVertical =
    canSplitW && (!canSplitH || bounds.w > bounds.h || (bounds.w === bounds.h && random() < 0.5));
  if (splitVertical) {
    const max = bounds.w - minLeaf;
    const min = minLeaf;
    if (max < min) {
      return node;
    }
    const cut = min + Math.floor(random() * (max - min + 1));
    node.left = splitNode({ x: bounds.x, y: bounds.y, w: cut, h: bounds.h }, minLeaf, maxLeaf, random);
    node.right = splitNode(
      { x: bounds.x + cut, y: bounds.y, w: bounds.w - cut, h: bounds.h },
      minLeaf,
      maxLeaf,
      random,
    );
  } else {
    const max = bounds.h - minLeaf;
    const min = minLeaf;
    if (max < min) {
      return node;
    }
    const cut = min + Math.floor(random() * (max - min + 1));
    node.left = splitNode({ x: bounds.x, y: bounds.y, w: bounds.w, h: cut }, minLeaf, maxLeaf, random);
    node.right = splitNode(
      { x: bounds.x, y: bounds.y + cut, w: bounds.w, h: bounds.h - cut },
      minLeaf,
      maxLeaf,
      random,
    );
  }
  return node;
}

function placeRooms(node: BspNode, random: () => number): void {
  if (node.left || node.right) {
    if (node.left) {
      placeRooms(node.left, random);
    }
    if (node.right) {
      placeRooms(node.right, random);
    }
    return;
  }
  const pad = 1;
  const maxW = Math.max(3, node.bounds.w - pad * 2);
  const maxH = Math.max(3, node.bounds.h - pad * 2);
  const w = 3 + Math.floor(random() * Math.max(1, maxW - 2));
  const h = 3 + Math.floor(random() * Math.max(1, maxH - 2));
  const x = node.bounds.x + pad + Math.floor(random() * Math.max(1, node.bounds.w - pad * 2 - w + 1));
  const y = node.bounds.y + pad + Math.floor(random() * Math.max(1, node.bounds.h - pad * 2 - h + 1));
  node.room = { x, y, w, h };
}

function collectRooms(node: BspNode): Rect[] {
  if (node.room) {
    return [node.room];
  }
  return [...(node.left ? collectRooms(node.left) : []), ...(node.right ? collectRooms(node.right) : [])];
}

function connectTree(node: BspNode, cells: Uint8Array, width: number, height: number): void {
  if (!node.left || !node.right) {
    return;
  }
  connectTree(node.left, cells, width, height);
  connectTree(node.right, cells, width, height);
  const a = roomCenter(pickRoom(node.left));
  const b = roomCenter(pickRoom(node.right));
  if (!a || !b) {
    return;
  }
  carveCorridor(cells, width, height, a, b);
}

function pickRoom(node: BspNode): Rect | null {
  if (node.room) {
    return node.room;
  }
  const rooms = collectRooms(node);
  return rooms[0] ?? null;
}

function roomCenter(room: Rect | null): { x: number; y: number } | null {
  if (!room) {
    return null;
  }
  return {
    x: room.x + Math.floor(room.w / 2),
    y: room.y + Math.floor(room.h / 2),
  };
}

function carveCorridor(
  cells: Uint8Array,
  width: number,
  height: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): void {
  let x = a.x;
  let y = a.y;
  while (x !== b.x) {
    setFloor(cells, width, height, x, y);
    x += x < b.x ? 1 : -1;
  }
  while (y !== b.y) {
    setFloor(cells, width, height, x, y);
    y += y < b.y ? 1 : -1;
  }
  setFloor(cells, width, height, b.x, b.y);
}

function fillRect(cells: Uint8Array, width: number, rect: Rect, value: number): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      cells[y * width + x] = value;
    }
  }
}

function setFloor(
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  cells[y * width + x] = FLOOR;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isFloor(cells: Uint8Array, width: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width) {
    return false;
  }
  const index = y * width + x;
  if (index < 0 || index >= cells.length) {
    return false;
  }
  return cells[index] === FLOOR;
}
