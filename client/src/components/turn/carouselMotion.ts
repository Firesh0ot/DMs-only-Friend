export type TurnSlot = "prev" | "active" | "next";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function captureCardRects(root: HTMLElement): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>("[data-token-id]").forEach((el) => {
    const id = el.dataset.tokenId;
    if (id) {
      map.set(id, el.getBoundingClientRect());
    }
  });
  return map;
}

export function playCardFlip(
  root: HTMLElement,
  previous: Map<string, DOMRect>,
): Map<string, DOMRect> {
  const next = captureCardRects(root);
  if (prefersReducedMotion() || previous.size === 0) {
    return next;
  }
  root.querySelectorAll<HTMLElement>("[data-token-id]").forEach((el) => {
    const id = el.dataset.tokenId;
    if (!id) {
      return;
    }
    const from = previous.get(id);
    const to = next.get(id);
    if (!from || !to) {
      return;
    }
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      return;
    }
    el.style.transition = "none";
    el.style.setProperty("--flip-x", `${dx}px`);
    el.style.setProperty("--flip-y", `${dy}px`);
    void el.getBoundingClientRect();
    el.style.transition = "";
    el.style.setProperty("--flip-x", "0px");
    el.style.setProperty("--flip-y", "0px");
  });
  return next;
}


export type TurnSlotCard = {
  tokenId: string;
  index: number;
  slot: TurnSlot;
};

export function buildTurnSlots(
  orderLength: number,
  activeIndex: number,
  tokenIds: string[],
): TurnSlotCard[] {
  if (orderLength <= 0 || tokenIds.length === 0) {
    return [];
  }
  const len = orderLength;
  const prevIdx = len > 1 ? (activeIndex - 1 + len) % len : -1;
  const nextIdx = len > 1 ? (activeIndex + 1) % len : -1;
  const result: TurnSlotCard[] = [];
  const seen = new Set<string>();

  const push = (index: number, slot: TurnSlot) => {
    const tokenId = tokenIds[index];
    if (!tokenId || seen.has(tokenId)) {
      return;
    }
    seen.add(tokenId);
    result.push({ tokenId, index, slot });
  };

  push(activeIndex, "active");
  if (prevIdx >= 0) {
    push(prevIdx, "prev");
  }
  if (nextIdx >= 0) {
    push(nextIdx, "next");
  }

  const rank: Record<TurnSlot, number> = { prev: 0, next: 1, active: 2 };
  result.sort((a, b) => rank[a.slot] - rank[b.slot]);
  return result;
}

export function fanCardTransform(offset: number): { transform: string; zIndex: number } {
  const angle = offset * 14;
  const x = offset * 2.15;
  const y = Math.abs(offset) * 0.35;
  const scale = offset === 0 ? 1 : Math.max(0.72, 1 - Math.abs(offset) * 0.1);
  return {
    transform: `translate(-50%, -70%) rotate(${angle}deg) translate(${x}rem, ${y}rem) scale(${scale})`,
    zIndex: 10 - Math.abs(offset),
  };
}

export function fanOffsetsForOrder(
  orderLength: number,
  activeIndex: number,
  offsets: readonly number[] = [-2, -1, 0, 1, 2],
): Array<{ index: number; offset: number }> {
  if (orderLength <= 0) {
    return [];
  }
  const ranked = [...offsets].sort((a, b) => Math.abs(a) - Math.abs(b));
  const seen = new Set<number>();
  const result: Array<{ index: number; offset: number }> = [];
  for (const offset of ranked) {
    if (Math.abs(offset) >= orderLength) {
      continue;
    }
    const index = (activeIndex + offset + orderLength * 4) % orderLength;
    if (seen.has(index)) {
      continue;
    }
    seen.add(index);
    result.push({ index, offset });
  }
  result.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset));
  return result;
}
