import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useModalMotion } from "@/components/motion/useModalMotion";
import { useReduceMotion } from "@/lib/reduceMotion";
import { IconX } from "@tabler/icons-react-native";
import { GuideIllustration } from "@/components/auth/GuideIllustration";
import { AUTH_GUIDES, type GuideType } from "@/lib/authGuides";
import { useTheme } from "@/lib/ThemeContext";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lightTap } from "@/lib/haptics";

export type { GuideType } from "@/lib/authGuides";

export interface AuthGuideModalProps {
  visible: boolean;
  guideType: GuideType | null;
  onClose: () => void;
}

export function AuthGuideModal({ visible, guideType, onClose }: AuthGuideModalProps) {
  const { colors } = useTheme();
  const { presented, backdropStyle, cardStyle } = useModalMotion(visible);
  const reduced = useReduceMotion();
  const [lastGuideType, setLastGuideType] = useState(guideType);
  useEffect(() => { if (guideType) setLastGuideType(guideType); }, [guideType]);
  const insets = useSafeAreaInsets();

  const renderedType = guideType || lastGuideType;
  if (!renderedType || !AUTH_GUIDES[renderedType]) return null;
  const guide = AUTH_GUIDES[renderedType];

  return (
    <Modal visible={presented} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.75)" }, backdropStyle]} />
      <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }, cardStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.badge, { backgroundColor: colors.tagBg }]}>
                <Text style={[styles.badgeText, { color: colors.metaText }]}>{guide.sourceLabel}</Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.txt }]}>
                {guide.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                lightTap();
                onClose();
              }}
              style={styles.closeBtn}
              accessibilityLabel="Fermer le guide"
            >
              <IconX size={20} color={colors.sub} />
            </TouchableOpacity>
          </View>

          {/* Contenu */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <GuideIllustration key={renderedType} guide={guide} />

            {/* Étapes numérotées */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.txt }]}>Pas à pas</Text>
              {guide.steps.map((st, i) => (
                <Animated.View key={`${renderedType}:${i}`} style={styles.stepRow}
                  entering={reduced ? undefined : FadeInDown.duration(280).delay(Math.min(i * 45, 180))}>
                  <Text style={[styles.stepNumber, { color: colors.sub }]}>{i + 1}.</Text>
                  <Text style={[styles.stepText, { color: colors.txt }]}>{st}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Conseils & astuces */}
            {guide.tips.length > 0 && (
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>À savoir</Text>
                {guide.tips.map((tp, i) => (
                  <Text key={i} style={styles.tipText}>
                    &bull; {tp}
                  </Text>
                ))}
              </View>
            )}

            {/* Bouton de fermeture */}
            <TouchableOpacity
              onPress={() => {
                lightTap();
                onClose();
              }}
              style={[styles.gotItBtn, { backgroundColor: colors.tagBg }]}
              activeOpacity={0.85}
            >
              <ButtonLabel style={styles.gotItText}>J'ai compris, revenir à la connexion</ButtonLabel>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    height: "92%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e2c",
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  closeBtn: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  stepNumber: { fontSize: 14, lineHeight: 22, minWidth: 18 },
  stepText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 22 },
  tipsBox: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 18,
    marginBottom: 3,
  },
  gotItBtn: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gotItText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
