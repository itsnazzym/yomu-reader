import React from "react";
import { StyleSheet, View, Text, Pressable, Switch } from "react-native";
import { IconDroplet, IconCheck } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useReaderSettings } from "@/lib/readerSettingsStore";

const SIGNATURE_HUES = [
  { name: "Crimson", hue: 0, color: "#ff4d4f" },
  { name: "Sakura", hue: 320, color: "#f759ab" },
  { name: "Ambre", hue: 45, color: "#ffa940" },
  { name: "Cyan", hue: 160, color: "#13c2c2" },
  { name: "Émeraude", hue: 120, color: "#52c41a" },
  { name: "Violet", hue: 280, color: "#9254de" },
];

export function StepTheme() {
  const { colors, hue, setHue } = useTheme();
  const { settings, updateSettings } = useReaderSettings();

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        <IconDroplet size={30} color={colors.accent} stroke={1.7} />
      </View>

      <Text style={styles.title}>Couleur d'Accent & Thème</Text>
      <Text style={styles.subtitle}>
        Personnalisez la couleur d'ambiance de l'interface. Vos modifications s'appliquent en direct.
      </Text>

      {/* Swatches Grid */}
      <View style={styles.swatchesCard}>
        <Text style={styles.cardLabel}>Teinte principale</Text>
        <View style={styles.swatchesRow}>
          {SIGNATURE_HUES.map((s) => {
            const isSelected = Math.abs(hue - s.hue) < 15;
            return (
              <Pressable
                key={s.hue}
                onPress={() => setHue(s.hue)}
                style={[
                  styles.swatchBtn,
                  { backgroundColor: s.color },
                  isSelected && styles.swatchBtnSelected,
                ]}
              >
                {isSelected && <IconCheck size={16} color="#fff" stroke={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* OLED Mode Card */}
      <View style={styles.toggleCard}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.toggleTitle}>Mode Noir Pur OLED</Text>
          <Text style={styles.toggleSub}>
            Fond 100% noir absolu pour économiser l'énergie sur écran AMOLED.
          </Text>
        </View>
        <Switch
          value={settings.oledMode}
          onValueChange={(val) => updateSettings({ oledMode: val })}
          trackColor={{ false: "#28283a", true: colors.accent }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f3f4f6",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  swatchesCard: {
    width: "100%",
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
  },
  swatchesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  swatchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchBtnSelected: {
    borderWidth: 2.5,
    borderColor: "#fff",
    transform: [{ scale: 1.15 }],
  },
  toggleCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  toggleSub: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
    lineHeight: 15,
  },
});
