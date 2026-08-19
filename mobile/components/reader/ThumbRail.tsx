import React, { useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { lightTap } from "@/lib/haptics";
import { useTheme } from "@/lib/ThemeContext";
import type { GalleryImage } from "@/lib/api/types";

export interface ThumbRailProps {
  pages: GalleryImage[];
  currentPage: number;
  totalPages: number;
  visible: boolean;
  onSelectPage: (index: number) => void;
}

export function ThumbRail({
  pages,
  currentPage,
  totalPages,
  visible,
  onSelectPage,
}: ThumbRailProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const ITEM_WIDTH = 56;
  const ITEM_GAP = 6;

  // Auto-scroll to center current page
  useEffect(() => {
    if (visible && scrollRef.current && totalPages > 0) {
      const targetX = Math.max(
        0,
        currentPage * (ITEM_WIDTH + ITEM_GAP) - width / 2 + ITEM_WIDTH / 2
      );
      scrollRef.current.scrollTo({ x: targetX, animated: true });
    }
  }, [currentPage, visible, width, totalPages]);

  if (!visible || !pages || pages.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: "rgba(10, 10, 16, 0.92)", borderTopColor: "#222232" }]}>
      <View style={styles.headerRow}>
        <Text style={styles.titleText}>
          Navigation Rapide • Page {currentPage + 1} / {totalPages}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {pages.map((p, idx) => {
          const isActive = idx === currentPage;
          const uri = p.urlThumb || p.url || "";
          return (
            <Pressable
              key={idx}
              onPress={() => {
                lightTap();
                onSelectPage(idx);
              }}
              style={[
                styles.thumbItem,
                {
                  width: ITEM_WIDTH,
                  borderColor: isActive ? colors.accent : "rgba(255,255,255,0.08)",
                  borderWidth: isActive ? 2 : 1,
                  backgroundColor: "#161622",
                },
              ]}
            >
              <SmartImage
                uri={uri}
                style={styles.thumbImg}
                contentFit="cover"
                showLoader={false}
              />
              <View
                style={[
                  styles.pageBadge,
                  { backgroundColor: isActive ? colors.accent : "rgba(0,0,0,0.7)" },
                ]}
              >
                <Text style={styles.pageBadgeText}>{idx + 1}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 64,
    left: 0,
    right: 0,
    paddingVertical: 8,
    borderTopWidth: 1,
    zIndex: 99,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    alignItems: "center",
  },
  titleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: "center",
  },
  thumbItem: {
    height: 80,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  pageBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pageBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
  },
});
