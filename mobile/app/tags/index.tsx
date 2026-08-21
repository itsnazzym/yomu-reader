import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  IconArrowLeft,
  IconSearch,
  IconX,
  IconHeart,
  IconPlus,
  IconSparkles,
  IconSearchOff,
  IconTag,
  IconFeather,
  IconDeviceTv,
  IconUser,
  IconUsers,
  IconWorld,
  IconFolder,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { lightTap } from "@/lib/haptics";
import {
  getAllTaxonomies,
  CATEGORY_META,
  TaxonomyItem,
} from "@/lib/taxonomyData";
import { useTagFavs } from "@/lib/tagFavoritesStore";
import { useTagCollections, TagCollection } from "@/lib/tagCollectionsStore";

type ActiveTab =
  | "all"
  | "favs"
  | "collections"
  | "tags"
  | "artists"
  | "parodies"
  | "characters"
  | "groups"
  | "languages";

const CATEGORY_TYPE_MAP: Record<string, string> = {
  tags: "tag",
  parodies: "parody",
  characters: "character",
  artists: "artist",
  groups: "group",
  languages: "language",
  tag: "tag",
  parody: "parody",
  character: "character",
  artist: "artist",
  group: "group",
  language: "language",
};

export default function TagsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFav, toggleFav, favoriteList, favCount } = useTagFavs();
  const {
    collections,
    createCollection,
    deleteCollection,
    formatQuery: formatColQuery,
  } = useTagCollections();

  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Create Collection Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("#ec4899");
  const [selectedTagsForCol, setSelectedTagsForCol] = useState<
    { type: string; name: string }[]
  >([]);

  const categories: { key: ActiveTab; label: string; icon: any }[] = [
    { key: "all", label: "Tous", icon: IconSparkles },
    {
      key: "collections",
      label: `Packs (${collections.length})`,
      icon: IconFolder,
    },
    {
      key: "favs",
      label: favCount > 0 ? `Favoris (${favCount})` : "Favoris",
      icon: IconHeart,
    },
    { key: "tags", label: "Tags", icon: IconTag },
    { key: "artists", label: "Artistes", icon: IconFeather },
    { key: "parodies", label: "Séries", icon: IconDeviceTv },
    { key: "characters", label: "Personnages", icon: IconUser },
    { key: "groups", label: "Groupes", icon: IconUsers },
    { key: "languages", label: "Langues", icon: IconWorld },
  ];

  const filteredItems = useMemo(() => {
    let baseList: TaxonomyItem[] = [];

    if (activeTab === "favs") {
      baseList = favoriteList.map((f, idx) => {
        let cat: any = "tags";
        const t = (f.type || "").toLowerCase();
        if (t === "artist") cat = "artists";
        else if (t === "parody") cat = "parodies";
        else if (t === "character") cat = "characters";
        else if (t === "group") cat = "groups";
        else if (t === "language") cat = "languages";
        else if (f.category) cat = f.category;

        return {
          id: 90000 + idx,
          name: f.name || "",
          category: cat,
          count: f.count || 0,
        };
      });
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        baseList = baseList.filter((t) => (t.name || "").toLowerCase().includes(q));
      }
    } else if (activeTab !== "collections") {
      baseList = getAllTaxonomies(activeTab, searchFilter);
    }

    return baseList;
  }, [activeTab, searchFilter, favoriteList]);

  // Clic sur le tag -> lance directement la recherche sur la page d'accueil
  const handleSelectTag = useCallback((tag: TaxonomyItem) => {
    lightTap();
    const type = CATEGORY_TYPE_MAP[tag.category] || "tag";
    router.push({
      pathname: "/",
      params: { tag: tag.name, type },
    });
  }, [router]);

  // Clic sur le bouton + -> ajoute le tag en plus à la recherche existante
  const handleAppendTag = useCallback((tag: TaxonomyItem) => {
    lightTap();
    const type = CATEGORY_TYPE_MAP[tag.category] || "tag";
    router.push({
      pathname: "/",
      params: { appendTag: tag.name, type },
    });
  }, [router]);

  // Clic sur le cœur -> met en favoris instantanément
  const handleToggleFavorite = useCallback((tag: TaxonomyItem) => {
    lightTap();
    const type = CATEGORY_TYPE_MAP[tag.category] || "tag";
    toggleFav({
      type,
      name: tag.name,
      category: tag.category,
      count: tag.count,
    });
  }, [toggleFav]);

  // Lancer une recherche combinant tous les favoris
  const handleSearchAllFavorites = () => {
    if (favoriteList.length === 0) return;
    lightTap();
    const combinedQuery = favoriteList
      .map((f) => `${f.type || "tag"}:"${f.name}"`)
      .join(" ");
    router.push({
      pathname: "/",
      params: { query: combinedQuery },
    });
  };

  // Lancer la recherche d'une collection
  const handleSearchCollection = (col: TagCollection) => {
    lightTap();
    const q = formatColQuery(col);
    router.push({
      pathname: "/",
      params: { query: q },
    });
  };

  const handleCreateCollectionSubmit = async () => {
    if (!newColName.trim()) return;
    lightTap();
    await createCollection(newColName.trim(), selectedTagsForCol, {
      description: newColDesc.trim(),
      color: newColColor,
    });
    setNewColName("");
    setNewColDesc("");
    setSelectedTagsForCol([]);
    setIsCreateModalOpen(false);
  };

  const toggleTagSelectionForCol = (tag: TaxonomyItem) => {
    lightTap();
    const type = CATEGORY_TYPE_MAP[tag.category] || "tag";
    const exists = selectedTagsForCol.some((t) => t.name === tag.name && t.type === type);
    if (exists) {
      setSelectedTagsForCol((prev) => prev.filter((t) => !(t.name === tag.name && t.type === type)));
    } else {
      setSelectedTagsForCol((prev) => [...prev, { type, name: tag.name }]);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: TaxonomyItem }) => {
      const meta = CATEGORY_META[item.category] || CATEGORY_META.tags || {
        icon: IconTag,
        color: "#60a5fa",
        label: "Tag",
        type: "tag",
      };
      const IconComp = meta.icon || IconTag;
      const itemType = CATEGORY_TYPE_MAP[item.category] || "tag";
      const favorited = isFav(itemType, item.name);

      return (
        <View
          style={[
            styles.tagCard,
            {
              backgroundColor: "#14141e",
              borderColor: favorited ? "rgba(244,63,94,0.4)" : "#232332",
            },
          ]}
        >
          {/* Main row press -> open single search */}
          <Pressable
            onPress={() => handleSelectTag(item)}
            android_ripple={{ color: "#ffffff15" }}
            style={styles.tagCardInner}
          >
            <View
              style={[
                styles.tagIconWrap,
                { backgroundColor: meta.color + "18", borderColor: meta.color + "30" },
              ]}
            >
              <IconComp size={15} color={meta.color} stroke={1.8} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.tagName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.tagSubMeta}>
                {meta.label} {item.count > 0 ? `• ${item.count.toLocaleString("fr-FR")}` : ""}
              </Text>
            </View>
          </Pressable>

          {/* Bouton + pour ajouter à la recherche */}
          <Pressable
            onPress={() => handleAppendTag(item)}
            hitSlop={6}
            style={[styles.tagActionBtn, { borderLeftColor: "#232332" }]}
          >
            <IconPlus size={16} color={colors.accent} stroke={2.5} />
          </Pressable>

          {/* Bouton Cœur Favori */}
          <Pressable
            onPress={() => handleToggleFavorite(item)}
            hitSlop={6}
            style={[styles.tagActionBtn, { borderLeftColor: "#232332" }]}
          >
            <IconHeart
              size={16}
              color={favorited ? "#f43f5e" : "#9ca3af"}
              fill={favorited ? "#f43f5e" : "transparent"}
              stroke={1.8}
            />
          </Pressable>
        </View>
      );
    },
    [
      colors.accent,
      handleAppendTag,
      handleSelectTag,
      handleToggleFavorite,
      isFav,
    ]
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: colors.bg,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: "#222232" }]}>
        <IconBtn onPress={() => router.back()} size={36} style={styles.backBtn}>
          <IconArrowLeft size={18} color="#f3f4f6" stroke={2} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tags & Packs</Text>
          <Text style={styles.headerSub}>
            {activeTab === "collections"
              ? `${collections.length} pack${collections.length > 1 ? "s" : ""} disponible${collections.length > 1 ? "s" : ""}`
              : activeTab === "favs"
              ? `${favoriteList.length} tag${favoriteList.length > 1 ? "s" : ""} favori${favoriteList.length > 1 ? "s" : ""}`
              : `${filteredItems.length.toLocaleString("fr-FR")} résultat${filteredItems.length > 1 ? "s" : ""}`}
          </Text>
        </View>

        {activeTab === "collections" && (
          <Pressable
            onPress={() => setIsCreateModalOpen(true)}
            style={[styles.headerActionBtn, { backgroundColor: colors.accent }]}
          >
            <IconPlus size={15} color="#fff" stroke={2.5} />
            <Text style={styles.headerActionText}>Créer</Text>
          </Pressable>
        )}
      </View>

      {/* Search Input Bar */}
      {activeTab !== "collections" && (
        <View style={styles.searchBarWrapper}>
          <View style={[styles.searchBarBox, { backgroundColor: "#14141e", borderColor: "#232332" }]}>
            <IconSearch size={16} color="#9ca3af" stroke={2} />
            <TextInput
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Filtrer parmi les tags, artistes, séries..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchFilter.length > 0 && (
              <Pressable onPress={() => setSearchFilter("")} hitSlop={6}>
                <IconX size={15} color="#9ca3af" stroke={2} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Category Tabs Scroll (Using standard ScrollView for rock-solid stability) */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {categories.map((item) => {
            const isActive = activeTab === item.key;
            const TabIcon = item.icon;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  lightTap();
                  setActiveTab(item.key);
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? colors.accent : "#14141e",
                    borderColor: isActive ? colors.accent : "#232332",
                  },
                ]}
              >
                <TabIcon
                  size={14}
                  color={isActive ? "#ffffff" : "#9ca3af"}
                  stroke={2}
                  fill={item.key === "favs" && isActive ? "#ffffff" : "transparent"}
                />
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive ? "#ffffff" : "#9ca3af",
                      fontWeight: isActive ? "800" : "600",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Bannière d'action si onglet Favoris actif avec éléments */}
      {activeTab === "favs" && favoriteList.length > 0 && (
        <View style={styles.favActionBanner}>
          <CardPressable
            radius={10}
            onPress={handleSearchAllFavorites}
            style={[styles.searchAllFavsBtn, { backgroundColor: colors.accent }]}
          >
            <IconSearch size={15} color="#fff" stroke={2.5} />
            <Text style={styles.searchAllFavsText}>
              Rechercher les favoris ({favoriteList.length})
            </Text>
          </CardPressable>
        </View>
      )}

      {/* Collections Tab Content */}
      {activeTab === "collections" ? (
        <ScrollView
          contentContainerStyle={[
            styles.collectionsContainer,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {collections.map((col) => (
            <View
              key={col.id}
              style={[
                styles.colCard,
                { backgroundColor: "#14141e", borderColor: col.color + "50" },
              ]}
            >
              <View style={styles.colHeader}>
                <View style={styles.colTitleRow}>
                  <View style={[styles.colColorDot, { backgroundColor: col.color }]} />
                  <Text style={styles.colName}>{col.name}</Text>
                </View>

                <Pressable
                  onPress={() => {
                    lightTap();
                    deleteCollection(col.id);
                  }}
                  hitSlop={8}
                >
                  <IconTrash size={16} color="#ef4444" stroke={1.8} />
                </Pressable>
              </View>

              {col.description ? (
                <Text style={styles.colDesc}>{col.description}</Text>
              ) : null}

              {/* Tags included */}
              <View style={styles.colTagsWrap}>
                {col.tags.map((t, idx) => (
                  <View key={idx} style={[styles.colTagBadge, { backgroundColor: col.color + "20" }]}>
                    <Text style={[styles.colTagBadgeText, { color: col.color }]}>
                      +{t.name}
                    </Text>
                  </View>
                ))}
                {col.excludeTags?.map((t, idx) => (
                  <View key={`ex_${idx}`} style={[styles.colTagBadge, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                    <Text style={[styles.colTagBadgeText, { color: "#ef4444" }]}>
                      -{t.name}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Launch Search Button */}
              <Pressable
                onPress={() => handleSearchCollection(col)}
                style={[styles.colSearchBtn, { backgroundColor: col.color }]}
              >
                <IconSearch size={14} color="#fff" stroke={2.5} />
                <Text style={styles.colSearchBtnText}>Rechercher le pack</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSearchOff size={44} color="#6b7280" stroke={1.5} style={{ opacity: 0.6 }} />
          <Text style={styles.emptyTitle}>
            {activeTab === "favs" ? "Aucun favori" : "Aucun résultat"}
          </Text>
          <Text style={styles.emptySub}>
            {activeTab === "favs"
              ? "Touchez l'icône cœur sur n'importe quel tag pour le conserver ici."
              : "Essayez avec d'autres termes de recherche."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          estimatedItemSize={58}
          drawDistance={400}
          keyExtractor={(item) => `${item.category}_${item.name}`}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: insets.bottom + 40,
          }}
        />
      )}

      {/* Modal Créer une Collection */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCreateModalOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: "#13131e", borderColor: "#28283a" }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau pack</Text>
              <Pressable onPress={() => setIsCreateModalOpen(false)} hitSlop={6}>
                <IconX size={18} color="#9ca3af" stroke={2} />
              </Pressable>
            </View>

            <TextInput
              value={newColName}
              onChangeText={setNewColName}
              placeholder="Nom du pack (ex: Romance Vanilla, FGO...)"
              placeholderTextColor="#6b7280"
              style={[styles.modalInput, { backgroundColor: "#181826", borderColor: "#2c2c3e" }]}
            />

            <TextInput
              value={newColDesc}
              onChangeText={setNewColDesc}
              placeholder="Description courte (optionnel)"
              placeholderTextColor="#6b7280"
              style={[styles.modalInput, { backgroundColor: "#181826", borderColor: "#2c2c3e" }]}
            />

            {/* Color Palette Selector */}
            <Text style={styles.paletteTitle}>Couleur :</Text>
            <View style={styles.paletteRow}>
              {["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewColColor(c)}
                  style={[
                    styles.paletteDot,
                    { backgroundColor: c },
                    newColColor === c && styles.paletteDotSelected,
                  ]}
                >
                  {newColColor === c && <IconCheck size={14} color="#fff" stroke={3} />}
                </Pressable>
              ))}
            </View>

            {/* Quick Tag Selector */}
            <Text style={styles.paletteTitle}>
              Tags favoris inclus ({selectedTagsForCol.length}) :
            </Text>
            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              <View style={styles.tagsSelectionWrap}>
                {favoriteList.map((f, idx) => {
                  const isSelected = selectedTagsForCol.some((t) => t.name === f.name);
                  return (
                    <Pressable
                      key={idx}
                      onPress={() =>
                        toggleTagSelectionForCol({
                          id: idx,
                          name: f.name,
                          category: (f.category as any) || "tags",
                          count: f.count || 0,
                        })
                      }
                      style={[
                        styles.selectTagChip,
                        {
                          backgroundColor: isSelected ? newColColor : "#181826",
                          borderColor: isSelected ? newColColor : "#2c2c3e",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectTagText,
                          { color: isSelected ? "#ffffff" : "#d1d5db" },
                        ]}
                      >
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={handleCreateCollectionSubmit}
              disabled={!newColName.trim()}
              style={[
                styles.modalSubmitBtn,
                { backgroundColor: newColName.trim() ? newColColor : "#2d2d3e" },
              ]}
            >
              <Text style={styles.modalSubmitText}>Créer le pack</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  headerSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#f3f4f6",
    padding: 0,
  },
  tabsContainer: {
    paddingVertical: 4,
    minHeight: 42,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    marginRight: 8,
  },
  tabChipText: {
    fontSize: 12,
  },
  favActionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchAllFavsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  searchAllFavsText: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "800",
  },
  tagCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 7,
    overflow: "hidden",
  },
  tagCardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tagIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tagName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  tagSubMeta: {
    fontSize: 10.5,
    color: "#9ca3af",
    marginTop: 1,
  },
  tagActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  collectionsContainer: {
    padding: 16,
    gap: 12,
  },
  colCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  colTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  colDesc: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 16,
  },
  colTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  colTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  colTagBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  colSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
    marginTop: 4,
  },
  colSearchBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#fff",
  },
  emptyContainer: {
    flex: 1,
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  modalInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#f3f4f6",
  },
  paletteTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    marginTop: 2,
  },
  paletteRow: {
    flexDirection: "row",
    gap: 10,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  paletteDotSelected: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  tagsSelectionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 4,
  },
  selectTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectTagText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
});
