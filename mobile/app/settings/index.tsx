import React, { useState, useEffect, useSyncExternalStore } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  type LayoutChangeEvent,
} from "react-native";
import {
  IconArrowLeft,
  IconUser,
  IconChevronRight,
  IconRefresh,
  IconLogin,
  IconArrowRight,
  IconPalette,
  IconCheck,
  IconChevronUp,
  IconChevronDown,
  IconBook2,
  IconLayoutList,
  IconCloudDownload,
  IconFolder,
  IconDatabase,
  IconTrash,
  IconClock,
  IconBan,
  IconPlus,
  IconX,
  IconWorld,
  IconKey,
  IconHelpCircle,
  IconDeviceFloppy,
  IconUpload,
  IconLock,
} from "@tabler/icons-react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { exportBackupToFile, restoreBackupFromFile, restoreBackupFromJson } from "@/lib/backupStore";
import { usePrivacy } from "@/lib/privacyStore";
import { hasStoredPin, useAppLock } from "@/lib/appLockStore";
import {
  setPreventScreenCapture,
  usePreventScreenCapture,
} from "@/lib/privacyCaptureStore";
import { PinLockModal } from "@/components/modals/PinLockModal";
import { TagLabel } from "@/components/ui/TagLabel";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { SmoothSlider } from "@/components/ui/SmoothSlider";
import { IconBtn } from "@/components/ui/IconBtn";
import {
  getDownloadQueueSnapshot,
  setMaxConcurrent,
  subscribeDownloadQueue,
} from "@/lib/downloadQueueStore";
import { useBlacklist } from "@/lib/blacklistFilter";
import { useAccount } from "@/lib/accountStore";
import { useReaderSettings } from "@/lib/readerSettingsStore";
import { useOnboarding } from "@/lib/useOnboarding";
import { useDownloadSettings } from "@/lib/downloadSettingsStore";
import { requestDownloadDirectory } from "@/lib/safCopy";
import { getCacheSize, clearAppCache, formatBytes } from "@/lib/cacheManager";
import { clearHistory } from "@/lib/historyStore";
import { checkForOtaUpdate, useOtaSettings } from "@/lib/otaUpdates";
import {
  isGlitchTipActive,
  sendGlitchTipTestEvent,
} from "@/lib/glitchTip";
import { SignInModal } from "@/components/modals/SignInModal";
import SmartImage from "@/components/SmartImage";
import { resolveAvatarUrl } from "@/app/profile";
import { displayAvatarUri } from "@/lib/avatarPersist";
import { catalogColumnCount } from "@/lib/catalogGrid";

const PREVIEW_SAMPLE_MANGA = [
  {
    id: 1,
    title: "[Shiina You] Kyoudai ni Okeru",
    pages: "28 p.",
    lang: "FR",
    tag: "doujinshi",
    cover: "https://t.nhentai.net/galleries/988732/thumb.jpg",
  },
  {
    id: 2,
    title: "[Takeda Hiromitsu] Sukebe na Musume",
    pages: "65 p.",
    lang: "EN",
    tag: "original",
    cover: "https://t.nhentai.net/galleries/1008632/thumb.jpg",
  },
  {
    id: 3,
    title: "[Hisasi] Kko to Yamioji",
    pages: "84 p.",
    lang: "JP",
    tag: "manga",
    cover: "https://t.nhentai.net/galleries/1109832/thumb.jpg",
  },
  {
    id: 4,
    title: "[Homunculus] Toki wo Kakeru",
    pages: "42 p.",
    lang: "FR",
    tag: "doujinshi",
    cover: "https://t.nhentai.net/galleries/988732/thumb.jpg",
  },
  {
    id: 5,
    title: "[Ootsuka Kotora] Maid Kanojo",
    pages: "36 p.",
    lang: "EN",
    tag: "cosplay",
    cover: "https://t.nhentai.net/galleries/1008632/thumb.jpg",
  },
  {
    id: 6,
    title: "[Ashitaba Fuu] Secret Garden",
    pages: "50 p.",
    lang: "JP",
    tag: "sole female",
    cover: "https://t.nhentai.net/galleries/1109832/thumb.jpg",
  },
];

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

const QUICK_BLACKLIST_SUGGESTIONS = [
  "netorare",
  "guro",
  "ugly bastard",
  "scat",
  "amputee",
  "furry",
  "snuff",
  "vomit",
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, hue, setHue } = useTheme();
  const insets = useSafeAreaInsets();

  const { session, isLoggedIn, syncFavorites } = useAccount();
  const accountAvatarUri = displayAvatarUri(session);
  const { settings: readerSettings, updateSettings: updateReaderSettings } = useReaderSettings();
  const { reset: resetOnboarding } = useOnboarding();

  const queueSnap = useSyncExternalStore(
    subscribeDownloadQueue,
    getDownloadQueueSnapshot,
    getDownloadQueueSnapshot
  );

  const {
    settings: downloadSettings,
    folderLabel,
    sandboxPath,
    updateSettings: updateDownloadFolder,
    resetFolder,
  } = useDownloadSettings();
  const { tags: blacklistedTags, addTag, removeTag } = useBlacklist();
  const { incognito, setIncognito } = usePrivacy();
  const {
    enabled: appLockEnabled,
    biometric: appLockBiometric,
    setEnabled: setAppLockEnabled,
    setBiometric: setAppLockBiometric,
    setPin: setAppLockPin,
  } = useAppLock();
  const preventCapture = usePreventScreenCapture();
  const { enabled: otaEnabled, setEnabled: setOtaEnabled } = useOtaSettings();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  // Interface & Grid preview states
  const [previewDevice, setPreviewDevice] = useState<"phone-p" | "phone-l" | "tab-p" | "tab-l">("phone-p");
  const [showGridCustomizer, setShowGridCustomizer] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [draftColumns, setDraftColumns] = useState(2);
  const [draftMinWidth, setDraftMinWidth] = useState(130);
  const [showTechPath, setShowTechPath] = useState(false);

  const columns = (() => {
    switch (previewDevice) {
      case "phone-p":
        return readerSettings.catalogColumnsPhonePortrait ?? 2;
      case "phone-l":
        return readerSettings.catalogColumnsPhoneLandscape ?? 3;
      case "tab-p":
        return readerSettings.catalogColumnsTabletPortrait ?? 4;
      case "tab-l":
        return readerSettings.catalogColumnsTabletLandscape ?? 5;
      default:
        return 2;
    }
  })();

  const setColumns = (val: number) => {
    switch (previewDevice) {
      case "phone-p":
        updateReaderSettings({ catalogColumnsPhonePortrait: val });
        break;
      case "phone-l":
        updateReaderSettings({ catalogColumnsPhoneLandscape: val });
        break;
      case "tab-p":
        updateReaderSettings({ catalogColumnsTabletPortrait: val });
        break;
      case "tab-l":
        updateReaderSettings({ catalogColumnsTabletLandscape: val });
        break;
    }
  };

  const minCardWidth = readerSettings.catalogMinCardWidth ?? 130;
  const setMinCardWidth = (val: number) => updateReaderSettings({ catalogMinCardWidth: val });

  useEffect(() => {
    setDraftColumns(columns);
  }, [columns, previewDevice]);

  useEffect(() => {
    setDraftMinWidth(minCardWidth);
  }, [minCardWidth]);

  const previewCols = catalogColumnCount({
    width: Math.max(previewWidth, 1),
    configuredColumns: draftColumns,
    minCardWidth: draftMinWidth,
    gap: 6,
    horizontalPadding: 0,
  });
  const previewCardWidth =
    previewWidth > 0
      ? (previewWidth - 6 * (previewCols - 1)) / previewCols
      : undefined;

  const appName = Constants.expoConfig?.name ?? "Yomu Reader";
  const appVersion = Constants.expoConfig?.version ?? "1.1.0";

  const infiniteScroll = readerSettings.infiniteScroll ?? true;
  const setInfiniteScroll = (val: boolean) => updateReaderSettings({ infiniteScroll: val });

  // Cache & Storage states
  const [cacheSizeBytes, setCacheSizeBytes] = useState<number>(0);
  const [clearingCache, setClearingCache] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const [isSignInOpen, setIsSignInOpen] = useState(false);

  useEffect(() => {
    getCacheSize().then(setCacheSizeBytes);
  }, []);

  const handleAddTag = () => {
    const clean = newTagInput.trim().toLowerCase();
    if (!clean) return;
    addTag(clean);
    setNewTagInput("");
  };

  const handleClearCache = () => {
    Alert.alert(
      "Vider le cache des images",
      "Voulez-vous supprimer les fichiers temporaires et les images mises en cache ? Cela libérera de l'espace sur votre appareil.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Vider le cache",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            try {
              await clearAppCache();
              const newSize = await getCacheSize();
              setCacheSizeBytes(newSize);
              Alert.alert("Succès", "Le cache des images a été vidé.");
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Réinitialiser l'historique",
      "Voulez-vous effacer tout votre historique de recherche et de lecture ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer tout",
          style: "destructive",
          onPress: async () => {
            await clearHistory();
            Alert.alert("Succès", "Historique effacé avec succès.");
          },
        },
      ]
    );
  };

  const handleSyncFavorites = async () => {
    setSyncingCloud(true);
    try {
      const res = await syncFavorites();
      if (res.success) {
        Alert.alert("Cloud Synchronisé", `${res.count} favoris officiels à jour.`);
      } else {
        Alert.alert("Erreur de synchro", res.error || "Impossible de joindre le serveur.");
      }
    } finally {
      setSyncingCloud(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: readerSettings.oledMode ? "#000000" : colors.bg,
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: "#222232" }]}>
        <IconBtn onPress={() => router.back()} size={36} style={styles.backBtn}>
          <IconArrowLeft size={18} color="#f3f4f6" strokeWidth={2} />
        </IconBtn>
        <Text style={styles.headerTitle}>Paramètres</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* 1. COMPTE & PROFIL HERO CARD */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.accent + "20" }]}>
              <IconUser size={14} color={colors.accent} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Compte</Text>
          </View>

          {isLoggedIn ? (
            <CardPressable
              radius={16}
              onPress={() => router.push("/profile")}
              style={[styles.accountHeroCard, { borderColor: "#28283a" }]}
            >
              <View style={styles.accountHeroRow}>
                <View style={[styles.avatarBox, { backgroundColor: colors.accent, overflow: "hidden" }]}>
                  {accountAvatarUri ? (
                    <Image
                      source={{
                        uri: resolveAvatarUrl(accountAvatarUri, session.username),
                      }}
                      style={styles.avatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(session.username || "M").charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.accountNameRow}>
                    <Text style={styles.accountName} numberOfLines={1} ellipsizeMode="tail">
                      {session.username || "Compte nHentai"}
                    </Text>
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>Actif</Text>
                    </View>
                  </View>
                  <Text style={styles.accountMeta}>
                    {session.cloudFavoritesCount || 0} favoris · {session.credentialType === "apiKey" ? "Clé API" : "Session API v2"}
                  </Text>
                </View>
                <IconChevronRight size={18} color="#6b7280" strokeWidth={2} />
              </View>

              <View style={styles.accountQuickActions}>
                <Pressable
                  onPress={handleSyncFavorites}
                  disabled={syncingCloud}
                  style={[styles.quickActionPill, { backgroundColor: "#222232" }]}
                >
                  {syncingCloud ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <IconRefresh size={12} color={colors.accent} strokeWidth={2} />
                  )}
                  <Text style={[styles.quickActionText, { color: colors.accent }]}>
                    {syncingCloud ? "Synchro..." : "Synchroniser"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/profile")}
                  style={[styles.quickActionPill, { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.quickActionText, { color: "#fff", fontWeight: "800" }]}>
                    Voir mon profil →
                  </Text>
                </Pressable>
              </View>
            </CardPressable>
          ) : (
            <CardPressable
              radius={16}
              onPress={() => setIsSignInOpen(true)}
              style={[styles.loginPromptCard, { borderColor: "#28283a" }]}
            >
              <View style={styles.loginPromptRow}>
                <View style={[styles.avatarBox, { backgroundColor: "#222232" }]}>
                  <IconLogin size={18} color={colors.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loginPromptTitle}>Connecter mon compte nHentai</Text>
                  <Text style={styles.loginPromptSub}>
                    Retrouvez vos favoris Cloud et accédez à votre profil.
                  </Text>
                </View>
                <IconArrowRight size={18} color={colors.accent} strokeWidth={2} />
              </View>
            </CardPressable>
          )}
        </View>

        {/* ================================================================= */}
        {/* 2. APPARENCE & INTERFACE */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(235, 47, 150, 0.15)" }]}>
              <IconPalette size={14} color="#eb2f96" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Interface & Thème</Text>
          </View>

          <View style={styles.groupCard}>
            <Text style={styles.cardSectionLabel}>Thème & Couleur d'accent</Text>

            {/* 25-color Swatches Grid */}
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
                    {isSelected && <IconCheck size={12} color="#fff" strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Hue Slider */}
            <View style={styles.hueRow}>
              <Text style={styles.hueText}>Teinte (Hue) : {Math.round(hue)}°</Text>
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

            <View style={styles.divider} />

            {/* OLED Mode Switch */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Mode Noir Pur OLED</Text>
                <Text style={styles.rowToggleSub}>
                  Fond noir 100% profond pour économiser la batterie sur écran AMOLED.
                </Text>
              </View>
              <Switch
                value={readerSettings.oledMode}
                onValueChange={(val) => updateReaderSettings({ oledMode: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Infinite Scroll Switch */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Défilement infini du catalogue</Text>
                <Text style={styles.rowToggleSub}>
                  Charge automatiquement la page suivante lors du défilement.
                </Text>
              </View>
              <Switch
                value={infiniteScroll}
                onValueChange={setInfiniteScroll}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Catalog Grid Customizer Accordion */}
            <Pressable
              onPress={() => setShowGridCustomizer((prev) => !prev)}
              style={styles.accordionHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowToggleTitle}>Disposition de la grille du catalogue</Text>
                <Text style={styles.rowToggleSub}>
                  Personnalisez le nombre de colonnes et la taille des cartes.
                </Text>
              </View>
              {showGridCustomizer ? (
                <IconChevronUp size={18} color="#9ca3af" strokeWidth={2} />
              ) : (
                <IconChevronDown size={18} color="#9ca3af" strokeWidth={2} />
              )}
            </Pressable>

            {showGridCustomizer && (
              <View style={styles.gridCustomizerWrap}>
                {/* Device Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.deviceTabs}
                >
                  {(
                    [
                      { key: "phone-p" as const, label: "Téléphone (portrait)" },
                      { key: "phone-l" as const, label: "Téléphone (paysage)" },
                      { key: "tab-p" as const, label: "Tablette (portrait)" },
                      { key: "tab-l" as const, label: "Tablette (paysage)" },
                    ]
                  ).map((d) => (
                    <Pressable
                      key={d.key}
                      onPress={() => setPreviewDevice(d.key)}
                      style={[
                        styles.deviceTab,
                        previewDevice === d.key && {
                          backgroundColor: colors.accent + "20",
                          borderColor: colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deviceTabText,
                          previewDevice === d.key && { color: colors.accent, fontWeight: "800" },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Real-time Dynamic Cards Preview */}
                <View style={styles.previewContainer}>
                  <View style={styles.previewHeaderInfo}>
                    <Text style={styles.previewHeaderLabel}>
                      Aperçu live · {previewDevice === "phone-p" ? "Téléphone (portrait)" : previewDevice === "phone-l" ? "Téléphone (paysage)" : previewDevice === "tab-p" ? "Tablette (portrait)" : "Tablette (paysage)"}
                    </Text>
                    <View style={[styles.previewBadgePill, { backgroundColor: colors.accent + "20" }]}>
                      <Text style={[styles.previewHeaderBadge, { color: colors.accent }]}>
                        {previewCols} colonne{previewCols > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={styles.previewGrid}
                    onLayout={(e: LayoutChangeEvent) => {
                      const next = e.nativeEvent.layout.width;
                      if (next > 0 && Math.abs(next - previewWidth) > 0.5) {
                        setPreviewWidth(next);
                      }
                    }}
                  >
                    {PREVIEW_SAMPLE_MANGA.slice(
                      0,
                      Math.min(6, Math.max(previewCols * 2, 3))
                    ).map((item) => {
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.previewCard,
                            {
                              width: previewCardWidth,
                              backgroundColor: "#161622",
                              borderColor: "#252538",
                            },
                          ]}
                        >
                          <View style={styles.previewCoverWrap}>
                            <SmartImage
                              uri={item.cover}
                              recyclingKey={`prev_${item.id}_${item.cover}`}
                              style={styles.previewCover}
                              contentFit="cover"
                            />
                            <View
                              style={[
                                styles.previewLangBadge,
                                {
                                  backgroundColor:
                                    item.lang === "FR"
                                      ? "#3b82f6"
                                      : item.lang === "JP"
                                      ? "#ec4899"
                                      : "#10b981",
                                },
                              ]}
                            >
                              <Text style={styles.previewLangText}>{item.lang}</Text>
                            </View>
                          </View>
                          <Text style={styles.previewTitle} numberOfLines={1} ellipsizeMode="tail">
                            {item.title}
                          </Text>
                          <View style={styles.previewMetaRow}>
                            <Text style={styles.previewMetaTag} numberOfLines={1} ellipsizeMode="tail">
                              {item.tag}
                            </Text>
                            <Text style={styles.previewMetaPages}>{item.pages}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.previewFooterNote}>
                    ✦ Modifie instantanément le catalogue d'accueil et les listes de mangas.
                  </Text>
                </View>

                {/* Columns slider */}
                <View style={styles.sliderHeaderRow}>
                  <Text style={styles.sliderLabel}>Nombre de colonnes</Text>
                  <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
                    <Text style={[styles.sliderValText, { color: colors.accent }]}>
                      {draftColumns} {draftColumns === 1 ? "colonne" : "colonnes"}
                    </Text>
                  </View>
                </View>
                <SmoothSlider
                  min={1}
                  max={previewDevice.startsWith("tab") ? 8 : 5}
                  step={1}
                  value={draftColumns}
                  onValueChange={(val) => setDraftColumns(Math.round(val))}
                  onSlidingComplete={(val) => setColumns(Math.round(val))}
                  activeColor={colors.accent}
                  thumbColor={colors.accent}
                />

                {/* Min card width slider */}
                <View style={[styles.sliderHeaderRow, { marginTop: 10 }]}>
                  <Text style={styles.sliderLabel}>Largeur minimale des cartes</Text>
                  <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
                    <Text style={[styles.sliderValText, { color: colors.accent }]}>
                      {draftMinWidth}px
                    </Text>
                  </View>
                </View>
                <SmoothSlider
                  min={80}
                  max={240}
                  step={5}
                  value={draftMinWidth}
                  onValueChange={(val) => setDraftMinWidth(Math.round(val))}
                  onSlidingComplete={(val) => setMinCardWidth(Math.round(val))}
                  activeColor={colors.accent}
                  thumbColor={colors.accent}
                />
              </View>
            )}
          </View>
        </View>

        {/* ================================================================= */}
        {/* 3. LECTEUR (READER SETTINGS) */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(96, 165, 250, 0.15)" }]}>
              <IconBook2 size={14} color="#60a5fa" strokeWidth={1.8} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Lecteur</Text>
          </View>

          <View style={styles.groupCard}>
            <Text style={styles.cardSectionLabel}>Mode de lecture</Text>
            <View style={styles.segmentedRow}>
              {[
                { key: "webtoon", label: "Webtoon", icon: "align-justify" },
                { key: "pager", label: "Page par page", icon: "book" },
              ].map((m) => {
                const active = readerSettings.defaultMode === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() =>
                      updateReaderSettings({
                        defaultMode: m.key as "webtoon" | "pager",
                      })
                    }
                    style={[
                      styles.segmentedBtn,
                      active && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    {m.key === "webtoon" ? (
                      <IconLayoutList size={14} color={active ? "#fff" : "#9ca3af"} strokeWidth={2} />
                    ) : (
                      <IconBook2 size={14} color={active ? "#fff" : "#9ca3af"} strokeWidth={1.8} />
                    )}
                    <Text
                      style={[
                        styles.segmentedText,
                        active && { color: "#fff", fontWeight: "800" },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardSectionLabel}>Sens de lecture</Text>
            <View style={styles.segmentedRow}>
              {[
                { key: "rtl", label: "Droite à gauche (Manga)" },
                { key: "ltr", label: "Gauche à droite" },
              ].map((d) => {
                const active = readerSettings.defaultDirection === d.key;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() =>
                      updateReaderSettings({
                        defaultDirection: d.key as "rtl" | "ltr",
                      })
                    }
                    style={[
                      styles.segmentedBtn,
                      active && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        active && { color: "#fff", fontWeight: "800" },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Fullscreen status bar */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Plein écran immersif</Text>
                <Text style={styles.rowToggleSub}>
                  Masque la barre d'état du téléphone pendant la lecture.
                </Text>
              </View>
              <Switch
                value={readerSettings.hideStatusBar}
                onValueChange={(val) => updateReaderSettings({ hideStatusBar: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Tap to turn */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Toucher pour tourner</Text>
                <Text style={styles.rowToggleSub}>
                  Taper à gauche/droite pour changer de page en mode Pager.
                </Text>
              </View>
              <Switch
                value={readerSettings.tapToTurnPage}
                onValueChange={(val) => updateReaderSettings({ tapToTurnPage: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Mode Double-Page */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Double-page (Paysage)</Text>
                <Text style={styles.rowToggleSub}>
                  Affiche deux pages côte à côte en mode paysage ou sur grand écran.
                </Text>
              </View>
              <Switch
                value={readerSettings.dualPageMode}
                onValueChange={(val) => updateReaderSettings({ dualPageMode: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Rail de miniatures Filmstrip */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Rail de miniatures</Text>
                <Text style={styles.rowToggleSub}>
                  Bande coulissante de navigation rapide dans le lecteur.
                </Text>
              </View>
              <Switch
                value={readerSettings.showThumbRail}
                onValueChange={(val) => updateReaderSettings({ showThumbRail: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 4. TÉLÉCHARGEMENTS & CONCURRENCE */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(52, 199, 89, 0.15)" }]}>
              <IconCloudDownload size={14} color="#34c759" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Téléchargements</Text>
          </View>

          <View style={styles.groupCard}>
            <View style={styles.sliderHeaderRow}>
              <Text style={styles.sliderLabel}>Téléchargements simultanés</Text>
              <View style={[styles.sliderValBadge, { backgroundColor: colors.accent + "20" }]}>
                <Text style={[styles.sliderValText, { color: colors.accent }]}>
                  {queueSnap.maxConcurrent}
                </Text>
              </View>
            </View>
            <Text style={styles.rowToggleSub}>
              Nombre de mangas téléchargés simultanément (1 à 8).
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

            <View style={styles.divider} />

            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Wi‑Fi uniquement</Text>
                <Text style={styles.rowToggleSub}>
                  Les téléchargements restent en file hors Wi‑Fi. Ils reprennent automatiquement.
                  {"\n"}Les DL s'arrêtent si l'app est tuée par le système (limite Expo).
                </Text>
              </View>
              <Switch
                value={downloadSettings.wifiOnly}
                onValueChange={(val) => updateDownloadFolder({ wifiOnly: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.rowToggleSub}>
              Export CBZ + ComicInfo.xml : bouton archive sur un titre hors-ligne
              (compatible Mihon, Komga, Kavita).
            </Text>

            <View style={styles.divider} />

            <View style={{ gap: 6, paddingVertical: 4 }}>
              <Text style={styles.rowToggleTitle}>Dossier de téléchargement</Text>
              <Text style={styles.rowToggleSub}>
                {folderLabel}
                {downloadSettings.mode === "saf"
                  ? "\nUne copie est aussi envoyée vers le dossier choisi."
                  : "\nAucun dossier public n'est requis : l'app écrit dans son stockage privé."}
              </Text>
              <Pressable
                onPress={() => setShowTechPath((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Afficher le chemin technique"
              >
                <Text style={[styles.rowToggleSub, { color: colors.accent, fontWeight: "700" }]}>
                  {showTechPath ? "Masquer le chemin technique" : "Chemin technique"}
                </Text>
              </Pressable>
              {showTechPath ? (
                <Text style={styles.rowToggleSub} selectable>
                  {sandboxPath || "NHAppAndroid (stockage app)"}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <CardPressable
                  radius={10}
                  onPress={async () => {
                    const uri = await requestDownloadDirectory();
                    if (uri) {
                      await updateDownloadFolder({
                        mode: "saf",
                        safDirectoryUri: uri,
                        folderPrompted: true,
                        rememberFolder: true,
                      });
                    }
                  }}
                  style={[styles.linkRow, { flex: 1 }]}
                >
                  <IconFolder size={16} color={colors.accent} strokeWidth={2} />
                  <Text style={styles.linkRowText}>Modifier</Text>
                </CardPressable>
                <CardPressable
                  radius={10}
                  onPress={() => void resetFolder()}
                  style={[styles.linkRow, { flex: 1 }]}
                >
                  <IconRefresh size={16} color={colors.sub} strokeWidth={2} />
                  <Text style={[styles.linkRowText, { color: colors.sub }]}>Réinitialiser</Text>
                </CardPressable>
              </View>
            </View>

            <View style={styles.divider} />

            <CardPressable
              radius={10}
              onPress={() => router.push("/downloaded")}
              style={styles.linkRow}
            >
              <IconFolder size={16} color={colors.accent} strokeWidth={2} />
              <Text style={styles.linkRowText}>Voir les téléchargements</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 5. STOCKAGE & CACHE */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(250, 173, 20, 0.15)" }]}>
              <IconDatabase size={14} color="#faad14" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Stockage & Cache</Text>
          </View>

          <View style={styles.groupCard}>
            {/* Cache row */}
            <View style={styles.cacheRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowToggleTitle}>Cache des images</Text>
                <Text style={styles.cacheSizeText}>{formatBytes(cacheSizeBytes)}</Text>
              </View>

              <Pressable
                onPress={handleClearCache}
                disabled={clearingCache}
                style={[styles.clearCacheBtn, { backgroundColor: "rgba(255, 71, 87, 0.15)", borderColor: "rgba(255, 71, 87, 0.3)" }]}
              >
                {clearingCache ? (
                  <ActivityIndicator size="small" color="#ff4757" />
                ) : (
                  <IconTrash size={14} color="#ff4757" strokeWidth={2} />
                )}
                <Text style={styles.clearCacheText}>Vider le cache</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <CardPressable
              radius={10}
              onPress={() => router.push("/settings/storage" as never)}
              style={styles.linkRow}
            >
              <IconDatabase size={16} color={colors.accent} strokeWidth={2} />
              <Text style={styles.linkRowText}>Tableau de bord stockage</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>

            <View style={styles.divider} />

            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Mises à jour OTA</Text>
                <Text style={styles.rowToggleSub}>
                  Autorise la vérification et le téléchargement des mises à jour JS à distance.
                </Text>
              </View>
              <Switch
                value={otaEnabled}
                onValueChange={(v) => {
                  void setOtaEnabled(v);
                }}
                trackColor={{ false: "#3f3f46", true: colors.accent }}
                thumbColor="#f4f4f5"
              />
            </View>

            <View style={styles.divider} />

            <CardPressable
              radius={10}
              onPress={() => {
                void checkForOtaUpdate();
              }}
              style={[styles.linkRow, !otaEnabled && { opacity: 0.45 }]}
            >
              <IconCloudDownload size={16} color={colors.accent} strokeWidth={2} />
              <Text style={styles.linkRowText}>Rechercher une mise à jour</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>

            <View style={styles.divider} />

            {/* Clear History */}
            <Pressable onPress={handleClearHistory} style={styles.dangerRow}>
              <IconClock size={16} color="#ff4757" strokeWidth={2} />
              <Text style={styles.dangerRowText}>Effacer l'historique</Text>
            </Pressable>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 6. FILTRES & SÉCURITÉ */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(255, 71, 87, 0.15)" }]}>
              <IconBan size={14} color="#ff4757" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Tags masqués</Text>
          </View>

          <View style={styles.groupCard}>
            {/* Blur NSFW Covers */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Mode discret (Flou)</Text>
                <Text style={styles.rowToggleSub}>
                  Floute les couvertures dans les grilles (accueil, favoris, téléchargés).
                </Text>
              </View>
              <Switch
                value={readerSettings.blurNsfwCovers}
                onValueChange={(val) => updateReaderSettings({ blurNsfwCovers: val })}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Mode incognito</Text>
                <Text style={styles.rowToggleSub}>
                  N'écrit plus l'historique de lecture ni les recherches récentes.
                </Text>
              </View>
              <Switch
                value={incognito}
                onValueChange={(val) => {
                  void setIncognito(val);
                }}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Verrouillage de l'app</Text>
                <Text style={styles.rowToggleSub}>
                  Code PIN au lancement et au retour arrière-plan. La biométrie
                  nécessite un APK / dev client.
                </Text>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={(val) => {
                  void (async () => {
                    try {
                      if (val && !(await hasStoredPin())) {
                        setPinModalOpen(true);
                        return;
                      }
                      await setAppLockEnabled(val);
                    } catch (error) {
                      Alert.alert(
                        "Verrouillage",
                        error instanceof Error ? error.message : "Impossible d'activer le verrou."
                      );
                    }
                  })();
                }}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={() => setPinModalOpen(true)}
              style={styles.pinRow}
            >
              <IconLock size={14} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.pinRowText, { color: colors.accent }]}>
                Définir / changer le PIN
              </Text>
            </Pressable>

            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Empreinte / Face ID</Text>
                <Text style={styles.rowToggleSub}>
                  Déverrouille sans taper le PIN si le capteur est disponible.
                </Text>
              </View>
              <Switch
                value={appLockBiometric}
                onValueChange={(val) => {
                  void (async () => {
                    try {
                      if (val) {
                        if (!appLockEnabled) {
                          setPinModalOpen(true);
                          return;
                        }
                        const LocalAuth = await import("expo-local-authentication");
                        const ok =
                          (await LocalAuth.hasHardwareAsync()) &&
                          (await LocalAuth.isEnrolledAsync());
                        if (!ok) {
                          Alert.alert(
                            "Empreinte / Face ID",
                            "Aucun capteur inscrit. Utilise un APK / dev client, pas Expo Go."
                          );
                          return;
                        }
                        await setAppLockBiometric(true);
                        return;
                      }
                      await setAppLockBiometric(false);
                    } catch (error) {
                      Alert.alert(
                        "Empreinte / Face ID",
                        error instanceof Error
                          ? error.message
                          : "Impossible de modifier la biométrie."
                      );
                    }
                  })();
                }}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            {/* Anti-capture d'écran (FLAG_SECURE) */}
            <View style={styles.rowToggle}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowToggleTitle}>Bloquer les captures d'écran</Text>
                <Text style={styles.rowToggleSub}>
                  Empêche les screenshots et masque l'aperçu dans le
                  multitâche. Recommandé pour la discrétion.
                </Text>
              </View>
              <Switch
                value={preventCapture}
                onValueChange={setPreventScreenCapture}
                trackColor={{ false: "#28283a", true: colors.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardSectionLabel}>Tags masqués automatiquement</Text>

            {/* Input to add tag */}
            <View style={styles.addTagRow}>
              <TextInput
                value={newTagInput}
                onChangeText={setNewTagInput}
                placeholder="Ajouter un tag (ex: guro, ntr...)"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                style={styles.tagInput}
              />
              <Pressable
                onPress={handleAddTag}
                style={[styles.addTagBtn, { backgroundColor: colors.accent }]}
              >
                <IconPlus size={18} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Quick 1-click suggestions */}
            <Text style={styles.quickSuggestLabel}>Suggestions rapides :</Text>
            <View style={styles.suggestChipsWrap}>
              {QUICK_BLACKLIST_SUGGESTIONS.map((sug) => {
                const isAlready = blacklistedTags.includes(sug);
                return (
                  <Pressable
                    key={sug}
                    onPress={() => (isAlready ? removeTag(sug) : addTag(sug))}
                    style={[
                      styles.suggestChip,
                      isAlready && { backgroundColor: "rgba(255, 71, 87, 0.2)", borderColor: "#ff4757" },
                    ]}
                  >
                    {isAlready ? (
                      <IconCheck size={11} color="#ff4757" strokeWidth={2.5} />
                    ) : (
                      <IconPlus size={11} color="#9ca3af" strokeWidth={2} />
                    )}
                    <Text
                      style={[
                        styles.suggestChipText,
                        isAlready && { color: "#ff4757", fontWeight: "700" },
                      ]}
                    >
                      {sug}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Currently blacklisted chips */}
            <View style={styles.tagsContainer}>
              {blacklistedTags.length === 0 ? (
                <Text style={styles.noTagsText}>
                  Aucun tag exclu. Tous les mangas s'afficheront normalement.
                </Text>
              ) : (
                blacklistedTags.map((tag) => (
                  <View key={tag} style={styles.blackTagChip}>
                    <TagLabel name={tag} color="#ff4757" variant="inline" style={styles.blackTagTextOverride} />
                    <Pressable onPress={() => removeTag(tag)} style={{ padding: 2 }}>
                      <IconX size={13} color="#ff4757" strokeWidth={2} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 6. SAUVEGARDE & RESTAURATION */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <IconDeviceFloppy size={14} color="#a855f7" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Sauvegarde</Text>
          </View>

          <View style={styles.groupCard}>
            <Text style={styles.rowToggleSub}>
              Exportez ou restaurez favoris, tags, packs, historique, filtres et recherches.
              Une copie automatique est écrite chaque jour dans NHAppAndroid/autobackup.
            </Text>

            <CardPressable
              radius={10}
              onPress={async () => {
                const res = await exportBackupToFile();
                if (res.success) {
                  Alert.alert("Sauvegarde générée", res.message || "Fichier JSON créé avec succès.");
                } else {
                  Alert.alert("Erreur", res.message);
                }
              }}
              style={[styles.btnActionRow, { backgroundColor: colors.accent }]}
            >
              <IconCloudDownload size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.btnActionText}>Exporter la sauvegarde</Text>
            </CardPressable>

            <View style={styles.divider} />

            <CardPressable
              radius={10}
              onPress={async () => {
                const res = await restoreBackupFromFile();
                if (res.error === "Import annulé") return;
                if (res.success) {
                  Alert.alert(
                    "Restauration réussie !",
                    `Restauré :\n• ${res.restoredItems.favorites} favoris\n• ${res.restoredItems.tagFavorites} tags\n• ${res.restoredItems.tagCollections} packs\n• ${res.restoredItems.history} historique\n• ${res.restoredItems.blacklist} tags masqués\n• ${res.restoredItems.searchHistory} recherches\n• ${res.restoredItems.libraryCollections} collections\n• ${res.restoredItems.follows} recherches suivies`
                  );
                } else {
                  Alert.alert("Erreur de restauration", res.error);
                }
              }}
              style={[styles.btnActionRow, { backgroundColor: colors.accent }]}
            >
              <IconUpload size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.btnActionText}>Restaurer depuis un fichier</Text>
            </CardPressable>

            <CardPressable
              radius={10}
              onPress={async () => {
                const clip = await Clipboard.getStringAsync();
                if (!clip || !clip.trim().startsWith("{")) {
                  Alert.alert(
                    "Presse-papier vide",
                    "Copiez le JSON de sauvegarde, ou utilisez Restaurer depuis un fichier."
                  );
                  return;
                }
                const res = await restoreBackupFromJson(clip);
                if (res.success) {
                  Alert.alert(
                    "Restauration réussie !",
                    `Restauré :\n• ${res.restoredItems.favorites} favoris\n• ${res.restoredItems.tagFavorites} tags\n• ${res.restoredItems.tagCollections} packs\n• ${res.restoredItems.history} historique\n• ${res.restoredItems.libraryCollections} collections`
                  );
                } else {
                  Alert.alert("Erreur de restauration", res.error);
                }
              }}
              style={[styles.btnActionRow, { backgroundColor: "#1e1e2c", borderColor: "#2f2f44", borderWidth: 1 }]}
            >
              <IconUpload size={16} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.btnActionText, { color: colors.txt }]}>
                Restaurer depuis le presse-papier
              </Text>
            </CardPressable>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 7. RÉSEAU & AVANCÉ */}
        {/* ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <IconWorld size={14} color="#a855f7" strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Réseau</Text>
          </View>

          <View style={styles.groupCard}>
            {/* Mirror status */}
            <View style={styles.mirrorStatusRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowToggleTitle}>Proxy Photon nHentai</Text>
                <Text style={styles.rowToggleSub}>
                  DNS sécurisé DoH pour l'API, Photon pour les images : aucun réglage FAI requis.
                </Text>
              </View>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineBadgeText}>Actif</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* API Keys link */}
            <CardPressable
              radius={10}
              onPress={() => router.push("/api-keys")}
              style={styles.linkRow}
            >
              <IconKey size={16} color="#60a5fa" strokeWidth={2} />
              <Text style={styles.linkRowText}>Clés API</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>

            <View style={styles.divider} />

            <CardPressable
              radius={10}
              onPress={() => {
                const result = sendGlitchTipTestEvent();
                if (result.ok) {
                  Alert.alert(
                    "Test GlitchTip envoyé",
                    "Ouvre Problèmes sur app.glitchtip.com (projet NHapp). L’événement « Test GlitchTip error! » doit apparaître sous 1–2 min."
                  );
                  return;
                }
                Alert.alert("GlitchTip inactif", result.reason ?? "DSN manquant.");
              }}
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel="Envoyer un événement de test à GlitchTip"
            >
              <IconWorld size={16} color={isGlitchTipActive() ? "#52c41a" : "#f59e0b"} strokeWidth={2} />
              <Text style={styles.linkRowText}>Tester GlitchTip</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>

            <View style={styles.divider} />

            {/* Replay Onboarding */}
            <CardPressable
              radius={10}
              onPress={() => {
                resetOnboarding();
                router.replace("/");
              }}
              style={styles.linkRow}
            >
              <IconHelpCircle size={16} color={colors.accent} strokeWidth={2} />
              <Text style={styles.linkRowText}>Revoir l'introduction</Text>
              <IconChevronRight size={16} color="#6b7280" strokeWidth={2} />
            </CardPressable>

            <View style={styles.divider} />

            {/* About */}
            <View style={styles.aboutRow}>
              <Text style={styles.aboutTitle}>{appName}</Text>
              <Text style={styles.aboutVersion}>
                Version {appVersion} · Moteur Natif v2
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modal de connexion */}
      <SignInModal visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
      <PinLockModal
        visible={pinModalOpen}
        title="Code de verrouillage"
        subtitle="4 à 8 chiffres. Requis au lancement et au retour arrière-plan."
        onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => {
          const saved = await setAppLockPin(pin);
          if (saved) {
            try {
              await setAppLockEnabled(true);
            } catch (error) {
              Alert.alert(
                "Verrouillage",
                error instanceof Error ? error.message : "PIN enregistré, activation impossible."
              );
            }
          }
          return saved;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 20,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
  },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#f3f4f6",
    letterSpacing: 0.2,
  },
  groupCard: {
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
  },
  divider: {
    height: 1,
    backgroundColor: "#222232",
    marginVertical: 4,
  },
  rowToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  pinRowText: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowToggleTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#f3f4f6",
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  rowToggleSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
    lineHeight: 15,
  },
  accountHeroCard: {
    backgroundColor: "#161622",
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  accountHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  accountNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  activePill: {
    backgroundColor: "rgba(82, 196, 26, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 9.5,
    color: "#52c41a",
    fontWeight: "700",
  },
  accountMeta: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  accountQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#222232",
  },
  quickActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickActionText: {
    fontSize: 11.5,
    fontWeight: "600",
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  loginPromptCard: {
    backgroundColor: "#161622",
    borderWidth: 1,
    padding: 14,
  },
  loginPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loginPromptTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  loginPromptSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: {
    borderWidth: 2.5,
    borderColor: "#fff",
    transform: [{ scale: 1.15 }],
  },
  hueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  hueText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "700",
  },
  hueBubble: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gridCustomizerWrap: {
    gap: 10,
    marginTop: 4,
  },
  deviceTabs: {
    marginTop: 4,
    flexGrow: 0,
  },
  deviceTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#28283a",
    marginRight: 6,
    backgroundColor: "#12121a",
  },
  deviceTabText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    paddingRight: 3,
  },
  previewContainer: {
    backgroundColor: "#101018",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#252538",
    gap: 8,
  },
  previewHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  previewHeaderLabel: {
    fontSize: 11.5,
    color: "#9ca3af",
    fontWeight: "700",
  },
  previewBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewHeaderBadge: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  previewCard: {
    borderRadius: 10,
    padding: 6,
    gap: 4,
    borderWidth: 1,
    overflow: "hidden",
  },
  previewCoverWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#0d0d14",
  },
  previewCover: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
  },
  previewLangBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  previewLangText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  previewTitle: {
    fontSize: 9.5,
    color: "#f3f4f6",
    fontWeight: "700",
  },
  previewMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewMetaTag: {
    fontSize: 8,
    color: "#93c5fd",
    fontWeight: "600",
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 3,
  },
  previewMetaPages: {
    fontSize: 8,
    color: "#6b7280",
    fontWeight: "600",
  },
  previewFooterNote: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  sliderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    fontSize: 12.5,
    color: "#f3f4f6",
    fontWeight: "700",
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
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: "#12121a",
    borderRadius: 10,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: "#28283a",
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentedText: {
    fontSize: 11.5,
    color: "#9ca3af",
    fontWeight: "600",
    textAlign: "center",
    paddingRight: 3,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  linkRowText: {
    flex: 1,
    fontSize: 13,
    color: "#f3f4f6",
    fontWeight: "600",
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  cacheRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cacheSizeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#faad14",
    marginTop: 2,
  },
  clearCacheBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearCacheText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#ff4757",
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  dangerRowText: {
    fontSize: 13,
    color: "#ff4757",
    fontWeight: "700",
  },
  addTagRow: {
    flexDirection: "row",
    gap: 8,
  },
  tagInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#1c1c28",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#f3f4f6",
    fontSize: 12.5,
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickSuggestLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  suggestChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1c1c28",
    borderColor: "#28283a",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestChipText: {
    fontSize: 11,
    color: "#9ca3af",
    flexShrink: 1,
    minWidth: 0,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  noTagsText: {
    fontSize: 11.5,
    color: "#6b7280",
    fontStyle: "italic",
  },
  blackTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 71, 87, 0.15)",
    borderColor: "rgba(255, 71, 87, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "100%",
    flexShrink: 1,
    minWidth: 0,
  },
  blackTagTextOverride: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  mirrorStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(82, 196, 26, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#52c41a",
  },
  onlineBadgeText: {
    fontSize: 10,
    color: "#52c41a",
    fontWeight: "700",
  },
  aboutRow: {
    gap: 2,
    paddingVertical: 2,
  },
  aboutTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  aboutVersion: {
    fontSize: 10.5,
    color: "#6b7280",
  },
  btnActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 4,
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
});
