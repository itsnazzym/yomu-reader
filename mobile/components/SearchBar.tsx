import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  IconMenu2,
  IconX,
  IconAdjustmentsHorizontal,
  IconArrowsShuffle,
  IconCheck,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/ThemeContext";
import { useDrawer } from "@/lib/DrawerContext";
import { IconBtn } from "@/components/ui/IconBtn";
import { getRandomGallery } from "@/lib/api/nhentai";

export interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  sort: "recent" | "popular" | "popular-today" | "popular-week";
  onSortChange: (sort: "recent" | "popular" | "popular-today" | "popular-week") => void;
  onToggleDrawer?: () => void;
}

export function SearchBar({
  query,
  onQueryChange,
  onSubmit,
  selectedLanguage,
  onLanguageChange,
  sort,
  onSortChange,
  onToggleDrawer,
}: SearchBarProps) {
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  const router = useRouter();
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);

  const handleRandomPress = async () => {
    setIsRandomLoading(true);
    try {
      const g = await getRandomGallery();
      if (g && g.id) {
        router.push({ pathname: "/book/[id]", params: { id: String(g.id) } });
      }
    } catch (e) {
      console.warn("Error fetching random:", e);
    } finally {
      setIsRandomLoading(false);
    }
  };

  const handleSubmit = () => {
    const clean = query.trim();
    if (/^\d{1,7}$/.test(clean)) {
      router.push({ pathname: "/book/[id]", params: { id: clean } });
      return;
    }
    onSubmit();
  };

  const handleMenuPress = () => {
    if (onToggleDrawer) {
      onToggleDrawer();
    } else {
      openDrawer();
    }
  };

  const sortLabels = {
    recent: "Plus récents",
    popular: "Plus populaires (Tout)",
    "popular-today": "Populaires aujourd'hui",
    "popular-week": "Populaires cette semaine",
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      {/* Top Search Bar Row */}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.page,
            borderColor: colors.tagBg,
          },
        ]}
      >
        {/* Drawer Toggle */}
        <IconBtn onPress={handleMenuPress} size={36}>
          <IconMenu2 size={20} color={colors.txt} stroke={2} />
        </IconBtn>

        {/* Input */}
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          placeholder="Rechercher tags, artistes ou code..."
          placeholderTextColor={colors.sub}
          style={[styles.input, { color: colors.txt }]}
        />

        {/* Clear Button */}
        {query ? (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => onQueryChange("")}
            style={styles.clearBtn}
          >
            <IconX size={16} color={colors.sub} stroke={2} />
          </TouchableOpacity>
        ) : null}

        {/* Sort Filter Trigger */}
        <IconBtn onPress={() => setIsSortModalOpen(true)} size={36}>
          <IconAdjustmentsHorizontal
            size={18}
            color={sort !== "recent" ? colors.accent : colors.sub}
            stroke={1.8}
          />
        </IconBtn>

        {/* Random Dice */}
        <IconBtn onPress={handleRandomPress} size={36} disabled={isRandomLoading}>
          {isRandomLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <IconArrowsShuffle size={18} color={colors.accent} stroke={2} />
          )}
        </IconBtn>
      </View>

      {/* Language Pills Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.langPillsContainer}
      >
        {[
          { key: "all", label: "Toutes" },
          { key: "english", label: "🇬🇧 English" },
          { key: "japanese", label: "🇯🇵 Japanese" },
          { key: "chinese", label: "🇨🇳 Chinese" },
        ].map((item) => {
          const isActive = selectedLanguage === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => onLanguageChange(item.key)}
              style={[
                styles.langChip,
                {
                  backgroundColor: isActive ? colors.accent : colors.page,
                  borderColor: isActive ? colors.accent : colors.tagBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.langChipText,
                  { color: isActive ? "#fff" : colors.sub },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort Selection Modal */}
      <Modal
        visible={isSortModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalBackdrop}
          onPress={() => setIsSortModalOpen(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.page, borderColor: colors.tagBg },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.txt }]}>
              Trier les résultats
            </Text>

            {(["recent", "popular", "popular-today", "popular-week"] as const).map(
              (key) => {
                const isSelected = sort === key;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSortChange(key);
                      setIsSortModalOpen(false);
                    }}
                    style={[
                      styles.sortOptionRow,
                      {
                        backgroundColor: isSelected ? colors.accent + "18" : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        {
                          color: isSelected ? colors.accent : colors.txt,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {sortLabels[key]}
                    </Text>
                    {isSelected && (
                      <IconCheck size={18} color={colors.accent} stroke={2.5} />
                    )}
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    paddingHorizontal: 8,
  },
  clearBtn: {
    padding: 6,
    marginRight: 2,
  },
  langPillsContainer: {
    paddingTop: 8,
    paddingBottom: 2,
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  langChipText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sortOptionText: {
    fontSize: 14,
  },
});

export default SearchBar;
