import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import {
  IconArrowLeft,
  IconFolder,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { IconBtn } from "@/components/ui/IconBtn";
import { AnimatedEmptyState } from "@/components/ui/AnimatedEmptyState";
import {
  deleteLibraryCollection,
  useLibraryCollections,
  type LibraryCollection,
} from "@/lib/libraryCollectionsStore";

export default function CollectionsIndexScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { collections } = useLibraryCollections();
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCollection = useCallback(
    (col: LibraryCollection): void => {
      router.push({
        pathname: "/collections/[id]",
        params: { id: col.id },
      } as never);
    },
    [router]
  );

  const handleDelete = (col: LibraryCollection): void => {
    Alert.alert(
      "Supprimer l’étagère",
      `Supprimer « ${col.name} » ? Les titres ne sont pas effacés.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            setBusyId(col.id);
            void deleteLibraryCollection(col.id)
              .catch((err: unknown) => {
                console.warn("[collections] delete failed:", err);
              })
              .finally(() => setBusyId(null));
          },
        },
      ]
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
        <IconBtn onPress={() => router.back()} size={40}>
          <IconArrowLeft size={22} color={colors.txt} strokeWidth={2} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Étagères</Text>
          <Text style={[styles.headerSub, { color: colors.sub }]}>
            Collections bibliothèque (hors packs tags)
          </Text>
        </View>
      </View>

      {collections.length === 0 ? (
        <AnimatedEmptyState
          type="downloads"
          title="Aucune étagère"
          description="Crée une collection manuelle ou smart depuis la fiche d’un livre."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 24,
            gap: 8,
          }}
        >
          {collections.map((col) => {
            const isSmart = col.mode === "smart";
            const countHint = isSmart
              ? "Smart · règles tags"
              : `${col.globalIds.length + col.localIds.length} titre(s)`;
            return (
              <TouchableOpacity
                key={col.id}
                activeOpacity={0.75}
                disabled={busyId === col.id}
                onPress={() => openCollection(col)}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.page,
                    borderColor: colors.tagBg,
                    opacity: busyId === col.id ? 0.5 : 1,
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: col.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.txt }]}>{col.name}</Text>
                  <Text style={[styles.rowSub, { color: colors.sub }]}>{countHint}</Text>
                </View>
                {isSmart ? (
                  <IconSparkles size={16} color={colors.accent} strokeWidth={2} />
                ) : (
                  <IconFolder size={16} color={colors.sub} strokeWidth={2} />
                )}
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={8}
                  onPress={() => handleDelete(col)}
                  accessibilityLabel={`Supprimer ${col.name}`}
                  style={styles.deleteBtn}
                >
                  <IconTrash size={15} color="#ff4757" strokeWidth={2} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
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
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 12.5, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 11.5, marginTop: 2 },
  deleteBtn: { padding: 6 },
});
