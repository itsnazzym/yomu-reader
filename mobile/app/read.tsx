import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";
import { useTheme } from "@/lib/ThemeContext";
import { getGallery, resolvePageUrl } from "@/lib/api/nhentai";
import { Gallery } from "@/lib/api/types";
import SmartImage from "@/components/SmartImage";
import { IconBtn } from "@/components/ui/IconBtn";
import { recordReadingProgress } from "@/lib/historyStore";
import { QuickShareModal } from "@/components/modals/QuickShareModal";

export default function ReaderScreen() {
  const { id, initialPage } = useLocalSearchParams<{
    id: string;
    initialPage?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(
    initialPage ? parseInt(initialPage, 10) : 0
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [readMode, setReadMode] = useState<"webtoon" | "pager">("webtoon");
  const [readingDirection, setReadingDirection] = useState<"rtl" | "ltr">("rtl");
  const [isShareOpen, setIsShareOpen] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pagerRef = useRef<PagerView>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getGallery(id)
      .then((g) => {
        setGallery(g);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Reader gallery fetch error:", err);
        setLoading(false);
      });
  }, [id]);

  const pages = gallery?.images?.pages || [];
  const totalPages = pages.length || gallery?.num_pages || 1;

  const handlePageChange = useCallback(
    (pageIdx: number) => {
      const clamped = Math.max(0, Math.min(totalPages - 1, pageIdx));
      setCurrentPage(clamped);
      if (gallery) {
        recordReadingProgress(gallery, clamped, totalPages);
      }
    },
    [gallery, totalPages]
  );

  const toggleControls = () => {
    setControlsVisible((prev) => !prev);
  };

  const jumpToPage = (index: number) => {
    handlePageChange(index);
    if (readMode === "webtoon") {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    } else {
      pagerRef.current?.setPage(index);
    }
  };

  if (loading || !gallery) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: "#000" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: "#fff" }]}>
          Chargement du lecteur...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar hidden={!controlsVisible} animated />

      {/* Reader Main Content */}
      <Pressable style={styles.readerArea} onPress={toggleControls}>
        {readMode === "webtoon" ? (
          <FlatList
            ref={flatListRef}
            data={pages}
            keyExtractor={(_, idx) => String(idx)}
            initialScrollIndex={currentPage > 0 ? currentPage : undefined}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item, index }) => {
              const imgUrl = item.url || resolvePageUrl(gallery.media_id, index, item);
              const imgRatio = item.w && item.h ? item.w / item.h : 0.7;
              const imgHeight = width / imgRatio;

              return (
                <View style={[styles.webtoonPageWrap, { width, height: imgHeight }]}>
                  <SmartImage
                    uri={imgUrl}
                    style={{ width, height: imgHeight }}
                    contentFit="contain"
                    priority={index === currentPage ? "high" : "normal"}
                  />
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
        ) : (
          <PagerView
            ref={pagerRef}
            style={StyleSheet.absoluteFillObject}
            initialPage={currentPage}
            layoutDirection={readingDirection}
            onPageSelected={(e) => handlePageChange(e.nativeEvent.position)}
          >
            {pages.map((p, idx) => {
              const imgUrl = p.url || resolvePageUrl(gallery.media_id, idx, p);
              return (
                <View key={idx} style={styles.pagerPageWrap}>
                  <SmartImage
                    uri={imgUrl}
                    style={{ width, height }}
                    contentFit="contain"
                    priority={idx === currentPage ? "high" : "normal"}
                  />
                </View>
              );
            })}
          </PagerView>
        )}
      </Pressable>

      {/* Floating Top Controls Overlay */}
      {controlsVisible && (
        <View
          style={[
            styles.topOverlay,
            {
              paddingTop: Math.max(insets.top, 12),
              backgroundColor: "rgba(0,0,0,0.85)",
            },
          ]}
        >
          <IconBtn onPress={() => router.back()} size={40}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </IconBtn>

          <View style={styles.titleWrapper}>
            <Text style={styles.readerTitle} numberOfLines={1}>
              {gallery.title.pretty || gallery.title.english}
            </Text>
            <Text style={styles.readerPageCount}>
              Page {currentPage + 1} / {totalPages}
            </Text>
          </View>

          <View style={styles.topActions}>
            {/* Mode Switch: Webtoon / Manga */}
            <IconBtn
              onPress={() =>
                setReadMode((m) => (m === "webtoon" ? "pager" : "webtoon"))
              }
              size={40}
            >
              <Feather
                name={readMode === "webtoon" ? "list" : "book"}
                size={20}
                color={colors.accent}
              />
            </IconBtn>

            {/* Reading Direction (Manga Mode) */}
            {readMode === "pager" && (
              <IconBtn
                onPress={() =>
                  setReadingDirection((d) => (d === "rtl" ? "ltr" : "rtl"))
                }
                size={40}
              >
                <Feather
                  name={readingDirection === "rtl" ? "arrow-left-circle" : "arrow-right-circle"}
                  size={20}
                  color={colors.accent}
                />
              </IconBtn>
            )}

            {/* Quick Share & AirDrop */}
            <IconBtn onPress={() => setIsShareOpen(true)} size={40}>
              <Feather name="share-2" size={20} color={colors.txt} />
            </IconBtn>
          </View>
        </View>
      )}

      {/* Floating Bottom ThumbRail Overlay */}
      {controlsVisible && (
        <View
          style={[
            styles.bottomOverlay,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: "rgba(0,0,0,0.85)",
            },
          ]}
        >
          <FlatList
            horizontal
            data={pages}
            keyExtractor={(_, idx) => String(idx)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRailContent}
            renderItem={({ item, index }) => {
              const isCurrent = index === currentPage;
              return (
                <Pressable
                  onPress={() => jumpToPage(index)}
                  style={[
                    styles.thumbRailItem,
                    {
                      borderColor: isCurrent ? colors.accent : "transparent",
                      borderWidth: isCurrent ? 2 : 1,
                    },
                  ]}
                >
                  <SmartImage
                    uri={item.urlThumb || item.url || ""}
                    style={styles.thumbRailImage}
                    contentFit="cover"
                  />
                  <View style={styles.thumbRailBadge}>
                    <Text style={styles.thumbRailText}>{index + 1}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      )}

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
    paddingTop: 10,
    zIndex: 20,
  },
  thumbRailContent: { paddingHorizontal: 12, gap: 8 },
  thumbRailItem: {
    width: 48,
    height: 68,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#181824",
  },
  thumbRailImage: { width: "100%", height: "100%" },
  thumbRailBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbRailText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
