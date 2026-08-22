import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  IconBook2,
  IconColumns,
  IconEye,
  IconLayoutList,
  IconSettings,
  IconX,
  IconZoomIn,
} from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useReaderSettings } from "@/lib/readerSettingsStore";
import { SmoothSlider } from "@/components/ui/SmoothSlider";
import { useReduceMotion } from "@/lib/reduceMotion";
import { lightTap } from "@/lib/haptics";

export interface ReaderSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  readMode: "webtoon" | "pager";
  readingDirection: "rtl" | "ltr";
  onReadModeChange: (mode: "webtoon" | "pager") => void;
  onDirectionChange: (direction: "rtl" | "ltr") => void;
}

export function ReaderSettingsPanel({
  visible,
  onClose,
  readMode,
  readingDirection,
  onReadModeChange,
  onDirectionChange,
}: ReaderSettingsPanelProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { settings, updateSettings } = useReaderSettings();
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      slide.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, reduceMotion, slide]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderColor: colors.tagBg,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
              opacity: slide,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <IconSettings size={18} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.title, { color: colors.txt }]}>Réglages lecteur</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fermer les réglages"
            >
              <IconX size={20} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.section, { color: colors.sub }]}>Lecture</Text>
          <View style={styles.row}>
            <Chip
              label="Vertical"
              icon={<IconLayoutList size={14} color={readMode === "webtoon" ? "#fff" : colors.sub} strokeWidth={2} />}
              active={readMode === "webtoon"}
              onPress={() => {
                lightTap();
                onReadModeChange("webtoon");
              }}
            />
            <Chip
              label="Pages"
              icon={<IconBook2 size={14} color={readMode === "pager" ? "#fff" : colors.sub} strokeWidth={2} />}
              active={readMode === "pager"}
              onPress={() => {
                lightTap();
                onReadModeChange("pager");
              }}
            />
            <Chip
              label={readingDirection === "rtl" ? "RTL" : "LTR"}
              active
              onPress={() => {
                lightTap();
                onDirectionChange(readingDirection === "rtl" ? "ltr" : "rtl");
              }}
            />
          </View>

          <Toggle
            title="Double page intelligente"
            subtitle="Associe les pages portrait, laisse les planches seules"
            value={settings.dualPageMode}
            onValueChange={(value) => updateSettings({ dualPageMode: value })}
          />
          <Toggle
            title="Tap des bords pour tourner"
            value={settings.tapToTurnPage}
            onValueChange={(value) => updateSettings({ tapToTurnPage: value })}
          />
          <Toggle
            title="Plein écran immersif"
            value={settings.hideStatusBar}
            onValueChange={(value) => updateSettings({ hideStatusBar: value })}
          />
          <Toggle
            title="Masquer les contrôles automatiquement"
            value={settings.autoHideControls}
            onValueChange={(value) => updateSettings({ autoHideControls: value })}
          />
          <Toggle
            title="Bandeau de miniatures"
            value={settings.showThumbRail}
            onValueChange={(value) => updateSettings({ showThumbRail: value })}
          />

          <Text style={[styles.section, { color: colors.sub }]}>Zoom</Text>
          <Toggle
            title="Pinch-to-zoom"
            value={settings.pinchToZoom}
            onValueChange={(value) => updateSettings({ pinchToZoom: value })}
          />
          <Toggle
            title="Reset zoom au changement de page"
            value={settings.resetZoomOnPageChange}
            onValueChange={(value) => updateSettings({ resetZoomOnPageChange: value })}
          />
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <IconZoomIn size={14} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.toggleTitle, { color: colors.txt }]}>
                Zoom double-tap · {settings.doubleTapZoom.toFixed(1)}×
              </Text>
            </View>
            <SmoothSlider
              min={1.4}
              max={2.6}
              step={0.1}
              value={settings.doubleTapZoom}
              onValueChange={(value) => updateSettings({ doubleTapZoom: Number(value.toFixed(1)) })}
              activeColor={colors.accent}
              thumbColor={colors.accent}
            />
          </View>

          <Text style={[styles.section, { color: colors.sub }]}>Affichage</Text>
          <View style={styles.row}>
            {(["none", "sepia", "night", "invert"] as const).map((filter) => (
              <Chip
                key={filter}
                label={filter === "none" ? "Normal" : filter}
                icon={<IconEye size={13} color={settings.colorFilter === filter ? "#fff" : colors.sub} strokeWidth={2} />}
                active={settings.colorFilter === filter}
                onPress={() => {
                  lightTap();
                  updateSettings({ colorFilter: filter });
                }}
              />
            ))}
          </View>
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <IconColumns size={14} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.toggleTitle, { color: colors.txt }]}>
                Luminosité · {Math.round(settings.readerBrightness * 100)}%
              </Text>
            </View>
            <SmoothSlider
              min={0.4}
              max={1}
              step={0.05}
              value={settings.readerBrightness}
              onValueChange={(value) => updateSettings({ readerBrightness: value })}
              activeColor={colors.accent}
              thumbColor={colors.accent}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : colors.page,
          borderColor: active ? colors.accent : colors.tagBg,
        },
      ]}
    >
      {icon}
      <Text style={[styles.chipText, { color: active ? "#fff" : colors.txt }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Toggle({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggleRow, { borderColor: colors.tagBg }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[styles.toggleTitle, { color: colors.txt }]}>{title}</Text>
        {subtitle ? <Text style={[styles.toggleSub, { color: colors.sub }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.tagBg, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: "86%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "800" },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleTitle: { fontSize: 13, fontWeight: "700" },
  toggleSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  sliderBlock: { marginTop: 8, marginBottom: 4 },
  sliderHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
});
