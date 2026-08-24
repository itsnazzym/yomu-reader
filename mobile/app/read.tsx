import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  StatusBar,
  Platform,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import {
  IconArrowLeft,
  IconLayoutList,
  IconBook2,
  IconCircleArrowLeft,
  IconCircleArrowRight,
  IconShare,
  IconAlertCircle,
  IconEye,
  IconColumns,
  IconSettings,
} from "@tabler/icons-react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";
import { useTheme } from "@/lib/ThemeContext";
import { getGallery, resolvePageUrl } from "@/lib/api/nhentai";
import { getSource } from "@/lib/sources/registry";
import { sourceGalleryToGallery } from "@/lib/sources/galleryMapper";
import type { SourceId } from "@/lib/sources/types";
import { readLocalGallery } from "@/lib/localLibrary";
import { Gallery } from "@/lib/api/types";
import SmartImage, { preloadSmartImage } from "@/components/SmartImage";
import { IconBtn } from "@/components/ui/IconBtn";
import { SmoothSlider } from "@/components/ui/SmoothSlider";
import { recordReadingProgress } from "@/lib/historyStore";
import { QuickShareModal } from "@/components/modals/QuickShareModal";
import { useReaderSettings } from "@/lib/readerSettingsStore";
import { ThumbRail } from "@/components/reader/ThumbRail";
import { ZoomablePage } from "@/components/reader/ZoomablePage";
import { ReaderSettingsPanel } from "@/components/reader/ReaderSettingsPanel";
import { lightTap } from "@/lib/haptics";
import { useDrawer } from "@/lib/DrawerContext";
import { buildReaderSpreads, pageToSpreadIndex, spreadToPage } from "@/lib/readerSpreads";
import {
  DwellRing,
  isNearMounted,
  PAGE_MOUNT_WINDOW,
  resolvePreloadWindow,
  type PreloadWindow,
} from "@/lib/adaptivePreload";

export function parseReaderInitialPage(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export default function ReaderScreen() {
  const { id, initialPage, local, localId, src } = useLocalSearchParams<{
    id: string;
    initialPage?: string;
    local?: string;
    localId?: string;
    src?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const { settings: readerSettings, updateSettings } = useReaderSettings();
  const { setSwipeEnabled } = useDrawer();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() =>
    parseReaderInitialPage(initialPage)
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [readMode, setReadMode] = useState<"webtoon" | "pager">(
    readerSettings.defaultMode || "webtoon"
  );
  const [readingDirection, setReadingDirection] = useState<"rtl" | "ltr">(
    readerSettings.defaultDirection || "rtl"
  );
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomResetEpoch, setZoomResetEpoch] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const pagerRef = useRef<PagerView>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellRingRef = useRef(new DwellRing());
  const lastPageAtRef = useRef<number>(Date.now());
  const skipDwellRef = useRef(false);
  const recordedOpenRef = useRef(false);
  const [preloadWindow, setPreloadWindow] = useState<PreloadWindow>({ prev: 1, next: 2 });
  const [mountedPagerIndex, setMountedPagerIndex] = useState(() =>
    parseReaderInitialPage(initialPage)
  );

  const isLandscape = width > height;
  const isDualPage = Boolean(
    readerSettings.dualPageMode &&
      readMode === "pager" &&
      (isLandscape || width >= 600)
  );

  useEffect(() => {
    let cancelled = false;
    const rawLocal = typeof localId === "string" && localId ? localId : local;
    setLoading(true);
    setError(null);
    setGallery(null);

    async function loadGallery() {
      try {
        if (rawLocal) {
          const result = await readLocalGallery(rawLocal);
          if (!cancelled) setGallery(result.gallery);
          return;
        }

        if (!id || !/^\d+$/.test(id) || Number(id) <= 0) {
          if (!cancelled) setError("Identifiant de galerie invalide.");
          return;
        }

        // Sources alternatives (src=3hentai|doujins) : chargement via
        // l'adaptateur, pages déjà résolues avec URLs fraîches.
        if (src && src !== "nhentai") {
          const sg = await getSource(src).getGallery(id);
          if (!cancelled) {
            setGallery(sourceGalleryToGallery(sg, src as SourceId));
          }
          return;
        }

        const remoteGallery = await getGallery(id);
        if (!cancelled) setGallery(remoteGallery);
      } catch (err) {
        if (cancelled) return;
        console.error(rawLocal ? "Local reader error:" : "Reader gallery fetch error:", err);
        setError(
          err instanceof Error
            ? err.message
            : rawLocal
              ? "Impossible d'ouvrir la galerie locale."
              : "Impossible de charger la galerie."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGallery();
    return () => {
      cancelled = true;
    };
  }, [id, local, localId, src]);

  useEffect(() => {
    setCurrentPage(parseReaderInitialPage(initialPage));
  }, [id, initialPage, local, localId]);

  const pages = useMemo(() => gallery?.images?.pages ?? [], [gallery]);
  const totalPages = pages.length || gallery?.num_pages || 1;

  const progressOpts = useMemo(() => {
    const rawLocal = typeof localId === "string" && localId ? localId : local;
    const source =
      (typeof src === "string" && src) ||
      (gallery?.scanlator && gallery.scanlator !== "nhentai" ? gallery.scanlator : undefined) ||
      (rawLocal ? undefined : "nhentai");
    return {
      source: typeof source === "string" ? source : undefined,
      localId: typeof rawLocal === "string" && rawLocal ? rawLocal : undefined,
    };
  }, [src, local, localId, gallery?.scanlator]);

  useEffect(() => {
    setCurrentPage((page) => Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  // Historique à l'ouverture (pas seulement au flip).
  useEffect(() => {
    if (!gallery || recordedOpenRef.current) return;
    recordedOpenRef.current = true;
    void recordReadingProgress(
      gallery,
      currentPage,
      totalPages,
      progressOpts
    );
  }, [gallery, currentPage, totalPages, progressOpts]);

  useEffect(() => {
    recordedOpenRef.current = false;
    dwellRingRef.current.clear();
    lastPageAtRef.current = Date.now();
  }, [id, local, localId, src]);

  const dualPageSpreads = useMemo(
    () => (isDualPage ? buildReaderSpreads(pages, readingDirection) : []),
    [pages, isDualPage, readingDirection]
  );

  // Resync index monté quand on bascule dual-page / galerie.
  useEffect(() => {
    setMountedPagerIndex(
      isDualPage ? pageToSpreadIndex(dualPageSpreads, currentPage) : currentPage
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on mode/id only
  }, [isDualPage, id, local, localId, dualPageSpreads.length]);

  // Fenêtre de préchargement (adaptative ou manuelle).
  useEffect(() => {
    setPreloadWindow(
      resolvePreloadWindow({
        adaptive: readerSettings.adaptivePreload,
        medianDwellMs: dwellRingRef.current.median(),
        manualPrev: readerSettings.preloadPrev,
        manualNext: readerSettings.preloadNext,
      })
    );
  }, [
    currentPage,
    readerSettings.adaptivePreload,
    readerSettings.preloadPrev,
    readerSettings.preloadNext,
  ]);

  // Préchargement couplé à la fenêtre (spread-aware en dual-page).
  useEffect(() => {
    if (pages.length === 0 || !gallery) return;

    const indices = new Set<number>();
    if (isDualPage && dualPageSpreads.length > 0) {
      const spreadIdx = pageToSpreadIndex(dualPageSpreads, currentPage);
      for (let d = -preloadWindow.prev; d <= preloadWindow.next; d += 1) {
        const neighbor = dualPageSpreads[spreadIdx + d];
        if (!neighbor) continue;
        if (neighbor.left !== null) indices.add(neighbor.left);
        if (neighbor.right !== null) indices.add(neighbor.right);
      }
    } else {
      for (let d = -preloadWindow.prev; d <= preloadWindow.next; d += 1) {
        if (d === 0) continue;
        const idx = currentPage + d;
        if (idx >= 0 && idx < pages.length) indices.add(idx);
      }
    }

    indices.forEach((idx) => {
      if (idx < 0 || idx >= pages.length) return;
      const p = pages[idx];
      const url = p?.url || resolvePageUrl(gallery.media_id || "", idx, p);
      if (url) {
        try {
          preloadSmartImage(url);
        } catch {
          // Cap mémoire / échec prefetch : ignorer silencieusement.
        }
      }
    });
  }, [
    currentPage,
    pages,
    gallery,
    preloadWindow,
    isDualPage,
    dualPageSpreads,
  ]);

  // System bar handling
  useEffect(() => {
    if (Platform.OS === "android") {
      if (readerSettings.hideStatusBar && !controlsVisible) {
        NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      } else {
        NavigationBar.setVisibilityAsync("visible").catch(() => {});
      }
    }
  }, [controlsVisible, readerSettings.hideStatusBar]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "android") {
        NavigationBar.setVisibilityAsync("visible").catch(() => {});
      }
    };
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number, resetZoom = false) => {
      const clamped = Math.max(0, Math.min(nextPage, totalPages - 1));
      const now = Date.now();
      if (!skipDwellRef.current && clamped !== currentPage) {
        dwellRingRef.current.push(now - lastPageAtRef.current);
      }
      skipDwellRef.current = false;
      lastPageAtRef.current = now;

      setCurrentPage(clamped);
      if (resetZoom && readerSettings.resetZoomOnPageChange) {
        setIsZoomed(false);
        setZoomResetEpoch((epoch) => epoch + 1);
      }

      if (gallery) {
        void recordReadingProgress(gallery, clamped, totalPages, progressOpts);
      }
    },
    [
      gallery,
      totalPages,
      readerSettings.resetZoomOnPageChange,
      progressOpts,
      currentPage,
    ]
  );

  const jumpToPage = useCallback(
    (index: number, opts?: { skipDwell?: boolean }) => {
      if (opts?.skipDwell) skipDwellRef.current = true;
      const target = Math.max(0, Math.min(index, totalPages - 1));
      handlePageChange(target, true);

      if (readMode === "webtoon") {
        flatListRef.current?.scrollToIndex({
          index: target,
          animated: true,
          viewPosition: 0,
        });
      } else {
        const pagerTarget = isDualPage
          ? pageToSpreadIndex(dualPageSpreads, target)
          : target;
        setMountedPagerIndex(pagerTarget);
        pagerRef.current?.setPage(pagerTarget);
      }
    },
    [readMode, handlePageChange, totalPages, isDualPage, dualPageSpreads]
  );

  const handleReaderTap = useCallback(
    (tapX: number) => {
      if (isZoomed) {
        lightTap();
        setControlsVisible((visible) => !visible);
        return;
      }
      const leftZone = width * 0.28;
      const rightZone = width * 0.72;
      if (readerSettings.tapToTurnPage && readMode === "pager") {
        if (tapX < leftZone) {
          jumpToPage(readingDirection === "rtl" ? currentPage + 1 : currentPage - 1);
          return;
        }
        if (tapX > rightZone) {
          jumpToPage(readingDirection === "rtl" ? currentPage - 1 : currentPage + 1);
          return;
        }
      }
      lightTap();
      setControlsVisible((visible) => !visible);
    },
    [
      isZoomed,
      width,
      readerSettings.tapToTurnPage,
      readMode,
      jumpToPage,
      readingDirection,
      currentPage,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      setSwipeEnabled(false);
      return () => setSwipeEnabled(true);
    }, [setSwipeEnabled])
  );

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!readerSettings.autoHideControls || !controlsVisible || settingsOpen) return;
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4000);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [controlsVisible, readerSettings.autoHideControls, settingsOpen, currentPage]);

  const cycleFilter = () => {
    lightTap();
    const current = readerSettings.colorFilter || "none";
    const next =
      current === "none"
        ? "sepia"
        : current === "sepia"
        ? "night"
        : current === "night"
        ? "invert"
        : "none";
    updateSettings({ colorFilter: next });
  };

  const toggleDualPage = () => {
    lightTap();
    updateSettings({ dualPageMode: !readerSettings.dualPageMode });
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: "#000" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.sub }]}>
          Préparation du lecteur...
        </Text>
      </View>
    );
  }

  if (error || !gallery) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: "#000" }]}>
        <IconAlertCircle size={48} color="#ff4757" strokeWidth={1.5} />
        <Text style={[styles.loadingText, { color: "#fff" }]}>
          {error || "Galerie introuvable"}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.back()}
          style={[styles.errorBackBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isImmersive = Boolean(readerSettings.hideStatusBar && !controlsVisible);
  const galleryTitle =
    gallery?.title?.pretty ||
    gallery?.title?.english ||
    gallery?.title?.japanese ||
    `Manga #${gallery?.id || id || ""}`;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar hidden={isImmersive} animated />

      {/* Reader Main Content */}
      <View style={styles.readerArea}>
        {readMode === "webtoon" ? (
          <FlatList
            ref={flatListRef}
            data={pages}
            keyExtractor={(_, idx) => String(idx)}
            initialScrollIndex={currentPage > 0 ? currentPage : undefined}
            scrollEnabled={!isZoomed}
            renderItem={({ item, index }) => {
              const imgUrl = item.url || resolvePageUrl(gallery.media_id, index, item);
              const imgRatio = item.w && item.h ? item.w / item.h : 0.707;
              const imgHeight = width / imgRatio;

              return (
                <View style={[styles.webtoonPageWrap, { width, height: imgHeight }]}>
                  <ZoomablePage
                    enabled
                    pinchEnabled={readerSettings.pinchToZoom}
                    doubleTapScale={readerSettings.doubleTapZoom}
                    resetToken={`${id}-${index}-${zoomResetEpoch}`}
                    onZoomChange={(scale) => setIsZoomed(scale > 1.02)}
                    onSingleTap={(x) => handleReaderTap(x)}
                  >
                    <SmartImage
                      uri={imgUrl}
                      style={{ width, height: imgHeight }}
                      contentFit={readerSettings.fitMode === "height" ? "cover" : "contain"}
                      priority={index === currentPage ? "high" : "normal"}
                    />
                  </ZoomablePage>
                  <View style={styles.webtoonPageNumber}>
                    <Text style={styles.pageNumberText}>
                      {index + 1} / {totalPages}
                    </Text>
                  </View>
                </View>
              );
            }}
            onMomentumScrollEnd={(e) => {
              const offsetY = e.nativeEvent.contentOffset.y;
              const approxIdx = Math.round(offsetY / (height * 0.8));
              handlePageChange(approxIdx);
            }}
          />
        ) : isDualPage ? (
          <PagerView
            ref={pagerRef}
            style={StyleSheet.absoluteFillObject}
            initialPage={pageToSpreadIndex(dualPageSpreads, currentPage)}
            layoutDirection={readingDirection}
            scrollEnabled={!isZoomed}
            offscreenPageLimit={PAGE_MOUNT_WINDOW}
            onPageSelected={(e) => {
              const position = e.nativeEvent.position;
              setMountedPagerIndex(position);
              handlePageChange(spreadToPage(dualPageSpreads, position), true);
            }}
          >
            {dualPageSpreads.map((spread, sIdx) => {
              const leftUrl =
                spread.left !== null
                  ? pages[spread.left]?.url ||
                    resolvePageUrl(gallery.media_id, spread.left, pages[spread.left])
                  : null;
              const rightUrl =
                spread.right !== null
                  ? pages[spread.right]?.url ||
                    resolvePageUrl(gallery.media_id, spread.right, pages[spread.right])
                  : null;

              return (
                <View key={sIdx} style={styles.dualPageSpread} collapsable={false}>
                  {isNearMounted(sIdx, mountedPagerIndex, PAGE_MOUNT_WINDOW) ? (
                    <ZoomablePage
                      pinchEnabled={readerSettings.pinchToZoom}
                      doubleTapScale={readerSettings.doubleTapZoom}
                      resetToken={`${id}-spread-${sIdx}-${zoomResetEpoch}`}
                      onZoomChange={(scale) => setIsZoomed(scale > 1.02)}
                      onSingleTap={(x) => handleReaderTap(x)}
                    >
                      <View style={styles.dualPageSpread}>
                        <View style={styles.dualPageHalf}>
                          {leftUrl ? (
                            <SmartImage
                              uri={leftUrl}
                              style={{ width: width / 2, height }}
                              contentFit="contain"
                            />
                          ) : null}
                        </View>
                        <View style={styles.dualPageHalf}>
                          {rightUrl ? (
                            <SmartImage
                              uri={rightUrl}
                              style={{ width: width / 2, height }}
                              contentFit="contain"
                            />
                          ) : null}
                        </View>
                      </View>
                    </ZoomablePage>
                  ) : null}
                </View>
              );
            })}
          </PagerView>
        ) : (
          <PagerView
            ref={pagerRef}
            style={StyleSheet.absoluteFillObject}
            initialPage={currentPage}
            layoutDirection={readingDirection}
            scrollEnabled={!isZoomed}
            offscreenPageLimit={PAGE_MOUNT_WINDOW}
            onPageSelected={(e) => {
              const position = e.nativeEvent.position;
              setMountedPagerIndex(position);
              handlePageChange(position, true);
            }}
          >
            {pages.map((p, idx) => {
              const imgUrl = p.url || resolvePageUrl(gallery.media_id, idx, p);
              return (
                <View key={idx} style={styles.pagerPageWrap} collapsable={false}>
                  {isNearMounted(idx, mountedPagerIndex, PAGE_MOUNT_WINDOW) ? (
                    <ZoomablePage
                      pinchEnabled={readerSettings.pinchToZoom}
                      doubleTapScale={readerSettings.doubleTapZoom}
                      resetToken={`${id}-page-${idx}-${zoomResetEpoch}`}
                      onZoomChange={(scale) => setIsZoomed(scale > 1.02)}
                      onSingleTap={(x) => handleReaderTap(x)}
                    >
                      <SmartImage
                        uri={imgUrl}
                        style={{ width, height }}
                        contentFit={readerSettings.fitMode === "height" ? "cover" : "contain"}
                        priority={idx === currentPage ? "high" : "normal"}
                      />
                    </ZoomablePage>
                  ) : null}
                </View>
              );
            })}
          </PagerView>
        )}

        {/* Screen / Color Filters Overlay */}
        {readerSettings.colorFilter === "sepia" && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.sepiaOverlay]} />
        )}
        {readerSettings.colorFilter === "night" && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.nightOverlay]} />
        )}
        {readerSettings.colorFilter === "invert" && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.invertOverlay]} />
        )}
        {readerSettings.readerBrightness < 0.99 && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: `rgba(0,0,0,${1 - readerSettings.readerBrightness})` },
            ]}
          />
        )}
      </View>

      {/* Floating Top Controls Overlay */}
      {controlsVisible && (
        <View
          style={[
            styles.topOverlay,
            {
              paddingTop: Math.max(insets.top, 12),
              backgroundColor: "rgba(0,0,0,0.88)",
            },
          ]}
        >
          <IconBtn onPress={() => router.back()} size={40}>
            <IconArrowLeft size={22} color="#fff" strokeWidth={2} />
          </IconBtn>

          <View style={styles.titleWrapper}>
            <Text style={styles.readerTitle} numberOfLines={1}>
              {galleryTitle}
            </Text>
            <Text style={styles.readerPageCount}>
              Page {currentPage + 1} / {totalPages}
            </Text>
          </View>

          <View style={styles.topActions}>
            {/* Filter Toggle (None / Sepia / Night / Invert) */}
            <IconBtn onPress={cycleFilter} size={40}>
              <IconEye
                size={20}
                color={readerSettings.colorFilter !== "none" ? colors.accent : "#fff"}
                strokeWidth={1.8}
              />
            </IconBtn>

            {/* Dual Page Toggle in landscape / tablet */}
            {(isLandscape || width >= 600) && (
              <IconBtn onPress={toggleDualPage} size={40}>
                <IconColumns
                  size={20}
                  color={readerSettings.dualPageMode ? colors.accent : "#9ca3af"}
                  strokeWidth={1.8}
                />
              </IconBtn>
            )}

            {/* Mode Switch: Webtoon / Manga */}
            <IconBtn
              onPress={() =>
                setReadMode((m) => (m === "webtoon" ? "pager" : "webtoon"))
              }
              size={40}
            >
              {readMode === "webtoon" ? (
                <IconLayoutList size={20} color={colors.accent} strokeWidth={2} />
              ) : (
                <IconBook2 size={20} color={colors.accent} strokeWidth={1.8} />
              )}
            </IconBtn>

            {/* Reading Direction */}
            {readMode === "pager" && (
              <IconBtn
                onPress={() =>
                  setReadingDirection((d) => (d === "rtl" ? "ltr" : "rtl"))
                }
                size={40}
              >
                {readingDirection === "rtl" ? (
                  <IconCircleArrowLeft size={20} color={colors.accent} strokeWidth={2} />
                ) : (
                  <IconCircleArrowRight size={20} color={colors.accent} strokeWidth={2} />
                )}
              </IconBtn>
            )}

            <IconBtn
              onPress={() => setSettingsOpen(true)}
              size={40}
              accessibilityLabel="Réglages du lecteur"
            >
              <IconSettings size={20} color="#fff" strokeWidth={2} />
            </IconBtn>

            {/* Share */}
            <IconBtn onPress={() => setIsShareOpen(true)} size={40}>
              <IconShare size={20} color={colors.txt} strokeWidth={2} />
            </IconBtn>
          </View>
        </View>
      )}

      {/* Floating ThumbRail Filmstrip */}
      {controlsVisible && readerSettings.showThumbRail && (
        <ThumbRail
          pages={pages}
          currentPage={currentPage}
          totalPages={totalPages}
          visible={controlsVisible}
          onSelectPage={(page) => jumpToPage(page, { skipDwell: true })}
        />
      )}

      {/* Floating Bottom Slider Overlay */}
      {controlsVisible && (
        <View
          style={[
            styles.bottomOverlay,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: "rgba(0,0,0,0.92)",
            },
          ]}
        >
          <View style={styles.sliderRow}>
            <Text style={styles.sliderPageLabel}>1</Text>
            <SmoothSlider
              value={currentPage + 1}
              min={1}
              max={totalPages}
              step={1}
              activeColor={colors.accent}
              thumbColor={colors.accent}
              style={{ flex: 1, marginHorizontal: 8 }}
              onSlidingComplete={(val) => {
                jumpToPage(val - 1, { skipDwell: true });
              }}
            />
            <Text style={styles.sliderPageLabel}>{totalPages}</Text>
          </View>
        </View>
      )}

      <ReaderSettingsPanel
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        readMode={readMode}
        readingDirection={readingDirection}
        onReadModeChange={setReadMode}
        onDirectionChange={setReadingDirection}
      />

      <QuickShareModal
        visible={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        gallery={
          gallery
            ? {
                id: gallery.id,
                title: gallery.title,
                coverUrl: gallery.images?.cover?.url,
              }
            : { id: id || "0" }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 14, fontWeight: "600" },
  errorBackBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  errorBackText: { color: "#fff", fontWeight: "700" },
  readerArea: { flex: 1 },
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
  pagerPageWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  dualPageSpread: { flex: 1, flexDirection: "row", backgroundColor: "#000" },
  dualPageHalf: { flex: 1, alignItems: "center", justifyContent: "center" },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 20,
  },
  titleWrapper: { flex: 1, paddingHorizontal: 10 },
  readerTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  readerPageCount: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
  topActions: { flexDirection: "row", gap: 4 },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    zIndex: 20,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  sliderPageLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    minWidth: 26,
    textAlign: "center",
  },
  sepiaOverlay: {
    backgroundColor: "rgba(235, 180, 80, 0.16)",
  },
  nightOverlay: {
    backgroundColor: "rgba(220, 100, 30, 0.24)",
  },
  invertOverlay: {
    backgroundColor: "rgba(30, 30, 50, 0.35)",
  },
});
