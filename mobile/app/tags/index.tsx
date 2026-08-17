import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";

interface TagItem {
  id: number;
  name: string;
  count: number;
  category: "tags" | "parodies" | "characters" | "artists" | "groups";
}

// Popular curated taxonomies
const DEFAULT_TAXONOMIES: TagItem[] = [
  // Parodies
  { id: 1, name: "original", count: 75400, category: "parodies" },
  { id: 2, name: "fate grand order", count: 48900, category: "parodies" },
  { id: 3, name: "touhou project", count: 44200, category: "parodies" },
  { id: 4, name: "kantai collection", count: 32100, category: "parodies" },
  { id: 5, name: "granblue fantasy", count: 28400, category: "parodies" },
  { id: 6, name: "the idolmaster", count: 25600, category: "parodies" },
  { id: 7, name: "blue archive", count: 19800, category: "parodies" },
  { id: 8, name: "genshin impact", count: 18200, category: "parodies" },
  { id: 9, name: "pokemon", count: 14500, category: "parodies" },
  { id: 10, name: "hololive", count: 12100, category: "parodies" },

  // Characters
  { id: 101, name: "gudao", count: 12400, category: "characters" },
  { id: 102, name: "producer", count: 10800, category: "characters" },
  { id: 103, name: "artoria pendragon", count: 9400, category: "characters" },
  { id: 104, name: "asuka langley soryu", count: 8200, category: "characters" },
  { id: 105, name: "tifa lockhart", count: 7600, category: "characters" },
  { id: 106, name: "reimu hakurei", count: 7100, category: "characters" },
  { id: 107, name: "raiden shogun", count: 6800, category: "characters" },
  { id: 108, name: "marin kitagawa", count: 5400, category: "characters" },

  // Tags
  { id: 201, name: "big breasts", count: 198000, category: "tags" },
  { id: 202, name: "sole female", count: 165000, category: "tags" },
  { id: 203, name: "sole male", count: 142000, category: "tags" },
  { id: 204, name: "schoolgirl uniform", count: 98000, category: "tags" },
  { id: 205, name: "stockings", count: 92000, category: "tags" },
  { id: 206, name: "nakadashi", count: 87000, category: "tags" },
  { id: 207, name: "blowjob", count: 81000, category: "tags" },
  { id: 208, name: "milf", count: 68000, category: "tags" },
  { id: 209, name: "glasses", count: 62000, category: "tags" },
  { id: 210, name: "maid", count: 48000, category: "tags" },

  // Artists
  { id: 301, name: "shindo l", count: 120, category: "artists" },
  { id: 302, name: "hisasi", count: 98, category: "artists" },
  { id: 303, name: "asakura ryou", count: 85, category: "artists" },
  { id: 304, name: "homunculus", count: 78, category: "artists" },
  { id: 305, name: "michiking", count: 74, category: "artists" },
  { id: 306, name: "crimson", count: 68, category: "artists" },

  // Groups
  { id: 401, name: "studio fow", count: 110, category: "groups" },
  { id: 402, name: "carmine", count: 84, category: "groups" },
  { id: 403, name: "alice soft", count: 76, category: "groups" },
  { id: 404, name: "type-moon", count: 62, category: "groups" },
];

export default function TagsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<
    "parodies" | "characters" | "tags" | "artists" | "groups"
  >("tags");
  const [searchFilter, setSearchFilter] = useState("");

  const categories = [
    { key: "tags", label: "Balises" },
    { key: "parodies", label: "Séries" },
    { key: "characters", label: "Personnages" },
    { key: "artists", label: "Artistes" },
    { key: "groups", label: "Groupes" },
  ] as const;

  const filteredItems = useMemo(() => {
    let list = DEFAULT_TAXONOMIES.filter((t) => t.category === activeCategory);
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, searchFilter]);

  const handleSelectTag = (tag: TagItem) => {
    router.push({
      pathname: "/",
      params: { tag: tag.name },
    });
  };

  const renderItem = ({ item }: { item: TagItem }) => (
    <CardPressable
      onPress={() => handleSelectTag(item)}
      radius={12}
      style={[
        styles.tagCard,
        { backgroundColor: colors.page, borderColor: colors.tagBg },
      ]}
    >
      <View style={styles.tagCardInner}>
        <View style={styles.tagIconWrap}>
          <Feather name="tag" size={16} color={colors.accent} />
        </View>
        <Text style={[styles.tagName, { color: colors.txt }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: colors.tagBg }]}>
          <Text style={[styles.countText, { color: colors.sub }]}>
            {item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
          </Text>
        </View>
      </View>
    </CardPressable>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.txt }]}>
          Balises & Taxonomies
        </Text>
        <Text style={[styles.headerSub, { color: colors.sub }]}>
          Explorez les mangas par séries, personnages, balises ou artistes
        </Text>

        {/* Search input */}
        <View style={[styles.searchWrap, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <Feather name="search" size={16} color={colors.sub} style={{ marginRight: 8 }} />
          <TextInput
            value={searchFilter}
            onChangeText={setSearchFilter}
            placeholder={`Filtrer les ${activeCategory}...`}
            placeholderTextColor={colors.sub}
            style={[styles.searchInput, { color: colors.txt }]}
          />
          {searchFilter ? (
            <Pressable onPress={() => setSearchFilter("")}>
              <Feather name="x" size={16} color={colors.sub} />
            </Pressable>
          ) : null}
        </View>

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {categories.map((c) => {
            const isActive = activeCategory === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  setActiveCategory(c.key);
                  setSearchFilter("");
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? colors.accent : colors.page,
                    borderColor: isActive ? colors.accent : colors.tagBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: isActive ? "#fff" : colors.sub },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* List */}
      <FlashList
        data={filteredItems}
        renderItem={renderItem}
        estimatedItemSize={60}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
        keyExtractor={(item) => String(item.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13 },
  tabsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  tabChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  tabChipText: { fontSize: 12, fontWeight: "700" },
  tagCard: { borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  tagCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tagIconWrap: { marginRight: 10 },
  tagName: { flex: 1, fontSize: 14, fontWeight: "700" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countText: { fontSize: 11, fontWeight: "700" },
});
