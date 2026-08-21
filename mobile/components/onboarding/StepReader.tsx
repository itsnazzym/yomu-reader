import React from "react";
import { StyleSheet, View, Text, Pressable, Switch } from "react-native";
import {
  IconEye,
  IconLayoutList,
  IconBook2,
  IconCircleCheck,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useReaderSettings } from "@/lib/readerSettingsStore";

export function StepReader() {
  const { colors } = useTheme();
  const { settings, updateSettings } = useReaderSettings();

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        <IconEye size={30} color={colors.accent} stroke={1.7} />
      </View>

      <Text style={[styles.title, { color: colors.txt }]}>Confort de Lecture</Text>
      <Text style={[styles.subtitle, { color: colors.sub }]}>
        Choisissez votre mode de lecture par défaut. Vous pourrez le changer à tout moment pendant la lecture.
      </Text>

      {/* Two reader mode cards */}
      <View style={styles.modeCardsWrap}>
        <Pressable
          onPress={() => updateSettings({ defaultMode: "webtoon" })}
          style={[
            styles.modeCard,
            { backgroundColor: colors.page, borderColor: colors.tagBg },
            settings.defaultMode === "webtoon" && {
              borderColor: colors.accent,
              backgroundColor: colors.accent + "12",
            },
          ]}
        >
          <View style={styles.modeCardHeader}>
            <IconLayoutList
              size={18}
              color={settings.defaultMode === "webtoon" ? colors.accent : colors.sub}
              stroke={1.8}
            />
            <Text
              style={[
                styles.modeCardTitle,
                { color: settings.defaultMode === "webtoon" ? colors.accent : colors.txt },
              ]}
            >
              Webtoon (Vertical)
            </Text>
            {settings.defaultMode === "webtoon" && (
              <IconCircleCheck size={18} color={colors.accent} stroke={2} style={{ marginLeft: "auto" }} />
            )}
          </View>
          <Text style={[styles.modeCardDesc, { color: colors.sub }]}>
            Défilement vertical continu et fluide, optimisé pour la lecture à une main sur mobile.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => updateSettings({ defaultMode: "pager", defaultDirection: "rtl" })}
          style={[
            styles.modeCard,
            { backgroundColor: colors.page, borderColor: colors.tagBg },
            settings.defaultMode === "pager" && {
              borderColor: colors.accent,
              backgroundColor: colors.accent + "12",
            },
          ]}
        >
          <View style={styles.modeCardHeader}>
            <IconBook2
              size={18}
              color={settings.defaultMode === "pager" ? colors.accent : colors.sub}
              stroke={1.8}
            />
            <Text
              style={[
                styles.modeCardTitle,
                { color: settings.defaultMode === "pager" ? colors.accent : colors.txt },
              ]}
            >
              Manga (Page par page)
            </Text>
            {settings.defaultMode === "pager" && (
              <IconCircleCheck size={18} color={colors.accent} stroke={2} style={{ marginLeft: "auto" }} />
            )}
          </View>
          <Text style={[styles.modeCardDesc, { color: colors.sub }]}>
            Tournage de page de droite à gauche, fidèle aux tomes et éditions imprimées japonaises.
          </Text>
        </Pressable>
      </View>

      {/* Immersion switch */}
      <View style={[styles.toggleCard, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.toggleTitle, { color: colors.txt }]}>Plein écran immersif</Text>
          <Text style={[styles.toggleSub, { color: colors.sub }]}>Masque la barre d'état du téléphone pendant la lecture.</Text>
        </View>
        <Switch
          value={settings.hideStatusBar}
          onValueChange={(val) => updateSettings({ hideStatusBar: val })}
          trackColor={{ false: colors.tagBg, true: colors.accent }}
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
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  modeCardsWrap: {
    width: "100%",
    gap: 8,
  },
  modeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  modeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeCardTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  modeCardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  toggleCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  toggleSub: {
    fontSize: 11,
    marginTop: 2,
  },
});
