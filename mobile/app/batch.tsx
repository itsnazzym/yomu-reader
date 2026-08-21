import React, { useState, useSyncExternalStore, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  IconPhoto,
  IconAlertTriangle,
  IconCircleCheck,
  IconPlayerPause,
  IconPlayerPlay,
  IconBook2,
  IconTrash,
  IconArrowLeft,
  IconPlus,
  IconCloudDownload,
  IconX,
  IconDownload,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { IconBtn } from "@/components/ui/IconBtn";
import SmartImage from "@/components/SmartImage";
import {
  subscribeDownloadQueue,
  getDownloadQueueSnapshot,
  enqueueGalleries,
  pauseQueueItem,
  resumeQueueItem,
  removeQueueItem,
  clearCompletedQueue,
  pauseAllQueue,
  resumeAllQueue,
  requeueItem,
  QueueItem,
} from "@/lib/downloadQueueStore";
import { searchGalleries, getGallery } from "@/lib/api/nhentai";
import {
  resolveLocalByGalleryId,
  verifyLocalGallery,
} from "@/lib/localLibrary";

export default function BatchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const queueState = useSyncExternalStore(
    subscribeDownloadQueue,
    getDownloadQueueSnapshot,
    getDownloadQueueSnapshot
  );

  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addMode, setAddMode] = useState<"query" | "ids">("query");

  // Query mode states
  const [queryInput, setQueryInput] = useState("");
  const [queryPages, setQueryPages] = useState("1");
  const [queryLanguage, setQueryLanguage] = useState<"all" | "english" | "japanese" | "chinese">("all");

  // IDs mode states
  const [idsInput, setIdsInput] = useState("");

  const [isFetchingBatch, setIsFetchingBatch] = useState(false);
  const [fetchStatusText, setFetchStatusText] = useState("");

  // Intégrité locale : résultat de vérification par id d'item (undefined = pas
  // encore vérifié, "checking" = en cours, sinon { ok, found, expected }).
  const [verifyResults, setVerifyResults] = useState<Record<number, undefined | "checking" | { ok: boolean; found: number; expected: number }>>({});

  const filteredItems = useMemo(() => {
    if (activeTab === "active") {
      return queueState.items.filter(
        (i) => i.status === "downloading" || i.status === "queued" || i.status === "paused"
      );
    }
    if (activeTab === "completed") {
      return queueState.items.filter((i) => i.status === "completed");
    }
    return queueState.items;
  }, [queueState.items, activeTab]);

  const stats = useMemo(() => {
    let queued = 0;
    let downloading = 0;
    let completed = 0;
    let error = 0;
    for (const it of queueState.items) {
      if (it.status === "queued") queued++;
      else if (it.status === "downloading") downloading++;
      else if (it.status === "completed") completed++;
      else if (it.status === "error") error++;
    }
    return { queued, downloading, completed, error, total: queueState.items.length };
  }, [queueState.items]);

  const handleStartBatchFromQuery = async () => {
    const q = queryInput.trim();
    if (!q) {
      if (Platform.OS === "android") ToastAndroid.show("Veuillez saisir un mot-clé ou tag", ToastAndroid.SHORT);
      return;
    }
    setIsFetchingBatch(true);
    setFetchStatusText("Recherche des galeries...");
    try {
      let fullQuery = q;
      if (queryLanguage !== "all") {
        fullQuery += ` language:${queryLanguage}`;
      }
      const maxPagesToFetch = Math.max(1, Math.min(5, parseInt(queryPages, 10) || 1));
      const foundGalleries: { id: number; title: string; cover?: string }[] = [];

      for (let p = 1; p <= maxPagesToFetch; p++) {
        setFetchStatusText(`Chargement page ${p}/${maxPagesToFetch}...`);
        const res = await searchGalleries(fullQuery, p, "popular");
        if (res && res.result && res.result.length > 0) {
          for (const g of res.result) {
            foundGalleries.push({
              id: g.id,
              title: g.title?.pretty || g.title?.english || `Gallery #${g.id}`,
              cover: g.images?.cover?.url || "",
            });
          }
        }
      }

      if (foundGalleries.length === 0) {
        if (Platform.OS === "android") ToastAndroid.show("Aucune galerie trouvée", ToastAndroid.SHORT);
      } else {
        enqueueGalleries(foundGalleries);
        if (Platform.OS === "android") {
          ToastAndroid.show(`${foundGalleries.length} galeries ajoutées à la file`, ToastAndroid.SHORT);
        }
        setIsAddModalVisible(false);
        setQueryInput("");
      }
    } catch (err: any) {
      console.error("[BatchScreen] Query search error:", err);
      if (Platform.OS === "android") ToastAndroid.show(`Erreur: ${err?.message || "Réseau"}`, ToastAndroid.LONG);
    } finally {
      setIsFetchingBatch(false);
      setFetchStatusText("");
    }
  };

  // Ouvre le lecteur local d'un item terminé. Les items nouveaux portent le
  // localId ; les anciens (file persistée avant cette version) sont résolus
  // par leur ID via la bibliothèque locale. Si rien n'est trouvé, propose une
  // réparation : re-télécharger la galerie.
  const openCompleted = async (item: QueueItem) => {
    if (item.localId) {
      router.push({ pathname: "/read", params: { localId: item.localId } });
      return;
    }
    let resolved: string | null = null;
    try {
      resolved = await resolveLocalByGalleryId(item.id);
    } catch (err) {
      console.warn("[BatchScreen] resolve local failed:", err);
    }
    if (resolved) {
      router.push({ pathname: "/read", params: { localId: resolved } });
      return;
    }

    // Réparation : le dossier local a disparu (supprimé à la main, résolution
    // impossible). Propose un re-téléchargement au lieu d'un simple toast.
    Alert.alert(
      "Galerie introuvable",
      "Les fichiers locaux de cette galerie sont introuvables. Re-télécharger ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Re-télécharger",
          onPress: () => requeueItem(item.id),
        },
      ]
    );
  };

  // Vérifie l'intégrité des fichiers locaux d'un item terminé : compte les
  // pages présentes sur disque et les compare aux métadonnées. Affiche le
  // résultat en ligne (coche / alerte) + toast.
  const handleVerify = async (item: QueueItem) => {
    if (verifyResults[item.id] === "checking") return;
    setVerifyResults((prev) => ({ ...prev, [item.id]: "checking" }));
    try {
      const localId =
        item.localId ?? (await resolveLocalByGalleryId(item.id)) ?? undefined;
      if (!localId) {
        setVerifyResults((prev) => ({ ...prev, [item.id]: undefined }));
        if (Platform.OS === "android") {
          ToastAndroid.show("Dossier de la galerie introuvable", ToastAndroid.SHORT);
        }
        return;
      }
      const res = await verifyLocalGallery(localId);
      setVerifyResults((prev) => ({
        ...prev,
        [item.id]: { ok: res.ok, found: res.found, expected: res.expected },
      }));
      if (Platform.OS === "android") {
        ToastAndroid.show(
          res.ok
            ? `Intégrité OK (${res.found}/${res.expected} pages)`
            : `Intégrité incomplète (${res.found}/${res.expected} pages)`,
          ToastAndroid.SHORT
        );
      }
    } catch (err) {
      console.warn("[BatchScreen] verify failed:", err);
      setVerifyResults((prev) => ({ ...prev, [item.id]: undefined }));
      if (Platform.OS === "android") {
        ToastAndroid.show("Vérification impossible", ToastAndroid.SHORT);
      }
    }
  };

  const handleStartBatchFromIds = async () => {
    const raw = idsInput.trim();
    if (!raw) return;

    const matches = raw.match(/\d{1,7}/g);
    if (!matches || matches.length === 0) {
      if (Platform.OS === "android") ToastAndroid.show("Aucun code ID valide détecté", ToastAndroid.SHORT);
      return;
    }

    const uniqueIds = Array.from(new Set(matches.map((m) => parseInt(m, 10))));
    setIsFetchingBatch(true);
    setFetchStatusText(`Récupération métadonnées (0/${uniqueIds.length})...`);

    const batchList: { id: number; title: string; cover?: string }[] = [];

    for (let i = 0; i < uniqueIds.length; i++) {
      const id = uniqueIds[i];
      setFetchStatusText(`Récupération #${id} (${i + 1}/${uniqueIds.length})...`);
      try {
        const g = await getGallery(id);
        batchList.push({
          id: g.id,
          title: g.title?.pretty || g.title?.english || `Gallery #${g.id}`,
          cover: g.images?.cover?.url || "",
        });
      } catch {
        batchList.push({
          id,
          title: `nHentai #${id}`,
          cover: "",
        });
      }
    }

    enqueueGalleries(batchList);
    if (Platform.OS === "android") {
      ToastAndroid.show(`${batchList.length} galeries ajoutées`, ToastAndroid.SHORT);
    }
    setIsAddModalVisible(false);
    setIdsInput("");
    setIsFetchingBatch(false);
    setFetchStatusText("");
  };

  const renderItem = ({ item }: { item: QueueItem }) => {
    const isDownloading = item.status === "downloading";
    const isPaused = item.status === "paused";
    const isCompleted = item.status === "completed";
    const isError = item.status === "error";

    const verify = verifyResults[item.id];
    const verifyChecking = verify === "checking";
    const verifyOk = typeof verify === "object" && verify.ok;
    const verifyBad = typeof verify === "object" && !verify.ok;

    const statusColor = isCompleted
      ? "#2ed573"
      : isError
      ? "#ff4757"
      : isDownloading
      ? colors.accent
      : colors.sub;

    const statusLabel = isDownloading
      ? "Téléchargement..."
      : isPaused
      ? "En pause"
      : isCompleted
      ? "Téléchargé"
      : isError
      ? (item.errorMessage || "Erreur")
      : "En attente";

    return (
      <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        <View style={styles.cardCoverContainer}>
          {item.cover ? (
            <SmartImage uri={item.cover} style={styles.cardCover} contentFit="cover" />
          ) : (
            <View style={[styles.cardCoverPlaceholder, { backgroundColor: colors.tagBg }]}>
              <IconPhoto size={22} color={colors.sub} stroke={1.8} />
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.txt }]} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.cardMetaRow}>
            <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
            {item.totalPages > 0 &&
              (isCompleted ? (
                <Pressable
                  onPress={() => handleVerify(item)}
                  disabled={verifyChecking}
                  style={({ pressed }) => [styles.verifyButton, { opacity: pressed ? 0.6 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    verifyChecking ? "Vérification en cours" : "Vérifier l'intégrité des fichiers"
                  }
                >
                  {verifyChecking ? (
                    <ActivityIndicator size={12} color={colors.accent} />
                  ) : verifyBad ? (
                    <IconAlertTriangle size={13} color="#ff4757" stroke={2} />
                  ) : verifyOk ? (
                    <IconCircleCheck size={13} color="#2ed573" stroke={2.5} />
                  ) : null}
                  <Text
                    style={[
                      styles.cardPagesText,
                      {
                        color: verifyOk ? "#2ed573" : verifyBad ? "#ff4757" : colors.sub,
                      },
                    ]}
                  >
                    {item.downloadedPages}/{item.totalPages} p.
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.cardPagesText, { color: colors.sub }]}>
                  {item.downloadedPages}/{item.totalPages} p.
                </Text>
              ))}
          </View>

          <View style={[styles.progressBarTrack, { backgroundColor: colors.tagBg }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: statusColor,
                  width: `${Math.max(0, Math.min(1, item.progress)) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.cardActions}>
          {isDownloading && (
            <Pressable
              onPress={() => pauseQueueItem(item.id)}
              style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <IconPlayerPause size={18} color={colors.accent} stroke={2} />
            </Pressable>
          )}
          {(isPaused || isError) && (
            <Pressable
              onPress={() => resumeQueueItem(item.id)}
              style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <IconPlayerPlay size={18} color={colors.accent} stroke={2} />
            </Pressable>
          )}
          {isCompleted && (
            <Pressable
              onPress={() => openCompleted(item)}
              style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <IconBook2 size={18} color="#2ed573" stroke={1.8} />
            </Pressable>
          )}
          <Pressable
            onPress={() => removeQueueItem(item.id)}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconTrash size={16} color="#ff4757" stroke={1.8} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconBtn onPress={() => router.back()} size={36}>
            <IconArrowLeft size={20} color={colors.txt} stroke={2} />
          </IconBtn>
          <View>
            <Text style={[styles.headerTitle, { color: colors.txt }]}>
              Téléchargement par lot
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.sub }]}>
              {stats.downloading > 0 ? `${stats.downloading} actifs · ` : ""}
              {stats.queued} en attente · {stats.completed} terminés
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setIsAddModalVisible(true)}
          style={({ pressed }) => [
            styles.addBatchBtn,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconPlus size={16} color="#fff" stroke={2.5} />
          <Text style={styles.addBatchBtnText}>Nouveau lot</Text>
        </Pressable>
      </View>

      {/* Toolbar / Tabs */}
      <View style={[styles.toolbar, { backgroundColor: colors.page }]}>
        <View style={styles.toolbarTabs}>
          {(["all", "active", "completed"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabButton,
                  isActive && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: isActive ? colors.accent : colors.sub },
                  ]}
                >
                  {tab === "all"
                    ? `Tous (${stats.total})`
                    : tab === "active"
                    ? `En cours (${stats.queued + stats.downloading})`
                    : `Terminés (${stats.completed})`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toolbarButtons}>
          <Pressable
            onPress={resumeAllQueue}
            style={({ pressed }) => [styles.toolbarBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconPlayerPlay size={16} color={colors.accent} stroke={2} />
          </Pressable>
          <Pressable
            onPress={pauseAllQueue}
            style={({ pressed }) => [styles.toolbarBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconPlayerPause size={16} color={colors.sub} stroke={2} />
          </Pressable>
          <Pressable
            onPress={clearCompletedQueue}
            style={({ pressed }) => [styles.toolbarBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconTrash size={16} color={colors.sub} stroke={1.8} />
          </Pressable>
        </View>
      </View>

      {/* Queue List */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconCloudDownload size={48} color={colors.sub} stroke={1.5} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyTitle, { color: colors.txt }]}>File de téléchargement vide</Text>
          <Text style={[styles.emptySub, { color: colors.sub }]}>
            Créez un nouveau lot pour télécharger plusieurs galeries en tâche de fond.
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          extraData={verifyResults}
          estimatedItemSize={90}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: insets.bottom + 40,
          }}
          keyExtractor={(item) => String(item.id)}
        />
      )}

      {/* Add Batch Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isFetchingBatch && setIsAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.page, borderColor: colors.tagBg },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.txt }]}>Ajouter un lot</Text>
              {!isFetchingBatch && (
                <Pressable onPress={() => setIsAddModalVisible(false)}>
                  <IconX size={22} color={colors.sub} stroke={2} />
                </Pressable>
              )}
            </View>

            <View style={[styles.modeToggle, { backgroundColor: colors.tagBg }]}>
              <Pressable
                onPress={() => setAddMode("query")}
                style={[
                  styles.modeToggleBtn,
                  addMode === "query" && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    { color: addMode === "query" ? "#fff" : colors.sub },
                  ]}
                >
                  Recherche / Tags
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAddMode("ids")}
                style={[
                  styles.modeToggleBtn,
                  addMode === "ids" && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    { color: addMode === "ids" ? "#fff" : colors.sub },
                  ]}
                >
                  Liste d'IDs
                </Text>
              </Pressable>
            </View>

            {isFetchingBatch ? (
              <View style={styles.fetchingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.fetchingText, { color: colors.txt }]}>
                  {fetchStatusText}
                </Text>
              </View>
            ) : addMode === "query" ? (
              <ScrollView style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.txt }]}>Mots-clés / Tags</Text>
                <TextInput
                  value={queryInput}
                  onChangeText={setQueryInput}
                  placeholder="Ex: parody:fate cosplay english"
                  placeholderTextColor={colors.sub}
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.bg, color: colors.txt, borderColor: colors.tagBg },
                  ]}
                />

                <Text style={[styles.inputLabel, { color: colors.txt }]}>Langue</Text>
                <View style={styles.langPillsRow}>
                  {(["all", "english", "japanese", "chinese"] as const).map((l) => (
                    <Pressable
                      key={l}
                      onPress={() => setQueryLanguage(l)}
                      style={[
                        styles.langPill,
                        { backgroundColor: queryLanguage === l ? colors.accent : colors.tagBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.langPillText,
                          { color: queryLanguage === l ? "#fff" : colors.sub },
                        ]}
                      >
                        {l === "all"
                          ? "Toutes"
                          : l === "english"
                          ? "English"
                          : l === "japanese"
                          ? "Japanese"
                          : "Chinese"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.txt }]}>
                  Nombre de pages de résultats (1-5)
                </Text>
                <TextInput
                  value={queryPages}
                  onChangeText={setQueryPages}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.sub}
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.bg, color: colors.txt, borderColor: colors.tagBg },
                  ]}
                />

                <Pressable
                  onPress={handleStartBatchFromQuery}
                  style={[styles.submitBatchBtn, { backgroundColor: colors.accent }]}
                >
                  <IconDownload size={18} color="#fff" stroke={2} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBatchBtnText}>Rechercher et Ajouter</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.txt }]}>
                  Coller des IDs (séparés par virgule, espace ou ligne)
                </Text>
                <TextInput
                  value={idsInput}
                  onChangeText={setIdsInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Ex: 177013, 385012, 411749"
                  placeholderTextColor={colors.sub}
                  style={[
                    styles.textInput,
                    styles.textArea,
                    { backgroundColor: colors.bg, color: colors.txt, borderColor: colors.tagBg },
                  ]}
                />

                <Pressable
                  onPress={handleStartBatchFromIds}
                  style={[styles.submitBatchBtn, { backgroundColor: colors.accent }]}
                >
                  <IconDownload size={18} color="#fff" stroke={2} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBatchBtnText}>Ajouter les identifiants</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  addBatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
  },
  addBatchBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  toolbarTabs: { flexDirection: "row", gap: 12 },
  tabButton: { paddingVertical: 6 },
  tabButtonText: { fontSize: 13, fontWeight: "600" },
  toolbarButtons: { flexDirection: "row", gap: 14, alignItems: "center" },
  toolbarBtn: { padding: 6 },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cardCoverContainer: { width: 52, height: 72, borderRadius: 8, overflow: "hidden", marginRight: 12 },
  cardCover: { width: "100%", height: "100%" },
  cardCoverPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 13, fontWeight: "700", lineHeight: 17, marginBottom: 4 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  statusBadge: { fontSize: 11, fontWeight: "700" },
  cardPagesText: { fontSize: 11 },
  verifyButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  progressBarTrack: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 2 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { padding: 6 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 },
  modalBox: { borderRadius: 18, borderWidth: 1, padding: 18, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modeToggle: { flexDirection: "row", borderRadius: 10, padding: 3, marginBottom: 16 },
  modeToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeToggleText: { fontSize: 13, fontWeight: "700" },
  modalBody: {},
  inputLabel: { fontSize: 13, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  textInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { height: 90, textAlignVertical: "top" },
  langPillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  langPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  langPillText: { fontSize: 12, fontWeight: "700" },
  submitBatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  submitBatchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fetchingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  fetchingText: { marginTop: 16, fontSize: 14, fontWeight: "600" },
});
