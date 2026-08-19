import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { IconTrash } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { useTheme } from "@/lib/ThemeContext";
import { useHistory, HistoryEntry } from "@/lib/historyStore";
import SmartImage from "@/components/SmartImage";
import { CardPressable } from "@/components/ui/CardPressable";
import { IconBtn } from "@/components/ui/IconBtn";
import { AnimatedEmptyState } from "@/components/ui/AnimatedEmptyState";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history, removeHistoryItem, clearHistory } = useHistory();

  const handleClearAll = () => {
    Alert.alert(
      "Effacer l'historique",
      "Voulez-vous supprimer tout votre historique de lecture ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Effacer", style: "destructive", onPress: clearHistory },
      ]
    );
  };

  const handleResume = (entry: HistoryEntry) => {
    router.push({
      pathname: "/read",
      params: {
        id: String(entry.gallery.id),
        initialPage: String(entry.lastPage),
      },
    });
  };

  const formatDateSafe = (timestamp: number | undefined) => {
    if (!timestamp) return "";
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "";
      return format(d, "dd/MM/yyyy HH:mm");
    } catch {
      return "";
    }
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const progress =
      item.totalPages > 0
        ? Math.min(1, (item.lastPage + 1) / item.totalPages)
        : 0;

    return (
      <CardPressable
        onPress={() => handleResume(item)}
        radius={14}
        style={[
          styles.card,
          { backgroundColor: colors.page, borderColor: colors.tagBg },
        ]}
      >
        <View style={styles.coverWrap}>
          <SmartImage
            uri={
              item.gallery.images?.cover?.url ||
              item.gallery.images?.thumbnail?.url ||
              ""
            }
            style={styles.cover}
            contentFit="cover"
          />
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.txt }]} numberOfLines={2}>
            {item.gallery.title?.pretty || item.gallery.title?.english || `Gallery #${item.gallery.id}`}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.pageText, { color: colors.accent }]}>
              Page {item.lastPage + 1} sur {item.totalPages}
            </Text>
            <Text style={[styles.dateText, { color: colors.sub }]}>
              {formatDateSafe(item.readAt)}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.tagBg }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actions}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              removeHistoryItem(item.gallery.id);
            }}
            style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <IconTrash size={16} color={colors.sub} stroke={1.8} />
          </Pressable>
        </View>
      </CardPressable>
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
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>
            Historique de Lecture
          </Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>
            {history.length} manga(s) consulté(s)
          </Text>
        </View>

        {history.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [
              styles.clearAllBtn,
              { backgroundColor: colors.tagBg, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconTrash size={14} color="#ff4757" stroke={2} style={{ marginRight: 6 }} />
            <Text style={[styles.clearAllText, { color: "#ff4757" }]}>Tout effacer</Text>
          </Pressable>
        )}
      </View>

      {history.length === 0 ? (
        <AnimatedEmptyState
          type="history"
          actionLabel="Commencer à lire"
          onActionPress={() => router.push("/" as any)}
        />
      ) : (
        <FlashList
          data={history}
          renderItem={renderItem}
          estimatedItemSize={90}
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 24,
          }}
          keyExtractor={(item) => String(item.gallery.id)}
        />
      )}
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
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2 },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  clearAllText: { fontSize: 12, fontWeight: "700" },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: "center",
  },
  coverWrap: { width: 50, height: 70, borderRadius: 8, overflow: "hidden", marginRight: 12 },
  cover: { width: "100%", height: "100%" },
  info: { flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 17, marginBottom: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  pageText: { fontSize: 11.5, fontWeight: "700" },
  dateText: { fontSize: 10.5 },
  progressBarTrack: { width: "100%", height: 3.5, borderRadius: 2, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 2 },
  actions: { paddingLeft: 4 },
  deleteBtn: { padding: 8 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
