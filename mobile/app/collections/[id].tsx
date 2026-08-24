import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { IconArrowLeft, IconSparkles } from "@tabler/icons-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { IconBtn } from "@/components/ui/IconBtn";
import { BookCard } from "@/components/BookCard";
import { AnimatedEmptyState } from "@/components/ui/AnimatedEmptyState";
import type { Gallery } from "@/lib/api/types";
import { useFavorites } from "@/lib/favoritesStore";
import {
  getLibraryCollectionsSnapshot,
  initLibraryCollections,
  resolveCollectionMembers,
  useLibraryCollections,
  type LibraryCollection,
} from "@/lib/libraryCollectionsStore";
import {
  listLocalLibrary,
  type LocalLibraryEntry,
} from "@/lib/localLibrary";
import { makeGlobalId } from "@/lib/sources/types";

function galleryGlobalId(gallery: Gallery, fallbackId?: number): string {
  if (gallery.globalId) return gallery.globalId;
  const scanlator = gallery.scanlator;
  if (
    scanlator === "3hentai" ||
    scanlator === "doujins" ||
    scanlator === "hitomi"
  ) {
    return makeGlobalId(scanlator, gallery.id);
  }
  return makeGlobalId("nhentai", fallbackId ?? gallery.id);
}

function membersToGalleries(
  memberIds: string[],
  favorites: Gallery[],
  localEntries: LocalLibraryEntry[]
): Gallery[] {
  const byId = new Map<string, Gallery>();
  try {
    for (const g of favorites) {
      byId.set(galleryGlobalId(g), g);
    }
    for (const entry of localEntries) {
      const gid = galleryGlobalId(entry.gallery, entry.galleryId);
      if (!byId.has(gid)) {
        byId.set(gid, entry.gallery);
      }
    }
  } catch (err) {
    console.warn("[collections] member map failed:", err);
  }
  const out: Gallery[] = [];
  for (const id of memberIds) {
    const g = byId.get(id);
    if (g) out.push(g);
  }
  return out;
}

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { favorites } = useFavorites();
  const { collections } = useLibraryCollections();
  const [localEntries, setLocalEntries] = useState<LocalLibraryEntry[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  const collection: LibraryCollection | undefined = useMemo(() => {
    const fromHook = collections.find((c) => c.id === id);
    if (fromHook) return fromHook;
    return getLibraryCollectionsSnapshot().find((c) => c.id === id);
  }, [collections, id]);

  useEffect(() => {
    void initLibraryCollections();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingLocal(true);
    void listLocalLibrary()
      .then((list) => {
        if (!cancelled) setLocalEntries(list);
      })
      .catch((err: unknown) => {
        console.warn("[collections] local library load failed:", err);
        if (!cancelled) setLocalEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLocal(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const memberIds = useMemo(() => {
    if (!collection) return [] as string[];
    return resolveCollectionMembers(collection, favorites, localEntries);
  }, [collection, favorites, localEntries]);

  const galleries = useMemo(
    () => membersToGalleries(memberIds, favorites, localEntries),
    [memberIds, favorites, localEntries]
  );

  const numColumns = width >= 600 ? 3 : 2;
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const renderItem = useCallback(
    ({ item }: { item: Gallery }) => (
      <View style={{ width: cardWidth }}>
        <BookCard gallery={item} cardWidth={cardWidth} />
      </View>
    ),
    [cardWidth]
  );

  if (!collection) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bg,
            paddingTop: Math.max(insets.top, 12),
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text style={{ color: colors.sub, marginBottom: 12 }}>Étagère introuvable</Text>
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} strokeWidth={2} />
        </IconBtn>
      </View>
    );
  }

  const isSmart = collection.mode === "smart";
  const ruleSummary = isSmart && collection.rule
    ? `Inclut ${collection.rule.include.map((t) => `${t.type}:${t.name}`).join(", ")}` +
      (collection.rule.exclude?.length
        ? ` · exclut ${collection.rule.exclude.map((t) => `${t.type}:${t.name}`).join(", ")}`
        : "")
    : null;

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
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} strokeWidth={2} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: collection.color }]} />
            <Text style={[styles.headerTitle, { color: colors.txt }]} numberOfLines={1}>
              {collection.name}
            </Text>
            {isSmart ? (
              <IconSparkles size={16} color={colors.accent} strokeWidth={2} />
            ) : null}
          </View>
          <Text style={[styles.headerSub, { color: colors.sub }]} numberOfLines={2}>
            {loadingLocal
              ? "Chargement…"
              : `${galleries.length} titre(s) · favoris + téléchargés`}
            {ruleSummary ? `\n${ruleSummary}` : ""}
          </Text>
        </View>
      </View>

      {loadingLocal ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : galleries.length === 0 ? (
        <AnimatedEmptyState
          type="downloads"
          title="Aucun membre"
          description={
            isSmart
              ? "Aucun favori ni téléchargement ne correspond aux règles tags."
              : "Ajoute des titres via la fiche livre → Collections."
          }
        />
      ) : (
        <FlashList
          data={galleries}
          renderItem={renderItem}
          numColumns={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: insets.bottom + 24,
          }}
          keyExtractor={(item) =>
            item.globalId || makeGlobalId("nhentai", item.id)
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 18, fontWeight: "800", flexShrink: 1 },
  headerSub: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
