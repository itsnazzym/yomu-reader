import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Gallery, Tag } from "@/lib/api/types";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import SmartImage from "@/components/SmartImage";
import { useFavorites } from "@/lib/favoritesStore";

export interface BookCardProps {
  gallery: Gallery;
  cardWidth?: number;
  onPress?: () => void;
}

// Pastel category tint colors for chips
const TAG_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  artist: { bg: "rgba(236, 72, 153, 0.15)", text: "#f472b6", border: "rgba(236, 72, 153, 0.3)" },
  group: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "rgba(168, 85, 247, 0.3)" },
  parody: { bg: "rgba(124, 58, 237, 0.15)", text: "#a78bfa", border: "rgba(124, 58, 237, 0.3)" },
  character: { bg: "rgba(6, 182, 212, 0.15)", text: "#22d3ee", border: "rgba(6, 182, 212, 0.3)" },
  tag: { bg: "rgba(59, 130, 246, 0.12)", text: "#93c5fd", border: "rgba(59, 130, 246, 0.25)" },
  language: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" },
};

export function BookCard({ gallery, cardWidth = 160, onPress }: BookCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();

  const fav = isFavorite(gallery.id);

  // Extract language badge
  const lang = (() => {
    if (!gallery.tags) return null;
    const lTag = gallery.tags.find((t) => t.type === "language" && t.name !== "translated");
    if (!lTag) return null;
    const name = lTag.name.toLowerCase();
    if (name === "english" || name === "en") return "EN";
    if (name === "japanese" || name === "jp") return "JP";
    if (name === "chinese" || name === "cn") return "CN";
    return name.slice(0, 2).toUpperCase();
  })();

  // Extract release date/year
  const dateStr = gallery.upload_date
    ? new Date(gallery.upload_date * 1000).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  // Real title formatting
  const title =
    gallery.title?.english ||
    gallery.title?.pretty ||
    gallery.title?.japanese ||
    `Gallery #${gallery.id}`;

  const coverUrl =
    gallery.images?.cover?.url ||
    gallery.images?.thumbnail?.url ||
    (gallery.media_id ? `https://t3.nhentai.net/galleries/${gallery.media_id}/thumb.webp` : "");

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: "/book/[id]",
        params: { id: String(gallery.id) },
      });
    }
  };

  const handleFavoritePress = (e: any) => {
    e?.stopPropagation?.();
    toggleFavorite(gallery);
  };

  // Filter preview tags (artist, group, parody, or popular tag)
  const tagChips = (gallery.tags || [])
    .filter((t) => t.type === "artist" || t.type === "group" || t.type === "parody" || t.type === "tag" || t.type === "character")
    .slice(0, 3);

  const extraTagsCount = Math.max(0, (gallery.tags?.length || 0) - tagChips.length);

  return (
    <CardPressable
      onPress={handleCardPress}
      radius={16}
      activeOpacity={0.82}
      style={[
        styles.card,
        {
          width: cardWidth,
          backgroundColor: "#161622",
          borderColor: "#28283a",
        },
      ]}
    >
      {/* Cover Image Container */}
      <View style={styles.imageContainer}>
        <SmartImage
          uri={coverUrl}
          style={styles.image}
          contentFit="cover"
        />

        {/* Top Badges (NEW Badge & Bookmark) */}
        <View style={styles.topBadgeRow}>
          <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleFavoritePress}
            style={[
              styles.favBtn,
              { backgroundColor: fav ? colors.accent : "rgba(18, 18, 28, 0.78)" },
            ]}
          >
            <Feather
              name="bookmark"
              size={13}
              color={fav ? "#fff" : "rgba(255,255,255,0.85)"}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Pages Badge */}
        <View style={styles.bottomBadgeRow}>
          <View style={[styles.pageBadge, { backgroundColor: "rgba(10, 10, 18, 0.82)" }]}>
            <Feather name="file-text" size={10} color="#fff" style={{ marginRight: 3 }} />
            <Text style={styles.pageText}>
              {gallery.num_pages || gallery.images?.pages?.length || "?"}p
            </Text>
          </View>
        </View>
      </View>

      {/* Card Info Area (Matching NHApp) */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Language, Pages & Date Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {lang ? `${lang} · ` : ""}
            {gallery.num_pages ? `${gallery.num_pages} стр.` : ""}
            {dateStr ? ` · ${dateStr}` : ""}
          </Text>
        </View>

        {/* Tag Chips Preview with Aesthetic Category Colors */}
        {tagChips.length > 0 ? (
          <View style={styles.tagsRow}>
            {tagChips.map((t) => {
              const themeStyle = TAG_TYPE_COLORS[t.type] || TAG_TYPE_COLORS.tag;
              return (
                <View
                  key={t.name}
                  style={[
                    styles.tagChip,
                    { backgroundColor: themeStyle.bg, borderColor: themeStyle.border },
                  ]}
                >
                  <Text
                    style={[styles.tagChipText, { color: themeStyle.text }]}
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>
                </View>
              );
            })}
            {extraTagsCount > 0 && (
              <View style={styles.extraTagChip}>
                <Text style={styles.extraTagText}>+{extraTagsCount}</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </CardPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 0.72,
    position: "relative",
    backgroundColor: "#11111a",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  topBadgeRow: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  favBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBadgeRow: {
    position: "absolute",
    bottom: 6,
    left: 6,
  },
  pageBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pageText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  info: {
    padding: 8,
  },
  title: {
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
    minHeight: 30,
    color: "#f3f4f6",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaText: {
    fontSize: 9.5,
    color: "#9ca3af",
    fontWeight: "500",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 75,
  },
  tagChipText: {
    fontSize: 9,
    fontWeight: "700",
  },
  extraTagChip: {
    backgroundColor: "#202030",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  extraTagText: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "700",
  },
});

export default BookCard;
