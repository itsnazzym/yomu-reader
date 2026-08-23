import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Pressable } from "react-native";
import { IconBookmark, IconBook2 } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { Gallery } from "@/lib/api/types";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import SmartImage from "@/components/SmartImage";
import { useFavorites } from "@/lib/favoritesStore";
import { lightTap } from "@/lib/haptics";
import {
  listSources,
  type SourceMeta,
} from "@/lib/sources/registry";

export interface BookCardProps {
  gallery: Gallery;
  cardWidth?: number;
  onPress?: () => void;
}

// Pastel category tint colors for chips
const TAG_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  artist: { bg: "rgba(236, 72, 153, 0.12)", text: "#f472b6", border: "rgba(236, 72, 153, 0.28)" },
  group: { bg: "rgba(168, 85, 247, 0.12)", text: "#c084fc", border: "rgba(168, 85, 247, 0.28)" },
  parody: { bg: "rgba(124, 58, 237, 0.12)", text: "#a78bfa", border: "rgba(124, 58, 237, 0.28)" },
  character: { bg: "rgba(6, 182, 212, 0.12)", text: "#22d3ee", border: "rgba(6, 182, 212, 0.28)" },
  tag: { bg: "rgba(59, 130, 246, 0.10)", text: "#93c5fd", border: "rgba(59, 130, 246, 0.22)" },
  language: { bg: "rgba(245, 158, 11, 0.12)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.28)" },
};

/** Métadonnées des sources indexées par id (badges). */
const SOURCE_METAS: Record<string, SourceMeta> = Object.fromEntries(
  listSources().map((m) => [m.id, m])
);

export function BookCard({ gallery, cardWidth = 160, onPress }: BookCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();

  const globalId = (gallery as Gallery & { globalId?: string }).globalId;
  const sourceMeta = globalId ? SOURCE_METAS[globalId.split(":")[0]] : undefined;

  const galleryId = gallery?.id ? Number(gallery.id) : 0;
  const fav = galleryId ? isFavorite(galleryId) : false;

  // Extract language badge
  const lang = (() => {
    if (!Array.isArray(gallery?.tags)) return null;
    const lTag = gallery.tags.find((t) => t?.type === "language" && t?.name !== "translated");
    if (!lTag || !lTag.name) return null;
    const name = String(lTag.name).toLowerCase();
    if (name === "english" || name === "en") return "EN";
    if (name === "japanese" || name === "jp") return "JP";
    if (name === "chinese" || name === "cn") return "CN";
    if (name === "french" || name === "fr" || name === "français" || name === "francais") return "FR";
    if (name === "spanish" || name === "es" || name === "español") return "ES";
    if (name === "german" || name === "de" || name === "deutsch") return "DE";
    if (name === "russian" || name === "ru") return "RU";
    if (name === "italian" || name === "it" || name === "italiano") return "IT";
    if (name === "korean" || name === "ko") return "KO";
    return name.slice(0, 2).toUpperCase();
  })();

  // Real title formatting
  const title =
    gallery?.title?.english ||
    gallery?.title?.pretty ||
    gallery?.title?.japanese ||
    `Gallery #${galleryId || 0}`;

  const coverUrl =
    gallery?.images?.cover?.url ||
    gallery?.images?.thumbnail?.url ||
    (gallery?.media_id ? `https://t3.nhentai.net/galleries/${gallery.media_id}/thumb.webp` : "");

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else if (galleryId > 0) {
      router.push({
        pathname: "/book/[id]",
        params: {
          id: String(galleryId),
          ...(globalId ? { src: globalId.split(":")[0] } : {}),
          ...(title ? { title: title.slice(0, 180) } : {}),
        },
      });
    }
  };

  const handleFavoritePress = (e: any) => {
    e?.stopPropagation?.();
    lightTap();
    if (gallery && galleryId > 0) toggleFavorite(gallery);
  };

  const handleTagPress = (e: any, name: string, type?: string) => {
    e?.stopPropagation?.();
    lightTap();
    router.push({
      pathname: "/",
      params: { tag: name, type: type || "tag" },
    });
  };

  // Filter preview tags
  const tagChips = (Array.isArray(gallery?.tags) ? gallery.tags : [])
    .filter((t) => t && t.name && (t.type === "artist" || t.type === "group" || t.type === "parody" || t.type === "tag" || t.type === "character"))
    .slice(0, 3);

  const extraTagsCount = Math.max(0, (gallery?.tags?.length || 0) - tagChips.length);
  const numPages = gallery?.num_pages || gallery?.images?.pages?.length || 0;

  return (
    <CardPressable
      onPress={handleCardPress}
      radius={14}
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          width: cardWidth,
          backgroundColor: colors.page,
          borderColor: colors.tagBg,
        },
      ]}
    >
      {/* Cover Image Container (B6 Tankōbon Ratio 1:1.414) */}
      <View style={[styles.imageContainer, { backgroundColor: colors.bg }]}>
        <SmartImage
          uri={coverUrl}
          recyclingKey={`cover_${galleryId}_${coverUrl}`}
          style={styles.image}
          contentFit="cover"
        />

        {/* Archive Stamp ID Badge (Top-Left) */}
        <View style={styles.archiveStamp}>
          <Text style={styles.archiveStampText}>#{galleryId}</Text>
        </View>

        {/* Discrete Bookmark Notch (Top-Right) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleFavoritePress}
          style={[
            styles.bookmarkNotch,
            fav && { backgroundColor: colors.accent },
          ]}
            accessibilityRole="button"
            accessibilityLabel={fav ? `Retirer ${title} des favoris` : `Ajouter ${title} aux favoris`}
            accessibilityState={{ selected: fav }}
        >
          <IconBookmark
            size={12}
            color={fav ? "#fff" : "rgba(255,255,255,0.75)"}
            strokeWidth={fav ? 2.5 : 1.8}
            fill={fav ? "#fff" : "none"}
          />
        </TouchableOpacity>

        {/* Bottom Technical Spec Bar */}
        <View style={styles.specBar}>
          <View style={styles.specBadge}>
            <IconBook2 size={10} color="#d1d5db" strokeWidth={1.8} style={{ marginRight: 3 }} />
            <Text style={styles.specText}>{numPages}p</Text>
          </View>
          {lang && (
            <View style={[styles.specBadge, styles.langBadge]}>
              <Text style={styles.langText}>{lang}</Text>
            </View>
          )}
          {/* Badge de source multi-sources (masqué pour nhentai, source par défaut) */}
          {sourceMeta && sourceMeta.id !== "nhentai" && (
            <View style={[styles.sourceBadge, { backgroundColor: sourceMeta.accentColor }]}>
              <Text style={styles.sourceText} numberOfLines={1}>
                {sourceMeta.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Card Info Area (Matte Info Tab) */}
      <View style={[styles.info, { borderTopColor: colors.tagBg }]}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Tag Chips Preview */}
        {tagChips.length > 0 ? (
          <View style={styles.tagsRow}>
            {tagChips.map((t, idx) => {
              const themeStyle = TAG_TYPE_COLORS[t.type] || TAG_TYPE_COLORS.tag;
              return (
                <Pressable
                  key={`${t.type}-${t.id || t.name || idx}`}
                  onPress={(e) => handleTagPress(e, t.name, t.type)}
                  style={[
                    styles.tagChip,
                    { backgroundColor: themeStyle.bg, borderColor: themeStyle.border },
                  ]}
                >
                  <Text style={[styles.tagChipText, { color: themeStyle.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
            {extraTagsCount > 0 && (
              <View style={[styles.extraTagChip, { backgroundColor: colors.tagBg }]}>
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
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 10,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 0.707, // Format B6 Tankōbon Japonais (1:1.414)
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  archiveStamp: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(9, 9, 14, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0.8,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  archiveStampText: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  bookmarkNotch: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(9, 9, 14, 0.85)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
  },
  specBar: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    gap: 4,
  },
  specBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(9, 9, 14, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0.8,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  specText: {
    color: "#e5e7eb",
    fontSize: 9.5,
    fontWeight: "700",
  },
  langBadge: {
    backgroundColor: "rgba(9, 9, 14, 0.9)",
  },
  langText: {
    color: "#fbbf24",
    fontSize: 9,
    fontWeight: "900",
  },
  sourceBadge: {
    maxWidth: 90,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  sourceText: {
    color: "#0b0b10",
    fontSize: 8.5,
    fontWeight: "900",
  },
  info: {
    padding: 8,
    gap: 5,
    borderTopWidth: 1,
  },
  title: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#f3f4f6",
    lineHeight: 15,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  tagChip: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.8,
    maxWidth: "100%",
    flexShrink: 0,
  },
  tagChipText: {
    fontSize: 9.5,
    fontWeight: "600",
    flexShrink: 0,
  },
  extraTagChip: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  extraTagText: {
    color: "#9ca3af",
    fontSize: 8.5,
    fontWeight: "700",
  },
});
