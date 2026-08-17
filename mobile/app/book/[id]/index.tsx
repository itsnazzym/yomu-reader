import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lightTap } from "@/lib/haptics";
import { format } from "date-fns";
import { useTheme } from "@/lib/ThemeContext";
import { getGallery, getComments } from "@/lib/api/nhentai";
import { Gallery, Tag, Comment } from "@/lib/api/types";
import SmartImage from "@/components/SmartImage";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { useFavorites } from "@/lib/favoritesStore";
import { enqueueGalleries } from "@/lib/downloadQueueStore";
import { BookCard } from "@/components/BookCard";
import { QuickShareModal } from "@/components/modals/QuickShareModal";

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const fav = gallery ? isFavorite(gallery.id) : false;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getGallery(id), getComments(id)])
      .then(([g, c]) => {
        setGallery(g);
        setComments(c);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gallery fetch failed:", err);
        setError(err?.message || "Impossible de charger la galerie.");
        setLoading(false);
      });
  }, [id]);

  const handleShare = () => {
    if (!gallery) return;
    setIsShareOpen(true);
  };

  const handleDownload = () => {
    if (!gallery) return;
    enqueueGalleries([
      {
        id: gallery.id,
        title: gallery.title.pretty || gallery.title.english,
        cover: gallery.images?.cover?.url,
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
      },
    });
  };

  const openTagSearch = (name: string) => {
    lightTap();

    router.push({
      pathname: "/",
      params: { tag: name },
    });
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
    tag: "Balises",
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
        <Feather name="alert-circle" size={48} color="#ff4757" />
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
  const thumbWidth = Math.floor((width - 32 - thumbGap * (thumbCols - 1)) / thumbCols);

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
          <Feather name="arrow-left" size={22} color={colors.txt} />
        </IconBtn>

        <View style={styles.topBarActions}>
          <IconBtn onPress={() => toggleFavorite(gallery)} size={40}>
            <Feather
              name="bookmark"
              size={20}
              color={fav ? colors.accent : colors.txt}
            />
          </IconBtn>
          <IconBtn onPress={handleShare} size={40}>
            <Feather name="share-2" size={20} color={colors.txt} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
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
              {gallery.title.pretty || gallery.title.english}
            </Text>
            {gallery.title.japanese ? (
              <Text style={[styles.titleJap, { color: colors.sub }]} numberOfLines={2}>
                {gallery.title.japanese}
              </Text>
            ) : null}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                <Feather name="file-text" size={13} color={colors.accent} />
                <Text style={[styles.statText, { color: colors.txt }]}>
                  {gallery.num_pages || gallery.images?.pages?.length} pages
                </Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                <Feather name="heart" size={13} color="#ff4757" />
                <Text style={[styles.statText, { color: colors.txt }]}>
                  {gallery.num_favorites || 0}
                </Text>
              </View>
              {gallery.upload_date ? (
                <View style={[styles.statChip, { backgroundColor: colors.tagBg }]}>
                  <Feather name="calendar" size={13} color={colors.sub} />
                  <Text style={[styles.statText, { color: colors.sub }]}>
                    {format(new Date(gallery.upload_date * 1000), "dd/MM/yyyy")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsContainer}>
          <CardPressable
            onPress={() => handleRead(0)}
            radius={14}
            style={[styles.primaryReadBtn, { backgroundColor: colors.accent }]}
          >
            <View style={styles.btnInner}>
              <Feather name="book-open" size={20} color="#fff" />
              <Text style={styles.primaryReadBtnText}>Lire Maintenant</Text>
            </View>
          </CardPressable>

          <CardPressable
            onPress={handleDownload}
            radius={14}
            style={[styles.secondaryBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          >
            <View style={styles.btnInner}>
              <Feather name="download" size={18} color={colors.accent} />
              <Text style={[styles.secondaryBtnText, { color: colors.txt }]}>Télécharger</Text>
            </View>
          </CardPressable>
        </View>

        {/* Tag Categories */}
        <View style={[styles.tagsSection, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.title }]}>
            Informations & Balises
          </Text>

          {Object.entries(tagGroups).map(([type, tags]) => (
            <View key={type} style={styles.tagCategoryRow}>
              <Text style={[styles.tagCategoryName, { color: colors.sub }]}>
                {tagCategoryLabels[type] || type}
              </Text>
              <View style={styles.tagChipsWrap}>
                {tags.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => openTagSearch(t.name)}
                    style={[styles.tagChip, { backgroundColor: colors.tagBg }]}
                  >
                    <Text style={[styles.tagChipText, { color: colors.tagText }]}>
                      {t.name}
                    </Text>
                    <Text style={[styles.tagChipCount, { color: colors.sub }]}>
                      {t.count > 999 ? `${(t.count / 1000).toFixed(0)}k` : t.count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Comments Preview */}
        {comments.length > 0 ? (
          <View style={[styles.commentsSection, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.title }]}>
                Commentaires ({comments.length})
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/book/[id]/comments",
                    params: { id: String(gallery.id) },
                  })
                }
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
                onPress={() => handleRead(idx)}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    aspectRatio: 0.72,
    borderRadius: 12,
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },
  heroMeta: { flex: 1, justifyContent: "space-between" },
  titlePretty: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  titleJap: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statText: { fontSize: 11, fontWeight: "700" },
  actionsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  primaryReadBtn: { flex: 1, paddingVertical: 13, borderRadius: 14 },
  secondaryBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryReadBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryBtnText: { fontWeight: "700", fontSize: 14 },
  tagsSection: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  tagCategoryRow: { marginBottom: 12 },
  tagCategoryName: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  tagChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  tagChipText: { fontSize: 12, fontWeight: "600" },
  tagChipCount: { fontSize: 10, fontWeight: "700" },
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
});
