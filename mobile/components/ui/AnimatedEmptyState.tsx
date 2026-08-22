import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import {
  IconBookmark,
  IconCloudDownload,
  IconWifiOff,
  IconClock,
  IconSearch,
  IconAlertTriangle,
  IconAlertCircle,
  IconArrowRight,
} from "@tabler/icons-react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/lib/ThemeContext";
import { mediumImpact, selectionTap } from "@/lib/haptics";

export type EmptyStateType =
  | "favorites"
  | "downloads"
  | "offline"
  | "history"
  | "network_error"
  | "error"
  | "search_empty"
  | "search";

interface AnimatedEmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  style?: ViewStyle;
}

const TYPE_CONFIGS: Record<
  EmptyStateType,
  {
    icon: any;
    kanji: string;
    defaultTitle: string;
    defaultDesc: string;
    sealColor: string;
  }
> = {
  favorites: {
    icon: IconBookmark,
    kanji: "愛",
    defaultTitle: "Aucun Favori Enregistré",
    defaultDesc: "Vos mangas coup de cœur apparaîtront ici pour un accès rapide et hors-ligne.",
    sealColor: "#ff4d4f",
  },
  downloads: {
    icon: IconCloudDownload,
    kanji: "庫",
    defaultTitle: "Bibliothèque Hors-Ligne Vide",
    defaultDesc: "Téléchargez des tomes entiers pour les dévorer partout sans connexion.",
    sealColor: "#34c759",
  },
  offline: {
    icon: IconWifiOff,
    kanji: "断",
    defaultTitle: "Connexion Interrompue",
    defaultDesc: "Impossible de joindre le réseau. Vos mangas téléchargés restent disponibles.",
    sealColor: "#faad14",
  },
  history: {
    icon: IconClock,
    kanji: "歴",
    defaultTitle: "Historique Vierge",
    defaultDesc: "Les chapitres et mangas que vous consultez s'afficheront ici automatiquement.",
    sealColor: "#60a5fa",
  },
  search_empty: {
    icon: IconSearch,
    kanji: "無",
    defaultTitle: "Aucun Résultat Trouvé",
    defaultDesc: "Essayez avec d'autres mots-clés, des noms d'artistes ou réduisez vos filtres.",
    sealColor: "#9ca3af",
  },
  search: {
    icon: IconSearch,
    kanji: "探",
    defaultTitle: "Recherche dans les Archives",
    defaultDesc: "Saisissez un titre, un tag (ex: doujinshi), un artiste ou un numéro #ID.",
    sealColor: "#60a5fa",
  },
  network_error: {
    icon: IconAlertTriangle,
    kanji: "障",
    defaultTitle: "Serveur Indisponible",
    defaultDesc: "Le miroir n'a pas répondu. Le proxy tentera automatiquement un itinéraire de secours.",
    sealColor: "#ff4757",
  },
  error: {
    icon: IconAlertCircle,
    kanji: "誤",
    defaultTitle: "Erreur Inattendue",
    defaultDesc: "Une anomalie s'est produite lors du chargement des données.",
    sealColor: "#ff4757",
  },
};

export function AnimatedEmptyState({
  type,
  title,
  description,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  style,
}: AnimatedEmptyStateProps) {
  const { colors } = useTheme();
  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.search_empty;
  const IconComp = config.icon;

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const animatedSealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handleAction = () => {
    mediumImpact();
    onActionPress?.();
  };

  const handleSecondary = () => {
    selectionTap();
    onSecondaryActionPress?.();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Sceau Hanko d'Imprimeur Traditionnel (判子) */}
      <Animated.View style={[styles.sealWrapper, animatedSealStyle]}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          {/* Double anneau d'encre géométrique */}
          <Circle
            cx="48"
            cy="48"
            r="44"
            stroke={config.sealColor}
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity={0.3}
            fill="none"
          />
          <Circle
            cx="48"
            cy="48"
            r="38"
            stroke={config.sealColor}
            strokeWidth="1"
            opacity={0.6}
            fill="none"
          />
          <Rect
            x="24"
            y="24"
            width="48"
            height="48"
            rx="8"
            stroke={config.sealColor}
            strokeWidth="1"
            opacity={0.25}
            fill="none"
          />
        </Svg>

        {/* Kanji & Icône centraux */}
        <View style={styles.sealCenter}>
          <Text style={[styles.kanjiText, { color: config.sealColor }]}>
            {config.kanji}
          </Text>
          <View style={[styles.iconDot, { backgroundColor: config.sealColor + "25" }]}>
            <IconComp size={14} color={config.sealColor} strokeWidth={2} />
          </View>
        </View>
      </Animated.View>

      {/* Typographie Éditoriale */}
      <Text style={styles.titleText}>{title || config.defaultTitle}</Text>
      <Text style={styles.descText}>{description || config.defaultDesc}</Text>

      {/* Actions Tactiles en Dalle de Pierre */}
      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actionsBox}>
          {actionLabel && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAction}
              style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.primaryActionText}>{actionLabel}</Text>
              <IconArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          )}

          {secondaryActionLabel && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSecondary}
              style={styles.secondaryActionBtn}
            >
              <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  sealWrapper: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  sealCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  kanjiText: {
    fontSize: 26,
    fontWeight: "900",
    opacity: 0.85,
    fontFamily: "serif",
    lineHeight: 30,
  },
  iconDot: {
    marginTop: 2,
    padding: 3,
    borderRadius: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f3f4f6",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  descText: {
    fontSize: 12.5,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 290,
  },
  actionsBox: {
    width: "100%",
    maxWidth: 260,
    marginTop: 20,
    gap: 10,
    alignItems: "center",
  },
  primaryActionBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default AnimatedEmptyState;
