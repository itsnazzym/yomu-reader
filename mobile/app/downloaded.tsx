import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { IconBtn } from "@/components/ui/IconBtn";
import { BookCard } from "@/components/BookCard";
import { Gallery } from "@/lib/api/types";
import { listLocalLibrary, LocalLibraryEntry } from "@/lib/localLibrary";

export default function DownloadedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [downloadedGalleries, setDownloadedGalleries] = useState<LocalLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const numColumns = width >= 600 ? 3 : 2;
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const loadDownloaded = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listLocalLibrary();
      setDownloadedGalleries(list);
    } catch (e) {
      console.warn("Failed to read local library:", e);
      setDownloadedGalleries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloaded();
  }, [loadDownloaded]);

  const openLocalReader = (localId: string) => {
    router.push({
      pathname: "/read",
      params: { localId },
    });
  };

  const renderItem = ({ item }: { item: LocalLibraryEntry }) => {
    // La couverture d'une galerie téléchargée pointe vers un URL réseau (proxy)
    // qui échouera hors-ligne : on utilise la page 1 locale comme couverture.
    const firstPage = item.gallery.images?.pages?.[0];
    const localCover = firstPage?.url || item.gallery.images?.cover?.url || "";
    const offlineGallery: Gallery = {
      ...item.gallery,
      images: {
        ...item.gallery.images,
        cover: { t: firstPage?.t || "j", w: firstPage?.w || 0, h: firstPage?.h || 0, url: localCover },
        thumbnail: { t: firstPage?.t || "j", w: firstPage?.w || 0, h: firstPage?.h || 0, url: localCover },
      },
    };
    return (
      <View style={{ width: cardWidth }}>
        <BookCard
          gallery={offlineGallery}
          cardWidth={cardWidth}
          onPress={() => openLocalReader(item.localId)}
        />
      </View>
    );
  };

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
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <Text style={[styles.headerTitle, { color: colors.txt }]}>
          Bibliothèque Hors-Ligne
        </Text>
        <Text style={[styles.headerSub, { color: colors.sub }]}>
          {downloadedGalleries.length} manga(s) téléchargé(s)
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>
            Recherche des mangas locaux...
          </Text>
        </View>
      ) : downloadedGalleries.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="download" size={48} color={colors.sub} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyTitle, { color: colors.txt }]}>
            Aucun manga téléchargé
          </Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>
            Téléchargez des mangas ou lancez des téléchargements par lot pour les lire hors connexion.
          </Text>
        </View>
      ) : (
        <FlashList
          data={downloadedGalleries}
          renderItem={renderItem}
          estimatedItemSize={240}
          numColumns={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: insets.bottom + 24,
          }}
          keyExtractor={(item) => item.localId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 14, fontSize: 13.5, fontWeight: "600" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
