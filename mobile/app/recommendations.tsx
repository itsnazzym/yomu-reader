import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Easing,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  IconBookmark,
  IconBook2,
  IconSearch,
  IconStar,
  IconChevronRight,
  IconRefresh,
  IconInfoCircle,
  IconAlertCircle,
  IconBolt,
  IconCompass,
  IconInbox,
  IconWifiOff,
  IconArrowLeft,
  IconAdjustmentsHorizontal,
  IconCpu,
  IconX,
  IconShield,
} from "@tabler/icons-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { lightTap } from "@/lib/haptics";
import { BookCard } from "@/components/BookCard";
import { CardPressable } from "@/components/ui/CardPressable";
import { Gallery } from "@/lib/api/types";
import {
  generateRecommendations,
  clearRecommendationCache,
  getCachedRecommendations,
  RecommendationResult,
} from "@/lib/recommendationEngine";

const sourceLabels: Record<string, string> = {
  fav: "favori",
  history: "lecture",
  search: "recherche",
};

// Distance de sortie du panneau : une translation d'une hauteur d'écran
// garantit qu'il disparaît complètement pendant l'animation de fermeture.
const SHEET_SLIDE_DISTANCE = Dimensions.get("window").height;

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [result, setResult] = useState<RecommendationResult | null>(
    getCachedRecommendations()
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  // Slide du panneau piloté par Animated : la navigation s'effectue dans le
  // callback de fin d'animation (timing exact, plus de durée approximative).
  const sheetY = useRef(new Animated.Value(SHEET_SLIDE_DISTANCE)).current;
  // Fondu du fond (overlay), synchronisé avec le slide du panneau.
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const numColumns = width >= 600 ? 3 : 2;
  const horizontalPadding = 12;
  const cardGap = 10;
  const cardWidth = Math.floor(
    (width - horizontalPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const books = useMemo(() => result?.books || [], [result]);
  const profile = result?.profile;
  const topTags = useMemo(() => profile?.tags.slice(0, 8) || [], [profile]);
  const isColdStart = Boolean(result && books.length === 0 && !profile?.hasSignals);

  const loadRecommendations = useCallback(
    async (isRefresh = false) => {
      if (loading || refreshing) return;

      if (isRefresh) {
        setRefreshing(true);
        clearRecommendationCache();
      } else {
        setLoading(true);
      }
      setError(null);
      setProgressMsg("");

      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      try {
        const nextResult = await generateRecommendations((message) =>
          setProgressMsg(message)
        );
        setResult(nextResult);
      } catch (err: any) {
        console.error("Recommendation error:", err);
        setError(err?.message || "Impossible de charger les recommandations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setProgressMsg("");
        spinAnim.stopAnimation();
        spinAnim.setValue(0);
      }
    },
    [loading, refreshing, spinAnim]
  );

  useEffect(() => {
    if (!result) {
      void loadRecommendations();
    }
  }, [result, loadRecommendations]);

  // Ouvre le panneau : slide de bas en haut + fondu du fond, en parallèle.
  const openSheet = useCallback(() => {
    sheetY.setValue(SHEET_SLIDE_DISTANCE);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetY, overlayOpacity]);

  // Ferme le panneau : slide + fondu du fond en parallèle, puis exécute
  // onAnimationEnd (callback de fin) — la navigation démarre exactement quand
  // les deux animations sont terminées.
  const closeSheet = useCallback((onAnimationEnd?: () => void) => {
    sheetY.stopAnimation();
    overlayOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: SHEET_SLIDE_DISTANCE,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onAnimationEnd?.();
    });
  }, [sheetY, overlayOpacity]);

  // Animation d'entrée à chaque ouverture du panneau.
  useEffect(() => {
    if (modalVisible) openSheet();
  }, [modalVisible, openSheet]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const renderItem = ({ item }: { item: Gallery }) => (
    <View style={{ width: cardWidth }}>
      <BookCard gallery={item} cardWidth={cardWidth} />
    </View>
  );

  const openTermSearch = (name: string, type?: string) => {
    lightTap();

    const navigate = () => {
      router.push({
        pathname: "/",
        params: type ? { tag: name, type } : { tag: name },
      });
    };

    // Depuis le panneau, navigue dans le callback de fin de l'animation de
    // fermeture (timing exact). Depuis les chips (panneau déjà fermé),
    // navigue immédiatement.
    if (modalVisible) {
      closeSheet(() => {
        setModalVisible(false);
        navigate();
      });
    } else {
      navigate();
    }
  };

  const renderStats = () => (
    <View style={styles.statsGrid}>
      <View style={styles.statItem}>
        <IconBookmark size={14} color={colors.accent} stroke={2} />
        <Text style={[styles.statValue, { color: colors.txt }]}>
          {profile?.totalFavorites || 0}
        </Text>
        <Text style={[styles.statLabel, { color: colors.sub }]}>favoris</Text>
      </View>
      <View style={styles.statItem}>
        <IconBook2 size={14} color="#8b9cf6" stroke={1.8} />
        <Text style={[styles.statValue, { color: colors.txt }]}>
          {profile?.totalHistory || 0}
        </Text>
        <Text style={[styles.statLabel, { color: colors.sub }]}>lus</Text>
      </View>
      <View style={styles.statItem}>
        <IconSearch size={14} color="#e6a86b" stroke={2} />
        <Text style={[styles.statValue, { color: colors.txt }]}>
          {profile?.totalSearches || 0}
        </Text>
        <Text style={[styles.statLabel, { color: colors.sub }]}>recherches</Text>
      </View>
    </View>
  );

  const renderIntro = () => (
    <View>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.page, borderColor: colors.tagBg },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accent + "22" }]}>
            <IconStar size={20} color={colors.accent} stroke={1.8} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroEyebrow, { color: colors.accent }]}>POUR VOUS</Text>
            <Text style={[styles.heroTitle, { color: colors.txt }]}>Une sélection qui vous ressemble</Text>
          </View>
          <View style={[styles.heroCount, { backgroundColor: colors.tagBg }]}>
            <Text style={[styles.heroCountText, { color: colors.txt }]}>{books.length}</Text>
            <Text style={[styles.heroCountLabel, { color: colors.sub }]}>suggestions</Text>
          </View>
        </View>

        <Text style={[styles.heroDescription, { color: colors.sub }]}> 
          Le moteur croise vos favoris, vos lectures et vos recherches pour trouver les prochaines galeries à découvrir.
        </Text>

        {renderStats()}

        {topTags.length > 0 && (
          <View style={styles.preferenceSection}>
            <View style={styles.preferenceHeader}>
              <Text style={[styles.preferenceTitle, { color: colors.txt }]}>Vos goûts dominants</Text>
              <Text style={[styles.preferenceHint, { color: colors.sub }]}>appuyez pour explorer</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.preferenceScroll}
            >
              {topTags.map((tag) => (
                <CardPressable
                  key={tag.name}
                  radius={9}
                  variant="chip"
                  activeOpacity={0.9}
                  onPress={() => openTermSearch(tag.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechercher ${tag.name}`}
                  style={[
                    styles.preferenceChip,
                    { backgroundColor: colors.tagBg, borderColor: colors.tagBg },
                  ]}
                >
                  <Text style={[styles.preferenceChipText, { color: colors.tagText }]} numberOfLines={1}>
                    {tag.name}
                  </Text>
                  {tag.count > 0 && (
                    <Text style={[styles.preferenceChipScore, { color: colors.accent }]}>
                      {formatCount(tag.count)}
                    </Text>
                  )}
                  <IconChevronRight size={11} color={colors.sub} stroke={2} style={styles.preferenceChipChevron} />
                </CardPressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.heroActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => void loadRecommendations(true)}
            disabled={loading || refreshing}
            accessibilityRole="button"
            accessibilityLabel="Actualiser les recommandations"
            style={[styles.heroRefreshButton, { backgroundColor: colors.accent }]}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconRefresh size={14} color="#fff" stroke={2} />
            </Animated.View>
            <Text style={styles.heroRefreshText}>Actualiser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
            accessibilityRole="button"
            style={[styles.heroInfoButton, { borderColor: colors.tagBg }]}
          >
            <IconInfoCircle size={14} color={colors.accent} stroke={2} />
            <Text style={[styles.heroInfoText, { color: colors.txt }]}>Comment ça marche ?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && result && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: "rgba(255,71,87,0.10)", borderColor: "rgba(255,71,87,0.28)" },
          ]}
        >
          <IconAlertCircle size={16} color="#ff6b78" stroke={2} />
          <Text style={styles.errorBannerText} numberOfLines={2}>{error}</Text>
          <TouchableOpacity onPress={() => void loadRecommendations(true)} disabled={refreshing}>
            <Text style={styles.errorRetryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {books.length > 0 && (
        <View style={styles.resultsHeading}>
          <View>
            <Text style={[styles.resultsTitle, { color: colors.txt }]}>À découvrir</Text>
            <Text style={[styles.resultsSubtitle, { color: colors.sub }]}>Classées par affinité avec votre profil</Text>
          </View>
          <View style={[styles.resultBadge, { backgroundColor: colors.accent + "22" }]}>
            <IconBolt size={12} color={colors.accent} stroke={2} />
            <Text style={[styles.resultBadgeText, { color: colors.accent }]}>PERSONNALISÉ</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadRecommendations(true)}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      contentContainerStyle={[
        styles.emptyScroll,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      {renderIntro()}
      <View style={[styles.emptyCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}> 
        <View style={[styles.emptyIcon, { backgroundColor: colors.tagBg }]}> 
          {isColdStart ? (
            <IconCompass size={24} color={colors.accent} stroke={1.8} />
          ) : (
            <IconInbox size={24} color={colors.accent} stroke={1.8} />
          )}
        </View>
        <Text style={[styles.emptyTitle, { color: colors.txt }]}> 
          {isColdStart ? "Votre profil commence ici" : "Pas encore de nouvelle suggestion"}
        </Text>
        <Text style={[styles.emptySub, { color: colors.sub }]}> 
          {isColdStart
            ? "Ajoutez des favoris, lisez quelques galeries ou lancez une recherche : le moteur apprendra vos préférences directement sur cet appareil."
            : "Vos favoris et votre historique ont déjà été exclus. Actualisez pour explorer une nouvelle page de résultats."}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => (isColdStart ? router.push("/") : void loadRecommendations(true))}
          style={[styles.emptyAction, { backgroundColor: colors.accent }]}
        >
          {isColdStart ? (
            <IconCompass size={15} color="#fff" stroke={2} />
          ) : (
            <IconRefresh size={15} color="#fff" stroke={2} />
          )}
          <Text style={styles.emptyActionText}>{isColdStart ? "Explorer les mangas" : "Chercher d'autres idées"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderInitialError = () => (
    <View style={styles.centerContainer}>
      <View style={[styles.errorIcon, { backgroundColor: "rgba(255,71,87,0.12)" }]}> 
        <IconWifiOff size={26} color="#ff6b78" stroke={1.8} />
      </View>
      <Text style={[styles.errorTitle, { color: colors.txt }]}>Connexion impossible</Text>
      <Text style={[styles.errorSub, { color: colors.sub }]}>{error}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => void loadRecommendations()}
        style={[styles.retryButton, { backgroundColor: colors.accent }]}
      >
        <IconRefresh size={15} color="#fff" stroke={2} />
        <Text style={styles.retryButtonText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}> 
      <View style={[styles.header, { borderBottomColor: colors.tagBg }]}> 
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <IconArrowLeft size={20} color={colors.txt} stroke={2} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.txt }]}>Recommandations</Text>
          <Text style={[styles.headerSubtitle, { color: colors.sub }]}>Moteur personnalisé</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel="Voir le fonctionnement du moteur"
          >
            <IconAdjustmentsHorizontal size={18} color={colors.sub} stroke={1.8} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => void loadRecommendations(true)}
            disabled={loading || refreshing}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel="Actualiser"
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconRefresh size={18} color={colors.accent} stroke={2} />
            </Animated.View>
          </TouchableOpacity>
          {books.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.accent + "22" }]}> 
              <Text style={[styles.countText, { color: colors.accent }]}>{books.length}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <View style={[styles.loadingIcon, { backgroundColor: colors.accent + "22" }]}> 
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconCpu size={26} color={colors.accent} stroke={1.8} />
            </Animated.View>
          </View>
          <Text style={[styles.loadingTitle, { color: colors.txt }]}>Analyse de vos préférences…</Text>
          <Text style={[styles.loadingSubtext, { color: colors.sub }]}> 
            {progressMsg || "Construction de votre profil de goûts"}
          </Text>
          <View style={[styles.loadingTrack, { backgroundColor: colors.tagBg }]}> 
            <View style={[styles.loadingFill, { backgroundColor: colors.accent }]} />
          </View>
        </View>
      ) : !result && error ? (
        renderInitialError()
      ) : result && books.length === 0 ? (
        renderEmptyState()
      ) : result ? (
        <FlashList
          data={books}
          renderItem={renderItem}
          estimatedItemSize={275}
          numColumns={numColumns}
          ListHeaderComponent={renderIntro()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadRecommendations(true)}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: 10,
            paddingBottom: insets.bottom + 30,
          }}
          keyExtractor={(item) => String(item.id)}
        />
      ) : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeSheet(() => setModalVisible(false))}
      >
        <View style={styles.modalOverlay}>
          {/* Fond assombri en fondu, synchronisé avec le slide du panneau */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.modalBackdrop,
              { opacity: overlayOpacity },
            ]}
          />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => closeSheet(() => setModalVisible(false))}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.page,
                borderColor: colors.tagBg,
                paddingBottom: insets.bottom + 18,
                transform: [{ translateY: sheetY }],
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.accent + "22" }]}> 
                <IconCpu size={17} color={colors.accent} stroke={1.8} />
              </View>
              <View style={styles.modalHeaderCopy}>
                <Text style={[styles.modalTitle, { color: colors.txt }]}>Votre moteur</Text>
                <Text style={[styles.modalSubtitle, { color: colors.sub }]}>Transparent, local et personnalisable</Text>
              </View>
              <TouchableOpacity
                onPress={() => closeSheet(() => setModalVisible(false))}
                style={styles.closeButton}
              >
                <IconX size={19} color={colors.sub} stroke={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sectionLabel, { color: colors.sub }]}>DONNÉES UTILISÉES</Text>
              <View style={[styles.dataCard, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}> 
                <View style={styles.dataRow}>
                  <View style={styles.dataLabelWrap}>
                    <IconBookmark size={14} color={colors.accent} stroke={2} />
                    <Text style={[styles.dataLabel, { color: colors.txt }]}>Favoris locaux</Text>
                  </View>
                  <Text style={[styles.dataValue, { color: colors.accent }]}>{profile?.totalFavorites || 0}</Text>
                </View>
                <View style={styles.dataRow}>
                  <View style={styles.dataLabelWrap}>
                    <IconBook2 size={14} color="#8b9cf6" stroke={1.8} />
                    <Text style={[styles.dataLabel, { color: colors.txt }]}>Historique de lecture</Text>
                  </View>
                  <Text style={[styles.dataValue, { color: colors.accent }]}>{profile?.totalHistory || 0}</Text>
                </View>
                <View style={styles.dataRow}>
                  <View style={styles.dataLabelWrap}>
                    <IconSearch size={14} color="#e6a86b" stroke={2} />
                    <Text style={[styles.dataLabel, { color: colors.txt }]}>Recherches récentes</Text>
                  </View>
                  <Text style={[styles.dataValue, { color: colors.accent }]}>{profile?.totalSearches || 0}</Text>
                </View>
              </View>

              {topTags.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.sub }]}>PRÉFÉRENCES DÉTECTÉES</Text>
                  {topTags.map((tag) => (
                    <CardPressable
                      key={tag.name}
                      radius={8}
                      variant="chip"
                      onPress={() => openTermSearch(tag.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rechercher ${tag.name}`}
                      style={styles.termRow}
                    >
                      <Text style={[styles.termName, { color: colors.txt }]} numberOfLines={1}>{tag.name}</Text>
                      <View style={styles.termRight}>
                        {tag.sources.map((source) => (
                          <View key={source} style={[styles.sourceBadge, { backgroundColor: colors.accent + "22" }]}> 
                            <Text style={[styles.sourceBadgeText, { color: colors.accent }]}>
                              {sourceLabels[source] || source}
                            </Text>
                          </View>
                        ))}
                        <Text style={[styles.termScore, { color: colors.accent }]}>{Math.round(tag.score)}</Text>
                        <IconChevronRight size={12} color={colors.sub} stroke={2} />
                      </View>
                    </CardPressable>
                  ))}
                </View>
              )}

              {profile && profile.artists.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.sub }]}>ARTISTES SUIVIS</Text>
                  {profile.artists.slice(0, 5).map((artist) => (
                    <CardPressable
                      key={artist.name}
                      radius={8}
                      variant="chip"
                      onPress={() => openTermSearch(artist.name, "artist")}
                      accessibilityRole="button"
                      accessibilityLabel={`Rechercher ${artist.name}${
                        artist.count > 0 ? ` (${formatCount(artist.count)} résultats)` : ""
                      }`}
                      style={styles.termRow}
                    >
                      <Text style={[styles.termName, { color: colors.txt }]} numberOfLines={1}>{artist.name}</Text>
                      <View style={styles.termRight}>
                        {artist.sources.map((source) => (
                          <View key={source} style={[styles.sourceBadge, { backgroundColor: colors.accent + "22" }]}>
                            <Text style={[styles.sourceBadgeText, { color: colors.accent }]}>
                              {sourceLabels[source] || source}
                            </Text>
                          </View>
                        ))}
                        {artist.count > 0 && (
                          <Text style={[styles.termCount, { color: colors.sub }]}>
                            {formatCount(artist.count)}
                          </Text>
                        )}
                        <Text style={[styles.termScore, { color: colors.accent }]}>{Math.round(artist.score)}</Text>
                        <IconChevronRight size={12} color={colors.sub} stroke={2} />
                      </View>
                    </CardPressable>
                  ))}
                </View>
              )}

              {profile && profile.parodies.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.sub }]}>PARODIES SUIVIES</Text>
                  {profile.parodies.slice(0, 5).map((parody) => (
                    <CardPressable
                      key={parody.name}
                      radius={8}
                      variant="chip"
                      onPress={() => openTermSearch(parody.name, "parody")}
                      accessibilityRole="button"
                      accessibilityLabel={`Rechercher ${parody.name}`}
                      style={styles.termRow}
                    >
                      <Text style={[styles.termName, { color: colors.txt }]} numberOfLines={1}>{parody.name}</Text>
                      <View style={styles.termRight}>
                        {parody.sources.map((source) => (
                          <View key={source} style={[styles.sourceBadge, { backgroundColor: colors.accent + "22" }]}>
                            <Text style={[styles.sourceBadgeText, { color: colors.accent }]}>
                              {sourceLabels[source] || source}
                            </Text>
                          </View>
                        ))}
                        <Text style={[styles.termScore, { color: colors.accent }]}>{Math.round(parody.score)}</Text>
                        <IconChevronRight size={12} color={colors.sub} stroke={2} />
                      </View>
                    </CardPressable>
                  ))}
                </View>
              )}

              {result && result.queriesUsed.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionLabel, { color: colors.sub }]}>REQUÊTES DE DÉCOUVERTE</Text>
                  <View style={[styles.queryBox, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}> 
                    {result.queriesUsed.map((query, index) => (
                      <Text key={`${query}-${index}`} style={[styles.queryLine, { color: colors.sub }]} numberOfLines={1}>
                        <Text style={{ color: colors.accent }}>→ </Text>{query}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              <View style={[styles.noteBox, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "30" }]}> 
                <IconShield size={15} color={colors.accent} stroke={2} />
                <Text style={[styles.noteText, { color: colors.sub }]}> 
                  Vos données restent sur l’appareil. Le moteur pondère les favoris, la récence des lectures et les recherches, exclut ce que vous avez déjà vu, puis ajoute un peu de popularité pour départager les résultats.
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: 0.1 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerAction: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
  countBadge: { minWidth: 28, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, alignItems: "center" },
  countText: { fontSize: 12, fontWeight: "900" },

  heroCard: { marginHorizontal: 2, padding: 15, borderRadius: 18, borderWidth: 1 },
  heroTopRow: { flexDirection: "row", alignItems: "center" },
  heroIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 11 },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginBottom: 3 },
  heroTitle: { fontSize: 15, lineHeight: 19, fontWeight: "800" },
  heroCount: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, marginLeft: 8 },
  heroCountText: { fontSize: 17, fontWeight: "900", lineHeight: 19 },
  heroCountLabel: { fontSize: 8.5, marginTop: 1 },
  heroDescription: { fontSize: 12, lineHeight: 17, marginTop: 13 },
  statsGrid: { flexDirection: "row", gap: 8, marginTop: 14 },
  statItem: { flex: 1, minHeight: 51, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.035)" },
  statValue: { fontSize: 15, fontWeight: "900", marginTop: 3 },
  statLabel: { fontSize: 9.5, marginTop: 1 },
  preferenceSection: { marginTop: 15 },
  preferenceHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  preferenceTitle: { fontSize: 12, fontWeight: "800" },
  preferenceHint: { fontSize: 9.5 },
  preferenceScroll: { gap: 6, paddingRight: 4 },
  preferenceChip: { maxWidth: 150, flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  preferenceChipText: { maxWidth: 112, fontSize: 10.5, fontWeight: "700" },
  preferenceChipScore: { fontSize: 9, fontWeight: "900", marginLeft: 7 },
  preferenceChipChevron: { marginLeft: 5 },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 15 },
  heroRefreshButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, minHeight: 38, borderRadius: 11 },
  heroRefreshText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  heroInfoButton: { flex: 1.55, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, minHeight: 38, borderRadius: 11, borderWidth: 1 },
  heroInfoText: { fontSize: 11.5, fontWeight: "700" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 2, marginTop: 10, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 11, borderWidth: 1 },
  errorBannerText: { flex: 1, color: "#ff9da6", fontSize: 11, lineHeight: 15 },
  errorRetryText: { color: "#ff9da6", fontSize: 11, fontWeight: "800" },
  resultsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 3, marginTop: 18, marginBottom: 2 },
  resultsTitle: { fontSize: 16, fontWeight: "900" },
  resultsSubtitle: { fontSize: 10.5, marginTop: 2 },
  resultBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7 },
  resultBadgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },

  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingIcon: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  loadingTitle: { fontSize: 16, fontWeight: "800", marginTop: 17 },
  loadingSubtext: { fontSize: 12, marginTop: 6, textAlign: "center" },
  loadingTrack: { width: 190, height: 4, borderRadius: 2, marginTop: 18, overflow: "hidden" },
  loadingFill: { width: "58%", height: "100%", borderRadius: 2 },
  errorIcon: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontSize: 16, fontWeight: "800", marginTop: 16 },
  errorSub: { fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "center", maxWidth: 300 },
  retryButton: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 19, paddingHorizontal: 19, paddingVertical: 11, borderRadius: 13 },
  retryButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  emptyScroll: { paddingHorizontal: 12, paddingTop: 10 },
  emptyCard: { alignItems: "center", marginTop: 12, paddingHorizontal: 24, paddingVertical: 25, borderRadius: 18, borderWidth: 1 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 15 },
  emptySub: { fontSize: 12.5, lineHeight: 19, textAlign: "center", marginTop: 8, maxWidth: 310 },
  emptyAction: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 19, paddingHorizontal: 17, paddingVertical: 11, borderRadius: 12 },
  emptyActionText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.62)" },
  modalSheet: { maxHeight: "88%", borderTopLeftRadius: 23, borderTopRightRadius: 23, borderWidth: 1 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#4b4b5c", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 19, paddingVertical: 14 },
  modalIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 10 },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 10.5, marginTop: 2 },
  closeButton: { padding: 6 },
  modalBody: { paddingHorizontal: 19 },
  modalBodyContent: { paddingBottom: 12 },
  sectionLabel: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1, marginBottom: 9 },
  dataCard: { borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  dataRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 29 },
  dataLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  dataLabel: { fontSize: 12.5, fontWeight: "600" },
  dataValue: { fontSize: 13, fontWeight: "900" },
  modalSection: { marginTop: 19 },
  termRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  termName: { flex: 1, fontSize: 12.5, fontWeight: "600", paddingRight: 8 },
  termRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  sourceBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  sourceBadgeText: { fontSize: 8.5, fontWeight: "800" },
  termScore: { minWidth: 24, fontSize: 11, fontWeight: "900", textAlign: "right" },
  termCount: { fontSize: 10.5, fontWeight: "800" },
  queryBox: { borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 5 },
  queryLine: { fontSize: 11, fontFamily: "monospace" },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 20, padding: 12, borderRadius: 11, borderWidth: 1 },
  noteText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
});
