import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  Modal,
} from "react-native";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBookmark,
  IconShare,
  IconFileText,
  IconHeart,
  IconCalendar,
  IconBook2,
  IconDownload,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPlay,
  IconPlus,
  IconMinus,
  IconFolderPlus,
} from "@tabler/icons-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lightTap } from "@/lib/haptics";
import { format } from "date-fns";
import { useTheme } from "@/lib/ThemeContext";
import { getGallery, getComments, getRelatedGalleryCards, RelatedCard } from "@/lib/api/nhentai";
import { Gallery, Tag, Comment } from "@/lib/api/types";
import SmartImage from "@/components/SmartImage";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { useFavorites } from "@/lib/favoritesStore";
import { useHistory, findHistoryEntry } from "@/lib/historyStore";
import { useTagFavs } from "@/lib/tagFavoritesStore";
import { enqueueGalleries } from "@/lib/downloadQueueStore";
import { RelatedRow } from "@/components/RelatedRow";
import { QuickShareModal } from "@/components/modals/QuickShareModal";
import { SignInModal } from "@/components/modals/SignInModal";
import { AuthRequiredModal } from "@/components/modals/AuthRequiredModal";
import { useAccount } from "@/lib/accountStore";
import { addFavorite, isFavorited, removeFavorite } from "@/lib/api/v2/galleries";
import { useHomeSearch } from "@/lib/homeSearchStore";
import { queryContainsTerm } from "@/lib/searchQuery";
import { getSource } from "@/lib/sources/registry";
import { sourceGalleryToGallery } from "@/lib/sources/galleryMapper";
import type { SourceId } from "@/lib/sources/types";
import { makeGlobalId } from "@/lib/sources/types";
import { CollectionPickerModal } from "@/components/modals/CollectionPickerModal";
import {
  findDuplicateGroups,
  galleryToDuplicateCandidate,
  otherSourcesInGroup,
} from "@/lib/duplicateMatch";

export default function BookDetailScreen() {
  const { id, src, title: titleParam, localId: localIdParam } = useLocalSearchParams<{
    id: string;
    src?: string;
    title?: string;
    localId?: string;
  }>();
  const sourceId = (src as SourceId) || "nhentai";
  const isNhentai = sourceId === "nhentai";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite, favorites } = useFavorites();
  const { history } = useHistory();
  const { isFav: isTagFav, toggleFav: toggleTagFav } = useTagFavs();
  const { isLoggedIn } = useAccount();
  const { query: homeQuery, toggleTerm, replaceTerm } = useHomeSearch();
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const appendLockRef = useRef(false);

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [related, setRelated] = useState<RelatedCard[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState<"login" | "register">("login");
  const [accountFav, setAccountFav] = useState(false);
  const [accountFavLoading, setAccountFavLoading] = useState(false);
  const [appendNotice, setAppendNotice] = useState<string | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);

  // Fermeture animée avant navigation (même pattern que le panneau des
  // recommandations) : fondu de l'écran, puis navigation au callback de fin.
  const fadeOut = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Si l'écran est démonté pendant l'animation (back), on stoppe le fondu :
  // le callback de fin reçoit finished=false et la navigation n'est pas lancée.
  useEffect(() => {
    return () => {
      fadeOut.stopAnimation();
    };
  }, [fadeOut]);

  const fav = gallery ? isFavorite(gallery.id) : false;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setRelated([]);
    setRelatedLoading(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    if (isNhentai) {
      // Flux nhentai existant : API + commentaires + suggestions.
      Promise.all([
        getGallery(id),
        getComments(id).catch(() => []),
      ])
        .then(([g, c]) => {
          setGallery(g);
          setComments(c);
        })
        .catch((err) => {
          setError(err?.message || "Impossible de charger la galerie");
        })
        .finally(() => {
          setLoading(false);
        });

      getRelatedGalleryCards(id)
        .then((cards) => {
          setRelated(cards);
        })
        .catch(() => {
          setRelated([]);
        })
        .finally(() => {
          setRelatedLoading(false);
        });
    } else {
      // Sources alternatives : adaptateur dédié, pas de commentaires ni
      // de suggestions (non supportés par ces sites).
      const knownTitle = typeof titleParam === "string" ? titleParam : undefined;
      getSource(sourceId)
        .getGallery(id, knownTitle)
        .then((sg) => {
          // Map vers Gallery (mapper partagé) pour réutiliser toute l'UI.
          setGallery({ ...sourceGalleryToGallery(sg, sourceId), origin: "local" });
        })
        .catch((err) => {
          setError(err?.message || "Impossible de charger la galerie");
        })
        .finally(() => {
          setLoading(false);
          setRelatedLoading(false);
        });
    }
  }, [id, sourceId, titleParam]);

  const handleShare = async () => {
    if (!gallery) return;
    setIsShareOpen(true);
  };

  const handleDownload = () => {
    if (!gallery) return;
    const bookTitle =
      gallery.title?.pretty ||
      gallery.title?.english ||
      gallery.title?.japanese ||
      (typeof gallery.title === "string" ? gallery.title : `Gallery #${gallery.id}`);
    enqueueGalleries([
      {
        id: gallery.id,
        title: bookTitle,
        cover: gallery.images?.cover?.url,
        src: sourceId !== "nhentai" ? sourceId : undefined,
      },
    ]);
    router.push("/batch");
  };

  const handleRead = (initialPage = 0) => {
    if (!gallery) return;
    router.push({
      pathname: "/read",
      params: {
        id: String(gallery.id),
        initialPage: String(initialPage),
        ...(sourceId !== "nhentai" ? { src: sourceId } : {}),
      },
    });
  };

  const pulse = (anim: Animated.Value): void => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.18, duration: 90, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();
  };

  useEffect(() => {
    let cancelled = false;
    if (!gallery || !isLoggedIn) {
      setAccountFav(false);
      return;
    }
    setAccountFavLoading(true);
    isFavorited(gallery.id)
      .then((res) => {
        if (!cancelled) setAccountFav(Boolean(res?.is_favorited));
      })
      .catch(() => {
        if (!cancelled) setAccountFav(false);
      })
      .finally(() => {
        if (!cancelled) setAccountFavLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gallery, isLoggedIn]);

  const handleBookmark = (): void => {
    if (!gallery) return;
    lightTap();
    pulse(bookmarkScale);
    void toggleFavorite(gallery);
  };

  const handleAccountHeart = async (): Promise<void> => {
    if (!gallery || accountFavLoading) return;
    if (!isLoggedIn) {
      setAuthPromptOpen(true);
      return;
    }
    const next = !accountFav;
    setAccountFav(next);
    setAccountFavLoading(true);
    lightTap();
    pulse(heartScale);
    try {
      if (next) {
        await addFavorite(gallery.id);
      } else {
        await removeFavorite(gallery.id);
      }
    } catch {
      setAccountFav(!next);
    } finally {
      setAccountFavLoading(false);
    }
  };

  const openTagSearch = (name: string, type = "tag") => {
    lightTap();
    replaceTerm(type, name);
    router.push({
      pathname: "/",
      params: { tag: name, type },
    });
  };

  const toggleTagSearch = (name: string, type = "tag") => {
    if (appendLockRef.current) return;
    appendLockRef.current = true;
    lightTap();
    const result = toggleTerm(type, name);
    setAppendNotice(result.added ? `Ajouté · ${result.term}` : `Retiré · ${result.term}`);
    setTimeout(() => {
      appendLockRef.current = false;
      setAppendNotice(null);
    }, 1400);
  };

  const groupTagsByType = (tags: Tag[] = []) => {
    const groups: Record<string, Tag[]> = {};
    for (const t of tags) {
      if (!groups[t.type]) groups[t.type] = [];
      groups[t.type].push(t);
    }
    return groups;
  };

  const tagGroups = gallery ? groupTagsByType(gallery.tags) : {};

  const tagCategoryLabels: Record<string, string> = {
    parody: "Séries / Parodies",
    character: "Personnages",
    tag: "Tags",
    artist: "Artistes",
    group: "Groupes",
    language: "Langues",
    category: "Catégories",
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.sub }]}>
          Chargement de la galerie #{id}...
        </Text>
      </View>
    );
  }

  if (error || !gallery) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <IconAlertCircle size={48} color="#ff4757" strokeWidth={1.5} />
        <Text style={[styles.errorTitle, { color: colors.txt }]}>Erreur</Text>
        <Text style={[styles.errorSub, { color: colors.sub }]}>
          {error || "Galerie introuvable"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const thumbCols = 3;
  const thumbGap = 8;
  const bookGlobalId =
    gallery.globalId || makeGlobalId(sourceId, gallery.id || id || 0);
  const duplicateSources = (() => {
    try {
      const candidates = [
        galleryToDuplicateCandidate(gallery),
        ...favorites.map(galleryToDuplicateCandidate),
      ];
      const groups = findDuplicateGroups(candidates);
      return otherSourcesInGroup(bookGlobalId, groups);
    } catch {
      return [] as string[];
    }
  })();

  const thumbWidth = Math.floor((width - 32 - thumbGap * (thumbCols - 1)) / thumbCols);

  const mainTitle =
    gallery.title?.pretty ||
    gallery.title?.english ||
    gallery.title?.japanese ||
    (typeof gallery.title === "string" ? gallery.title : `Gallery #${gallery.id}`);

  const historyEntry =
    findHistoryEntry({
      id: gallery.id,
      source: sourceId,
      localId: typeof localIdParam === "string" && localIdParam ? localIdParam : undefined,
    }) ||
    // Fallback: ancienne entrée sans source (nhentai uniquement).
    (sourceId === "nhentai"
      ? history.find((entry) => Number(entry.gallery?.id) === Number(gallery.id) && !entry.source)
      : undefined);
  const historyTotal =
    historyEntry?.totalPages ||
    gallery.num_pages ||
    gallery.images?.pages?.length ||
    0;
  const inProgress =
    !!historyEntry && historyTotal > 0 && historyEntry.lastPage < historyTotal - 1;
  const finished =
    !!historyEntry && historyTotal > 0 && historyEntry.lastPage >= historyTotal - 1;
  const readLabel = inProgress
    ? `Continuer p. ${historyEntry.lastPage + 1}`
    : finished
      ? "Relire"
      : "Lire Maintenant";
  const readInitialPage = inProgress ? historyEntry.lastPage : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Floating App Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: colors.bg + "E6",
          },
        ]}
      >
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} strokeWidth={2} />
        </IconBtn>

        <View style={styles.topBarActions}>
          <IconBtn
            onPress={() => void handleAccountHeart()}
            size={40}
            accessibilityLabel={accountFav ? "Retirer des favoris nHentai" : "Ajouter aux favoris nHentai"}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <IconHeart
                size={20}
                color={accountFav ? "#f43f5e" : colors.txt}
                fill={accountFav ? "#f43f5e" : "transparent"}
                strokeWidth={accountFav ? 2.4 : 1.8}
              />
            </Animated.View>
          </IconBtn>
          <IconBtn
            onPress={handleBookmark}
            size={40}
            accessibilityLabel={fav ? "Retirer le signet local" : "Ajouter un signet local"}
          >
            <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
              <IconBookmark
                size={20}
                color={fav ? colors.accent : colors.txt}
                fill={fav ? colors.accent : "transparent"}
                strokeWidth={fav ? 2.5 : 1.8}
              />
            </Animated.View>
          </IconBtn>
          <IconBtn onPress={handleShare} size={40}>
            <IconShare size={20} color={colors.txt} strokeWidth={2} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.coverWrapper}>
            <SmartImage
              uri={gallery.images?.cover?.url || ""}
              style={styles.coverImage}
              contentFit="cover"
            />
          </View>

          <View style={styles.heroMeta}>
            <Text style={[styles.titlePretty, { color: colors.txt }]}>
              {mainTitle}
            </Text>
            {gallery.title?.japanese ? (
              <Text style={[styles.titleJap, { color: colors.sub }]} numberOfLines={2}>
                {gallery.title.japanese}
              </Text>
            ) : null}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                <IconFileText size={13} color={colors.accent} strokeWidth={2} />
                <Text style={[styles.statText, { color: colors.txt }]}>
                  {gallery.num_pages || gallery.images?.pages?.length || 0} pages
                </Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                <IconHeart size={13} color="#ff4757" strokeWidth={2} />
                <Text style={[styles.statText, { color: colors.txt }]}>
                  {gallery.num_favorites || 0}
                </Text>
              </View>
              {gallery.upload_date ? (
                <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                  <IconCalendar size={13} color={colors.sub} strokeWidth={2} />
                  <Text style={[styles.statText, { color: colors.sub }]}>
                    {format(new Date(Number(gallery.upload_date) * 1000), "dd/MM/yyyy")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsContainer}>
          <CardPressable
            onPress={() => handleRead(readInitialPage)}
            radius={14}
            style={[styles.primaryReadBtn, { backgroundColor: colors.accent }]}
          >
            <View style={styles.btnInner}>
              <IconBook2 size={18} color="#fff" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <Text
                style={styles.primaryReadBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {readLabel}
              </Text>
            </View>
          </CardPressable>

          <View style={styles.secondaryActionsRow}>
            <CardPressable
              onPress={handleDownload}
              radius={14}
              style={[styles.secondaryBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
            >
              <View style={styles.btnInner}>
                <IconDownload size={16} color={colors.accent} strokeWidth={2} style={{ flexShrink: 0 }} />
                <Text style={[styles.secondaryBtnText, { color: colors.txt }]} numberOfLines={1}>
                  Télécharger
                </Text>
              </View>
            </CardPressable>

            <CardPressable
              onPress={() => {
                lightTap();
                setCollectionOpen(true);
              }}
              radius={14}
              style={[styles.secondaryBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
              accessibilityLabel="Ajouter à une collection"
            >
              <View style={styles.btnInner}>
                <IconFolderPlus size={16} color={colors.accent} strokeWidth={2} style={{ flexShrink: 0 }} />
                <Text style={[styles.secondaryBtnText, { color: colors.txt }]} numberOfLines={1}>
                  Collection
                </Text>
              </View>
            </CardPressable>
          </View>
        </View>

        {duplicateSources.length > 0 ? (
          <View
            style={[
              styles.dupeBadge,
              { backgroundColor: colors.accent + "22", borderColor: colors.accent },
            ]}
          >
            <Text style={[styles.dupeBadgeText, { color: colors.accent }]}>
              Aussi sur {duplicateSources.join(", ")}
            </Text>
          </View>
        ) : null}

        {/* Tag Categories */}
        <View style={[styles.tagsSection, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.title }]}>
            Informations & Tags
          </Text>

          {Object.entries(tagGroups).map(([type, tags]) => (
            <View key={type} style={styles.tagCategoryRow}>
              <Text style={[styles.tagCategoryName, { color: colors.sub }]}>
                {tagCategoryLabels[type] || type}
              </Text>
              <View style={styles.tagChipsWrap}>
                {tags.map((t) => {
                  const isTagFavorited = isTagFav(t.type, t.name);
                  const inSearch = queryContainsTerm(homeQuery, t.type, t.name);
                  return (
                    <View
                      key={t.id}
                      style={[
                        styles.tagChipContainer,
                        {
                          backgroundColor: inSearch ? colors.accent + "22" : colors.tagBg,
                          borderColor: inSearch
                            ? colors.accent
                            : isTagFavorited
                              ? colors.accent
                              : "rgba(255,255,255,0.06)",
                        },
                      ]}
                    >
                      {/* Clic direct pour chercher ce tag */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => openTagSearch(t.name, t.type)}
                        style={styles.tagChipMainPress}
                      >
                        <Text style={[styles.tagChipText, { color: colors.tagText }]}>
                          {t.name}
                        </Text>
                        {typeof t.count === "number" && t.count > 0 ? (
                          <Text style={[styles.tagChipCount, { color: colors.sub }]}>
                            {t.count > 999 ? `${(t.count / 1000).toFixed(0)}k` : t.count}
                          </Text>
                        ) : null}
                      </TouchableOpacity>

                      {/* Bouton +/- pour ajouter/retirer de la recherche sans quitter la page */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        hitSlop={6}
                        onPress={() => toggleTagSearch(t.name, t.type)}
                        style={[
                          styles.tagChipActionBtn,
                          {
                            borderLeftColor: "rgba(255,255,255,0.1)",
                            backgroundColor: inSearch ? colors.accent + "33" : "transparent",
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: inSearch }}
                        accessibilityLabel={
                          inSearch
                            ? `Retirer ${t.name} de la recherche`
                            : `Ajouter ${t.name} à la recherche`
                        }
                      >
                        {inSearch ? (
                          <IconMinus size={13} color={colors.accent} strokeWidth={2.5} />
                        ) : (
                          <IconPlus size={13} color={colors.accent} strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>

                      {/* Bouton cœur pour mettre en favoris */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        hitSlop={6}
                        onPress={() => {
                          lightTap();
                          toggleTagFav({ type: t.type, name: t.name, count: t.count });
                        }}
                        style={styles.tagChipActionBtn}
                      >
                        <IconHeart
                          size={13}
                          color={isTagFavorited ? "#f43f5e" : colors.sub}
                          fill={isTagFavorited ? "#f43f5e" : "transparent"}
                          strokeWidth={1.8}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <RelatedRow
          items={related}
          loading={relatedLoading}
          excludeId={gallery.id}
        />

        {/* Comments Preview */}
        {comments.length > 0 ? (
          <View style={[styles.commentsSection, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.title }]}>
                Commentaires ({comments.length})
              </Text>
              <Pressable
                onPress={() => {
                  lightTap();
                  router.push({
                    pathname: "/book/[id]/comments",
                    params: { id: String(gallery.id) },
                  });
                }}
              >
                <Text style={[styles.seeAllText, { color: colors.accent }]}>
                  Voir tout
                </Text>
              </Pressable>
            </View>

            {comments.slice(0, 3).map((c) => (
              <View key={c.id} style={[styles.commentCard, { backgroundColor: colors.bg }]}>
                <View style={styles.commentPosterRow}>
                  <Text style={[styles.commentUsername, { color: colors.accent }]}>
                    {c.poster?.username || "Anonyme"}
                  </Text>
                  <Text style={[styles.commentDate, { color: colors.sub }]}>
                    {c.post_date ? format(new Date(c.post_date * 1000), "dd/MM/yyyy") : ""}
                  </Text>
                </View>
                <Text style={[styles.commentBody, { color: colors.txt }]}>
                  {c.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Thumbnails Grid Preview */}
        <View style={styles.thumbnailsSection}>
          <Text style={[styles.sectionTitle, { color: colors.title, paddingHorizontal: 16 }]}>
            Aperçu des Pages ({gallery.images?.pages?.length || 0})
          </Text>

          <View style={styles.thumbsGrid}>
            {(gallery.images?.pages || []).map((p, idx) => (
              <Pressable
                key={idx}
                onPress={() => setPreviewIndex(idx)}
                style={[
                  styles.thumbCard,
                  {
                    width: thumbWidth,
                    backgroundColor: colors.page,
                    borderColor: colors.tagBg,
                  },
                ]}
              >
                <SmartImage
                  uri={p.urlThumb || p.url || ""}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
                <View style={styles.thumbPageBadge}>
                  <Text style={styles.thumbPageText}>{idx + 1}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Quick Page Preview Modal */}
      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreviewIndex(null)}
        >
          {previewIndex !== null && gallery && (
            <Pressable
              style={[styles.previewCard, { backgroundColor: "#12121a", borderColor: "#28283a" }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <View style={styles.previewHeader}>
                <Text style={styles.previewHeaderText}>
                  Page {previewIndex + 1} sur {gallery.images?.pages?.length || gallery.num_pages || 0}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setPreviewIndex(null)}
                  style={styles.previewCloseBtn}
                >
                  <IconX size={18} color="#9ca3af" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* High-res Image Preview */}
              <View style={styles.previewImageContainer}>
                <SmartImage
                  uri={
                    gallery.images?.pages?.[previewIndex]?.url ||
                    gallery.images?.pages?.[previewIndex]?.urlThumb ||
                    ""
                  }
                  style={styles.previewImage}
                  contentFit="contain"
                />

                {/* Left/Right Quick Page Navigation */}
                {previewIndex > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setPreviewIndex((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
                    style={[styles.previewNavBtn, styles.previewNavLeft]}
                  >
                    <IconChevronLeft size={22} color="#fff" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {previewIndex < (gallery.images?.pages?.length || gallery.num_pages || 1) - 1 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      setPreviewIndex((prev) =>
                        prev !== null
                          ? Math.min((gallery.images?.pages?.length || gallery.num_pages || 1) - 1, prev + 1)
                          : 0
                      )
                    }
                    style={[styles.previewNavBtn, styles.previewNavRight]}
                  >
                    <IconChevronRight size={22} color="#fff" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Button: Start Reading from this page */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const idx = previewIndex;
                  setPreviewIndex(null);
                  handleRead(idx);
                }}
                style={[styles.previewReadBtn, { backgroundColor: colors.accent }]}
              >
                <IconPlayerPlay size={18} color="#1c191a" fill="#1c191a" />
                <Text style={styles.previewReadText}>Lire à partir de cette page</Text>
              </TouchableOpacity>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {appendNotice ? (
        <View
          pointerEvents="none"
          style={[
            styles.appendNotice,
            { top: Math.max(insets.top, 12) + 52, backgroundColor: colors.accent + "F2" },
          ]}
        >
          <Text style={styles.appendNoticeText}>{appendNotice}</Text>
        </View>
      ) : null}

      <AuthRequiredModal
        visible={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        onSignIn={() => {
          setAuthPromptOpen(false);
          setSignInMode("login");
          setSignInOpen(true);
        }}
        onRegister={() => {
          setAuthPromptOpen(false);
          setSignInMode("register");
          setSignInOpen(true);
        }}
      />
      <SignInModal
        visible={signInOpen}
        initialMode={signInMode}
        onClose={() => setSignInOpen(false)}
        onSuccess={() => setSignInOpen(false)}
      />

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
            : null
        }
      />

      <CollectionPickerModal
        visible={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        globalId={bookGlobalId}
        title={mainTitle}
      />

      {/* Voile de fermeture : fondu de l'écran avant la navigation par tag */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.navFadeOverlay, { opacity: fadeOut }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appendNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 30,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  appendNoticeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 14, fontSize: 14, fontWeight: "600" },
  errorTitle: { fontSize: 18, fontWeight: "700", marginTop: 14 },
  errorSub: { fontSize: 13, marginTop: 4, textAlign: "center" },
  backBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  backBtnText: { color: "#fff", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBarActions: { flexDirection: "row", gap: 4 },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    gap: 16,
  },
  coverWrapper: {
    width: 130,
    aspectRatio: 0.707, // B6 Tankobon ratio
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0d0d14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  coverImage: { width: "100%", height: "100%" },
  heroMeta: { flex: 1, justifyContent: "space-between" },
  titlePretty: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
    color: "#f3f4f6",
    flexShrink: 0,
    paddingRight: 4,
  },
  titleJap: { fontSize: 11, marginTop: 4, lineHeight: 15, color: "#9ca3af" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#232332",
    backgroundColor: "#161622",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
    paddingRight: 2,
    includeFontPadding: false,
  },
  actionsContainer: {
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  primaryReadBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
  },
  primaryReadBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    flexShrink: 0,
    paddingRight: 6,
    includeFontPadding: false,
  },
  secondaryBtnText: {
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 0,
    paddingRight: 4,
    includeFontPadding: false,
  },
  dupeBadge: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dupeBadgeText: { fontSize: 12, fontWeight: "700" },
  tagsSection: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    flexShrink: 0,
    paddingRight: 4,
  },
  tagCategoryRow: { marginBottom: 12 },
  tagCategoryName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    flexShrink: 0,
    paddingRight: 4,
  },
  tagChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChipContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "visible",
    flexShrink: 0,
    maxWidth: "100%",
  },
  tagChipMainPress: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    flexShrink: 0,
  },
  tagChipActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 0,
    paddingRight: 4,
    includeFontPadding: false,
  },
  tagChipCount: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
    paddingRight: 2,
    includeFontPadding: false,
  },
  commentsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  commentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAllText: { fontSize: 13, fontWeight: "700" },
  commentCard: { padding: 12, borderRadius: 10, marginBottom: 8 },
  commentPosterRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  commentUsername: { fontSize: 12.5, fontWeight: "700" },
  commentDate: { fontSize: 11 },
  commentBody: { fontSize: 13, lineHeight: 18 },
  thumbnailsSection: { marginTop: 24 },
  thumbsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  thumbCard: { aspectRatio: 0.72, borderRadius: 10, overflow: "hidden", borderWidth: 1, position: "relative" },
  thumbImage: { width: "100%", height: "100%" },
  thumbPageBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  thumbPageText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  navFadeOverlay: { backgroundColor: "#000" },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewCard: {
    width: "100%",
    maxWidth: 380,
    height: "82%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  previewHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f1f2e",
  },
  previewImageContainer: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewNavBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewNavLeft: { left: 8 },
  previewNavRight: { right: 8 },
  previewReadBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  previewReadText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1c191a",
  },
});
