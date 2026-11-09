import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import {
  IconWorld,
  IconCalendar,
  IconChevronRight,
  IconArrowLeft,
  IconCheck,
  IconRotateClockwise,
  IconHelpCircle,
  IconChevronDown,
  IconX,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { type SourceId } from "@/lib/sources/types";
import {
  getSourceFilterSupport,
} from "@/lib/sources/sourceFilterSupport";
import { getEhentaiCategoryInfo } from "@/lib/sources/ehentaiCategories";

export interface FilterOptions {
  sort: "recent" | "popular-today" | "popular-week" | "popular";
  language: string;
  pageRange: string;
  dateFilter: string;
  keyword?: string;
  categories?: string[];
  pageMin?: string;
  pageMax?: string;
  minRating?: number; // 0 = all, 1..5
}

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
  source?: SourceId | "all";
}

/** Ordre 1:1 d'affichage des 10 catégories d'après la maquette */
const CATEGORY_PAIRS: [string, string][] = [
  ["Doujinshi", "Manga"],
  ["Image Set", "Game CG"],
  ["Artist CG", "Cosplay"],
  ["Non-H", "Asian Porn"],
  ["Western", "Misc"],
];

const RATING_OPTIONS = [
  { value: 0, label: "Toutes (0★)" },
  { value: 1, label: "1 ★ et +" },
  { value: 2, label: "2 ★ et +" },
  { value: 3, label: "3 ★ et +" },
  { value: 4, label: "4 ★ et +" },
  { value: 5, label: "5 ★" },
];

export function FilterModal({
  visible,
  onClose,
  options,
  onChange,
  source = "all",
}: FilterModalProps) {
  const { colors } = useTheme();
  const support = getSourceFilterSupport(source);

  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "language" | "date">("none");
  const [currentSort, setCurrentSort] = useState(options.sort);
  const [currentLang, setCurrentLang] = useState(options.language);
  const [currentDateFilter, setCurrentDateFilter] = useState(options.dateFilter || "all");

  // Nouveaux filtres graphiques
  const [keyword, setKeyword] = useState(options.keyword || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (options.categories && options.categories.length > 0) {
      return options.categories;
    }
    return support.supportedCategories;
  });
  const [pageMin, setPageMin] = useState(options.pageMin || "");
  const [pageMax, setPageMax] = useState(options.pageMax || "");
  const [minRating, setMinRating] = useState<number>(options.minRating || 0);
  const [showRatingMenu, setShowRatingMenu] = useState(false);
  const [showPagesTooltip, setShowPagesTooltip] = useState(false);

  // Animations slide + fade
  const slideY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const submenuSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCurrentSort(options.sort);
      setCurrentLang(options.language);
      setCurrentDateFilter(options.dateFilter || "all");
      setKeyword(options.keyword || "");
      setSelectedCategories(
        options.categories && options.categories.length > 0
          ? options.categories
          : support.supportedCategories
      );
      setPageMin(options.pageMin || "");
      setPageMax(options.pageMax || "");
      setMinRating(options.minRating || 0);
      setShowRatingMenu(false);
      setShowPagesTooltip(false);
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
  }, [visible, options, opacity, slideY, source]);

  const toggleCategory = (catName: string) => {
    setSelectedCategories((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === catName.toLowerCase());
      if (exists) {
        return prev.filter((c) => c.toLowerCase() !== catName.toLowerCase());
      } else {
        return [...prev, catName];
      }
    });
  };

  const handleApply = () => {
    onChange({
      sort: currentSort,
      language: currentLang,
      pageRange: options.pageRange || "all",
      dateFilter: currentDateFilter,
      keyword: keyword.trim(),
      categories: selectedCategories,
      pageMin: pageMin.trim(),
      pageMax: pageMax.trim(),
      minRating: minRating,
    });
    onClose();
  };

  const handleReset = () => {
    setCurrentSort("recent");
    setCurrentLang("english");
    setCurrentDateFilter("all");
    setKeyword("");
    setSelectedCategories(support.supportedCategories);
    setPageMin("");
    setPageMax("");
    setMinRating(0);
    setShowRatingMenu(false);
    setShowPagesTooltip(false);

    onChange({
      sort: "recent",
      language: "english",
      pageRange: "all",
      dateFilter: "all",
      keyword: "",
      categories: support.supportedCategories,
      pageMin: "",
      pageMax: "",
      minRating: 0,
    });
    onClose();
  };

  const navigateToSubmenu = (menu: "language" | "date") => {
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

  const languages = [
    { key: "all", label: "Toutes les langues" },
    { key: "english", label: "Anglais" },
    { key: "japanese", label: "Japonais" },
    { key: "chinese", label: "Chinois" },
    { key: "french", label: "Français" },
    { key: "spanish", label: "Espagnol" },
    { key: "german", label: "Allemand" },
    { key: "korean", label: "Coréen" },
  ];

  const dateFilters = [
    { key: "all", label: "Toutes les dates" },
    { key: "uploaded:today", label: "Aujourd'hui (24 h)" },
    { key: "uploaded:thisweek", label: "Cette semaine" },
    { key: "uploaded:thismonth", label: "Ce mois-ci" },
    { key: "uploaded:thisyear", label: "Cette année" },
  ];

  const popularPeriods = [
    { key: "popular-today", label: "Aujourd'hui" },
    { key: "popular-week", label: "Cette semaine" },
    { key: "popular", label: "Tout" },
  ] as const;

  const sortMode: "recent" | "popular" =
    currentSort === "recent" ? "recent" : "popular";

  const getLangLabel = () => {
    const found = languages.find((l) => l.key === currentLang);
    return found ? found.label : "Toutes les langues";
  };

  const getDateLabel = () => {
    const found = dateFilters.find((d) => d.key === currentDateFilter);
    return found ? found.label : "Toutes les dates";
  };

  // Filtrage des paires de catégories compatibles
  const visibleCategoryPairs = CATEGORY_PAIRS.map(([left, right]) => {
    const leftSupported = support.supportedCategories.includes(left);
    const rightSupported = support.supportedCategories.includes(right);
    return [leftSupported ? left : null, rightSupported ? right : null] as [
      string | null,
      string | null
    ];
  }).filter(([left, right]) => left !== null || right !== null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              backgroundColor: colors.page,
              borderColor: colors.tagBg,
              opacity,
              transform: [{ translateY: slideY }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header 1:1 : Reset à gauche, Titre "Filter" au centre, Validation à droite */}
          <View style={[styles.headerBar, { borderBottomColor: colors.tagBg }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleReset}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Réinitialiser les filtres"
              hitSlop={8}
            >
              <IconRotateClockwise size={22} color={colors.accent || "#d1cdd9"} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Filter</Text>
              {source && source !== "all" && (
                <Text style={[styles.headerSourceBadge, { color: colors.accent }]}>
                  {source.toUpperCase()}
                </Text>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleApply}
              style={[styles.headerBtn, styles.headerCheckBtn]}
              accessibilityRole="button"
              accessibilityLabel="Appliquer les filtres"
              hitSlop={8}
            >
              <IconCheck size={24} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Corps principal défilable */}
          {activeSubmenu === "none" && (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 1. GRILLE DE CATÉGORIES (si supportée par la source) */}
              {support.supportsCategories && (
                <View style={styles.categoriesSection}>
                  {visibleCategoryPairs.map(([left, right], idx) => {
                    const renderCatBtn = (catName: string | null) => {
                      if (!catName) {
                        return <View style={styles.catBtnSpacer} />;
                      }
                      const isSelected = selectedCategories.some(
                        (c) => c.toLowerCase() === catName.toLowerCase()
                      );
                      const catInfo = getEhentaiCategoryInfo(catName);

                      return (
                        <TouchableOpacity
                          key={catName}
                          activeOpacity={0.75}
                          onPress={() => toggleCategory(catName)}
                          style={[
                            styles.catBtn,
                            isSelected
                              ? [
                                  styles.catBtnSelected,
                                  {
                                    backgroundColor: catInfo?.color || "#5e5873",
                                    borderColor: catInfo?.color || colors.accent,
                                  },
                                ]
                              : styles.catBtnUnselected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`Catégorie ${catName}`}
                        >
                          <Text
                            style={[
                              styles.catBtnText,
                              isSelected ? styles.catBtnTextSelected : styles.catBtnTextUnselected,
                            ]}
                            numberOfLines={1}
                          >
                            {catName}
                          </Text>
                        </TouchableOpacity>
                      );
                    };

                    return (
                      <View key={`cat_row_${idx}`} style={styles.catRow}>
                        {renderCatBtn(left)}
                        {renderCatBtn(right)}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* 2. CHAMP KEYWORD (Recherche textuelle) */}
              <View style={styles.keywordSection}>
                <Text style={styles.fieldLabel}>Keyword</Text>
                <View style={[styles.keywordInputWrap, { borderBottomColor: colors.tagBg }]}>
                  <TextInput
                    value={keyword}
                    onChangeText={setKeyword}
                    placeholder="Saisir des mots-clés..."
                    placeholderTextColor="#5a5467"
                    style={styles.keywordInput}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {keyword.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setKeyword("")}
                      style={styles.clearKeywordBtn}
                      hitSlop={6}
                    >
                      <IconX size={16} color="#7c7689" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 3. PLAGE DE PAGES : Pages Between [ min ] to [ max ] */}
              {support.supportsPages && (
                <View style={styles.filterRowSection}>
                  <View style={styles.filterRowHeader}>
                    <Text style={styles.rowLabelText}>Pages Between</Text>
                    <TouchableOpacity
                      onPress={() => setShowPagesTooltip((prev) => !prev)}
                      hitSlop={6}
                      style={styles.helpIconBtn}
                    >
                      <IconHelpCircle size={16} color="#8a8397" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.pagesBetweenInputs}>
                    <TextInput
                      value={pageMin}
                      onChangeText={(val) => setPageMin(val.replace(/[^0-9]/g, ""))}
                      placeholder="min"
                      placeholderTextColor="#524d5e"
                      keyboardType="numeric"
                      maxLength={5}
                      style={[styles.pageSquareInput, { borderColor: colors.tagBg }]}
                    />
                    <Text style={styles.toSeparatorText}>to</Text>
                    <TextInput
                      value={pageMax}
                      onChangeText={(val) => setPageMax(val.replace(/[^0-9]/g, ""))}
                      placeholder="max"
                      placeholderTextColor="#524d5e"
                      keyboardType="numeric"
                      maxLength={5}
                      style={[styles.pageSquareInput, { borderColor: colors.tagBg }]}
                    />
                  </View>
                </View>
              )}

              {/* Info bulle Pages */}
              {showPagesTooltip && support.supportsPages && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>
                    Exclut les galeries ayant moins de "min" pages ou plus de "max" pages. Laissez vide pour ne pas contraindre.
                  </Text>
                </View>
              )}

              {/* 4. NOTE MINIMALE : Minimum Rating [ 1 ▾ ] */}
              {support.supportsRating && (
                <View style={styles.filterRowSection}>
                  <Text style={styles.rowLabelText}>Minimum Rating</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowRatingMenu((prev) => !prev)}
                    style={[styles.ratingSelectorBtn, { borderBottomColor: colors.tagBg }]}
                  >
                    <Text style={styles.ratingSelectorValue}>
                      {minRating > 0 ? `${minRating} ★` : "Toutes"}
                    </Text>
                    <IconChevronDown size={18} color="#8a8397" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Sélecteur de note dépliable */}
              {showRatingMenu && support.supportsRating && (
                <View style={[styles.ratingPillsRow, { borderColor: colors.tagBg }]}>
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = minRating === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => {
                          setMinRating(opt.value);
                          setShowRatingMenu(false);
                        }}
                        style={[
                          styles.ratingPill,
                          isSelected && [
                            styles.ratingPillActive,
                            { backgroundColor: colors.accent + "33", borderColor: colors.accent },
                          ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.ratingPillText,
                            isSelected && { color: colors.accent, fontWeight: "700" },
                          ]}
                        >
                          {opt.value === 0 ? "0★" : `${opt.value}★`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* 5. OPTIONS AVANCÉES DE SOURCE (Tri, Langue, Date) */}
              {(support.supportsSort || support.supportsLanguage || support.supportsDate) && (
                <View style={[styles.extraOptionsGroup, { borderTopColor: colors.tagBg }]}>
                  {/* Tri (si supporté) */}
                  {support.supportsSort && (
                    <View style={styles.sortBlock}>
                      <Text style={styles.sortHeader}>TRI</Text>
                      <View style={styles.sortModeRow}>
                        {(["recent", "popular"] as const).map((mode) => {
                          const isActive = sortMode === mode;
                          return (
                            <TouchableOpacity
                              key={mode}
                              activeOpacity={0.7}
                              onPress={() =>
                                setCurrentSort(
                                  mode === "recent" ? "recent" : popularPeriods[0].key
                                )
                              }
                              style={[
                                styles.sortModePill,
                                { borderColor: colors.tagBg },
                                isActive && {
                                  backgroundColor: colors.accent + "26",
                                  borderColor: colors.accent,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.sortModeText,
                                  isActive && { color: colors.accent, fontWeight: "800" },
                                ]}
                              >
                                {mode === "recent" ? "Récentes" : "Populaires"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {sortMode === "popular" && (
                        <View style={styles.periodRow}>
                          {popularPeriods.map((period) => {
                            const isSelected = currentSort === period.key;
                            return (
                              <TouchableOpacity
                                key={period.key}
                                activeOpacity={0.7}
                                onPress={() => setCurrentSort(period.key)}
                                style={[
                                  styles.periodPill,
                                  { borderColor: colors.tagBg },
                                  isSelected && {
                                    backgroundColor: colors.accent + "26",
                                    borderColor: colors.accent,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.periodText,
                                    isSelected && { color: colors.accent, fontWeight: "800" },
                                  ]}
                                >
                                  {period.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Langue (si supportée) */}
                  {support.supportsLanguage && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigateToSubmenu("language")}
                      style={styles.menuOptionRow}
                    >
                      <View style={styles.optionLeft}>
                        <IconWorld size={16} color={colors.accent} strokeWidth={1.8} style={styles.optionIcon} />
                        <Text style={styles.optionTitle}>Langue : {getLangLabel()}</Text>
                      </View>
                      <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
                    </TouchableOpacity>
                  )}

                  {/* Date (si supportée) */}
                  {support.supportsDate && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigateToSubmenu("date")}
                      style={styles.menuOptionRow}
                    >
                      <View style={styles.optionLeft}>
                        <IconCalendar size={16} color={colors.accent} strokeWidth={1.8} style={styles.optionIcon} />
                        <Text style={styles.optionTitle}>
                          Date de téléversement {currentDateFilter !== "all" ? `(${getDateLabel()})` : ""}
                        </Text>
                      </View>
                      <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Sous-menu Langue */}
          {activeSubmenu === "language" && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={navigateBack}
                style={[styles.submenuHeader, { borderBottomColor: colors.tagBg }]}
              >
                <IconArrowLeft size={16} color={colors.accent} strokeWidth={2} />
                <Text style={styles.submenuTitle}>Choisir une langue</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {languages.map((l) => (
                  <TouchableOpacity
                    key={l.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentLang(l.key);
                      navigateBack();
                    }}
                    style={[
                      styles.submenuItem,
                      currentLang === l.key && { backgroundColor: colors.accent + "26" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.submenuItemText,
                        currentLang === l.key && { color: colors.accent, fontWeight: "700" },
                      ]}
                    >
                      {l.label}
                    </Text>
                    {currentLang === l.key && <IconCheck size={16} color={colors.accent} strokeWidth={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Sous-menu Date */}
          {activeSubmenu === "date" && (
            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={navigateBack}
                style={[styles.submenuHeader, { borderBottomColor: colors.tagBg }]}
              >
                <IconArrowLeft size={16} color={colors.accent} strokeWidth={2} />
                <Text style={styles.submenuTitle}>Période de mise en ligne</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {dateFilters.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentDateFilter(d.key);
                      navigateBack();
                    }}
                    style={[
                      styles.submenuItem,
                      currentDateFilter === d.key && { backgroundColor: colors.accent + "26" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.submenuItemText,
                        currentDateFilter === d.key && { color: colors.accent, fontWeight: "700" },
                      ]}
                    >
                      {d.label}
                    </Text>
                    {currentDateFilter === d.key && <IconCheck size={16} color={colors.accent} strokeWidth={2.5} />}
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
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  menuContainer: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "86%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCheckBtn: {
    borderRadius: 20,
  },
  headerTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#f0edf5",
    letterSpacing: 0.3,
  },
  headerSourceBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  scrollBody: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
  },
  categoriesSection: {
    marginBottom: 16,
  },
  catRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  catBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  catBtnSpacer: {
    flex: 1,
    height: 44,
  },
  catBtnUnselected: {
    backgroundColor: "#1c1922",
    borderColor: "#2d2737",
  },
  catBtnSelected: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  catBtnText: {
    fontSize: 14,
    textAlign: "center",
  },
  catBtnTextUnselected: {
    color: "#6c6678",
    fontWeight: "600",
  },
  catBtnTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  keywordSection: {
    marginBottom: 18,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8c8699",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  keywordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    paddingVertical: 4,
  },
  keywordInput: {
    flex: 1,
    fontSize: 15,
    color: "#ffffff",
    paddingVertical: 6,
  },
  clearKeywordBtn: {
    padding: 6,
  },
  filterRowSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  filterRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLabelText: {
    fontSize: 16,
    color: "#e8e5ef",
    fontWeight: "500",
  },
  helpIconBtn: {
    padding: 2,
  },
  pagesBetweenInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageSquareInput: {
    width: 52,
    height: 42,
    backgroundColor: "#0d0b11",
    borderRadius: 8,
    borderWidth: 1,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  toSeparatorText: {
    fontSize: 14,
    color: "#9e97ab",
    fontWeight: "500",
  },
  tooltipBox: {
    backgroundColor: "#201c29",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#a39eb0",
  },
  tooltipText: {
    fontSize: 12,
    color: "#b0aac0",
    lineHeight: 16,
  },
  ratingSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1.5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 64,
    justifyContent: "space-between",
  },
  ratingSelectorValue: {
    fontSize: 16,
    color: "#f5f3fa",
    fontWeight: "600",
  },
  ratingPillsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ratingPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1b1822",
    borderWidth: 1,
    borderColor: "#2d2737",
  },
  ratingPillActive: {
    elevation: 2,
  },
  ratingPillText: {
    fontSize: 12,
    color: "#857f92",
    fontWeight: "600",
  },
  extraOptionsGroup: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sortBlock: {
    marginBottom: 14,
  },
  sortHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  sortModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  sortModePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16131c",
  },
  sortModeText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  periodRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16131c",
  },
  periodText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  menuOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "500",
  },
  submenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  submenuTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  submenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submenuItemText: {
    fontSize: 14,
    color: "#d1d5db",
    fontWeight: "500",
  },
});
