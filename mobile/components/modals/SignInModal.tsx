import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { useAccount } from "@/lib/accountStore";

export interface SignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SignInModal({ visible, onClose, onSuccess }: SignInModalProps) {
  const { colors } = useTheme();
  const { loginWithSession, syncFavorites, session, logout } = useAccount();

  const [sessionCookie, setSessionCookie] = useState(session.sessionId || "");
  const [username, setUsername] = useState(session.username || "");
  const [credentialType, setCredentialType] = useState<"refresh" | "apiKey">(
    session.credentialType === "apiKey" ? "apiKey" : "refresh"
  );
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleCookieLogin = async () => {
    const clean = sessionCookie.trim();
    if (!clean) {
      Alert.alert("Requis", "Veuillez coller votre clé API ou votre refresh_token nhentai.net.");
      return;
    }

    setLoading(true);
    setSyncStatus("Connexion & Vérification...");

    try {
      await loginWithSession(clean, username.trim() || "Membre nHentai", credentialType);
      setSyncStatus("Synchronisation des favoris cloud...");

      const res = await syncFavorites((msg) => setSyncStatus(msg));

      if (res.success) {
        Alert.alert("Cloud Synchronisé", `Connecté avec succès ! ${res.count} favoris officiels synchronisés.`);
        onSuccess?.();
        onClose();
      } else {
        Alert.alert(
          "Compte enregistré",
          `Votre credential est enregistré, mais la synchro a échoué : ${res.error || "erreur inconnue"}`
        );
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de se connecter.");
    } finally {
      setLoading(false);
      setSyncStatus(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Feather name="cloud" size={20} color={colors.accent} />
              <Text style={styles.headerTitle}>Compte & Cloud Sync</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#9ca3af" />
            </Pressable>
          </View>

          {/* If already logged in, show status & logout */}
          {session.isLoggedIn ? (
            <View style={styles.loggedInBox}>
              <View style={styles.userRow}>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Feather name="user" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{session.username || "Membre nHentai"}</Text>
                  <Text style={styles.syncMeta}>
                    {session.cloudFavoritesCount || 0} favoris Cloud synchronisés
                  </Text>
                </View>
              </View>

              <CardPressable
                radius={12}
                onPress={async () => {
                  setLoading(true);
                  try {
                    const res = await syncFavorites((msg) => setSyncStatus(msg));
                    if (res.success) {
                      Alert.alert("Cloud Synchronisé", `${res.count} favoris mis à jour avec le compte officiel.`);
                    } else {
                      Alert.alert("Synchronisation impossible", res.error || "Erreur inconnue.");
                    }
                  } finally {
                    setLoading(false);
                    setSyncStatus(null);
                  }
                }}
                disabled={loading}
                style={[styles.syncBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.syncBtnInner}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="refresh-cw" size={16} color="#fff" />
                  )}
                  <Text style={styles.syncBtnText}>
                    {loading ? (syncStatus || "Synchronisation...") : "Synchroniser les favoris maintenant"}
                  </Text>
                </View>
              </CardPressable>

              <Pressable
                onPress={() => {
                  logout();
                  Alert.alert("Déconnexion", "Compte déconnecté.");
                }}
                style={styles.logoutBtn}
              >
                <Text style={styles.logoutBtnText}>Se déconnecter</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.form}>
                <Text style={styles.hintText}>
                  {credentialType === "apiKey"
                    ? "Générez une clé API sur nhentai.net → Réglages du compte → API Keys, puis collez-la ici."
                    : "Collez votre cookie refresh_token nhentai.net (DevTools → Application → Cookies)."}
                </Text>

                <View style={styles.typeRow}>
                  {(
                    [
                      { key: "apiKey", label: "Clé API", icon: "key" },
                      { key: "refresh", label: "refresh_token", icon: "refresh-cw" },
                    ] as const
                  ).map((opt) => (
                    <Pressable
                      key={opt.key}
                      onPress={() => setCredentialType(opt.key)}
                      style={[
                        styles.typeChip,
                        credentialType === opt.key && { borderColor: colors.accent, backgroundColor: "#1c1c28" },
                      ]}
                    >
                      <Feather
                        name={opt.icon}
                        size={14}
                        color={credentialType === opt.key ? colors.accent : "#9ca3af"}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          credentialType === opt.key && { color: colors.accent },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    {credentialType === "apiKey" ? "Clé API nhentai.net" : "refresh_token (cookie officiel)"}
                  </Text>
                  <TextInput
                    value={sessionCookie}
                    onChangeText={setSessionCookie}
                    placeholder={
                      credentialType === "apiKey" ? "Ex: nhk_xxxxxxxxxxxxxxxx" : "Ex: 9f3a2c1b..."
                    }
                    placeholderTextColor="#6b7280"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleCookieLogin}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Pseudo (Optionnel)</Text>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Votre pseudo nHentai"
                    placeholderTextColor="#6b7280"
                    style={styles.input}
                  />
                </View>

                <CardPressable
                  radius={14}
                  onPress={handleCookieLogin}
                  disabled={loading}
                  style={[styles.submitBtn, { backgroundColor: colors.accent }]}
                >
                  <View style={styles.submitBtnContent}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="cloud" size={18} color="#fff" />
                    )}
                    <Text style={styles.submitBtnText}>
                      {loading ? (syncStatus || "Connexion...") : "Connecter & Synchroniser Favoris"}
                    </Text>
                  </View>
                </CardPressable>
              </View>
            </>
          )}

          <Text style={styles.footerNote}>nhentai.net · Cloud Sync v2</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#161622",
    borderColor: "#28283a",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  closeBtn: {
    padding: 4,
  },
  loggedInBox: {
    gap: 14,
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1c1c28",
    padding: 12,
    borderRadius: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  syncMeta: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  syncBtn: {
    borderRadius: 12,
  },
  syncBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  syncBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
  logoutBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  logoutBtnText: {
    color: "#ff4757",
    fontSize: 13,
    fontWeight: "700",
  },
  hintText: {
    fontSize: 11.5,
    color: "#9ca3af",
    lineHeight: 16,
    marginBottom: 10,
  },
  form: {
    gap: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#28283a",
    borderRadius: 12,
  },
  typeChipText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#9ca3af",
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#9ca3af",
  },
  input: {
    backgroundColor: "#1c1c28",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    color: "#f3f4f6",
    fontSize: 13,
  },
  submitBtn: {
    borderRadius: 14,
    marginTop: 6,
  },
  submitBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
  },
  footerNote: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 10.5,
    color: "#6b7280",
  },
});

export default SignInModal;
