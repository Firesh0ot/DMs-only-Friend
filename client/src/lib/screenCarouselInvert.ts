export const SCREEN_CAROUSEL_INVERT_KEY = "dms-screen-carousel-invert";
export const SCREEN_CAROUSEL_INVERT_EVENT = "dms-screen-carousel-invert";

export function readScreenCarouselInvert(): boolean {
  try {
    return localStorage.getItem(SCREEN_CAROUSEL_INVERT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeScreenCarouselInvert(inverted: boolean): void {
  try {
    localStorage.setItem(SCREEN_CAROUSEL_INVERT_KEY, inverted ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SCREEN_CAROUSEL_INVERT_EVENT, { detail: { inverted } }),
    );
  }
}

export function carouselFacingWithInvert(facingDeg: number, inverted: boolean): number {
  return inverted ? facingDeg + 180 : facingDeg;
}
