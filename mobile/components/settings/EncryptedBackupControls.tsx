import React, { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { exportBackupToFile, restoreBackupFromFile } from "@/lib/backupStore";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
export function EncryptedBackupControls() {
  const { colors } = useTheme();
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordRepeat, setBackupPasswordRepeat] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const runEncryptedBackup = async (restore: boolean): Promise<void> => {
    if (backupBusy || backupPassword.length < 12) return;
    if (!restore && backupPassword !== backupPasswordRepeat) { Alert.alert("Mot de passe", "Les deux saisies doivent être identiques."); return; }
    setBackupBusy(true);
    try {
      if (restore) {
        const result = await restoreBackupFromFile({ password: backupPassword });
        Alert.alert(result.success ? "Restauration terminée" : "Restauration", result.error || "Vos données sont restaurées.");
      } else {
        const result = await exportBackupToFile({ password: backupPassword });
        Alert.alert(result.success ? "Sauvegarde protégée" : "Export impossible", result.message || "Conservez le mot de passe pour restaurer ce fichier.");
      }
    } finally { setBackupBusy(false); setBackupPassword(""); setBackupPasswordRepeat(""); }
  };
  return <View>
            <View style={styles.divider} />
            <Text style={styles.rowToggleTitle}>Sauvegarde protégée par mot de passe</Text>
            <Text style={styles.rowToggleSub}>12 caractères minimum. Conservez ce mot de passe : il est indispensable pour restaurer le fichier.</Text>
            <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} value={backupPassword} onChangeText={setBackupPassword} placeholder="Mot de passe de sauvegarde" accessibilityLabel="Mot de passe de sauvegarde" placeholderTextColor={colors.sub} style={[styles.cloudKeyInput, { color: colors.txt, borderColor: colors.tagBg }]} editable={!backupBusy} />
            <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} value={backupPasswordRepeat} onChangeText={setBackupPasswordRepeat} placeholder="Confirmer pour exporter" accessibilityLabel="Confirmer le mot de passe pour exporter" placeholderTextColor={colors.sub} style={[styles.cloudKeyInput, { color: colors.txt, borderColor: colors.tagBg }]} editable={!backupBusy} />
            <CardPressable disabled={backupBusy || backupPassword.length < 12} onPress={() => { void runEncryptedBackup(false); }} style={[styles.btnActionRow, { backgroundColor: colors.accent }]}>
              <ButtonLabel style={styles.btnActionText}>{backupBusy ? "Patientez…" : "Exporter un fichier chiffré"}</ButtonLabel>
            </CardPressable>
            <CardPressable disabled={backupBusy || backupPassword.length < 12} onPress={() => { void runEncryptedBackup(true); }} style={[styles.btnActionRow, { backgroundColor: colors.page }]}>
              <ButtonLabel style={{ color: colors.txt }}>Restaurer un fichier chiffré</ButtonLabel>
            </CardPressable>
  </View>;
}
const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: "#28283a", marginVertical: 12 },
  rowToggleTitle: { fontSize: 14, fontWeight: "600", color: "#f1f1f5" },
  rowToggleSub: { fontSize: 12, color: "#a2a2b4", lineHeight: 18, marginVertical: 6 },
  cloudKeyInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 10 },
  btnActionRow: { padding: 13, borderRadius: 10, marginTop: 10, alignItems: "center" },
  btnActionText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
