import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { IconBtn } from "@/components/ui/IconBtn";
import {
  clearAppCache,
  formatBytes,
  getStorageBreakdown,
  type StorageBreakdown,
} from "@/lib/cacheManager";
import { deleteLocalGallery } from "@/lib/localLibrary";
import { removeCompletedByLocalId } from "@/lib/downloadQueueStore";

export default function StorageSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<StorageBreakdown | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const next = await getStorageBreakdown();
      setData(next);
    } catch (err) {
      console.warn("[storage] breakdown failed:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClearCache = (): void => {
    Alert.alert(
      "Vider le cache images",
      "Supprime le cache Expo (images temporaires). Les téléchargements NHAppAndroid sont conservés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Vider",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await clearAppCache();
                await refresh();
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleDeleteGallery = (localId: string, label: string): void => {
    Alert.alert(
      "Supprimer cette galerie",
      `Supprimer « ${label} » de la bibliothèque locale ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deleteLocalGallery(localId);
                removeCompletedByLocalId(localId);
                await refresh();
              } catch (err) {
                Alert.alert(
                  "Erreur",
                  err instanceof Error ? err.message : "Suppression impossible."
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: Math.max(insets.top, 12) },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} strokeWidth={2} />
        </IconBtn>
        <Text style={[styles.headerTitle, { color: colors.txt }]}>Stockage</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.hint, { color: colors.sub }]}>Analyse du stockage…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 40,
          }}
        >
          <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
            <Text style={[styles.cardTitle, { color: colors.txt }]}>Total</Text>
            <Text style={[styles.big, { color: colors.accent }]}>
              {formatBytes(data?.totalBytes || 0)}
            </Text>
            <Text style={[styles.hint, { color: colors.sub }]}>
              Cache Expo · {formatBytes(data?.expoCacheBytes || 0)}
            </Text>
            <Text style={[styles.hint, { color: colors.sub }]}>
              Bibliothèque NHAppAndroid · {formatBytes(data?.libraryBytes || 0)}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={busy}
            onPress={handleClearCache}
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.actionText}>Vider le cache images</Text>
          </TouchableOpacity>

          <Text style={[styles.section, { color: colors.sub }]}>Plus gros dossiers</Text>
          {(data?.topConsumers || []).length === 0 ? (
            <Text style={[styles.hint, { color: colors.sub }]}>
              Aucune galerie locale trouvée.
            </Text>
          ) : (
            (data?.topConsumers || []).map((bucket) => (
              <View
                key={bucket.key}
                style={[
                  styles.row,
                  { backgroundColor: colors.page, borderColor: colors.tagBg },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.rowTitle, { color: colors.txt }]} numberOfLines={1} ellipsizeMode="tail">
                    {bucket.label}
                  </Text>
                  <Text style={[styles.hint, { color: colors.sub }]}>
                    {formatBytes(bucket.sizeBytes)}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={busy}
                  onPress={() => handleDeleteGallery(bucket.key, bucket.label)}
                  hitSlop={8}
                  accessibilityLabel={`Supprimer ${bucket.label}`}
                >
                  <IconTrash size={18} color="#ff4757" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  big: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  hint: { fontSize: 12, lineHeight: 17 },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 13, fontWeight: "700" },
});
