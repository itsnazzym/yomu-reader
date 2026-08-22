import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  IconChevronRight,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useOnboarding } from "@/lib/useOnboarding";
import { StepWelcome } from "./StepWelcome";
import { StepTheme } from "./StepTheme";
import { StepReader } from "./StepReader";
import { StepDownloadFolder } from "./StepDownloadFolder";
import { StepAccount } from "./StepAccount";

export function OnboardingModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isOpen, currentStep, totalSteps, nextStep, prevStep, complete } = useOnboarding();

  if (!isOpen) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.rootOverlay,
        {
          backgroundColor: colors.bg,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[styles.stepIndicator, { color: colors.sub }]}>
            Étape {currentStep + 1} sur {totalSteps}
          </Text>

          {/* Permanent Skip Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={complete}
            style={[styles.skipBtn, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
            accessibilityRole="button"
            accessibilityLabel="Passer la présentation"
          >
            <Text style={[styles.skipBtnText, { color: colors.sub }]}>Passer</Text>
            <IconChevronRight size={14} color={colors.sub} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Progress Segments */}
        <View style={styles.progressSegments}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                {
                  backgroundColor: i <= currentStep ? colors.accent : colors.tagBg,
                },
              ]}
            />
          ))}
        </View>

        {/* Step Content */}
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 0 && <StepWelcome />}
          {currentStep === 1 && <StepTheme />}
          {currentStep === 2 && <StepReader />}
          {currentStep === 3 && <StepDownloadFolder />}
          {currentStep === 4 && <StepAccount onFinish={complete} />}
        </ScrollView>

        {/* Footer Controls */}
        <View style={[styles.footerRow, { borderTopColor: colors.tagBg }]}>
          {currentStep > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={prevStep}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Étape précédente"
            >
              <IconArrowLeft size={16} color={colors.sub} strokeWidth={2} />
              <Text style={[styles.backBtnText, { color: colors.sub }]}>Retour</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={nextStep}
            style={[styles.nextBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={currentStep === totalSteps - 1 ? "Terminer la présentation" : "Continuer"}
          >
            <View style={styles.nextBtnInner}>
              <Text style={styles.nextBtnText}>
                {currentStep === totalSteps - 1 ? "Terminer" : "Continuer"}
              </Text>
              {currentStep === totalSteps - 1 ? (
                <IconCheck size={16} color="#fff" strokeWidth={2.5} />
              ) : (
                <IconArrowRight size={16} color="#fff" strokeWidth={2.5} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootOverlay: {
    zIndex: 99999,
    elevation: 99999,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: "700",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  skipBtnText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "700",
  },
  progressSegments: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 10,
  },
  progressSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  scrollFlex: {
    flex: 1,
  },
  scrollBody: {
    paddingVertical: 12,
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "700",
  },
  nextBtn: {
    borderRadius: 12,
    minWidth: 140,
  },
  nextBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
});
