import React, { useMemo } from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { useBlacklist } from "@/lib/blacklistFilter";
import { DB_CATEGORIES } from "@/lib/taxonomyData";
import { RelatedCard } from "@/lib/api/nhentai";
import SmartImage from "@/components/SmartImage";

const CARD_WIDTH = 112;
const MAX_RELATED = 12;

let tagIdNameMap: Map<number, string> | null = null;

function getTagIdNameMap(): Map<number, string> {
  if (tagIdNameMap) return tagIdNameMap;
  const map = new Map<number, string>();
  for (const list of Object.values(DB_CATEGORIES)) {
    for (const item of list) {
      if (item?.id && item?.name) {
        map.set(item.id, String(item.name).toLowerCase());
      }
    }
  }
  tagIdNameMap = map;
  return map;
}

function relatedTagNames(item: RelatedCard): string[] {
  const names = new Set(item.tagNames.map((n) => n.toLowerCase()));
  const idMap = getTagIdNameMap();
  for (const tid of item.tag_ids) {
    const name = idMap.get(tid);
    if (name) names.add(name);
  }
  return [...names];
}

function isRelatedBlacklisted(item: RelatedCard, blacklistedTags: string[]): boolean {
  if (!blacklistedTags.length) return false;
  const names = relatedTagNames(item);
  if (!names.length) return false;
  return blacklistedTags.some((blocked) => names.includes(blocked));
}

export interface RelatedRowProps {
  items: RelatedCard[];
  loading: boolean;
  /** Hide the current gallery if the API echoes it back. */
  excludeId?: number | string;
}

export function RelatedRow({ items, loading, excludeId }: RelatedRowProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { tags: blacklistedTags } = useBlacklist();

  const visible = useMemo(() => {
    const skip = Number(excludeId);
    return items
      .filter((item) => {
        if (skip && Number(item.id) === skip) return false;
        return !isRelatedBlacklisted(item, blacklistedTags);
      })
      .slice(0, MAX_RELATED);
  }, [items, blacklistedTags, excludeId]);

  if (!loading && visible.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.title }]}>Similaires</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {loading
          ? [0, 1, 2].map((key) => (
              <View
                key={`ph-${key}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.page,
                    borderColor: colors.tagBg,
                  },
                ]}
              >
                <View style={[styles.cover, { backgroundColor: colors.tagBg }]} />
                <View style={[styles.placeholderLine, { backgroundColor: colors.tagBg }]} />
                <View
                  style={[
                    styles.placeholderLine,
                    styles.placeholderLineShort,
                    { backgroundColor: colors.tagBg },
                  ]}
                />
              </View>
            ))
          : visible.map((item) => (
              <TouchableOpacity
                key={String(item.id)}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: "/book/[id]",
                    params: { id: String(item.id) },
                  });
                }}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.page,
                    borderColor: colors.tagBg,
                  },
                ]}
              >
                <View style={styles.cover}>
                  <SmartImage
                    uri={item.coverUrl}
                    style={styles.coverImage}
                    contentFit="cover"
                    priority="low"
                  />
                </View>
                <Text style={[styles.cardTitle, { color: colors.txt }]} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    paddingLeft: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    paddingRight: 16,
  },
  row: {
    paddingRight: 16,
    gap: 10,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 8,
  },
  cover: {
    width: CARD_WIDTH,
    aspectRatio: 0.707,
    backgroundColor: "#0d0d14",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  placeholderLine: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
    marginTop: 10,
  },
  placeholderLineShort: {
    width: "55%",
    marginTop: 6,
  },
});
