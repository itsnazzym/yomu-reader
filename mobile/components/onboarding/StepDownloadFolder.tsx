import React, { useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { IconCircleCheck, IconFolder, IconFolderPlus } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import {
  getSandboxLibraryPath,
  useDownloadSettings,
} from "@/lib/downloadSettingsStore";
import { requestDownloadDirectory } from "@/lib/safCopy";
import { lightTap } from "@/lib/haptics";

export function StepDownloadFolder() {
  const { colors } = useTheme();
  const { settings, folderLabel, updateSettings } = useDownloadSettings();
  const [busy, setBusy] = useState(false);
  const sandboxPath = getSandboxLibraryPath();

  const pickFolder = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    lightTap();
    try {
      const uri = await requestDownloadDirectory();
      if (uri) {
        await updateSettings({
          mode: "saf",
          safDirectoryUri: uri,
          folderPrompted: true,
          rememberFolder: settings.rememberFolder,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const useDefault = async (): Promise<void> => {
    lightTap();
    await updateSettings({
      mode: "app",
      safDirectoryUri: null,
      folderPrompted: true,
      rememberFolder: settings.rememberFolder,
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "35" }]}>
        <IconFolder size={30} color={colors.accent} stroke={1.7} />
      </View>
      <Text style={[styles.title, { color: colors.txt }]}>Choisissez votre dossier de téléchargement</Text>
      <Text style={[styles.subtitle, { color: colors.sub }]}>
        Les fichiers sont d'abord enregistrés dans le stockage privé de l'application, lisible hors-ligne.
        Vous pouvez aussi copier chaque manga terminé vers un dossier de votre choix.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        <Text style={[styles.cardLabel, { color: colors.sub }]}>Emplacement actuel</Text>
        <Text style={[styles.cardValue, { color: colors.txt }]}>{folderLabel}</Text>
        <Text style={[styles.cardPath, { color: colors.sub }]} numberOfLines={2}>
          {settings.mode === "saf" && settings.safDirectoryUri
            ? settings.safDirectoryUri
            : sandboxPath || "documentDirectory/NHAppAndroid"}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => void pickFolder()}
        disabled={busy}
        style={[styles.primary, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Choisir un dossier"
      >
        <IconFolderPlus size={18} color="#fff" stroke={2} />
        <Text style={styles.primaryText}>Choisir un dossier</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => void useDefault()}
        style={[styles.secondary, { borderColor: colors.tagBg, backgroundColor: colors.page }]}
        accessibilityRole="button"
        accessibilityLabel="Utiliser le dossier par défaut"
      >
        {settings.mode === "app" ? <IconCircleCheck size={16} color={colors.accent} stroke={2} /> : null}
        <Text style={[styles.secondaryText, { color: colors.txt }]}>Garder le dossier de l'application</Text>
      </TouchableOpacity>

      <View style={[styles.remember, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.toggleTitle, { color: colors.txt }]}>Se souvenir de ce choix</Text>
          <Text style={[styles.toggleSub, { color: colors.sub }]}>
            Ne plus afficher cette étape aux prochains lancements.
          </Text>
        </View>
        <Switch
          value={settings.rememberFolder}
          onValueChange={(value) => {
            void updateSettings({ rememberFolder: value, folderPrompted: value });
          }}
          trackColor={{ false: colors.tagBg, true: colors.accent }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12, paddingHorizontal: 8 },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 4 },
  card: { width: "100%", borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  cardLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  cardValue: { fontSize: 14, fontWeight: "800" },
  cardPath: { fontSize: 11, lineHeight: 15 },
  primary: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondary: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontWeight: "700", fontSize: 13 },
  remember: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  toggleTitle: { fontSize: 13.5, fontWeight: "700" },
  toggleSub: { fontSize: 11, marginTop: 2 },
});
