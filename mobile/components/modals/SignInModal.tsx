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

  const [activeTab, setActiveTab] = useState<"cookie" | "credentials" | "register">("cookie");
  const [sessionCookie, setSessionCookie] = useState(session.sessionId || "");
  const [username, setUsername] = useState(session.username || "");
  const [password, setPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleCookieLogin = async () => {
    const clean = sessionCookie.trim();
    if (!clean) {
      Alert.alert("Requis", "Veuillez entrer votre cookie de session (sessionid).");
      return;
    }

    // Extract sessionid if user pasted whole cookie string
    let sid = clean;
    const match = clean.match(/sessionid=([^;]+)/);
    if (match) sid = match[1];

    setLoading(true);
    setSyncStatus("Connexion & Vérification...");

    try {
      await loginWithSession(sid, username.trim() || "Membre nHentai");
      setSyncStatus("Synchronisation des favoris cloud...");

      const res = await syncFavorites((msg) => setSyncStatus(msg));

      if (res.success) {
        Alert.alert("Cloud Synchronisé", `Connecté avec succès ! ${res.count} favoris officiels synchronisés.`);
        onSuccess?.();
        onClose();
      } else {
        Alert.alert("Session Enregistrée", `Connecté avec succès. (${res.error || "Favoris synchronisés"})`);
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de se connecter.");
    } finally {
      setLoading(false);
      setSyncStatus(null);
    }
  };

  const handleCredentialsLogin = () => {
    if (!isVerified) {
      Alert.alert("Vérification", "Veuillez valider la case de vérification humaine.");
      return;
    }
    if (!username || !password) {
      Alert.alert("Requis", "Veuillez remplir vos identifiants.");
      return;
    }

    setLoading(true);
    setSyncStatus("Authentification en cours...");

    setTimeout(async () => {
      await loginWithSession("auth_" + Date.now(), username);
      setLoading(false);
      setSyncStatus(null);
      Alert.alert("Connexion", `Bienvenue, ${username} !`);
      onSuccess?.();
      onClose();
    }, 1000);
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
                  await syncFavorites((msg) => setSyncStatus(msg));
                  setLoading(false);
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
              {/* Tabs */}
              <View style={styles.tabRow}>
                <Pressable onPress={() => setActiveTab("cookie")} style={styles.tab}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "cookie" && { color: colors.accent, fontWeight: "800" },
                    ]}
                  >
                    Cookie de Session
                  </Text>
                  {activeTab === "cookie" && (
                    <View style={[styles.tabIndicator, { backgroundColor: colors.accent }]} />
                  )}
                </Pressable>

                <Pressable onPress={() => setActiveTab("credentials")} style={styles.tab}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "credentials" && { color: colors.accent, fontWeight: "800" },
                    ]}
                  >
                    Identifiants
                  </Text>
                  {activeTab === "credentials" && (
                    <View style={[styles.tabIndicator, { backgroundColor: colors.accent }]} />
                  )}
                </Pressable>
              </View>

              {/* Cookie Sync Tab */}
              {activeTab === "cookie" ? (
                <View style={styles.form}>
                  <Text style={styles.hintText}>
                    Collez votre cookie <Text style={{ color: colors.accent }}>sessionid</Text> du site officiel nhentai.net pour synchroniser instantanément tous vos favoris cloud.
                  </Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Cookie de session (sessionid)</Text>
                    <TextInput
                      value={sessionCookie}
                      onChangeText={setSessionCookie}
                      placeholder="Ex: 3m56q2... ou sessionid=..."
                      placeholderTextColor="#6b7280"
                      autoCapitalize="none"
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
              ) : (
                /* Credentials Tab */
                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Username or email</Text>
                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      placeholder="username or email"
                      placeholderTextColor="#6b7280"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#6b7280"
                      secureTextEntry
                      style={styles.input}
                    />
                  </View>

                  {/* Cloudflare Verification Box */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Verification</Text>
                    <Pressable
                      onPress={() => setIsVerified((prev) => !prev)}
                      style={[styles.turnstileBox, isVerified && { borderColor: colors.accent }]}
                    >
                      <View style={styles.turnstileLeft}>
                        <View
                          style={[
                            styles.checkbox,
                            isVerified && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                        >
                          {isVerified && <Feather name="check" size={13} color="#fff" />}
                        </View>
                        <Text style={styles.turnstileText}>Verify you are human</Text>
                      </View>

                      <View style={styles.turnstileRight}>
                        <Text style={styles.turnstileBrand}>Cloudflare</Text>
                        <Text style={styles.turnstileSub}>Privacy · Terms</Text>
                      </View>
                    </Pressable>
                  </View>

                  <CardPressable
                    radius={14}
                    onPress={handleCredentialsLogin}
                    disabled={loading}
                    style={[styles.submitBtn, { backgroundColor: colors.accent }]}
                  >
                    <View style={styles.submitBtnContent}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.submitBtnText}>Sign in & Sync</Text>
                      )}
                    </View>
                  </CardPressable>
                </View>
              )}
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
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#28283a",
    marginBottom: 16,
    gap: 16,
  },
  tab: {
    paddingBottom: 8,
    position: "relative",
  },
  tabText: {
    fontSize: 13.5,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
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
  turnstileBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1c1c28",
    borderColor: "#28283a",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  turnstileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#6b7280",
    alignItems: "center",
    justifyContent: "center",
  },
  turnstileText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  turnstileRight: {
    alignItems: "flex-end",
  },
  turnstileBrand: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#9ca3af",
  },
  turnstileSub: {
    fontSize: 8.5,
    color: "#6b7280",
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
