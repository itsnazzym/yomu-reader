import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  IconMenu2,
  IconRefresh,
  IconSearch,
  IconAdjustmentsHorizontal,
  IconTag,
  IconX,
  IconAlertCircle,
  IconInbox,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconFlame,
  IconWorld,
  IconTags,
  IconPhotoSearch,
} from "@tabler/icons-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useDrawer } from "@/lib/DrawerContext";
import { BookCard } from "@/components/BookCard";
import { FilterModal, FilterOptions } from "@/components/modals/FilterModal";
import { ReverseImageSearchModal } from "@/components/modals/ReverseImageSearchModal";
import { searchGalleries } from "@/lib/api/nhentai";
import { Gallery } from "@/lib/api/types";
import { isGalleryBlacklisted, useBlacklist } from "@/lib/blacklistFilter";
import { addToSearchHistory } from "@/lib/recommendationEngine";
import {
  searchTaxonomy,
  formatTagQuery,
  TaxonomyItem,
  CATEGORY_META,
} from "@/lib/taxonomyData";
import { useReaderSettings } from "@/lib/readerSettingsStore";
import { useTagCollections } from "@/lib/tagCollectionsStore";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tags: blacklistedTags } = useBlacklist();
  const params = useLocalSearchParams<{
    tag?: string;
    query?: string;
    type?: string;
    appendTag?: string;
  }>();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const { collections, formatQuery: formatColQuery } = useTagCollections();

  useEffect(() => {
    if (params.query) {
      setSearchQuery(params.query);
      setActiveQuery(params.query);
      setIsSearchOpen(true);
      setPage(1);
    } else if (params.tag) {
      const type = params.type || "tag";
      const formatted = `${type}:"${params.tag}"`;
      setSearchQuery(formatted);
      setActiveQuery(formatted);
      setIsSearchOpen(true);
      setPage(1);
    } else if (params.appendTag) {
      const type = params.type || "tag";
      const formatted = `${type}:"${params.appendTag}"`;
      setSearchQuery((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${formatted}` : formatted;
        setActiveQuery(next);
        return next;
      });
      setIsSearchOpen(true);
      setPage(1);
    }
  }, [params.query, params.tag, params.appendTag, params.type]);

  // Suggestions automatiques de tags
  const tagSuggestions = useMemo(() => {
    if (!isSearchOpen || !searchQuery.trim()) return [];
    const parts = searchQuery.split(/\s+/);
    const lastWord = parts[parts.length - 1] || "";
    if (lastWord.length < 2) return [];
    return searchTaxonomy(lastWord, 6);
  }, [isSearchOpen, searchQuery]);

  const handleSelectSuggestion = (item: TaxonomyItem) => {
    const formatted = formatTagQuery(item);
    const parts = searchQuery.split(/\s+/);
    parts.pop();
    const newQuery = parts.length > 0 ? `${parts.join(" ")} ${formatted}` : formatted;
    setSearchQuery(newQuery);
    setActiveQuery(newQuery);
    setPage(1);
  };

  // Jump to Page Modal (Works on Android, iOS, Web)
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState("1");

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sort: "recent",
    language: "all",
    pageRange: "all",
    dateFilter: "all",
  });

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [popularGalleries, setPopularGalleries] = useState<Gallery[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Start in a loading state so Android never flashes a blank grid while
  // the first mirror request is being established.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rotation animation for refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);

  const { settings: readerSettings } = useReaderSettings();

  const isLandscape = width > 500;
  const isTablet = width >= 768;
  const configuredColumns = isTablet
    ? isLandscape
      ? readerSettings.catalogColumnsTabletLandscape
      : readerSettings.catalogColumnsTabletPortrait
    : isLandscape
    ? readerSettings.catalogColumnsPhoneLandscape
    : readerSettings.catalogColumnsPhonePortrait;

  const numColumns = Math.max(1, configuredColumns || (width >= 600 ? 3 : 2));
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  // Synchronize tag clicks
  useEffect(() => {
    if (params.tag) {
      const type = params.type || "tag";
      const cleanTag = String(params.tag).trim();
      const q = cleanTag.includes(" ") ? `${type}:"${cleanTag}"` : `${type}:${cleanTag}`;
      setSearchQuery(q);
      setActiveQuery(q);
      setIsSearchOpen(true);
      setPage(1);
    } else if (params.query) {
      setSearchQuery(params.query);
      setActiveQuery(params.query);
      setIsSearchOpen(true);
      setPage(1);
    }
  }, [params.tag, params.query, params.type]);

  const fetchGalleries = useCallback(
    async (
      q: string,
      opts: FilterOptions,
      p: number
    ) => {
      setIsLoading(true);
      setError(null);

      const isHomeFeed =
        !q.trim() &&
        opts.sort === "recent" &&
        opts.language === "all" &&
        opts.pageRange === "all" &&
        opts.dateFilter === "all";

      if (!isHomeFeed) {
        setPopularGalleries([]);
      }

      // Start refresh spin
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => spinAnim.setValue(0));

      try {
        let queryParts: string[] = [];
        if (q.trim()) {
          queryParts.push(q.trim());
        }
        if (opts.language && opts.language !== "all") {
          queryParts.push(`language:${opts.language}`);
        }
        if (opts.pageRange && opts.pageRange !== "all") {
          queryParts.push(opts.pageRange);
        }
        if (opts.dateFilter && opts.dateFilter !== "all") {
          queryParts.push(opts.dateFilter);
        }

        const effectiveQuery = queryParts.join(" ");
        const [response, popularResponse] = await Promise.all([
          searchGalleries(effectiveQuery, p, opts.sort as any),
          isHomeFeed
            ? searchGalleries("", 1, "popular-today").catch((popularError) => {
                // A failed popularity request must not hide the usable upload
                // feed; the website's main content remains the priority.
                console.warn("Popular Now unavailable:", popularError);
                return null;
              })
            : Promise.resolve(null),
        ]);

        const newItems = response.result || [];
        if (p > 1 && readerSettings.infiniteScroll) {
          setGalleries((prev) => {
            const existingIds = new Set(prev.map((g) => g.id));
            const fresh = newItems.filter((g) => !existingIds.has(g.id));
            return [...prev, ...fresh];
          });
        } else {
          setGalleries(newItems);
        }
        setPopularGalleries(
          isHomeFeed ? (popularResponse?.result || []).slice(0, 5) : []
        );
        setTotalPages(Math.max(1, response.num_pages || 1));
      } catch (err: any) {
        console.error("Fetch galleries error:", err);
        setError(err?.message || "Erreur de chargement des galeries.");
      } finally {
        setIsLoading(false);
      }
    },
    [spinAnim]
  );

  useEffect(() => {
    fetchGalleries(activeQuery, filterOptions, page);
  }, [activeQuery, filterOptions, page, fetchGalleries]);

  const handleSearchSubmit = () => {
    const clean = searchQuery.trim();
    if (/^\d{1,7}$/.test(clean)) {
      router.push({ pathname: "/book/[id]", params: { id: clean } });
      return;
    }
    void addToSearchHistory(clean);
    setActiveQuery(clean);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchGalleries(activeQuery, filterOptions, page);
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    if (clamped !== page) {
      setPage(clamped);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const isHomeFeed =
    !activeQuery.trim() &&
    filterOptions.sort === "recent" &&
    filterOptions.language === "all" &&
    filterOptions.pageRange === "all" &&
    filterOptions.dateFilter === "all";

  const filteredGalleries = useMemo(() => {
    if (!blacklistedTags.length) return galleries;
    return galleries.filter((g) => !isGalleryBlacklisted(g));
  }, [galleries, blacklistedTags]);

  const filteredPopularGalleries = useMemo(() => {
    if (!blacklistedTags.length) return popularGalleries;
    return popularGalleries.filter((g) => !isGalleryBlacklisted(g));
  }, [popularGalleries, blacklistedTags]);

  const popularCardWidth = Math.min(150, Math.max(132, Math.round(width * 0.38)));

  const homeHeader = isHomeFeed ? (
    <View style={styles.homeHeader}>
      {filteredPopularGalleries.length > 0 && (
        <View>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Popular Now</Text>
            <Text style={styles.sectionMeta}>Today</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularRow}
          >
            {filteredPopularGalleries.map((item) => (
              <View key={String(item.id)} style={{ width: popularCardWidth, marginRight: 10 }}>
                <BookCard gallery={item} cardWidth={popularCardWidth} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.sectionHeaderRow, styles.newUploadsHeader]}>
        <Text style={styles.sectionTitle}>New Uploads</Text>
        <Text style={styles.sectionMeta}>Page {page}</Text>
      </View>
    </View>
  ) : null;

  const renderItem = ({ item }: { item: Gallery }) => (
    <View style={{ width: cardWidth }}>
      <BookCard gallery={item} cardWidth={cardWidth} />
    </View>
  );

  const hasActiveFilters =
    filterOptions.language !== "all" ||
    filterOptions.pageRange !== "all" ||
    filterOptions.dateFilter !== "all" ||
    filterOptions.sort !== "recent";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "#12121a",
          paddingTop: insets.top + 6,
        },
      ]}
    >
      {/* Top Header Row (Matching NHApp Screenshot 1:1) */}
      <View style={styles.topHeader}>
        {/* Left: Drawer Menu Button + Title */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={openDrawer}
          style={styles.headerLeft}
        >
          <IconMenu2 size={20} color="#f3f4f6" stroke={2} style={{ marginRight: 10 }} />
          <Text style={styles.headerTitle}>Home</Text>
        </TouchableOpacity>

        {/* Right Action Icons */}
        <View style={styles.headerRight}>
          {/* Refresh Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleRefresh}
            style={styles.iconBtn}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconRefresh size={18} color="#c5878d" stroke={2} />
            </Animated.View>
          </TouchableOpacity>

          {/* Search Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            style={[styles.iconBtn, isSearchOpen && { backgroundColor: "rgba(197, 135, 141, 0.2)" }]}
          >
            <IconSearch size={18} color="#c5878d" stroke={2} />
          </TouchableOpacity>

          {/* Filter & Sort Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsFilterModalOpen(true)}
            style={[styles.iconBtn, hasActiveFilters && { backgroundColor: "rgba(197, 135, 141, 0.2)" }]}
          >
            <IconAdjustmentsHorizontal size={18} color="#c5878d" stroke={1.8} />
            {hasActiveFilters && <View style={styles.filterBadgeDot} />}
          </TouchableOpacity>

          {/* Tags Explorer Shortcut */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/tags")}
            style={styles.iconBtn}
          >
            <IconTag size={18} color="#c5878d" stroke={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Search Input & Tag Suggestions */}
      {isSearchOpen && (
        <View style={styles.searchSection}>
          <View style={styles.searchBarWrap}>
            <IconSearch size={16} color="#9ca3af" stroke={1.8} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholder="Rechercher tags, artistes, parodies ou code..."
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
              autoFocus
            />
            {/* Recherche Visuelle par Image */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsImageSearchOpen(true)}
              style={{ padding: 4, marginRight: 2 }}
            >
              <IconPhotoSearch size={18} color="#60a5fa" stroke={2} />
            </TouchableOpacity>

            {searchQuery ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setSearchQuery("");
                  setActiveQuery("");
                  setPage(1);
                  router.setParams({ tag: undefined, query: undefined, type: undefined });
                }}
                style={{ padding: 4 }}
              >
                <IconX size={16} color="#9ca3af" stroke={2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Live Tag Autocomplete Dropdown */}
          {tagSuggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: "#151522", borderColor: "#28283a" }]}>
              {tagSuggestions.map((item) => {
                const meta = CATEGORY_META[item.category];
                return (
                  <TouchableOpacity
                    key={`${item.category}-${item.id}`}
                    activeOpacity={0.7}
                    onPress={() => handleSelectSuggestion(item)}
                    style={styles.suggestionItem}
                  >
                    <View style={styles.suggestionLeft}>
                      <View style={[styles.categoryBadge, { backgroundColor: `${meta?.color || "#60a5fa"}20` }]}>
                        <Text style={[styles.categoryBadgeText, { color: meta?.color || "#60a5fa" }]}>
                          {meta?.label || "Tag"}
                        </Text>
                      </View>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={styles.suggestionCount}>
                      {item.count > 1000 ? `${Math.round(item.count / 1000)}k` : item.count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Quick Tag & Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipsRow}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const q = "language:french";
                setSearchQuery(q);
                setActiveQuery(q);
                setPage(1);
              }}
              style={[styles.quickChip, searchQuery.includes("french") && styles.quickChipActive]}
            >
              <IconWorld size={14} color={searchQuery.includes("french") ? "#ffffff" : "#60a5fa"} stroke={2} />
              <Text style={[styles.quickChipText, searchQuery.includes("french") && styles.quickChipTextActive]}>
                Français
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const q = "language:english";
                setSearchQuery(q);
                setActiveQuery(q);
                setPage(1);
              }}
              style={[styles.quickChip, searchQuery.includes("english") && styles.quickChipActive]}
            >
              <IconWorld size={14} color={searchQuery.includes("english") ? "#ffffff" : "#34d399"} stroke={2} />
              <Text style={[styles.quickChipText, searchQuery.includes("english") && styles.quickChipTextActive]}>
                Anglais
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setFilterOptions((prev) => ({
                  ...prev,
                  sort: prev.sort === "popular" ? "recent" : "popular",
                }));
                setPage(1);
              }}
              style={[styles.quickChip, filterOptions.sort.includes("popular") && styles.quickChipActive]}
            >
              <IconFlame size={14} color={filterOptions.sort.includes("popular") ? "#ffffff" : "#fbbf24"} stroke={2} />
              <Text style={[styles.quickChipText, filterOptions.sort.includes("popular") && styles.quickChipTextActive]}>
                Populaires
              </Text>
            </TouchableOpacity>

            {/* Custom Tag Collections / Packs */}
            {collections.map((col) => {
              const colQ = formatColQuery(col);
              const isColActive = searchQuery === colQ;
              return (
                <TouchableOpacity
                  key={col.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSearchQuery(colQ);
                    setActiveQuery(colQ);
                    setPage(1);
                  }}
                  style={[
                    styles.quickChip,
                    { borderColor: col.color + "60" },
                    isColActive && { backgroundColor: col.color + "30", borderColor: col.color },
                  ]}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col.color }} />
                  <Text style={[styles.quickChipText, isColActive && { color: "#ffffff", fontWeight: "800" }]}>
                    {col.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/tags")}
              style={styles.quickChip}
            >
              <IconTags size={14} color="#a78bfa" stroke={2} />
              <Text style={styles.quickChipText}>
                Explorer Tags
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Main Grid View */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Chargement des mangas...</Text>
        </View>
      ) : error && galleries.length === 0 ? (
        <View style={styles.centerContainer}>
          <IconAlertCircle size={48} color="#ff4757" stroke={1.5} />
          <Text style={styles.errorTitle}>Impossible de charger les galeries</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRefresh}
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filteredGalleries.length === 0 ? (
        <View style={styles.centerContainer}>
          <IconInbox size={48} color="#6b7280" stroke={1.5} style={{ opacity: 0.5 }} />
          <Text style={styles.emptyTitle}>Aucun résultat trouvé</Text>
          <Text style={styles.emptySub}>
            Essayez de modifier votre recherche ou vos filtres de page/langue.
          </Text>
        </View>
      ) : (
        <FlashList
          ref={flatListRef}
          data={filteredGalleries}
          renderItem={renderItem}
          estimatedItemSize={240}
          getItemType={() => "gallery_card"}
          drawDistance={500}
          numColumns={numColumns}
          ListHeaderComponent={homeHeader}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (readerSettings.infiniteScroll && !isLoading && page < totalPages) {
              setPage((prev) => prev + 1);
            }
          }}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 8,
            paddingBottom: insets.bottom + (readerSettings.infiniteScroll ? 25 : 65),
          }}
          keyExtractor={(item) => String(item.id)}
        />
      )}

      {/* Bottom Pagination Bar (Only when infinite scroll is disabled) */}
      {!readerSettings.infiniteScroll && (
        <View
          style={[
            styles.bottomPagination,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
        {/* Prev Page Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handlePageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          style={[styles.pageNavBtn, page <= 1 && { opacity: 0.3 }]}
        >
          <IconChevronLeft size={22} color="#f3f4f6" stroke={2} />
        </TouchableOpacity>

        {/* Page Indicator (Clickable to jump - Android, iOS, Web compatible) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setJumpPageInput(String(page));
            setIsJumpModalOpen(true);
          }}
          style={styles.pageIndicatorBox}
        >
          <Text style={styles.pageText}>
            {page} / {totalPages}
          </Text>
        </TouchableOpacity>

        {/* Next Page Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handlePageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          style={[styles.pageNavBtn, page >= totalPages && { opacity: 0.3 }]}
        >
          <IconChevronRight size={22} color="#f3f4f6" stroke={2} />
        </TouchableOpacity>
      </View>
      )}

      {/* Jump to Page Modal */}
      <Modal
        visible={isJumpModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsJumpModalOpen(false)}
      >
        <Pressable
          style={styles.jumpBackdrop}
          onPress={() => setIsJumpModalOpen(false)}
        >
          <Pressable
            style={[
              styles.jumpModalCard,
              { backgroundColor: "#161622", borderColor: "#28283a" },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.jumpModalTitle}>Aller à la page</Text>
            <Text style={styles.jumpModalSub}>
              Entrez un numéro de page entre 1 et {totalPages} :
            </Text>

            <TextInput
              value={jumpPageInput}
              onChangeText={setJumpPageInput}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => {
                const p = parseInt(jumpPageInput || "1", 10);
                if (!isNaN(p)) {
                  handlePageChange(p);
                }
                setIsJumpModalOpen(false);
              }}
              style={[
                styles.jumpInput,
                { backgroundColor: "#12121a", borderColor: "#28283a", color: "#f3f4f6" },
              ]}
            />

            <View style={styles.jumpActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsJumpModalOpen(false)}
                style={styles.jumpCancelBtn}
              >
                <Text style={styles.jumpCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const p = parseInt(jumpPageInput || "1", 10);
                  if (!isNaN(p)) {
                    handlePageChange(p);
                  }
                  setIsJumpModalOpen(false);
                }}
                style={[styles.jumpSubmitBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.jumpSubmitText}>Aller</Text>
                <IconArrowRight size={16} color="#1c191a" stroke={2.5} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        options={filterOptions}
        onChange={(newOpts) => {
          setFilterOptions(newOpts);
          setPage(1);
        }}
      />

      {/* Reverse Image Search Modal */}
      <ReverseImageSearchModal
        visible={isImageSearchOpen}
        onClose={() => setIsImageSearchOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#f3f4f6",
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBadgeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ed2553",
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#181826",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#f3f4f6",
  },
  homeHeader: {
    paddingTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  sectionMeta: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  popularRow: {
    paddingRight: 4,
  },
  newUploadsHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#9ca3af",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    color: "#f3f4f6",
  },
  errorSub: {
    fontSize: 12.5,
    marginTop: 4,
    textAlign: "center",
    color: "#9ca3af",
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    color: "#f3f4f6",
  },
  emptySub: {
    fontSize: 12.5,
    marginTop: 4,
    textAlign: "center",
    maxWidth: 280,
    color: "#9ca3af",
  },
  bottomPagination: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    backgroundColor: "rgba(18, 18, 26, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#20202e",
  },
  pageNavBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c1c28",
  },
  pageIndicatorBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#161622",
    borderWidth: 1,
    borderColor: "#28283a",
  },
  pageText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#f3f4f6",
    letterSpacing: 0.5,
  },
  jumpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  jumpModalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  jumpModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  jumpModalSub: {
    fontSize: 12.5,
    color: "#9ca3af",
    lineHeight: 17,
  },
  jumpInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  jumpActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  jumpCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e1e2c",
  },
  jumpCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
  },
  jumpSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  jumpSubmitText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1c191a",
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  suggestionsBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 4,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1d1d2c",
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  suggestionName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#f3f4f6",
    flex: 1,
  },
  suggestionCount: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  quickChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#161622",
    borderWidth: 1,
    borderColor: "#28283a",
  },
  quickChipActive: {
    backgroundColor: "rgba(197, 135, 141, 0.2)",
    borderColor: "#c5878d",
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d1d5db",
  },
  quickChipTextActive: {
    color: "#c5878d",
    fontWeight: "800",
  },
});
