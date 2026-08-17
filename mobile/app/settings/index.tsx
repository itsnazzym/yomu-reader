import React, { useState, useSyncExternalStore } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { SmoothSlider } from "@/components/ui/SmoothSlider";
import {
  getDownloadQueueSnapshot,
  setMaxConcurrent,
  subscribeDownloadQueue,
} from "@/lib/downloadQueueStore";
import { useBlacklist } from "@/lib/blacklistFilter";

const THEME_PALETTES = [
  { hue: 0, color: "#ff4d4f" },
  { hue: 15, color: "#ff6b4a" },
  { hue: 25, color: "#ff7a45" },
  { hue: 35, color: "#fa8c16" },
  { hue: 45, color: "#ffa940" },
  { hue: 55, color: "#ffc53d" },
  { hue: 65, color: "#ffec3d" },
  { hue: 75, color: "#bae637" },
  { hue: 85, color: "#a0d911" },
  { hue: 100, color: "#73d13d" },
  { hue: 120, color: "#52c41a" },
  { hue: 140, color: "#389e0d" },
  { hue: 160, color: "#13c2c2" },
  { hue: 175, color: "#08979c" },
  { hue: 190, color: "#36cfc9" },
  { hue: 205, color: "#4096ff" },
  { hue: 215, color: "#1677ff" },
  { hue: 230, color: "#2f54eb" },
  { hue: 245, color: "#597ef7" },
  { hue: 260, color: "#722ed1" },
  { hue: 280, color: "#9254de" },
  { hue: 300, color: "#eb2f96" },
  { hue: 320, color: "#f759ab" },
  { hue: 340, color: "#ed2553" },
  { hue: 355, color: "#e84749" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, hue, setHue } = useTheme();
  const insets = useSafeAreaInsets();

  const queueSnap = useSyncExternalStore(
    subscribeDownloadQueue,
    getDownloadQueueSnapshot,
    getDownloadQueueSnapshot
  );

  const { tags: blacklistedTags, addTag, removeTag } = useBlacklist();
  const [newTagInput, setNewTagInput] = useState("");

  // Settings states matching NHApp
  const [selectedLanguage, setSelectedLanguage] = useState("System");
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [infiniteScroll, setInfiniteScroll] = useState(true);
  const [respectActiveTags, setRespectActiveTags] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<"phone-p" | "phone-l" | "tab-p" | "tab-l">("tab-l");
  const [columns, setColumns] = useState(5);
  const [minCardWidth, setMinCardWidth] = useState(80);

  const handleAddTag = () => {
    const clean = newTagInput.trim().toLowerCase();
    if (!clean) return;
    addTag(clean);
    setNewTagInput("");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: "#12121a",
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {/* Top Header with Back Arrow */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#f3f4f6" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Language Section */}
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={16} color="#c5878d" />
          <Text style={styles.sectionTitle}>Language</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            onPress={() => setIsLangDropdownOpen((prev) => !prev)}
            style={styles.dropdownTrigger}
          >
            <View>
              <Text style={styles.dropdownSub}>Current</Text>
              <Text style={styles.dropdownVal}>{selectedLanguage}</Text>
            </View>
            <Feather
              name={isLangDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color="#9ca3af"
            />
          </Pressable>

          {isLangDropdownOpen && (
            <View style={styles.dropdownList}>
              {["System", "English", "Français", "日本語 (Japanese)", "中文 (Chinese)"].map(
                (l) => (
                  <Pressable
                    key={l}
                    onPress={() => {
                      setSelectedLanguage(l);
                      setIsLangDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      selectedLanguage === l && { backgroundColor: "rgba(197, 135, 141, 0.15)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedLanguage === l && { color: "#c5878d", fontWeight: "700" },
                      ]}
                    >
                      {l}
                    </Text>
                    {selectedLanguage === l && (
                      <Feather name="check" size={16} color="#c5878d" />
                    )}
                  </Pressable>
                )
              )}
            </View>
          )}
        </View>

        {/* Appearance Section */}
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={16} color="#c5878d" />
          <Text style={styles.sectionTitle}>Appearance</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>App theme</Text>

          {/* Color Palette Grid (32 swatches matching NHApp) */}
          <View style={styles.paletteGrid}>
            {THEME_PALETTES.map((p) => {
              const isSelected = Math.abs(hue - p.hue) < 10;
              return (
                <Pressable
                  key={p.hue}
                  onPress={() => setHue(p.hue)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: p.color },
                    isSelected && styles.colorSwatchActive,
                  ]}
                >
                  {isSelected && <Feather name="check" size={12} color="#fff" />}
                </Pressable>
              );
            })}
          </View>

          {/* Hue indicator and slider */}
          <View style={styles.hueRow}>
            <Text style={styles.hueText}>Hue: {Math.round(hue)}°</Text>
            <View style={[styles.hueBubble, { backgroundColor: colors.accent }]} />
          </View>

          <SmoothSlider
            min={0}
            max={360}
            step={1}
            value={hue}
            onValueChange={setHue}
            activeColor={colors.accent}
            thumbColor={colors.accent}
          />

          {/* Infinite scroll toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.toggleTitle}>Infinite scroll</Text>
              <Text style={styles.toggleSub}>
                Automatically load next page when scrolling down instead of pagination
              </Text>
            </View>
            <Switch
              value={infiniteScroll}
              onValueChange={setInfiniteScroll}
              trackColor={{ false: "#28283a", true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {/* Respect active tags toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.toggleTitle}>
                Respect active tags when opening a book tag?
              </Text>
              <Text style={styles.toggleSub}>
                When enabled, opening a tag from a book keeps current tag filters. When disabled, it opens only that tag without current filters.
              </Text>
            </View>
            <Switch
              value={respectActiveTags}
              onValueChange={setRespectActiveTags}
              trackColor={{ false: "#28283a", true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Catalog Grid Section (Matching NHApp) */}
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={16} color="#c5878d" />
          <Text style={styles.sectionTitle}>Catalog grid</Text>
        </View>

        <View style={styles.card}>
          {/* Device Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceTabs}>
            {[
              { key: "phone-p", label: "Phone (portrait)" },
              { key: "phone-l", label: "Phone (landscape)" },
              { key: "tab-p", label: "Tablet (portrait)" },
              { key: "tab-l", label: "Tablet (landscape)" },
            ].map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setPreviewDevice(d.key as any)}
                style={[
                  styles.deviceTab,
                  previewDevice === d.key && styles.deviceTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.deviceTabText,
                    previewDevice === d.key && styles.deviceTabTextActive,
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Mini Cards Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewRow}>
              {[
                { title: "Kyoudai ni Okeru Seikoushou", pages: "28 стр.", tags: ["inari", "doujinshi"] },
                { title: "Sukebe na Musume no Otoshikata", pages: "65 стр.", tags: ["kazuhiro", "original"] },
                { title: "Kko to Yamioji Ha", pages: "84 стр.", tags: ["rororogi", "original"] },
              ].map((item, idx) => (
                <View key={idx} style={styles.previewCard}>
                  <View style={styles.previewCover} />
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.previewMeta}>EN · {item.pages}</Text>
                  <View style={styles.previewTags}>
                    {item.tags.map((t) => (
                      <View key={t} style={styles.previewTagChip}>
                        <Text style={styles.previewTagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Columns Slider */}
          <View style={styles.sliderHeaderRow}>
            <Text style={styles.sliderLabel}>Columns</Text>
            <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
              <Text style={[styles.sliderValText, { color: colors.accent }]}>{columns}</Text>
            </View>
          </View>
          <SmoothSlider
            min={1}
            max={8}
            step={1}
            value={columns}
            onValueChange={setColumns}
            activeColor={colors.accent}
            thumbColor={colors.accent}
          />

          {/* Min card width Slider */}
          <View style={[styles.sliderHeaderRow, { marginTop: 12 }]}>
            <Text style={styles.sliderLabel}>Experimental • Min card width</Text>
            <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
              <Text style={[styles.sliderValText, { color: colors.accent }]}>{minCardWidth}px</Text>
            </View>
          </View>
          <SmoothSlider
            min={60}
            max={260}
            step={5}
            value={minCardWidth}
            onValueChange={setMinCardWidth}
            activeColor={colors.accent}
            thumbColor={colors.accent}
          />
        </View>

        {/* Downloads & Concurrency */}
        <View style={styles.sectionHeader}>
          <Feather name="download" size={16} color="#c5878d" />
          <Text style={styles.sectionTitle}>Téléchargements & Concurrence</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sliderHeaderRow}>
            <Text style={styles.sliderLabel}>Téléchargements simultanés (Workers)</Text>
            <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
              <Text style={[styles.sliderValText, { color: colors.accent }]}>
                {queueSnap.maxConcurrent}
              </Text>
            </View>
          </View>
          <Text style={styles.toggleSub}>
            Nombre de mangas pouvant être téléchargés en même temps (1 à 8).
          </Text>
          <SmoothSlider
            min={1}
            max={8}
            step={1}
            value={queueSnap.maxConcurrent}
            onValueChange={setMaxConcurrent}
            activeColor={colors.accent}
            thumbColor={colors.accent}
          />
        </View>

        {/* Excluded Tags */}
        <View style={styles.sectionHeader}>
          <Feather name="slash" size={16} color="#c5878d" />
          <Text style={styles.sectionTitle}>Filtrage & Balises Exclues</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.addTagRow}>
            <TextInput
              value={newTagInput}
              onChangeText={setNewTagInput}
              placeholder="Ex: netorare, gore, ugly bastard..."
              placeholderTextColor="#6b7280"
              style={styles.tagInput}
            />
            <Pressable
              onPress={handleAddTag}
              style={[styles.addTagBtn, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.tagsContainer}>
            {blacklistedTags.length === 0 ? (
              <Text style={styles.noTagsText}>
                Aucun tag exclu. Les mangas s'afficheront normalement.
              </Text>
            ) : (
              blacklistedTags.map((tag) => (
                <View key={tag} style={styles.blackTagChip}>
                  <Text style={styles.blackTagText}>{tag}</Text>
                  <Pressable onPress={() => removeTag(tag)}>
                    <Feather name="x" size={14} color="#ff4757" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  card: {
    backgroundColor: "#1a1a26",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#14141e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#28283a",
  },
  dropdownSub: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  dropdownVal: {
    fontSize: 14,
    color: "#f3f4f6",
    fontWeight: "700",
    marginTop: 2,
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: "#14141e",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#28283a",
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  dropdownItemText: {
    fontSize: 13.5,
    color: "#d1d5db",
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f3f4f6",
    marginBottom: 10,
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  hueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  hueText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#9ca3af",
  },
  hueBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#222232",
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  toggleSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 3,
    lineHeight: 14,
  },
  deviceTabs: {
    flexDirection: "row",
    marginBottom: 12,
  },
  deviceTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  deviceTabActive: {
    backgroundColor: "rgba(197, 135, 141, 0.2)",
    borderWidth: 1,
    borderColor: "#c5878d",
  },
  deviceTabText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#9ca3af",
  },
  deviceTabTextActive: {
    color: "#f3f4f6",
    fontWeight: "700",
  },
  previewContainer: {
    backgroundColor: "#12121a",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  previewRow: {
    flexDirection: "row",
    gap: 8,
  },
  previewCard: {
    flex: 1,
    backgroundColor: "#1a1a26",
    borderRadius: 8,
    padding: 6,
  },
  previewCover: {
    width: "100%",
    aspectRatio: 0.72,
    backgroundColor: "#202030",
    borderRadius: 6,
    marginBottom: 6,
  },
  previewTitle: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  previewMeta: {
    fontSize: 8.5,
    color: "#9ca3af",
    marginTop: 2,
  },
  previewTags: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
  },
  previewTagChip: {
    backgroundColor: "#252538",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  previewTagText: {
    fontSize: 7.5,
    color: "#9ca3af",
  },
  sliderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  sliderLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  sliderValBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sliderValText: {
    fontSize: 11,
    fontWeight: "800",
  },
  addTagRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#28283a",
    backgroundColor: "#14141e",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#f3f4f6",
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  blackTagChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222232",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  blackTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  noTagsText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#9ca3af",
  },
});
