import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  Alert,
  BackHandler,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { IconCheck, IconTrash, IconX, IconFolderPlus } from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { BookCard } from "@/components/BookCard";
import { Gallery } from "@/lib/api/types";
import {
  listLocalLibrary,
  LocalLibraryEntry,
  deleteLocalGallery,
  formatLibrarySize,
} from "@/lib/localLibrary";
import { removeCompletedByLocalId } from "@/lib/downloadQueueStore";
import { findHistoryEntry, getHistory, initHistory } from "@/lib/historyStore";
import { AnimatedEmptyState } from "@/components/ui/AnimatedEmptyState";
import { mediumImpact } from "@/lib/haptics";
import { CollectionPickerModal } from "@/components/modals/CollectionPickerModal";
import { makeGlobalId } from "@/lib/sources/types";

const SELECTION_BAR_H = 52;

function toOfflineGallery(item: LocalLibraryEntry): Gallery {
  // La couverture d'une galerie téléchargée pointe vers un URL réseau (proxy)
  // qui échouera hors-ligne : on utilise la page 1 locale comme couverture.
  const firstPage = item.gallery.images?.pages?.[0];
  const localCover = firstPage?.url || item.gallery.images?.cover?.url || "";
  return {
    ...item.gallery,
    images: {
      ...item.gallery.images,
      cover: {
        t: firstPage?.t || "j",
        w: firstPage?.w || 0,
        h: firstPage?.h || 0,
        url: localCover,
      },
      thumbnail: {
        t: firstPage?.t || "j",
        w: firstPage?.w || 0,
        h: firstPage?.h || 0,
        url: localCover,
      },
    },
  };
}

export default function DownloadedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [downloadedGalleries, setDownloadedGalleries] = useState<LocalLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [collectionTarget, setCollectionTarget] = useState<LocalLibraryEntry | null>(null);
  const deletingRef = useRef(false);

  const numColumns = width >= 600 ? 3 : 2;
  const cardGap = 10;
  const horizontalPadding = 12;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const totalSizeBytes = useMemo(
    () => downloadedGalleries.reduce((sum, e) => sum + (e.sizeBytes || 0), 0),
    [downloadedGalleries]
  );

  const headerSub = useMemo(() => {
    const n = downloadedGalleries.length;
    const titres = `${n} titre${n > 1 ? "s" : ""}`;
    return `${titres} · ${formatLibrarySize(totalSizeBytes)}`;
  }, [downloadedGalleries.length, totalSizeBytes]);

  const extraData = `${selecting}:${[...selectedIds].join(",")}`;

  const loadDownloaded = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await listLocalLibrary();
      setDownloadedGalleries(list);
    } catch (e) {
      console.warn("Failed to read local library:", e);
      setDownloadedGalleries([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloaded();
  }, [loadDownloaded]);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      exitSelection();
      return true;
    });
    return () => sub.remove();
  }, [selecting, exitSelection]);

  const openLocalReader = useCallback(
    (localId: string) => {
      void initHistory().then(() => {
        const hist =
          findHistoryEntry({ localId }) ||
          getHistory().find((entry) => entry.localId === localId);
        const params: Record<string, string> = { localId };
        if (hist && hist.lastPage > 0) {
          params.initialPage = String(hist.lastPage);
        }
        router.push({
          pathname: "/read",
          params,
        });
      });
    },
    [router]
  );

  const toggleSelect = useCallback((localId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  }, []);

  const enterSelection = useCallback((localId: string) => {
    mediumImpact();
    setSelecting(true);
    setSelectedIds(new Set([localId]));
  }, []);

  const deleteIds = useCallback(
    async (ids: string[]) => {
      if (deletingRef.current || ids.length === 0) return;
      deletingRef.current = true;
      const idSet = new Set(ids);
      setDownloadedGalleries((prev) => prev.filter((e) => !idSet.has(e.localId)));
      exitSelection();
      try {
        const removed: string[] = [];
        for (const id of ids) {
          try {
            await deleteLocalGallery(id);
            removed.push(id);
          } catch (err) {
            console.warn("[downloaded] delete failed:", id, err);
          }
        }
        if (removed.length > 0) removeCompletedByLocalId(removed);
        await loadDownloaded({ silent: true });
      } finally {
        deletingRef.current = false;
      }
    },
    [exitSelection, loadDownloaded]
  );

  const confirmDeleteOne = useCallback(
    (item: LocalLibraryEntry) => {
      Alert.alert(
        "Supprimer ce titre ?",
        `« ${item.title} » sera retiré de l'appareil. Cette action est irréversible.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => {
              void deleteIds([item.localId]);
            },
          },
        ]
      );
    },
    [deleteIds]
  );

  const confirmBulkDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const n = ids.length;
    Alert.alert(
      n === 1 ? "Supprimer ce titre ?" : `Supprimer ${n} titres ?`,
      "Les fichiers locaux seront effacés. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void deleteIds(ids);
          },
        },
      ]
    );
  }, [selectedIds, deleteIds]);

  const renderItem = ({ item }: { item: LocalLibraryEntry }) => {
    const selected = selectedIds.has(item.localId);
    return (
      <View style={{ width: cardWidth }}>
        <TouchableOpacity
          activeOpacity={0.85}
          delayLongPress={400}
          onPress={() => {
            if (selecting) toggleSelect(item.localId);
            else openLocalReader(item.localId);
          }}
          onLongPress={() => {
            if (selecting) toggleSelect(item.localId);
            else enterSelection(item.localId);
          }}
        >
          <View pointerEvents="none">
            <BookCard gallery={toOfflineGallery(item)} cardWidth={cardWidth} />
          </View>
          {selecting ? (
            <View
              pointerEvents="none"
              style={[
                styles.selectOverlay,
                selected && { borderColor: colors.accent, backgroundColor: "rgba(197,135,141,0.18)" },
              ]}
            >
              <View
                style={[
                  styles.checkCircle,
                  selected
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { borderColor: "rgba(255,255,255,0.7)" },
                ]}
              >
                {selected ? <IconCheck size={14} color="#fff" strokeWidth={2.5} /> : null}
              </View>
            </View>
          ) : null}
        </TouchableOpacity>
        {!selecting ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setCollectionTarget(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.folderBtn}
              accessibilityLabel="Ajouter à une collection"
            >
              <IconFolderPlus size={15} color={colors.accent} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => confirmDeleteOne(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.trashBtn}
            >
              <IconTrash size={15} color="#ff4757" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const selectedCount = selectedIds.size;
  const listBottomPad =
    insets.bottom + (selecting ? SELECTION_BAR_H + 20 : 24);

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>
            Bibliothèque Hors-Ligne
          </Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>{headerSub}</Text>
        </View>
        {selecting ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={exitSelection}
            style={[styles.cancelBtn, { backgroundColor: colors.tagBg }]}
          >
            <IconX size={14} color={colors.txt} strokeWidth={2} />
            <Text style={[styles.cancelBtnText, { color: colors.txt }]}>Annuler</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>
            Recherche des mangas locaux...
          </Text>
        </View>
      ) : downloadedGalleries.length === 0 ? (
        <AnimatedEmptyState
          type="downloads"
          actionLabel="Explorer le catalogue"
          onActionPress={() => router.push("/" as any)}
        />
      ) : (
        <FlashList
          data={downloadedGalleries}
          renderItem={renderItem}
          extraData={extraData}
          numColumns={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 12,
            paddingBottom: listBottomPad,
          }}
          keyExtractor={(item) => item.localId}
        />
      )}

      {selecting ? (
        <View
          style={[
            styles.selectionBar,
            {
              backgroundColor: colors.page,
              borderTopColor: colors.tagBg,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <Text style={[styles.selectionCount, { color: colors.txt }]}>
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={selectedCount === 0}
            onPress={confirmBulkDelete}
            style={[
              styles.bulkDeleteBtn,
              { backgroundColor: selectedCount === 0 ? colors.tagBg : "#ff4757" },
            ]}
          >
            <IconTrash size={15} color={selectedCount === 0 ? colors.sub : "#fff"} strokeWidth={2} />
            <Text
              style={[
                styles.bulkDeleteText,
                { color: selectedCount === 0 ? colors.sub : "#fff" },
              ]}
            >
              Supprimer
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <CollectionPickerModal
        visible={collectionTarget !== null}
        onClose={() => setCollectionTarget(null)}
        globalId={
          collectionTarget
            ? collectionTarget.gallery.globalId ||
              makeGlobalId("nhentai", collectionTarget.galleryId)
            : "nhentai:0"
        }
        localId={collectionTarget?.localId}
        title={collectionTarget?.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 14, fontSize: 13.5, fontWeight: "600" },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(9, 9, 14, 0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  folderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(9, 9, 14, 0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: {
    position: "absolute",
    right: 6,
    bottom: 18,
    flexDirection: "row",
    gap: 6,
    zIndex: 2,
  },
  selectOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 10, // BookCard a marginBottom: 10
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  checkCircle: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 9, 14, 0.55)",
  },
  selectionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  selectionCount: { fontSize: 15, fontWeight: "700", flex: 1 },
  bulkDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bulkDeleteText: { fontSize: 14, fontWeight: "800" },
});
