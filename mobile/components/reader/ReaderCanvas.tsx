import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from "react-native";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { resolvePageUrl } from "@/lib/api/nhentai";
import type { GalleryImage } from "@/lib/api/types";
import type { ReaderSettings } from "@/lib/readerSettingsStore";
import SmartImage from "@/components/SmartImage";
import { buildReaderSpreads, pageToSpreadIndex, spreadToPage } from "@/lib/readerSpreads";
import { ReaderPage } from "./ReaderPage";

export interface ReaderCanvasProps {
  mediaId: string;
  pages: GalleryImage[];
  totalPages: number;
  width: number;
  height: number;
  readMode: "webtoon" | "pager";
  readingDirection: "rtl" | "ltr";
  isDualPage: boolean;
  isZoomed: boolean;
  fitMode: ReaderSettings["fitMode"];
  initialPage: number;
  jumpToken: number;
  jumpPage: number;
  onPageChange: (page: number) => void;
}

interface WebtoonRowProps {
  uri: string;
  width: number;
  height: number;
  contentFit: "cover" | "contain";
  pageLabel: string;
}

interface WebtoonLayout {
  offsets: number[];
  heights: number[];
}

const VIEWABILITY = { itemVisiblePercentThreshold: 51 };
const PAGE_WINDOW = 1;

function pageUrl(mediaId: string, index: number, page: GalleryImage | undefined): string {
  if (!page) return "";
  return page.url || resolvePageUrl(mediaId, index, page);
}

function isNear(index: number, mounted: number): boolean {
  return Math.abs(index - mounted) <= PAGE_WINDOW;
}

function buildWebtoonLayout(pages: GalleryImage[], width: number): WebtoonLayout {
  const offsets: number[] = [];
  const heights: number[] = [];
  let offset = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const ratio = page.w && page.h ? page.w / page.h : 0.707;
    const nextHeight = Math.max(1, width / ratio);
    offsets.push(offset);
    heights.push(nextHeight);
    offset += nextHeight;
  }
  return { offsets, heights };
}

const WebtoonRow = memo(function WebtoonRow({
  uri,
  width,
  height,
  contentFit,
  pageLabel,
}: WebtoonRowProps) {
  return (
    <View style={[styles.webtoonPageWrap, { width, height }]}>
      <SmartImage
        uri={uri}
        style={{ width, height }}
        contentFit={contentFit}
        showLoader={false}
        recyclingKey={uri}
      />
      <View style={styles.webtoonPageNumber}>
        <Text style={styles.pageNumberText}>{pageLabel}</Text>
      </View>
    </View>
  );
});

function ReaderCanvasInner({
  mediaId,
  pages,
  totalPages,
  width,
  height,
  readMode,
  readingDirection,
  isDualPage,
  isZoomed,
  fitMode,
  initialPage,
  jumpToken,
  jumpPage,
  onPageChange,
}: ReaderCanvasProps) {
  const listRef = useRef<FlatList<GalleryImage>>(null);
  const pagerRef = useRef<PagerView>(null);
  const onPageChangeRef = useRef(onPageChange);
  const jumpPageRef = useRef(jumpPage);
  const readModeRef = useRef(readMode);
  const isDualPageRef = useRef(isDualPage);
  onPageChangeRef.current = onPageChange;
  jumpPageRef.current = jumpPage;
  readModeRef.current = readMode;
  isDualPageRef.current = isDualPage;

  const spreads = useMemo(
    () => (isDualPage ? buildReaderSpreads(pages, readingDirection) : []),
    [isDualPage, pages, readingDirection]
  );
  const spreadsRef = useRef(spreads);
  spreadsRef.current = spreads;

  const [mountedIndex, setMountedIndex] = useState(() =>
    isDualPage ? pageToSpreadIndex(buildReaderSpreads(pages, readingDirection), initialPage) : initialPage
  );

  const contentFit = fitMode === "height" ? "cover" : "contain";
  const webtoonLayout = useMemo(() => buildWebtoonLayout(pages, width), [pages, width]);

  const handlePagerSelected = useCallback((event: PagerViewOnPageSelectedEvent) => {
    const position = event.nativeEvent.position;
    setMountedIndex(position);
    const page = isDualPageRef.current
      ? spreadToPage(spreadsRef.current, position)
      : position;
    onPageChangeRef.current(page);
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (typeof first?.index === "number") {
        onPageChangeRef.current(first.index);
      }
    }
  ).current;

  useEffect(() => {
    if (jumpToken <= 0) return;
    const targetPage = jumpPageRef.current;
    if (readModeRef.current === "webtoon") {
      try {
        listRef.current?.scrollToIndex({
          index: targetPage,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        // FlatList can throw before layout; onScrollToIndexFailed retries.
      }
      return;
    }
    const pagerTarget = isDualPageRef.current
      ? pageToSpreadIndex(spreadsRef.current, targetPage)
      : targetPage;
    setMountedIndex(pagerTarget);
    pagerRef.current?.setPage(pagerTarget);
  }, [jumpToken]);

  const renderWebtoonItem = useCallback(
    ({ item, index }: ListRenderItemInfo<GalleryImage>) => {
      const uri = pageUrl(mediaId, index, item);
      const rowHeight = webtoonLayout.heights[index] ?? height;
      return (
        <WebtoonRow
          uri={uri}
          width={width}
          height={rowHeight}
          contentFit={contentFit}
          pageLabel={`${index + 1} / ${totalPages}`}
        />
      );
    },
    [contentFit, height, mediaId, totalPages, webtoonLayout.heights, width]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<GalleryImage> | null | undefined, index: number) => ({
      length: webtoonLayout.heights[index] ?? 1,
      offset: webtoonLayout.offsets[index] ?? 0,
      index,
    }),
    [webtoonLayout]
  );

  if (readMode === "webtoon") {
    return (
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderWebtoonItem}
        getItemLayout={getItemLayout}
        style={StyleSheet.absoluteFillObject}
        initialScrollIndex={initialPage > 0 ? initialPage : undefined}
        scrollEnabled={!isZoomed}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
          });
        }}
      />
    );
  }

  if (isDualPage) {
    return (
      <PagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFillObject}
        initialPage={pageToSpreadIndex(spreads, initialPage)}
        layoutDirection={readingDirection}
        scrollEnabled={!isZoomed}
        offscreenPageLimit={1}
        onPageSelected={handlePagerSelected}
      >
        {spreads.map((spread, spreadIndex) => {
          const leftUrl =
            spread.left !== null ? pageUrl(mediaId, spread.left, pages[spread.left]) : "";
          const rightUrl =
            spread.right !== null ? pageUrl(mediaId, spread.right, pages[spread.right]) : "";
          return (
            <View key={`spread-${spreadIndex}`} style={styles.dualPageSpread} collapsable={false}>
              {isNear(spreadIndex, mountedIndex) ? (
                <View style={styles.dualPageSpread}>
                  <View style={styles.dualPageHalf}>
                    {leftUrl ? (
                      <SmartImage
                        uri={leftUrl}
                        style={{ width: width / 2, height }}
                        contentFit="contain"
                        showLoader={false}
                        recyclingKey={leftUrl}
                      />
                    ) : null}
                  </View>
                  <View style={styles.dualPageHalf}>
                    {rightUrl ? (
                      <SmartImage
                        uri={rightUrl}
                        style={{ width: width / 2, height }}
                        contentFit="contain"
                        showLoader={false}
                        recyclingKey={rightUrl}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </PagerView>
    );
  }

  return (
    <PagerView
      ref={pagerRef}
      style={StyleSheet.absoluteFillObject}
      initialPage={initialPage}
      layoutDirection={readingDirection}
      scrollEnabled={!isZoomed}
      offscreenPageLimit={1}
      onPageSelected={handlePagerSelected}
    >
      {pages.map((page, index) => {
        const uri = pageUrl(mediaId, index, page);
        return (
          <View key={`page-${index}`} style={styles.pagerPageWrap} collapsable={false}>
            {isNear(index, mountedIndex) ? (
              <ReaderPage uri={uri} width={width} height={height} contentFit={contentFit} />
            ) : null}
          </View>
        );
      })}
    </PagerView>
  );
}

export const ReaderCanvas = memo(ReaderCanvasInner);

const styles = StyleSheet.create({
  webtoonPageWrap: { position: "relative", backgroundColor: "#000" },
  webtoonPageNumber: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pageNumberText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  pagerPageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  dualPageSpread: { flex: 1, flexDirection: "row", backgroundColor: "#000" },
  dualPageHalf: { flex: 1, alignItems: "center", justifyContent: "center" },
});
