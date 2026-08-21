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
  StyleProp,
  ViewStyle,
} from "react-native";
import {
  IconMenu2,
  IconX,
  IconAdjustmentsHorizontal,
  IconArrowsShuffle,
  IconCheck,
  IconPhotoSearch,
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
  showMenu?: boolean;
  showLanguagePills?: boolean;
  showSortButton?: boolean;
  showRandomButton?: boolean;
  onImageSearch?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
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
  showMenu = true,
  showLanguagePills = true,
  showSortButton = true,
  showRandomButton = true,
  onImageSearch,
  onClear,
  autoFocus = false,
  placeholder = "Rechercher tags, artistes ou code...",
  style,
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
    <View style={[styles.wrapper, { backgroundColor: colors.bg }, style]}>
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
        {showMenu ? (
          <IconBtn
            onPress={handleMenuPress}
            size={36}
            accessibilityLabel="Ouvrir le menu"
          >
            <IconMenu2 size={20} color={colors.txt} stroke={2} />
          </IconBtn>
        ) : null}

        {/* Input */}
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={colors.sub}
          autoFocus={autoFocus}
          style={[styles.input, { color: colors.txt }]}
        />

        {onImageSearch ? (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={onImageSearch}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Rechercher par image"
          >
            <IconPhotoSearch size={17} color={colors.accent} stroke={2} />
          </TouchableOpacity>
        ) : null}

        {/* Clear Button */}
        {query ? (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => (onClear ? onClear() : onQueryChange(""))}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
          >
            <IconX size={16} color={colors.sub} stroke={2} />
          </TouchableOpacity>
        ) : null}

        {showSortButton ? (
          <IconBtn
            onPress={() => setIsSortModalOpen(true)}
            size={36}
            accessibilityLabel="Trier les résultats"
          >
            <IconAdjustmentsHorizontal
              size={18}
              color={sort !== "recent" ? colors.accent : colors.sub}
              stroke={1.8}
            />
          </IconBtn>
        ) : null}

        {showRandomButton ? (
          <IconBtn
            onPress={handleRandomPress}
            size={36}
            disabled={isRandomLoading}
            accessibilityLabel="Ouvrir une galerie au hasard"
          >
            {isRandomLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <IconArrowsShuffle size={18} color={colors.accent} stroke={2} />
            )}
          </IconBtn>
        ) : null}
      </View>

      {/* Language Pills Bar */}
      {showLanguagePills ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langPillsContainer}
        >
          {[
            { key: "all", label: "Toutes" },
            { key: "english", label: "English" },
            { key: "japanese", label: "Japanese" },
            { key: "chinese", label: "Chinese" },
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
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Langue : ${item.label}`}
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
      ) : null}

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
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Trier : ${sortLabels[key]}`}
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
