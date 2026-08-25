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
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import {
  IconMenu2,
  IconRefresh,
  IconSearch,
  IconAdjustmentsHorizontal,
  IconTag,
  IconAlertCircle,
  IconInbox,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconFlame,
  IconWorld,
  IconTags,
  IconBook2,
} from "@tabler/icons-react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useDrawer } from "@/lib/DrawerContext";
import { BookCard } from "@/components/BookCard";
import { SearchBar } from "@/components/SearchBar";
import { TagLabel } from "@/components/ui/TagLabel";
import { FilterModal, FilterOptions } from "@/components/modals/FilterModal";
import { ReverseImageSearchModal } from "@/components/modals/ReverseImageSearchModal";
import { searchGalleries } from "@/lib/api/nhentai";
import { listSources } from "@/lib/sources/registry";
import { getSource } from "@/lib/sources/registry";
import type { SourceId } from "@/lib/sources/types";
import { lightTap } from "@/lib/haptics";
import { Gallery } from "@/lib/api/types";
import { isGalleryBlacklisted, useBlacklist } from "@/lib/blacklistFilter";
import { useHistory } from "@/lib/historyStore";
import SmartImage from "@/components/SmartImage";
import { addToSearchHistory } from "@/lib/recommendationEngine";
import {
  checkAllSourcesHealth,
  consumeFallbackToast,
  pickFallbackSource,
  useSourceHealth,
} from "@/lib/sourceHealthStore";
import {
  searchTaxonomy,
  formatTagQuery,
  TaxonomyItem,
  CATEGORY_META,
} from "@/lib/taxonomyData";
import { getReaderSettings, useReaderSettings } from "@/lib/readerSettingsStore";
import { useTagCollections } from "@/lib/tagCollectionsStore";
import {
  appendHomeSearchTerm,
  getHomeSearchQuery,
  replaceHomeSearchTerm,
  setHomeSearchQuery,
} from "@/lib/homeSearchStore";
import { firstRouteParam } from "@/lib/searchQuery";
import { translateQueryForSource } from "@/lib/sources/html";
import { catalogColumnCount } from "@/lib/catalogGrid";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tags: blacklistedTags } = useBlacklist();
  const { history } = useHistory();
  const params = useLocalSearchParams<{
    tag?: string;
    query?: string;
    type?: string;
    appendTag?: string;
    src?: string;
  }>();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState(() => getHomeSearchQuery());
  const [activeQuery, setActiveQuery] = useState(() => getHomeSearchQuery());
  const [isSearchOpen, setIsSearchOpen] = useState(() => Boolean(getHomeSearchQuery()));
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const { collections, formatQuery: formatColQuery } = useTagCollections();
  const consumedParamsRef = useRef("");

  const applySearchQuery = useCallback((next: string, openSearch = true) => {
    const clean = next.trim();
    setSearchQuery(clean);
    setActiveQuery(clean);
    setHomeSearchQuery(clean);
    if (openSearch && clean) setIsSearchOpen(true);
    setPage(1);
  }, []);

  useEffect(() => {
    const query = firstRouteParam(params.query);
    const tag = firstRouteParam(params.tag);
    const appendTag = firstRouteParam(params.appendTag);
    const type = firstRouteParam(params.type) || "tag";
    const src = firstRouteParam(params.src);
    if (!query && !tag && !appendTag && !src) return;

    const key = `${query}|${tag}|${appendTag}|${type}|${src}`;
    if (consumedParamsRef.current === key) return;
    consumedParamsRef.current = key;

    // Un tag sélectionné depuis la taxonomie d'une source cible
    // automatiquement cette source pour que les résultats viennent du bon site.
    if (src && ["nhentai", "3hentai", "doujins"].includes(src)) {
      const sid = src as SourceId;
      setActiveSource((prev) => (prev === sid ? prev : sid));
      setPage(1);
    }

    if (query) {
      applySearchQuery(query);
    } else if (tag) {
      applySearchQuery(replaceHomeSearchTerm(type, tag));
    } else if (appendTag) {
      const result = appendHomeSearchTerm(type, appendTag);
      applySearchQuery(result.query);
    }

    router.setParams({
      tag: undefined,
      query: undefined,
      type: undefined,
      appendTag: undefined,
      src: undefined,
    });
  }, [params.query, params.tag, params.appendTag, params.type, params.src, applySearchQuery, router]);

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
    applySearchQuery(newQuery);
  };

  // Jump to Page Modal (Works on Android, iOS, Web)
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState("1");

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sort: "recent",
    language: "english",
    pageRange: "all",
    dateFilter: "all",
  });

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [popularGalleries, setPopularGalleries] = useState<Gallery[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Start in a loading state so Android never flashes a blank grid while
  // the first mirror request is being established.
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Chargement d'un plein rafraîchissement (changement de source, refresh,
  // nouvelle recherche) quand du contenu est déjà affiché : bannière fine
  // au lieu de vider la grille.
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [feedTrackWidth, setFeedTrackWidth] = useState(0);
  const feedBarAnim = useRef(new Animated.Value(0)).current;
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rotation animation for refresh button
  const spinAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlashListRef<Gallery>>(null);
  const latestRequestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const galleriesRef = useRef<Gallery[]>([]);

  // Multi-sources : "all" = fusion nhentai + 3hentai + doujins.
  const [activeSource, setActiveSource] = useState<SourceId | "all">("all");
  const sourceMetas = React.useMemo(() => listSources(), []);
  const sourceHealth = useSourceHealth();

  // Health-check au démarrage + fallback si source active down.
  useEffect(() => {
    let cancelled = false;
    void checkAllSourcesHealth().then(() => {
      if (cancelled) return;
      setActiveSource((prev) => {
        const fallback = pickFallbackSource(prev);
        if (!fallback || fallback === prev) return prev;
        if (consumeFallbackToast()) {
          const label =
            fallback === "all"
              ? "toutes les sources"
              : sourceMetas.find((m) => m.id === fallback)?.label ?? fallback;
          Alert.alert(
            "Source indisponible",
            `Basculement automatique vers ${label}.`
          );
        }
        return fallback;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceMetas]);

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

  const cardGap = 10;
  const horizontalPadding = 12;
  const numColumns = catalogColumnCount({
    width,
    configuredColumns: Math.max(1, configuredColumns || (width >= 600 ? 3 : 2)),
    minCardWidth: readerSettings.catalogMinCardWidth ?? 130,
    gap: cardGap,
    horizontalPadding,
  });
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  galleriesRef.current = galleries;

  const fetchGalleries = useCallback(
    async (
      q: string,
      opts: FilterOptions,
      p: number
    ) => {
      const requestId = ++latestRequestRef.current;
      const infinite = getReaderSettings().infiniteScroll;
      const isPagination = p > 1 && infinite && galleriesRef.current.length > 0;
      if (isPagination) {
        setIsFetchingMore(true);
        loadingMoreRef.current = true;
      } else if (galleriesRef.current.length === 0) {
        setIsInitialLoading(true);
      } else {
        // Contenu déjà affiché (changement de source, refresh, recherche) :
        // on garde la grille visible mais on signale le rechargement.
        setIsFeedLoading(true);
      }
      setError(null);

      const isHomeFeed =
        !q.trim() &&
        opts.sort === "recent" &&
        opts.language === "english" &&
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
        // Langue séparée pour les sources alt (sinon Hitomi/Doujins cherchent "english").
        const userQuery = q.trim();
        const language =
          opts.language && opts.language !== "all" ? opts.language : undefined;

        let queryParts: string[] = [];
        if (userQuery) {
          queryParts.push(userQuery);
        }
        // nHentai garde language: dans la chaîne de requête.
        if (language && !userQuery.toLowerCase().includes("language:")) {
          queryParts.push(`language:${language}`);
        }
        if (opts.pageRange && opts.pageRange !== "all") {
          queryParts.push(opts.pageRange);
        }
        if (opts.dateFilter && opts.dateFilter !== "all") {
          queryParts.push(opts.dateFilter);
        }

        const effectiveQuery = queryParts.join(" ");
        const altQuery = translateQueryForSource(userQuery) || undefined;
        const sort: "recent" | "popular" | "popular-today" | "popular-week" =
          opts.sort === "popular" ||
          opts.sort === "popular-today" ||
          opts.sort === "popular-week"
            ? opts.sort
            : "recent";
        const popQuery = opts.language && opts.language !== "all" ? `language:${opts.language}` : "";

        // ─── Multi-sources ───────────────────────────────────────────────
        // "all" : nhentai (flux principal + popular) + 3hentai + doujins en
        // parallèle, résultats entrelacés. Source unique : flux direct.
        if (activeSource === "all") {
          const nhentaiPromise = searchGalleries(effectiveQuery, p, sort);
          const altSources = ["3hentai", "doujins"] as SourceId[];
          const altPromises = altSources.map(async (sid) => {
            try {
              const r = await getSource(sid).search({
                query: altQuery,
                page: p,
                sort,
                language,
              });
              // Map les cartes sources vers un pseudo-Gallery pour l'affichage.
              return r.cards.map((c) => ({
                id: Number(c.globalId.split(":")[1]) || 0,
                media_id: "",
                globalId: c.globalId,
                title: { english: c.title, japanese: "", pretty: c.title },
                images: {
                  pages: [],
                  cover: { url: c.coverUrl } as any,
                  thumbnail: { url: c.coverUrl } as any,
                },
                scanlator: sid,
                upload_date: c.uploadDate || 0,
                tags: (c.tags || []).map((t) => ({ id: 0, type: (t.type || "tag") as any, name: t.name, url: "", count: 0 })),
                num_pages: c.numPages || 0,
                num_favorites: 0,
              })) as Gallery[];
            } catch (e) {
              console.warn(`Source ${sid} indisponible:`, e);
              return [] as Gallery[];
            }
          });

          const [response, threeH, dj] = await Promise.all([
            nhentaiPromise,
            ...altPromises,
          ]);
          if (requestId !== latestRequestRef.current) return;

          // Interleave : nhentai d'abord, puis alternance 3hentai/doujins.
          const merged: Gallery[] = [...(response.result || [])];
          const maxAlt = Math.max(threeH.length, dj.length);
          for (let i = 0; i < maxAlt; i++) {
            if (threeH[i]) merged.push(threeH[i]);
            if (dj[i]) merged.push(dj[i]);
          }

          const dedupKey = (g: Gallery) =>
            ((g as any).globalId as string) || `${g.id}`;
          if (isPagination) {
            setGalleries((prev) => {
              const existingIds = new Set(prev.map(dedupKey));
              const fresh = merged.filter((g) => !existingIds.has(dedupKey(g)));
              return [...prev, ...fresh];
            });
          } else {
            setGalleries(merged);
          }
          setTotalPages(Math.max(1, response.num_pages || 1));
        } else {
          const adapter = getSource(activeSource);
          const res = await adapter.search({
            query:
              activeSource === "nhentai"
                ? effectiveQuery || undefined
                : altQuery,
            page: p,
            sort,
            language: activeSource === "nhentai" ? undefined : language,
          });
          if (requestId !== latestRequestRef.current) return;
          const mapped: Gallery[] = res.cards.map((c) => ({
            id: Number(c.globalId.split(":")[1]) || 0,
            media_id: "",
            globalId: c.globalId,
            title: { english: c.title, japanese: "", pretty: c.title },
            images: {
              pages: [],
              cover: { url: c.coverUrl } as any,
              thumbnail: { url: c.coverUrl } as any,
            },
            scanlator: activeSource,
            upload_date: c.uploadDate || 0,
            tags: (c.tags || []).map((t) => ({ id: 0, type: (t.type || "tag") as any, name: t.name, url: "", count: 0 })),
            num_pages: c.numPages || 0,
            num_favorites: 0,
          }));
          const dedupKey = (g: Gallery) => (g as any).globalId;
          if (isPagination) {
            setGalleries((prev) => {
              const existingIds = new Set(prev.map(dedupKey));
              const fresh = mapped.filter((g) => !existingIds.has(dedupKey(g)));
              return [...prev, ...fresh];
            });
          } else {
            setGalleries(mapped);
          }
          setTotalPages(res.hasMore ? p + 1 : p);
        }
        if (isHomeFeed && p === 1 && activeSource === "all") {
          setPopularGalleries([]);
        } else {
          setPopularGalleries([]);
        }
      } catch (err: unknown) {
        if (requestId !== latestRequestRef.current) return;
        console.error("Fetch galleries error:", err);
        const message = err instanceof Error ? err.message : "Erreur de chargement des galeries.";
        setError(message);
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsInitialLoading(false);
          setIsFeedLoading(false);
          setIsFetchingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [spinAnim, activeSource]
  );

  useEffect(() => {
    return () => {
      latestRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    fetchGalleries(activeQuery, filterOptions, page);
  }, [activeQuery, filterOptions, page, fetchGalleries]);

  // Barre de progression indéterminée pendant un rechargement de flux.
  useEffect(() => {
    if (!isFeedLoading || feedTrackWidth <= 0) return;
    feedBarAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(feedBarAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(feedBarAnim, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFeedLoading, feedTrackWidth, feedBarAnim]);

  const feedBarTranslateX = feedBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-feedTrackWidth * 0.4, feedTrackWidth],
  });

  // Retour en haut de liste quand la source change (le contenu va être
  // remplacé, rester sur l'offset précédent serait déroutant).
  const prevActiveSource = useRef<SourceId | "all">(activeSource);
  useEffect(() => {
    if (prevActiveSource.current === activeSource) return;
    prevActiveSource.current = activeSource;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeSource]);

  useEffect(() => {
    setHomeSearchQuery(activeQuery);
  }, [activeQuery]);

  const searchIdentity = `${activeQuery}|${filterOptions.sort}|${filterOptions.language}|${filterOptions.pageRange}|${filterOptions.dateFilter}`;
  const prevSearchIdentity = useRef(searchIdentity);
  useEffect(() => {
    if (prevSearchIdentity.current === searchIdentity) return;
    prevSearchIdentity.current = searchIdentity;
    if (galleriesRef.current.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [searchIdentity]);

  useFocusEffect(
    useCallback(() => {
      const stored = getHomeSearchQuery();
      if (stored !== activeQuery) {
        setSearchQuery(stored);
        setActiveQuery(stored);
        if (stored.trim()) setIsSearchOpen(true);
        setPage(1);
      }
    }, [activeQuery])
  );

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

  const resumeEntry = useMemo(() => {
    if (!isHomeFeed || isSearchOpen) return null;
    return (
      history.find((entry) => {
        const total = entry.totalPages || 0;
        return entry.lastPage > 0 && total > 1 && entry.lastPage < total - 1;
      }) ?? null
    );
  }, [history, isHomeFeed, isSearchOpen]);

  const handleResumeRead = () => {
    if (!resumeEntry) return;
    const params: Record<string, string> = {
      id: String(resumeEntry.gallery.id),
      initialPage: String(resumeEntry.lastPage),
    };
    if (resumeEntry.localId) {
      params.localId = resumeEntry.localId;
    } else if (resumeEntry.source && resumeEntry.source !== "nhentai") {
      params.src = resumeEntry.source;
    }
    router.push({
      pathname: "/read",
      params,
    });
  };

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
          backgroundColor: colors.bg,
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
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le menu"
        >
          <IconMenu2 size={20} color={colors.txt} strokeWidth={2} style={{ marginRight: 10 }} />
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Accueil</Text>
        </TouchableOpacity>

        {/* Right Action Icons */}
        <View style={styles.headerRight}>
          {/* Refresh Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleRefresh}
            style={styles.iconBtn}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Actualiser les galeries"
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconRefresh size={18} color={colors.accent} strokeWidth={2} />
            </Animated.View>
          </TouchableOpacity>

          {/* Search Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            style={[styles.iconBtn, isSearchOpen && { backgroundColor: colors.accent + "33" }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? "Fermer la recherche" : "Ouvrir la recherche"}
          >
            <IconSearch size={18} color={colors.accent} strokeWidth={2} />
          </TouchableOpacity>

          {/* Filter & Sort Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsFilterModalOpen(true)}
            style={[styles.iconBtn, hasActiveFilters && { backgroundColor: colors.accent + "33" }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les filtres"
          >
            <IconAdjustmentsHorizontal size={18} color={colors.accent} strokeWidth={1.8} />
            {hasActiveFilters && <View style={styles.filterBadgeDot} />}
          </TouchableOpacity>

          {/* Tags Explorer Shortcut */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/tags")}
            style={styles.iconBtn}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Explorer les tags"
          >
            <IconTag size={18} color={colors.accent} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Multi-source selector chips */}
      <View style={styles.sourceChipsRow}>
        {([["all", "Tout"]] as [SourceId | "all", string][]).concat(
          sourceMetas.map((m) => [m.id, m.label] as [SourceId, string])
        ).map(([sid, label]) => {
          const isActive = activeSource === sid;
          const meta = sid === "all" ? undefined : sourceMetas.find((m2) => m2.id === sid);
          const health =
            sid === "all" ? undefined : sourceHealth[sid as SourceId]?.status;
          const healthColor =
            health === "ok"
              ? "#2ecc71"
              : health === "down"
                ? "#ff4757"
                : health === "checking"
                  ? "#f1c40f"
                  : colors.sub;
          return (
            <TouchableOpacity
              key={sid}
              activeOpacity={0.7}
              onPress={() => {
                lightTap();
                setPage(1);
                setActiveSource(sid);
              }}
              style={[
                styles.sourceChip,
                {
                  borderColor: isActive ? colors.accent : colors.tagBg,
                  backgroundColor: isActive ? colors.accent + "26" : "transparent",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer sur la source ${label}${
                health === "down" ? " (indisponible)" : health === "ok" ? " (OK)" : ""
              }`}
            >
              {meta && (
                <View
                  style={[
                    styles.sourceChipDot,
                    { backgroundColor: healthColor || meta.accentColor },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.sourceChipText,
                  { color: isActive ? colors.accent : colors.sub },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bannière de rechargement du flux (changement de source, refresh…) :
          la grille reste visible mais assombrie pendant le fetch. */}
      {isFeedLoading && galleries.length > 0 && !error ? (
        <View
          style={[styles.feedLoadingBanner, { backgroundColor: colors.searchBg }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Chargement ${
            activeSource === "all"
              ? "du flux toutes sources"
              : `de la source ${sourceMetas.find((m) => m.id === activeSource)?.label ?? activeSource}`
          }`}
        >
          <View style={styles.feedLoadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.feedLoadingText, { color: colors.sub }]}>
              {activeSource === "all"
                ? "Actualisation du flux…"
                : `Chargement de ${sourceMetas.find((m) => m.id === activeSource)?.label ?? activeSource}…`}
            </Text>
          </View>
          <View
            style={[styles.feedLoadingTrack, { backgroundColor: colors.tagBg }]}
            onLayout={(e) => setFeedTrackWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.feedLoadingBar,
                {
                  backgroundColor: colors.accent,
                  transform: [{ translateX: feedBarTranslateX }],
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* Échec d'un rechargement avec contenu déjà affiché : notice inline. */}
      {!isFeedLoading && error && galleries.length > 0 ? (
        <View
          style={[styles.feedLoadingBanner, { backgroundColor: "#ff475722" }]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.feedLoadingRow}>
            <IconAlertCircle size={15} color="#ff4757" strokeWidth={2} />
            <Text
              style={[styles.feedLoadingText, { color: "#ff4757" }]}
              numberOfLines={2}
            >
              {activeSource === "all"
                ? "Flux indisponible"
                : `${sourceMetas.find((m) => m.id === activeSource)?.label ?? activeSource} indisponible`}
              {" — "}
              {error}
            </Text>
            <TouchableOpacity onPress={handleRefresh} hitSlop={6}>
              <Text style={[styles.feedLoadingText, { color: colors.accent }]}>
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {resumeEntry ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleResumeRead}
          style={[
            styles.resumeBar,
            { backgroundColor: colors.searchBg, borderColor: colors.tagBg },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Reprendre la lecture de ${
            resumeEntry.gallery.title?.pretty ||
            resumeEntry.gallery.title?.english ||
            `Gallery #${resumeEntry.gallery.id}`
          }`}
        >
          <View style={[styles.resumeCover, { backgroundColor: colors.bg }]}>
            <SmartImage
              uri={
                resumeEntry.gallery.images?.cover?.url ||
                resumeEntry.gallery.images?.thumbnail?.url ||
                ""
              }
              style={styles.resumeCoverImage}
              contentFit="cover"
            />
          </View>
          <View style={styles.resumeInfo}>
            <Text style={[styles.resumeLabel, { color: colors.accent }]}>Reprendre</Text>
            <Text style={styles.resumeTitle} numberOfLines={1} ellipsizeMode="tail">
              {resumeEntry.gallery.title?.pretty ||
                resumeEntry.gallery.title?.english ||
                `Gallery #${resumeEntry.gallery.id}`}
            </Text>
            <Text style={styles.resumePage}>
              Page {resumeEntry.lastPage + 1} / {resumeEntry.totalPages}
            </Text>
          </View>
          <View style={[styles.resumeAction, { backgroundColor: colors.accent + "29" }]}>
            <IconBook2 size={18} color={colors.accent} strokeWidth={2} />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Expandable Search Input & Tag Suggestions */}
      {isSearchOpen && (
        <View style={styles.searchSection}>
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            selectedLanguage={filterOptions.language}
            onLanguageChange={(language) => {
              setFilterOptions((prev) => ({ ...prev, language }));
              setPage(1);
            }}
            sort={filterOptions.sort}
            onSortChange={(sort) => {
              setFilterOptions((prev) => ({ ...prev, sort }));
              setPage(1);
            }}
            showMenu={false}
            showLanguagePills={false}
            showSortButton={false}
            showRandomButton={false}
            onImageSearch={() => setIsImageSearchOpen(true)}
            onClear={() => {
              applySearchQuery("", false);
              setIsSearchOpen(true);
              router.setParams({
                tag: undefined,
                query: undefined,
                type: undefined,
                appendTag: undefined,
              });
            }}
            autoFocus
            placeholder="Rechercher tags, artistes, parodies ou code..."
          />

          {/* Live Tag Autocomplete Dropdown */}
          {tagSuggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
              {tagSuggestions.map((item) => {
                const meta = CATEGORY_META[item.category];
                return (
                  <TouchableOpacity
                    key={`${item.category}-${item.id}`}
                    activeOpacity={0.7}
                    onPress={() => handleSelectSuggestion(item)}
                    style={styles.suggestionItem}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter le tag ${item.name}`}
                  >
                    <View style={styles.suggestionLeft}>
                      <View style={[styles.categoryBadge, { backgroundColor: `${meta?.color || "#60a5fa"}20` }]}>
                        <Text style={[styles.categoryBadgeText, { color: meta?.color || "#60a5fa" }]}>
                          {meta?.label || "Tag"}
                        </Text>
                      </View>
                      <TagLabel name={item.name} variant="list" style={styles.suggestionNameOverride} />
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
              style={[
                styles.quickChip,
                { backgroundColor: colors.page, borderColor: colors.tagBg },
                searchQuery.includes("french") && {
                  backgroundColor: colors.accent + "33",
                  borderColor: colors.accent,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: searchQuery.includes("french") }}
              accessibilityLabel="Filtrer les galeries françaises"
            >
              <IconWorld size={14} color={searchQuery.includes("french") ? "#ffffff" : colors.accent} strokeWidth={2} />
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
              style={[
                styles.quickChip,
                { backgroundColor: colors.page, borderColor: colors.tagBg },
                searchQuery.includes("english") && {
                  backgroundColor: colors.accent + "33",
                  borderColor: colors.accent,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: searchQuery.includes("english") }}
              accessibilityLabel="Filtrer les galeries anglaises"
            >
              <IconWorld size={14} color={searchQuery.includes("english") ? "#ffffff" : colors.accent} strokeWidth={2} />
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
              style={[
                styles.quickChip,
                { backgroundColor: colors.page, borderColor: colors.tagBg },
                filterOptions.sort.includes("popular") && {
                  backgroundColor: colors.accent + "33",
                  borderColor: colors.accent,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: filterOptions.sort.includes("popular") }}
              accessibilityLabel="Trier par popularité"
            >
              <IconFlame size={14} color={filterOptions.sort.includes("popular") ? "#ffffff" : colors.accent} strokeWidth={2} />
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
                    { backgroundColor: colors.page, borderColor: col.color + "60" },
                    isColActive && { backgroundColor: col.color + "30", borderColor: col.color },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isColActive }}
                  accessibilityLabel={`Collection ${col.name}`}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col.color }} />
                  <Text
                    style={[styles.quickChipText, isColActive && { color: "#ffffff", fontWeight: "800" }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {col.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/tags")}
              style={[styles.quickChip, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
              accessibilityRole="button"
              accessibilityLabel="Explorer les tags"
            >
              <IconTags size={14} color={colors.accent} strokeWidth={2} />
              <Text style={styles.quickChipText}>
                Explorer Tags
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Main Grid View — never unmount FlashList once data exists */}
      {isInitialLoading && galleries.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Chargement des mangas...</Text>
        </View>
      ) : error && galleries.length === 0 ? (
        <View style={styles.centerContainer}>
          <IconAlertCircle size={48} color="#ff4757" strokeWidth={1.5} />
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
          <IconInbox size={48} color="#6b7280" strokeWidth={1.5} style={{ opacity: 0.5 }} />
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
          getItemType={() => "gallery_card"}
          drawDistance={500}
          numColumns={numColumns}
          style={{ opacity: isFeedLoading ? 0.35 : 1 }}
          ListHeaderComponent={homeHeader}
          ListFooterComponent={
            isFetchingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            if (
              readerSettings.infiniteScroll &&
              !isInitialLoading &&
              !isFetchingMore &&
              !loadingMoreRef.current &&
              page < totalPages &&
              galleries.length > 0
            ) {
              loadingMoreRef.current = true;
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
              backgroundColor: colors.bg + "F2",
              borderTopColor: colors.tagBg,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
        {/* Prev Page Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handlePageChange(page - 1)}
          disabled={page <= 1 || isInitialLoading}
          style={[
            styles.pageNavBtn,
            { backgroundColor: colors.page },
            page <= 1 && { opacity: 0.3 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Page précédente"
        >
          <IconChevronLeft size={22} color={colors.txt} strokeWidth={2} />
        </TouchableOpacity>

        {/* Page Indicator (Clickable to jump - Android, iOS, Web compatible) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setJumpPageInput(String(page));
            setIsJumpModalOpen(true);
          }}
          style={[
            styles.pageIndicatorBox,
            { backgroundColor: colors.page, borderColor: colors.tagBg },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Aller à la page ${page} sur ${totalPages}`}
        >
          <Text style={[styles.pageText, { color: colors.txt }]}>
            {page} / {totalPages}
          </Text>
        </TouchableOpacity>

        {/* Next Page Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handlePageChange(page + 1)}
          disabled={page >= totalPages || isInitialLoading}
          style={[
            styles.pageNavBtn,
            { backgroundColor: colors.page },
            page >= totalPages && { opacity: 0.3 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Page suivante"
        >
          <IconChevronRight size={22} color={colors.txt} strokeWidth={2} />
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
              { backgroundColor: colors.page, borderColor: colors.tagBg },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.jumpModalTitle, { color: colors.txt }]}>Aller à la page</Text>
            <Text style={[styles.jumpModalSub, { color: colors.sub }]}>
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
                { backgroundColor: colors.bg, borderColor: colors.tagBg, color: colors.txt },
              ]}
            />

            <View style={styles.jumpActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsJumpModalOpen(false)}
                style={[styles.jumpCancelBtn, { backgroundColor: colors.tagBg }]}
                accessibilityRole="button"
                accessibilityLabel="Annuler"
              >
                <Text style={[styles.jumpCancelText, { color: colors.sub }]}>Annuler</Text>
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
                accessibilityRole="button"
                accessibilityLabel="Aller à la page"
              >
                <Text style={styles.jumpSubmitText}>Aller</Text>
                <IconArrowRight size={16} color="#1c191a" strokeWidth={2.5} />
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
  sourceChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  sourceChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sourceChipText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 3,
  },
  feedLoadingBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  feedLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedLoadingText: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  feedLoadingTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  feedLoadingBar: {
    width: "40%",
    height: "100%",
    borderRadius: 2,
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
    backgroundColor: "#ff4757",
  },
  resumeBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  resumeCover: {
    width: 40,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
  },
  resumeCoverImage: {
    width: "100%",
    height: "100%",
  },
  resumeInfo: {
    flex: 1,
    minWidth: 0,
  },
  resumeLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  resumeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  resumePage: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 2,
  },
  resumeAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
    borderTopWidth: 1,
  },
  pageNavBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  pageIndicatorBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
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
  },
  jumpCancelText: {
    fontSize: 13,
    fontWeight: "700",
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
    minWidth: 0,
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
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  suggestionNameOverride: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#f3f4f6",
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
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d1d5db",
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  quickChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
