import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import {
  IconCheck,
  IconFolderPlus,
  IconX,
  IconSparkles,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { TagLabel } from "@/components/ui/TagLabel";
import {
  collectionContains,
  useLibraryCollections,
} from "@/lib/libraryCollectionsStore";
import type { TagCollectionItem } from "@/lib/tagCollectionsStore";
import { useTagFavs } from "@/lib/tagFavoritesStore";

export interface CollectionPickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Identifiant global multi-sources (nhentai:123). */
  globalId: string;
  localId?: string;
  title?: string;
}

type CreateMode = "manual" | "smart";

function parseTagDraft(raw: string): TagCollectionItem | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(":");
  if (colon > 0) {
    const type = trimmed.slice(0, colon).trim().toLowerCase() || "tag";
    const name = trimmed.slice(colon + 1).trim();
    if (!name) return null;
    return { type, name };
  }
  return { type: "tag", name: trimmed };
}

function tagKey(item: TagCollectionItem): string {
  return `${item.type.toLowerCase()}:${item.name.toLowerCase()}`;
}

export function CollectionPickerModal({
  visible,
  onClose,
  globalId,
  localId,
  title,
}: CollectionPickerModalProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { collections, createCollection, toggleMembership } = useLibraryCollections();
  const { favoriteList } = useTagFavs();
  const [newName, setNewName] = useState("");
  const [createMode, setCreateMode] = useState<CreateMode>("manual");
  const [includeTags, setIncludeTags] = useState<TagCollectionItem[]>([]);
  const [excludeTags, setExcludeTags] = useState<TagCollectionItem[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagTarget, setTagTarget] = useState<"include" | "exclude">("include");

  const favSuggestions = useMemo(
    () =>
      favoriteList.map((t) => ({
        type: t.type || "tag",
        name: t.name,
      })),
    [favoriteList]
  );

  const resetCreateForm = (): void => {
    setNewName("");
    setCreateMode("manual");
    setIncludeTags([]);
    setExcludeTags([]);
    setTagDraft("");
    setTagTarget("include");
  };

  const addTag = (item: TagCollectionItem, target: "include" | "exclude"): void => {
    const key = tagKey(item);
    if (target === "include") {
      setIncludeTags((prev) =>
        prev.some((t) => tagKey(t) === key) ? prev : [...prev, item]
      );
      setExcludeTags((prev) => prev.filter((t) => tagKey(t) !== key));
    } else {
      setExcludeTags((prev) =>
        prev.some((t) => tagKey(t) === key) ? prev : [...prev, item]
      );
      setIncludeTags((prev) => prev.filter((t) => tagKey(t) !== key));
    }
  };

  const removeTag = (item: TagCollectionItem, target: "include" | "exclude"): void => {
    const key = tagKey(item);
    if (target === "include") {
      setIncludeTags((prev) => prev.filter((t) => tagKey(t) !== key));
    } else {
      setExcludeTags((prev) => prev.filter((t) => tagKey(t) !== key));
    }
  };

  const handleAddDraft = (): void => {
    const parsed = parseTagDraft(tagDraft);
    if (!parsed) return;
    addTag(parsed, tagTarget);
    setTagDraft("");
  };

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim();
    if (!name) return;
    if (createMode === "smart" && includeTags.length === 0) return;
    try {
      const created = await createCollection(name, {
        mode: createMode,
        rule:
          createMode === "smart"
            ? {
                include: includeTags,
                exclude: excludeTags.length > 0 ? excludeTags : undefined,
              }
            : undefined,
      });
      if (createMode === "manual") {
        await toggleMembership(created.id, globalId, localId);
      }
      resetCreateForm();
      if (createMode === "smart") {
        onClose();
        router.push({
          pathname: "/collections/[id]",
          params: { id: created.id },
        } as never);
      }
    } catch (error) {
      console.warn("[CollectionPicker] create failed:", error);
    }
  };

  const openCollection = (collectionId: string): void => {
    onClose();
    router.push({
      pathname: "/collections/[id]",
      params: { id: collectionId },
    } as never);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.txt }]}>Collections</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Fermer"
              activeOpacity={0.7}
            >
              <IconX size={18} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          {title ? (
            <Text style={[styles.subtitle, { color: colors.sub }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}

          <View style={styles.modeRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCreateMode("manual")}
              style={[
                styles.modeChip,
                {
                  backgroundColor:
                    createMode === "manual" ? colors.accent + "33" : colors.bg,
                  borderColor: createMode === "manual" ? colors.accent : colors.tagBg,
                },
              ]}
            >
              <Text style={[styles.modeChipText, { color: colors.txt }]}>Manuelle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCreateMode("smart")}
              style={[
                styles.modeChip,
                {
                  backgroundColor:
                    createMode === "smart" ? colors.accent + "33" : colors.bg,
                  borderColor: createMode === "smart" ? colors.accent : colors.tagBg,
                },
              ]}
            >
              <IconSparkles size={12} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.modeChipText, { color: colors.txt }]}>Smart (tags)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={
                createMode === "smart" ? "Nouvelle étagère smart" : "Nouvelle collection"
              }
              placeholderTextColor="#6b7280"
              style={[styles.input, { backgroundColor: colors.bg, color: colors.txt }]}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                void handleCreate();
              }}
              style={[
                styles.createBtn,
                {
                  backgroundColor: colors.accent,
                  opacity:
                    !newName.trim() ||
                    (createMode === "smart" && includeTags.length === 0)
                      ? 0.45
                      : 1,
                },
              ]}
              accessibilityLabel="Créer la collection"
            >
              <IconFolderPlus size={16} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {createMode === "smart" ? (
            <View style={styles.smartBlock}>
              <Text style={[styles.smartHint, { color: colors.sub }]}>
                Inclure (tous) · Exclure (aucun). Format libre : tag ou type:nom
              </Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setTagTarget("include")}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor:
                        tagTarget === "include" ? colors.accent + "22" : colors.bg,
                      borderColor:
                        tagTarget === "include" ? colors.accent : colors.tagBg,
                    },
                  ]}
                >
                  <Text style={[styles.modeChipText, { color: colors.txt }]}>
                    Inclure ({includeTags.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setTagTarget("exclude")}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor:
                        tagTarget === "exclude" ? "rgba(255,71,87,0.15)" : colors.bg,
                      borderColor:
                        tagTarget === "exclude" ? "#ff4757" : colors.tagBg,
                    },
                  ]}
                >
                  <Text style={[styles.modeChipText, { color: colors.txt }]}>
                    Exclure ({excludeTags.length})
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.createRow}>
                <TextInput
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  placeholder="ex. artist:shiina you"
                  placeholderTextColor="#6b7280"
                  onSubmitEditing={handleAddDraft}
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.txt }]}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddDraft}
                  style={[styles.createBtn, { backgroundColor: colors.tagBg }]}
                  accessibilityLabel="Ajouter le tag"
                >
                  <IconCheck size={16} color={colors.txt} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {(includeTags.length > 0 || excludeTags.length > 0) && (
                <View style={styles.chipWrap}>
                  {includeTags.map((t) => (
                    <TouchableOpacity
                      key={`in-${tagKey(t)}`}
                      activeOpacity={0.75}
                      onPress={() => removeTag(t, "include")}
                      style={[styles.tagChip, { borderColor: colors.accent }]}
                    >
                      <TagLabel
                        name={t.name}
                        color={colors.accent}
                        variant="inline"
                        prefix={`+${t.type}:`}
                      />
                    </TouchableOpacity>
                  ))}
                  {excludeTags.map((t) => (
                    <TouchableOpacity
                      key={`ex-${tagKey(t)}`}
                      activeOpacity={0.75}
                      onPress={() => removeTag(t, "exclude")}
                      style={[styles.tagChip, { borderColor: "#ff4757" }]}
                    >
                      <TagLabel
                        name={t.name}
                        color="#ff4757"
                        variant="inline"
                        prefix={`−${t.type}:`}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {favSuggestions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestRow}
                >
                  {favSuggestions.slice(0, 24).map((t) => (
                    <TouchableOpacity
                      key={`fav-${tagKey(t)}`}
                      activeOpacity={0.75}
                      onPress={() => addTag(t, tagTarget)}
                      style={[styles.suggestChip, { backgroundColor: colors.bg }]}
                    >
                      <TagLabel
                        name={t.name}
                        color={colors.sub}
                        variant="inline"
                        prefix={`${t.type}:`}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {collections.length === 0 ? (
              <Text style={[styles.empty, { color: colors.sub }]}>
                Aucune étagère. Crée « À lire » ou une smart par tags.
              </Text>
            ) : (
              collections.map((col) => {
                const selected = collectionContains(col, globalId, localId);
                const isSmart = col.mode === "smart";
                return (
                  <TouchableOpacity
                    key={col.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (isSmart) {
                        openCollection(col.id);
                        return;
                      }
                      void toggleMembership(col.id, globalId, localId);
                    }}
                    onLongPress={() => openCollection(col.id)}
                    style={[
                      styles.row,
                      { borderColor: colors.tagBg },
                      selected && !isSmart && { backgroundColor: col.color + "26" },
                    ]}
                    accessibilityRole={isSmart ? "button" : "checkbox"}
                    accessibilityState={{
                      checked: isSmart ? undefined : selected,
                    }}
                  >
                    <View style={[styles.dot, { backgroundColor: col.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.txt }]}>{col.name}</Text>
                      {isSmart ? (
                        <Text style={[styles.smartHint, { color: colors.sub }]}>
                          Auto · ouvrir l’étagère
                        </Text>
                      ) : null}
                    </View>
                    {!isSmart && selected ? (
                      <IconCheck size={16} color={colors.accent} strokeWidth={2.4} />
                    ) : null}
                    {isSmart ? (
                      <IconSparkles size={14} color={colors.accent} strokeWidth={2} />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
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
    maxHeight: "86%",
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
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    minWidth: 0,
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
  smartBlock: {
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
    flexShrink: 1,
    minWidth: 0,
  },
  suggestRow: {
    gap: 6,
    paddingBottom: 4,
  },
  suggestChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 220,
    flexShrink: 1,
    minWidth: 0,
  },
  list: {
    maxHeight: 240,
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
    fontSize: 14,
    fontWeight: "600",
  },
  smartHint: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 6,
  },
});
