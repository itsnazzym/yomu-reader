export interface CatalogColumnCountOptions {
  width: number;
  configuredColumns: number;
  minCardWidth: number;
  gap?: number;
  horizontalPadding?: number;
}

/**
 * Shared catalog column rule: configured columns win until min card width
 * would overflow, then drop columns.
 */
export function catalogColumnCount(opts: CatalogColumnCountOptions): number {
  const gap = opts.gap ?? 10;
  const pad = opts.horizontalPadding ?? 12;
  const available = Math.max(1, opts.width - pad * 2);
  const maxByMin = Math.max(
    1,
    Math.floor((available + gap) / (opts.minCardWidth + gap))
  );
  return Math.max(1, Math.min(opts.configuredColumns, maxByMin));
}
