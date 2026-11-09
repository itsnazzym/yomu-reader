import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  TouchableOpacity,
  Linking,
} from "react-native";
import {
  IconX,
  IconShieldLock,
  IconKey,
  IconUser,
  IconLock,
  IconCheck,
  IconTrash,
  IconLogin,
  IconWorld,
  IconSparkles,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { lightTap } from "@/lib/haptics";
import {
  getSourceAuth,
  saveSourceAuth,
  clearSourceAuth,
  loginEhentaiWithCookies,
  loginEhentaiWithCredentials,
  loginRule34,
  parseCookieString,
  useSourceAuth,
  type SourceAuthState,
} from "@/lib/sources/authStore";
import type { SourceId } from "@/lib/sources/types";

export interface SourceAuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialSource?: SourceId;
  onOpenNhentaiAuth?: () => void;
}

export function SourceAuthModal({
  visible,
  onClose,
  initialSource = "ehentai",
  onOpenNhentaiAuth,
}: SourceAuthModalProps) {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<SourceId>(initialSource);

  // E-Hentai form state
  const ehentaiAuth = useSourceAuth("ehentai");
  const [ehentaiLoginMode, setEhentaiLoginMode] = useState<"cookies" | "forum">("cookies");
  const [ehentaiUsername, setEhentaiUsername] = useState("");
  const [ehentaiPassword, setEhentaiPassword] = useState("");
  const [rawCookieString, setRawCookieString] = useState("");
  const [ipbMemberId, setIpbMemberId] = useState("");
  const [ipbPassHash, setIpbPassHash] = useState("");
  const [igneousCookie, setIgneousCookie] = useState("");
  const [exhentaiToggle, setExhentaiToggle] = useState(true);

  // Rule34 form state
  const rule34Auth = useSourceAuth("rule34");
  const [rule34UserId, setRule34UserId] = useState("");
  const [rule34ApiKey, setRule34ApiKey] = useState("");

  // Loading & status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialSource === "nhentai" ? "ehentai" : initialSource);
      setErrorMessage(null);
      setSuccessMessage(null);
      if (ehentaiAuth.cookies) {
        setIpbMemberId(ehentaiAuth.cookies.ipb_member_id || "");
        setIpbPassHash(ehentaiAuth.cookies.ipb_pass_hash || "");
        setIgneousCookie(ehentaiAuth.cookies.igneous || "");
        setExhentaiToggle(Boolean(ehentaiAuth.isExHentaiEnabled));
      }
      if (rule34Auth.credentials) {
        setRule34UserId(rule34Auth.credentials.userId || "");
        setRule34ApiKey(rule34Auth.credentials.apiKey || "");
      }
    }
  }, [visible, initialSource, ehentaiAuth, rule34Auth]);

  // Détection automatique lors du collage d'une chaîne complète de cookies
  const handleRawCookiePaste = (text: string) => {
    setRawCookieString(text);
    if (text.includes("=") && text.includes(";")) {
      const parsed = parseCookieString(text);
      if (parsed.ipb_member_id) setIpbMemberId(parsed.ipb_member_id);
      if (parsed.ipb_pass_hash) setIpbPassHash(parsed.ipb_pass_hash);
      if (parsed.igneous) setIgneousCookie(parsed.igneous);
      lightTap();
    }
  };

  const handleEhentaiLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (ehentaiLoginMode === "cookies") {
        await loginEhentaiWithCookies(
          {
            ipb_member_id: ipbMemberId,
            ipb_pass_hash: ipbPassHash,
            igneous: igneousCookie,
          },
          exhentaiToggle
        );
        lightTap();
        setSuccessMessage("Cookies E-Hentai enregistrés avec succès !");
      } else {
        await loginEhentaiWithCredentials(ehentaiUsername, ehentaiPassword);
        lightTap();
        setSuccessMessage("Connexion aux forums E-Hentai réussie !");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEhentaiLogout = async () => {
    Alert.alert(
      "Déconnexion E-Hentai",
      "Voulez-vous effacer les identifiants et cookies E-Hentai de cet appareil ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            await clearSourceAuth("ehentai");
            setIpbMemberId("");
            setIpbPassHash("");
            setIgneousCookie("");
            setRawCookieString("");
            setSuccessMessage("Session E-Hentai déconnectée.");
            lightTap();
          },
        },
      ]
    );
  };

  const handleRule34Login = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await loginRule34(rule34UserId, rule34ApiKey);
      lightTap();
      setSuccessMessage("Compte Rule34 lié avec succès !");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRule34Logout = async () => {
    Alert.alert(
      "Déconnexion Rule34",
      "Voulez-vous retirer vos identifiants Rule34 de cet appareil ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            await clearSourceAuth("rule34");
            setRule34UserId("");
            setRule34ApiKey("");
            setSuccessMessage("Identifiants Rule34 retirés.");
            lightTap();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <View style={[styles.modalCard, { backgroundColor: "#12121a", borderColor: "#222232" }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <IconShieldLock size={20} color={colors.accent} strokeWidth={2} />
                <Text style={[styles.title, { color: colors.txt }]}>Comptes & Sources Isolés</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  lightTap();
                  onClose();
                }}
                style={styles.closeBtn}
              >
                <IconX size={20} color={colors.sub} />
              </TouchableOpacity>
            </View>

            {/* Source Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => {
                  lightTap();
                  setActiveTab("ehentai");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                style={[
                  styles.tabChip,
                  activeTab === "ehentai" && { backgroundColor: "#e63946" },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    activeTab === "ehentai" ? { color: "#fff", fontWeight: "700" } : { color: colors.sub },
                  ]}
                >
                  E-Hentai {ehentaiAuth.isLoggedIn ? "✓" : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  lightTap();
                  setActiveTab("rule34");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                style={[
                  styles.tabChip,
                  activeTab === "rule34" && { backgroundColor: "#7ebd78" },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    activeTab === "rule34" ? { color: "#101018", fontWeight: "700" } : { color: colors.sub },
                  ]}
                >
                  Rule34 {rule34Auth.isLoggedIn ? "✓" : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  lightTap();
                  onClose();
                  onOpenNhentaiAuth?.();
                }}
                style={[styles.tabChip, { backgroundColor: "#1e1e2c" }]}
              >
                <Text style={[styles.tabChipText, { color: colors.txt }]}>nHentai ↗</Text>
              </TouchableOpacity>
            </View>

            {/* Status Messages */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* ────────────────── Onglet E-Hentai ────────────────── */}
              {activeTab === "ehentai" && (
                <View style={styles.sectionWrap}>
                  {/* Status Banner */}
                  <View
                    style={[
                      styles.statusBanner,
                      {
                        backgroundColor: ehentaiAuth.isLoggedIn ? "rgba(46, 213, 115, 0.12)" : "rgba(255, 255, 255, 0.05)",
                        borderColor: ehentaiAuth.isLoggedIn ? "rgba(46, 213, 115, 0.3)" : "#262638",
                      },
                    ]}
                  >
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: ehentaiAuth.isLoggedIn ? "#2ed573" : "#747d8c" },
                        ]}
                      />
                      <Text style={[styles.statusTitle, { color: colors.txt }]}>
                        {ehentaiAuth.isLoggedIn
                          ? `Connecté : ${ehentaiAuth.username || "Compte E-Hentai"}`
                          : "Non connecté (Mode Invité E-Hentai)"}
                      </Text>
                    </View>
                    {ehentaiAuth.isExHentaiEnabled && (
                      <Text style={styles.pandaBadge}>🐼 Mode ExHentai (Panda) Actif</Text>
                    )}
                  </View>

                  {/* Mode switcher (Cookies vs Forum) */}
                  <View style={styles.subModeRow}>
                    <TouchableOpacity
                      onPress={() => setEhentaiLoginMode("cookies")}
                      style={[
                        styles.subModeBtn,
                        ehentaiLoginMode === "cookies" && { backgroundColor: "#252538", borderColor: "#e63946" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subModeText,
                          ehentaiLoginMode === "cookies" ? { color: "#fff", fontWeight: "700" } : { color: colors.sub },
                        ]}
                      >
                        Import de Cookies (JHenTai)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setEhentaiLoginMode("forum")}
                      style={[
                        styles.subModeBtn,
                        ehentaiLoginMode === "forum" && { backgroundColor: "#252538", borderColor: "#e63946" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subModeText,
                          ehentaiLoginMode === "forum" ? { color: "#fff", fontWeight: "700" } : { color: colors.sub },
                        ]}
                      >
                        Identifiants Forum
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {ehentaiLoginMode === "cookies" ? (
                    <View style={styles.inputsBlock}>
                      <Text style={[styles.fieldHint, { color: colors.sub }]}>
                        Collez la chaîne complète de cookies ou saisissez les champs obligatoires (ipb_member_id et ipb_pass_hash) :
                      </Text>

                      <TextInput
                        value={rawCookieString}
                        onChangeText={handleRawCookiePaste}
                        placeholder="Coller cookie complet (ipb_member_id=...; ipb_pass_hash=...)"
                        placeholderTextColor="#666"
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <TextInput
                        value={ipbMemberId}
                        onChangeText={setIpbMemberId}
                        placeholder="ipb_member_id (ex: 1234567)"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                      />

                      <TextInput
                        value={ipbPassHash}
                        onChangeText={setIpbPassHash}
                        placeholder="ipb_pass_hash (32 caractères hexadécimaux)"
                        placeholderTextColor="#666"
                        secureTextEntry
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                      />

                      <TextInput
                        value={igneousCookie}
                        onChangeText={setIgneousCookie}
                        placeholder="igneous (requis pour ExHentai / Panda 🐼)"
                        placeholderTextColor="#666"
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                      />

                      <View style={styles.switchRow}>
                        <Text style={[styles.switchLabel, { color: colors.txt }]}>
                          Activer le routage ExHentai (Panda)
                        </Text>
                        <Switch
                          value={exhentaiToggle}
                          onValueChange={setExhentaiToggle}
                          trackColor={{ false: "#333", true: "#e63946" }}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.inputsBlock}>
                      <Text style={[styles.fieldHint, { color: colors.sub }]}>
                        Connexion directe aux forums IP.Board E-Hentai :
                      </Text>

                      <TextInput
                        value={ehentaiUsername}
                        onChangeText={setEhentaiUsername}
                        placeholder="Nom d'utilisateur forum"
                        placeholderTextColor="#666"
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                        autoCapitalize="none"
                      />

                      <TextInput
                        value={ehentaiPassword}
                        onChangeText={setEhentaiPassword}
                        placeholder="Mot de passe forum"
                        placeholderTextColor="#666"
                        secureTextEntry
                        style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                      />
                    </View>
                  )}

                  {/* Boutons d'action */}
                  <View style={styles.actionBtnsRow}>
                    <CardPressable
                      onPress={handleEhentaiLogin}
                      radius={12}
                      style={[styles.primaryBtn, { backgroundColor: "#e63946" }]}
                    >
                      <View style={styles.btnInner}>
                        {loading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <IconCheck size={18} color="#fff" strokeWidth={2.2} />
                            <ButtonLabel style={styles.btnText}>Enregistrer E-Hentai</ButtonLabel>
                          </>
                        )}
                      </View>
                    </CardPressable>

                    {ehentaiAuth.isLoggedIn && (
                      <CardPressable
                        onPress={handleEhentaiLogout}
                        radius={12}
                        style={[styles.logoutBtn, { borderColor: "#44222a", backgroundColor: "#221217" }]}
                      >
                        <View style={styles.btnInner}>
                          <IconTrash size={16} color="#ff4757" />
                          <ButtonLabel style={[styles.btnText, { color: "#ff4757" }]}>Déconnecter</ButtonLabel>
                        </View>
                      </CardPressable>
                    )}
                  </View>
                </View>
              )}

              {/* ────────────────── Onglet Rule34 ────────────────── */}
              {activeTab === "rule34" && (
                <View style={styles.sectionWrap}>
                  <View
                    style={[
                      styles.statusBanner,
                      {
                        backgroundColor: rule34Auth.isLoggedIn ? "rgba(126, 189, 120, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        borderColor: rule34Auth.isLoggedIn ? "rgba(126, 189, 120, 0.3)" : "#262638",
                      },
                    ]}
                  >
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: rule34Auth.isLoggedIn ? "#7ebd78" : "#747d8c" },
                        ]}
                      />
                      <Text style={[styles.statusTitle, { color: colors.txt }]}>
                        {rule34Auth.isLoggedIn
                          ? `Lié : ${rule34Auth.username || "Compte Rule34"}`
                          : "Non lié (Navigation publique anonyme)"}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.fieldHint, { color: colors.sub }]}>
                    Renseignez votre User ID et votre clé API (obtenue sur votre compte rule34.xxx) pour accéder aux galeries et posts :
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL("https://rule34.xxx/index.php?page=account&s=options")}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
                    activeOpacity={0.7}
                  >
                    <IconWorld size={14} color="#7ebd78" />
                    <Text style={{ color: "#7ebd78", fontSize: 13, textDecorationLine: "underline" }}>
                      Obtenir ma clé API gratuite sur rule34.xxx
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.inputsBlock}>
                    <TextInput
                      value={rule34UserId}
                      onChangeText={setRule34UserId}
                      placeholder="User ID Rule34 (numérique)"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                    />

                    <TextInput
                      value={rule34ApiKey}
                      onChangeText={setRule34ApiKey}
                      placeholder="Clé API Rule34"
                      placeholderTextColor="#666"
                      secureTextEntry
                      style={[styles.input, { color: colors.txt, borderColor: "#2e2e42" }]}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.actionBtnsRow}>
                    <CardPressable
                      onPress={handleRule34Login}
                      radius={12}
                      style={[styles.primaryBtn, { backgroundColor: "#7ebd78" }]}
                    >
                      <View style={styles.btnInner}>
                        {loading ? (
                          <ActivityIndicator size="small" color="#101018" />
                        ) : (
                          <>
                            <IconCheck size={18} color="#101018" strokeWidth={2.4} />
                            <ButtonLabel style={[styles.btnText, { color: "#101018" }]}>Lier Rule34</ButtonLabel>
                          </>
                        )}
                      </View>
                    </CardPressable>

                    {rule34Auth.isLoggedIn && (
                      <CardPressable
                        onPress={handleRule34Logout}
                        radius={12}
                        style={[styles.logoutBtn, { borderColor: "#44222a", backgroundColor: "#221217" }]}
                      >
                        <View style={styles.btnInner}>
                          <IconTrash size={16} color="#ff4757" />
                          <ButtonLabel style={[styles.btnText, { color: "#ff4757" }]}>Retirer</ButtonLabel>
                        </View>
                      </CardPressable>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  keyboardWrap: {
    width: "100%",
    maxWidth: 520,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c28",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a26",
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#181824",
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 20,
  },
  sectionWrap: {
    gap: 16,
  },
  statusBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  pandaBadge: {
    fontSize: 12,
    color: "#ff9f43",
    fontWeight: "600",
    marginLeft: 19,
  },
  subModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  subModeBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#171722",
    borderWidth: 1,
    borderColor: "#242436",
    alignItems: "center",
  },
  subModeText: {
    fontSize: 12,
  },
  inputsBlock: {
    gap: 10,
  },
  fieldHint: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#151520",
    paddingHorizontal: 14,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  actionBtnsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#fff",
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(235, 77, 75, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(235, 77, 75, 0.3)",
  },
  errorText: {
    fontSize: 12.5,
    color: "#ff4757",
  },
  successBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(46, 213, 115, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(46, 213, 115, 0.3)",
  },
  successText: {
    fontSize: 12.5,
    color: "#2ed573",
  },
});
