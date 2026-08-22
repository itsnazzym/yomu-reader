import React, { useState } from "react";
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { IconFolder } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { getSandboxLibraryPath, useDownloadSettings } from "@/lib/downloadSettingsStore";
import { requestDownloadDirectory } from "@/lib/safCopy";
import { useOnboarding } from "@/lib/useOnboarding";

export function FolderPromptModal() {
  const { colors } = useTheme();
  const { settings, ready, folderLabel, updateSettings } = useDownloadSettings();
  const { isOpen: onboardingOpen, isReady: onboardingReady } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const visible =
    ready && onboardingReady && !onboardingOpen && !settings.folderPrompted;

  if (!visible) return null;

  const finish = async (remember: boolean): Promise<void> => {
    await updateSettings({ folderPrompted: true, rememberFolder: remember });
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => void finish(settings.rememberFolder)}>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent + "20" }]}>
            <IconFolder size={28} color={colors.accent} stroke={1.8} />
          </View>
          <Text style={[styles.title, { color: colors.txt }]}>Choisissez votre dossier de téléchargement</Text>
          <Text style={[styles.desc, { color: colors.sub }]}>
            Par défaut : {folderLabel}. Les lectures hors-ligne utilisent toujours le stockage de l'application
            ({getSandboxLibraryPath() || "NHAppAndroid"}). Un dossier choisi reçoit une copie des mangas terminés.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
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
            }}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryText}>Choisir un dossier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void finish(settings.rememberFolder)}
            style={styles.cancel}
          >
            <Text style={[styles.cancelText, { color: colors.sub }]}>Garder l'emplacement par défaut</Text>
          </TouchableOpacity>

          <View style={styles.rememberRow}>
            <Text style={[styles.rememberText, { color: colors.txt }]}>Se souvenir de ce choix</Text>
            <Switch
              value={settings.rememberFolder}
              onValueChange={(value) => {
                void updateSettings({ rememberFolder: value });
              }}
              trackColor={{ false: colors.tagBg, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 13, lineHeight: 18, textAlign: "center", marginBottom: 16 },
  primary: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  cancel: { marginTop: 12, paddingVertical: 8 },
  cancelText: { fontWeight: "700" },
  rememberRow: {
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rememberText: { fontSize: 13, fontWeight: "700" },
});
