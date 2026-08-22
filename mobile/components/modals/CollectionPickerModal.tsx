import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { IconCheck, IconFolderPlus, IconX } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import {
  collectionContains,
  useLibraryCollections,
} from "@/lib/libraryCollectionsStore";

export interface CollectionPickerModalProps {
  visible: boolean;
  onClose: () => void;
  galleryId: number;
  localId?: string;
  title?: string;
}

export function CollectionPickerModal({
  visible,
  onClose,
  galleryId,
  localId,
  title,
}: CollectionPickerModalProps) {
  const { colors } = useTheme();
  const { collections, createCollection, toggleMembership } = useLibraryCollections();
  const [newName, setNewName] = useState("");

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await createCollection(name);
      await toggleMembership(created.id, galleryId, localId);
      setNewName("");
    } catch (error) {
      console.warn("[CollectionPicker] create failed:", error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.txt }]}>Collections</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Fermer">
              <IconX size={18} color={colors.sub} strokeWidth={2} />
            </Pressable>
          </View>
          {title ? (
            <Text style={[styles.subtitle, { color: colors.sub }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}

          <View style={styles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nouvelle collection"
              placeholderTextColor="#6b7280"
              style={[styles.input, { backgroundColor: colors.bg, color: colors.txt }]}
            />
            <Pressable
              onPress={() => {
                void handleCreate();
              }}
              style={[styles.createBtn, { backgroundColor: colors.accent }]}
              accessibilityLabel="Créer la collection"
            >
              <IconFolderPlus size={16} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {collections.length === 0 ? (
              <Text style={[styles.empty, { color: colors.sub }]}>
                Aucune étagère. Crée « À lire » ou « Archive ».
              </Text>
            ) : (
              collections.map((col) => {
                const selected = collectionContains(col, galleryId, localId);
                return (
                  <Pressable
                    key={col.id}
                    onPress={() => {
                      void toggleMembership(col.id, galleryId, localId);
                    }}
                    style={[
                      styles.row,
                      { borderColor: colors.tagBg },
                      selected && { backgroundColor: col.color + "26" },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={[styles.dot, { backgroundColor: col.color }]} />
                    <Text style={[styles.rowLabel, { color: colors.txt }]}>{col.name}</Text>
                    {selected ? <IconCheck size={16} color={colors.accent} strokeWidth={2.4} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    maxHeight: "78%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  createRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  createBtn: {
    width: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    maxHeight: 280,
  },
  empty: {
    fontSize: 12.5,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});
