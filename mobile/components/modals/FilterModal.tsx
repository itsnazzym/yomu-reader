import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";

export interface FilterOptions {
  sort: "recent" | "popular-today" | "popular-week" | "popular-month" | "popular";
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
  }, [visible]);

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

  const sortOptions = [
    { key: "recent", label: "New", icon: "clock" as const },
    { key: "popular-today", label: "Hot Today", icon: "sun" as const },
    { key: "popular-week", label: "Hot Week", icon: "calendar" as const },
    { key: "popular-month", label: "Hot Month", icon: "calendar" as const },
    { key: "popular", label: "Hot", icon: "trending-up" as const },
  ];

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={onClose}>
          <Animated.View
            style={[
              styles.menuContainer,
              { transform: [{ translateY: slideY }] },
            ]}
          >
            {/* Main Filter Menu (Matching NHApp Screenshot) */}
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
                    <Feather name="globe" size={16} color="#c5878d" style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>Language: {getLangLabel()}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#6b7280" />
                </TouchableOpacity>

                {/* Pages Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateToSubmenu("pages")}
                  style={styles.menuOptionRow}
                >
                  <View style={styles.optionLeft}>
                    <Feather name="file-text" size={16} color="#c5878d" style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>
                      Pages {currentPageRange !== "all" ? `(${getPageLabel()})` : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#6b7280" />
                </TouchableOpacity>

                {/* Date Filter Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateToSubmenu("date")}
                  style={styles.menuOptionRow}
                >
                  <View style={styles.optionLeft}>
                    <Feather name="calendar" size={16} color="#c5878d" style={styles.optionIcon} />
                    <Text style={styles.optionTitle}>
                      Date filter {currentDateFilter !== "all" ? `(${getDateLabel()})` : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* SORT Section */}
              <View style={styles.sortSection}>
                <Text style={styles.sortHeader}>SORT</Text>

                {sortOptions.map((item) => {
                  const isSelected = currentSort === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.7}
                      onPress={() => {
                        setCurrentSort(item.key as any);
                        onChange({
                          sort: item.key as any,
                          language: currentLang,
                          pageRange: currentPageRange,
                          dateFilter: currentDateFilter,
                        });
                        onClose();
                      }}
                      style={[
                        styles.sortRow,
                        isSelected && { backgroundColor: "rgba(197, 135, 141, 0.15)" },
                      ]}
                    >
                      <View style={styles.optionLeft}>
                        <Feather
                          name={item.icon}
                          size={16}
                          color={isSelected ? "#c5878d" : "#9ca3af"}
                          style={styles.optionIcon}
                        />
                        <Text
                          style={[
                            styles.sortLabel,
                            isSelected && { color: "#c5878d", fontWeight: "800" },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>

                      {/* Radio Circle */}
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && { borderColor: "#c5878d" },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
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
                <Feather name="arrow-left" size={16} color="#c5878d" />
                <Text style={styles.submenuTitle}>Select Language</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }}>
                {languages.map((l) => (
                  <TouchableOpacity
                    key={l.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentLang(l.key);
                      setActiveSubmenu("none");
                      onChange({
                        sort: currentSort,
                        language: l.key,
                        pageRange: currentPageRange,
                        dateFilter: currentDateFilter,
                      });
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
                    {currentLang === l.key && <Feather name="check" size={16} color="#c5878d" />}
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
                onPress={() => setActiveSubmenu("none")}
                style={styles.submenuHeader}
              >
                <Feather name="arrow-left" size={16} color="#c5878d" />
                <Text style={styles.submenuTitle}>Filter by Page Count</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }}>
                {pageRanges.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentPageRange(p.key);
                      setActiveSubmenu("none");
                      onChange({
                        sort: currentSort,
                        language: currentLang,
                        pageRange: p.key,
                        dateFilter: currentDateFilter,
                      });
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
                    {currentPageRange === p.key && <Feather name="check" size={16} color="#c5878d" />}
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
                onPress={() => setActiveSubmenu("none")}
                style={styles.submenuHeader}
              >
                <Feather name="arrow-left" size={16} color="#c5878d" />
                <Text style={styles.submenuTitle}>Filter by Upload Date</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }}>
                {dateFilters.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentDateFilter(d.key);
                      navigateBack();
                      onChange({
                        sort: currentSort,
                        language: currentLang,
                        pageRange: currentPageRange,
                        dateFilter: d.key,
                      });
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
                    {currentDateFilter === d.key && <Feather name="check" size={16} color="#c5878d" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
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
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sortLabel: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "500",
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c5878d",
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
});

export default FilterModal;
