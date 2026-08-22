export interface PageSize {
  w?: number;
  h?: number;
  width?: number;
  height?: number;
}

export interface ReaderSpread {
  left: number | null;
  right: number | null;
  pages: number[];
}

const LANDSCAPE_RATIO = 1.15;
const PANORAMA_RATIO = 1.55;
const TALL_STRIP_RATIO = 0.45;

function sizeOf(page: PageSize | undefined): { w: number; h: number } | null {
  if (!page) return null;
  const w = page.w ?? page.width;
  const h = page.h ?? page.height;
  if (!w || !h || w <= 0 || h <= 0) return null;
  return { w, h };
}

function ratioOf(page: PageSize | undefined): number | null {
  const size = sizeOf(page);
  return size ? size.w / size.h : null;
}

export function isLandscapePage(page: PageSize | undefined): boolean {
  const ratio = ratioOf(page);
  return ratio !== null && ratio >= LANDSCAPE_RATIO;
}

export function isPanoramicPage(page: PageSize | undefined): boolean {
  const ratio = ratioOf(page);
  return ratio !== null && ratio >= PANORAMA_RATIO;
}

export function isTallStripPage(page: PageSize | undefined): boolean {
  const ratio = ratioOf(page);
  return ratio !== null && ratio < TALL_STRIP_RATIO;
}

export function canPairPages(left: PageSize | undefined, right: PageSize | undefined): boolean {
  if (isLandscapePage(left) || isLandscapePage(right)) return false;
  if (isPanoramicPage(left) || isPanoramicPage(right)) return false;
  if (isTallStripPage(left) || isTallStripPage(right)) return false;
  return true;
}

function singleSpread(index: number, direction: "rtl" | "ltr"): ReaderSpread {
  return direction === "rtl"
    ? { left: null, right: index, pages: [index] }
    : { left: index, right: null, pages: [index] };
}

function pairSpread(first: number, second: number, direction: "rtl" | "ltr"): ReaderSpread {
  return direction === "rtl"
    ? { left: second, right: first, pages: [first, second] }
    : { left: first, right: second, pages: [first, second] };
}

export function buildReaderSpreads(
  pages: PageSize[],
  direction: "rtl" | "ltr" = "ltr"
): ReaderSpread[] {
  const spreads: ReaderSpread[] = [];
  let index = 0;

  while (index < pages.length) {
    const current = pages[index];
    const isCover = index === 0;
    const isLast = index === pages.length - 1;
    const forceSingle =
      isLast ||
      isLandscapePage(current) ||
      isPanoramicPage(current) ||
      isTallStripPage(current) ||
      (isCover && !isLandscapePage(current));

    if (forceSingle) {
      spreads.push(singleSpread(index, direction));
      index += 1;
      continue;
    }

    const next = pages[index + 1];
    if (!canPairPages(current, next)) {
      spreads.push(singleSpread(index, direction));
      index += 1;
      continue;
    }

    spreads.push(pairSpread(index, index + 1, direction));
    index += 2;
  }

  return spreads;
}

export function pageToSpreadIndex(spreads: ReaderSpread[], pageIndex: number): number {
  const found = spreads.findIndex((spread) => spread.pages.includes(pageIndex));
  return found >= 0 ? found : 0;
}

export function spreadToPage(spreads: ReaderSpread[], spreadIndex: number): number {
  const spread = spreads[spreadIndex];
  return spread?.pages[0] ?? 0;
}
