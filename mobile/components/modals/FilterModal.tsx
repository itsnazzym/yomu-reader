import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import {
  IconWorld,
  IconFileText,
  IconCalendar,
  IconChevronRight,
  IconArrowLeft,
  IconCheck,
  IconRotateClockwise,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

export interface FilterOptions {
  sort: "recent" | "popular-today" | "popular-week" | "popular";
  language: string;
  pageRange: string;
  dateFilter: string;
}

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
}

export function FilterModal({ visible, onClose, options, onChange }: FilterModalProps) {
  const { colors } = useTheme();

  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "language" | "pages" | "date">("none");
  const [currentSort, setCurrentSort] = useState(options.sort);
  const [currentLang, setCurrentLang] = useState(options.language);
  const [currentPageRange, setCurrentPageRange] = useState(options.pageRange || "all");
  const [currentDateFilter, setCurrentDateFilter] = useState(options.dateFilter || "all");

  // Slide + fade animation for the menu panel
  const slideY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Slide for submenu transition
  const submenuSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCurrentSort(options.sort);
      setCurrentLang(options.language);
      setCurrentPageRange(options.pageRange || "all");
      setCurrentDateFilter(options.dateFilter || "all");
      setActiveSubmenu("none");
      slideY.setValue(-20);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, options]);

  const navigateToSubmenu = (menu: "language" | "pages" | "date") => {
    submenuSlide.setValue(30);
    setActiveSubmenu(menu);
    Animated.timing(submenuSlide, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const navigateBack = () => {
    submenuSlide.setValue(-20);
    setActiveSubmenu("none");
    Animated.timing(submenuSlide, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const hasActiveFilters =
    currentLang !== "all" ||
    currentPageRange !== "all" ||
    currentDateFilter !== "all" ||
    currentSort !== "recent";

  const handleReset = () => {
    setCurrentSort("recent");
    setCurrentLang("all");
    setCurrentPageRange("all");
    setCurrentDateFilter("all");
    onChange({
      sort: "recent",
      language: "all",
      pageRange: "all",
      dateFilter: "all",
    });
    onClose();
  };

  // Tri façon nhentai.net : un mode « Recent | Popular », et une période
  // (Today / Week / All time) visible seulement en mode Popular.
  const popularPeriods = [
    { key: "popular-today", label: "Today" },
    { key: "popular-week", label: "Week" },
    { key: "popular", label: "All time" },
  ] as const;
  const sortMode: "recent" | "popular" =
    currentSort === "recent" ? "recent" : "popular";

  const languages = [
    { key: "all", label: "All languages" },
    { key: "english", label: "🇬🇧 English" },
    { key: "japanese", label: "🇯🇵 Japanese" },
    { key: "chinese", label: "🇨🇳 Chinese" },
    { key: "french", label: "🇫🇷 Français" },
    { key: "spanish", label: "🇪🇸 Español" },
    { key: "german", label: "🇩🇪 Deutsch" },
    { key: "korean", label: "🇰🇷 한국어" },
  ];

  const pageRanges = [
    { key: "all", label: "All page counts" },
    { key: "pages:<20", label: "Court (< 20 pages)" },
    { key: "pages:20-50", label: "Moyen (20 - 50 pages)" },
    { key: "pages:50-100", label: "Long (50 - 100 pages)" },
    { key: "pages:>100", label: "Volume XL (> 100 pages)" },
  ];

  const dateFilters = [
    { key: "all", label: "All time (Historique complet)" },
    { key: "uploaded:today", label: "Aujourd'hui (24h)" },
    { key: "uploaded:thisweek", label: "Cette semaine" },
    { key: "uploaded:thismonth", label: "Ce mois-ci" },
    { key: "uploaded:thisyear", label: "Cette année" },
  ];

  const handleApply = () => {
    onChange({
      sort: currentSort,
      language: currentLang,
      pageRange: currentPageRange,
      dateFilter: currentDateFilter,
    });
    onClose();
  };

  const selectSort = (key: FilterOptions["sort"]) => {
    setCurrentSort(key);
    onChange({
      sort: key,
      language: currentLang,
      pageRange: currentPageRange,
      dateFilter: currentDateFilter,
    });
    onClose();
  };

  const getLangLabel = () => {
    const found = languages.find((l) => l.key === currentLang);
    return found ? found.label : "All languages";
  };

  const getPageLabel = () => {
    const found = pageRanges.find((p) => p.key === currentPageRange);
    return found ? found.label : "All page counts";
  };

  const getDateLabel = () => {
    const found = dateFilters.find((d) => d.key === currentDateFilter);
    return found ? found.label : "All time";
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            { opacity, transform: [{ translateY: slideY }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Main Filter Menu */}
          {activeSubmenu === "none" && (
            <View>
              {/* Header Navigation Options */}
              <View style={styles.topOptionsGroup}>
                {/* Language Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateToSubmenu("language")}
                  style={styles.menuOptionRow}
                >
                  <View style={styles.optionLeft}>
                    <IconWorld size={16} color="#c5878d" stroke={1.8} style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>Language: {getLangLabel()}</Text>
                  </View>
                  <IconChevronRight size={16} color="#6b7280" stroke={2} />
                </TouchableOpacity>

                {/* Pages Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateToSubmenu("pages")}
                  style={styles.menuOptionRow}
                >
                  <View style={styles.optionLeft}>
                    <IconFileText size={16} color="#c5878d" stroke={1.8} style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>
                      Pages {currentPageRange !== "all" ? `(${getPageLabel()})` : ""}
                    </Text>
                  </View>
                  <IconChevronRight size={16} color="#6b7280" stroke={2} />
                </TouchableOpacity>

                {/* Date Filter Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateToSubmenu("date")}
                  style={styles.menuOptionRow}
                >
                  <View style={styles.optionLeft}>
                    <IconCalendar size={16} color="#c5878d" stroke={1.8} style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>
                      Date filter {currentDateFilter !== "all" ? `(${getDateLabel()})` : ""}
                    </Text>
                  </View>
                  <IconChevronRight size={16} color="#6b7280" stroke={2} />
                </TouchableOpacity>
              </View>

              {/* SORT Section */}
              <View style={styles.sortSection}>
                <Text style={styles.sortHeader}>SORT</Text>

                {/* Mode : Recent | Popular */}
                <View style={styles.sortModeRow}>
                  {(["recent", "popular"] as const).map((mode) => {
                    const isActive = sortMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.7}
                        onPress={() =>
                          selectSort(
                            mode === "recent"
                              ? "recent"
                              : popularPeriods[0].key
                          )
                        }
                        style={[
                          styles.sortModePill,
                          isActive && {
                            backgroundColor: "rgba(197, 135, 141, 0.15)",
                            borderColor: "#c5878d",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sortModeText,
                            isActive && { color: "#c5878d", fontWeight: "800" },
                          ]}
                        >
                          {mode === "recent" ? "Recent" : "Popular"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Période — visible seulement en mode Popular */}
                {sortMode === "popular" && (
                  <View style={styles.periodRow}>
                    {popularPeriods.map((period) => {
                      const isSelected = currentSort === period.key;
                      return (
                        <TouchableOpacity
                          key={period.key}
                          activeOpacity={0.7}
                          onPress={() => selectSort(period.key)}
                          style={[
                            styles.periodPill,
                            isSelected && {
                              backgroundColor: "rgba(197, 135, 141, 0.15)",
                              borderColor: "#c5878d",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodText,
                              isSelected && { color: "#c5878d", fontWeight: "800" },
                            ]}
                          >
                            {period.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {/* Reset Filters Option (if active) */}
                {hasActiveFilters && (
                  <View style={styles.resetWrap}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleReset}
                      style={styles.resetBtn}
                    >
                      <IconRotateClockwise size={16} color={colors.accent} stroke={2} />
                      <Text style={styles.resetBtnText}>Réinitialiser les filtres</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Submenu: Language */}
          {activeSubmenu === "language" && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={navigateBack}
                style={styles.submenuHeader}
              >
                <IconArrowLeft size={16} color="#c5878d" stroke={2} />
                <Text style={styles.submenuTitle}>Select Language</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {languages.map((l) => (
                  <TouchableOpacity
                    key={l.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentLang(l.key);
                      onChange({
                        sort: currentSort,
                        language: l.key,
                        pageRange: currentPageRange,
                        dateFilter: currentDateFilter,
                      });
                      onClose();
                    }}
                    style={[
                      styles.submenuItem,
                      currentLang === l.key && { backgroundColor: "rgba(197, 135, 141, 0.15)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.submenuItemText,
                        currentLang === l.key && { color: "#c5878d", fontWeight: "700" },
                      ]}
                    >
                      {l.label}
                    </Text>
                    {currentLang === l.key && <IconCheck size={16} color="#c5878d" stroke={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Submenu: Pages */}
          {activeSubmenu === "pages" && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={navigateBack}
                style={styles.submenuHeader}
              >
                <IconArrowLeft size={16} color="#c5878d" stroke={2} />
                <Text style={styles.submenuTitle}>Filter by Page Count</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {pageRanges.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentPageRange(p.key);
                      onChange({
                        sort: currentSort,
                        language: currentLang,
                        pageRange: p.key,
                        dateFilter: currentDateFilter,
                      });
                      onClose();
                    }}
                    style={[
                      styles.submenuItem,
                      currentPageRange === p.key && { backgroundColor: "rgba(197, 135, 141, 0.15)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.submenuItemText,
                        currentPageRange === p.key && { color: "#c5878d", fontWeight: "700" },
                      ]}
                    >
                      {p.label}
                    </Text>
                    {currentPageRange === p.key && <IconCheck size={16} color="#c5878d" stroke={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Submenu: Date */}
          {activeSubmenu === "date" && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={navigateBack}
                style={styles.submenuHeader}
              >
                <IconArrowLeft size={16} color="#c5878d" stroke={2} />
                <Text style={styles.submenuTitle}>Filter by Upload Date</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {dateFilters.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentDateFilter(d.key);
                      onChange({
                        sort: currentSort,
                        language: currentLang,
                        pageRange: currentPageRange,
                        dateFilter: d.key,
                      });
                      onClose();
                    }}
                    style={[
                      styles.submenuItem,
                      currentDateFilter === d.key && { backgroundColor: "rgba(197, 135, 141, 0.15)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.submenuItemText,
                        currentDateFilter === d.key && { color: "#c5878d", fontWeight: "700" },
                      ]}
                    >
                      {d.label}
                    </Text>
                    {currentDateFilter === d.key && <IconCheck size={16} color="#c5878d" stroke={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 14,
  },
  menuContainer: {
    width: 290,
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  topOptionsGroup: {
    borderBottomWidth: 1,
    borderBottomColor: "#222232",
    paddingBottom: 6,
    marginBottom: 4,
  },
  menuOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    marginRight: 10,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  sortSection: {
    paddingTop: 4,
  },
  sortHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6b7280",
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sortModeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  sortModePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    alignItems: "center",
  },
  sortModeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#d1d5db",
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    alignItems: "center",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d1d5db",
  },
  submenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222232",
  },
  submenuTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  submenuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  submenuItemText: {
    fontSize: 13,
    color: "#d1d5db",
  },
  resetWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#222232",
    marginTop: 4,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 71, 87, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 71, 87, 0.3)",
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ff4757",
  },
});

export default FilterModal;
