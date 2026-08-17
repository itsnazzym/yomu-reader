import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useDrawer } from "@/lib/DrawerContext";
import { BookCard } from "@/components/BookCard";
import { FilterModal, FilterOptions } from "@/components/modals/FilterModal";
import { searchGalleries } from "@/lib/api/nhentai";
import { Gallery } from "@/lib/api/types";
import { isGalleryBlacklisted, useBlacklist } from "@/lib/blacklistFilter";
import { addToSearchHistory } from "@/lib/recommendationEngine";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tags: blacklistedTags } = useBlacklist();
  const params = useLocalSearchParams<{ tag?: string; query?: string; type?: string }>();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sort: "recent",
    language: "all",
    pageRange: "all",
    dateFilter: "all",
  });

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rotation animation for refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);

  const numColumns = width >= 600 ? 3 : 2;
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  // Synchronize tag clicks
  useEffect(() => {
    if (params.tag) {
      const q =
        params.type && params.type !== "tag"
          ? `${params.type}:"${params.tag}"`
          : `"${params.tag}"`;
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
        const response = await searchGalleries(effectiveQuery, p, opts.sort as any);

        const newItems = response.result || [];
        setGalleries(newItems);
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

  const filteredGalleries = useMemo(() => {
    if (!blacklistedTags.length) return galleries;
    return galleries.filter((g) => !isGalleryBlacklisted(g));
  }, [galleries, blacklistedTags]);

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
          <Feather name="menu" size={20} color="#f3f4f6" style={{ marginRight: 10 }} />
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
              <Feather name="refresh-cw" size={18} color="#c5878d" />
            </Animated.View>
          </TouchableOpacity>

          {/* Search Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            style={[styles.iconBtn, isSearchOpen && { backgroundColor: "rgba(197, 135, 141, 0.2)" }]}
          >
            <Feather name="search" size={18} color="#c5878d" />
          </TouchableOpacity>

          {/* Filter & Sort Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsFilterModalOpen(true)}
            style={[styles.iconBtn, hasActiveFilters && { backgroundColor: "rgba(197, 135, 141, 0.2)" }]}
          >
            <Feather name="filter" size={18} color="#c5878d" />
            {hasActiveFilters && <View style={styles.filterBadgeDot} />}
          </TouchableOpacity>

          {/* Tags Explorer Shortcut */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/tags")}
            style={styles.iconBtn}
          >
            <Feather name="tag" size={18} color="#c5878d" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Search Input */}
      {isSearchOpen && (
        <View style={styles.searchBarWrap}>
          <Feather name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
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
          {searchQuery ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setSearchQuery("");
                setActiveQuery("");
                setPage(1);
              }}
              style={{ padding: 4 }}
            >
              <Feather name="x" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
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
          <Feather name="alert-circle" size={48} color="#ff4757" />
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
          <Feather name="inbox" size={48} color="#6b7280" style={{ opacity: 0.5 }} />
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
          numColumns={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 8,
            paddingBottom: insets.bottom + 65,
          }}
          keyExtractor={(item) => String(item.id)}
        />
      )}

      {/* Bottom Pagination Bar (1:1 with Screenshot) */}
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
          <Feather name="chevron-left" size={22} color="#f3f4f6" />
        </TouchableOpacity>

        {/* Page Indicator (Clickable to jump) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Alert.prompt?.(
              "Aller à la page",
              `Entrez un numéro de page (1 à ${totalPages}) :`,
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Aller",
                  onPress: (val) => {
                    const p = parseInt(val || "1", 10);
                    if (!isNaN(p)) handlePageChange(p);
                  },
                },
              ],
              "plain-text",
              String(page)
            );
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
          <Feather name="chevron-right" size={22} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

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
});
