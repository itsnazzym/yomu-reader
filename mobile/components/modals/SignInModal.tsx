import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  IconCloud,
  IconX,
  IconUser,
  IconRefresh,
  IconKey,
  IconLock,
  IconEye,
  IconEyeOff,
  IconLogin,
  IconShield,
  IconMail,
} from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { useAccount, detectCredentialType } from "@/lib/accountStore";
import { CaptchaEmbed } from "@/components/auth/CaptchaEmbed";
import { AuthPowProgressBar } from "@/components/auth/AuthPowProgressBar";
import {
  getCaptchaInfo,
  getPowChallenge,
  solvePoW,
} from "@/lib/api/v2/config";
import type { PowProgress } from "@/lib/api/v2/config";
import {
  register as v2Register,
  requestPasswordReset as v2Reset,
} from "@/lib/api/v2/auth";
import { ApiError } from "@/lib/api/v2/client";

export interface SignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthMode = "login" | "register" | "reset" | "apikey";

export function SignInModal({ visible, onClose, onSuccess }: SignInModalProps) {
  const { colors } = useTheme();
  const { loginWithCredentials, loginWithSession, syncFavorites, session, logout, fetchUserProfile } = useAccount();

  // Auth Mode
  const [mode, setMode] = useState<AuthMode>("login");

  // Form inputs
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  // Captcha state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInfo, setCaptchaInfo] = useState<{ site_key: string; provider: string } | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  // Status & loading
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [powProgress, setPowProgress] = useState<PowProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Load captcha on open or mode switch
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setErrorMessage(null);
    setResetSuccess(false);
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    setPowProgress(null);

    (async () => {
      try {
        const info = await getCaptchaInfo();
        if (!cancelled && info.site_key) {
          setCaptchaInfo({
            site_key: info.site_key,
            provider: info.provider || "turnstile",
          });
        } else if (!cancelled) {
          setCaptchaInfo(null);
        }
      } catch {
        if (!cancelled) setCaptchaInfo(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  const resetForm = () => {
    setUsernameInput("");
    setEmailInput("");
    setPasswordInput("");
    setPasswordConfirmInput("");
    setApiKeyInput("");
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    setErrorMessage(null);
    setResetSuccess(false);
    setPowProgress(null);
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    resetForm();
  };

  const updateProgress = (message: string, progress?: PowProgress) => {
    setSyncStatus(message);
    setPowProgress(progress ?? null);
  };

  // 1. Direct Login with Credentials & PoW & Captcha
  const handleLogin = async () => {
    const user = usernameInput.trim();
    const pass = passwordInput;
    if (!user || !pass) {
      setErrorMessage("Veuillez saisir votre identifiant et votre mot de passe.");
      return;
    }
    if (captchaInfo?.site_key && !captchaToken) {
      setErrorMessage("Veuillez valider le contrôle de sécurité Captcha ci-dessous.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    updateProgress("Calcul du défi de sécurité (PoW)...");

    try {
      const res = await loginWithCredentials(
        user,
        pass,
        captchaToken || undefined,
        (msg, progress) => updateProgress(msg, progress)
      );

      if (!res.success) {
        setErrorMessage(res.error || "Identifiants incorrects ou rejetés par le serveur.");
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        return;
      }

      updateProgress("Synchronisation des favoris cloud...");
      const syncRes = await syncFavorites((msg) => updateProgress(msg));

      Alert.alert(
        "Connecté !",
        syncRes.success
          ? `Bienvenue ${user} ! ${syncRes.count} favoris officiels synchronisés.`
          : `Bienvenue ${user} ! Connexion validée, mais la synchronisation des favoris a échoué : ${syncRes.error}`
      );
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? String(err.message)
          : err?.message || "Erreur de connexion.";
      setErrorMessage(msg);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
      setSyncStatus(null);
      setPowProgress(null);
    }
  };

  // 2. Register Account
  const handleRegister = async () => {
    const u = usernameInput.trim();
    const em = emailInput.trim();
    const p = passwordInput;
    if (!u || !em || !p) {
      setErrorMessage("Veuillez remplir tous les champs.");
      return;
    }
    if (p !== passwordConfirmInput) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (captchaInfo?.site_key && !captchaToken) {
      setErrorMessage("Veuillez valider le contrôle de sécurité Captcha.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    updateProgress("Calcul du défi de sécurité...");

    try {
      const pow = await getPowChallenge("register");
      updateProgress("Calcul cryptographique...");
      const nonce = await solvePoW(pow.challenge, pow.difficulty, (progress) => {
        updateProgress("Calcul cryptographique...", progress);
      });

      updateProgress("Création du compte...");
      await v2Register({
        username: u,
        email: em,
        password: p,
        pow_challenge: pow.challenge,
        pow_nonce: nonce,
        captcha_response: captchaToken || undefined,
      });

      await fetchUserProfile();
      Alert.alert("Succès", "Votre compte nHentai a été créé avec succès !");
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? String(err.message)
          : err?.message || "Échec de l'inscription.";
      setErrorMessage(msg);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
      setSyncStatus(null);
      setPowProgress(null);
    }
  };

  // 3. Password Reset
  const handleReset = async () => {
    const em = emailInput.trim();
    if (!em) {
      setErrorMessage("Veuillez entrer votre adresse email.");
      return;
    }
    if (captchaInfo?.site_key && !captchaToken) {
      setErrorMessage("Veuillez valider le contrôle de sécurité Captcha.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    updateProgress("Calcul du défi de sécurité...");

    try {
      const pow = await getPowChallenge("reset");
      updateProgress("Calcul cryptographique...");
      const nonce = await solvePoW(pow.challenge, pow.difficulty, (progress) => {
        updateProgress("Calcul cryptographique...", progress);
      });

      updateProgress("Envoi de l'email de réinitialisation...");
      await v2Reset({
        email: em,
        pow_challenge: pow.challenge,
        pow_nonce: nonce,
        captcha_response: captchaToken || undefined,
      });

      resetForm();
      setResetSuccess(true);
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? String(err.message)
          : err?.message || "Échec de la réinitialisation.";
      setErrorMessage(msg);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setLoading(false);
      setSyncStatus(null);
      setPowProgress(null);
    }
  };

  // 4. API Key Login
  const handleApiKeyLogin = async () => {
    const clean = apiKeyInput.trim();
    if (!clean) {
      setErrorMessage("Veuillez coller votre clé API nHentai (nhk_...).");
      return;
    }

    const detected = detectCredentialType(clean);
    setLoading(true);
    setErrorMessage(null);
    updateProgress("Vérification de la clé API...");

    try {
      await loginWithSession(
        detected.credential,
        usernameInput.trim() || "Membre nHentai",
        detected.type
      );

      updateProgress("Synchronisation des favoris cloud...");
      const res = await syncFavorites((msg) => updateProgress(msg));

      Alert.alert(
        "Connecté",
        res.success
          ? `Clé API validée ! ${res.count} favoris synchronisés.`
          : `Clé API validée, mais la synchronisation a échoué : ${res.error}`
      );
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Impossible de se connecter avec cette clé.");
    } finally {
      setLoading(false);
      setSyncStatus(null);
      setPowProgress(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <IconCloud size={20} color={colors.accent} stroke={1.8} />
              <Text style={styles.headerTitle}>Compte nHentai</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.tagBg }]}
              accessibilityRole="button"
              accessibilityLabel="Fermer le compte"
            >
              <IconX size={20} color={colors.sub} stroke={2} />
            </Pressable>
          </View>

          {/* If already logged in */}
          {session.isLoggedIn ? (
            <View style={styles.loggedInBox}>
              <View style={[styles.userRow, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <IconUser size={22} color="#fff" stroke={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{session.username || "Membre nHentai"}</Text>
                  <Text style={styles.syncMeta}>
                    {session.cloudFavoritesCount || 0} favoris Cloud synchronisés
                  </Text>
                  <Text style={styles.typeBadge}>
                    Mode : {session.credentialType === "apiKey" ? "Clé API" : "Session Officielle API v2"}
                  </Text>
                </View>
              </View>

              <CardPressable
                radius={12}
                onPress={async () => {
                  setLoading(true);
                  try {
                    updateProgress("Synchronisation des favoris cloud...");
                    const res = await syncFavorites((msg) => updateProgress(msg));
                    if (res.success) {
                      Alert.alert("Cloud Synchronisé", `${res.count} favoris mis à jour avec le compte officiel.`);
                    } else {
                      Alert.alert("Synchronisation impossible", res.error || "Erreur inconnue.");
                    }
                  } finally {
                    setLoading(false);
                    setSyncStatus(null);
                    setPowProgress(null);
                  }
                }}
                disabled={loading}
                style={[styles.syncBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.syncBtnInner}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconRefresh size={16} color="#fff" stroke={2} />
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
                style={[styles.logoutBtn, { backgroundColor: colors.tagBg }]}
                accessibilityRole="button"
                accessibilityLabel="Se déconnecter"
              >
                <Text style={styles.logoutBtnText}>Se déconnecter</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
            >
              {/* Navigation tabs */}
              <View style={[styles.tabContainer, { backgroundColor: colors.bg }]}>
                {(["login", "register", "reset", "apikey"] as AuthMode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    style={[
                      styles.tabBtn,
                      mode === m && { backgroundColor: colors.accent + "26", borderColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: mode === m ? colors.txt : colors.sub },
                        mode === m && { fontWeight: "800" },
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: mode === m }}
                      accessibilityLabel={
                        m === "login"
                          ? "Connexion"
                          : m === "register"
                            ? "Inscription"
                            : m === "reset"
                              ? "Réinitialisation du mot de passe"
                              : "Connexion par clé API"
                      }
                    >
                      {m === "login"
                        ? "Connexion"
                        : m === "register"
                          ? "Inscription"
                          : m === "reset"
                            ? "Oubli"
                            : "Clé API"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {resetSuccess && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    Un email de réinitialisation a été envoyé si l'adresse existe.
                  </Text>
                </View>
              )}

              {/* Form Inputs based on mode */}
              {mode !== "reset" && mode !== "apikey" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Identifiant</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                    <IconUser size={16} color="#9ca3af" stroke={1.8} />
                    <TextInput
                      value={usernameInput}
                      onChangeText={setUsernameInput}
                      placeholder="Nom d'utilisateur"
                      placeholderTextColor="#6b7280"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              {(mode === "register" || mode === "reset") && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Adresse Email</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                    <IconMail size={16} color="#9ca3af" stroke={1.8} />
                    <TextInput
                      value={emailInput}
                      onChangeText={setEmailInput}
                      placeholder="votre.email@domaine.com"
                      placeholderTextColor="#6b7280"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              {mode !== "reset" && mode !== "apikey" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mot de passe</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                    <IconLock size={16} color="#9ca3af" stroke={1.8} />
                    <TextInput
                      value={passwordInput}
                      onChangeText={setPasswordInput}
                      placeholder="••••••••"
                      placeholderTextColor="#6b7280"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                    />
                    <Pressable
                      onPress={() => setShowPassword((p) => !p)}
                      style={styles.eyeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <IconEyeOff size={16} color="#9ca3af" stroke={1.8} />
                      ) : (
                        <IconEye size={16} color="#9ca3af" stroke={1.8} />
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {mode === "register" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                    <IconLock size={16} color="#9ca3af" stroke={1.8} />
                    <TextInput
                      value={passwordConfirmInput}
                      onChangeText={setPasswordConfirmInput}
                      placeholder="••••••••"
                      placeholderTextColor="#6b7280"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              {mode === "apikey" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Clé API nHentai (nhk_...)</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.bg, borderColor: colors.tagBg }]}>
                    <IconKey size={16} color="#9ca3af" stroke={1.8} />
                    <TextInput
                      value={apiKeyInput}
                      onChangeText={setApiKeyInput}
                      placeholder="nhk_xxxxxxxxxxxxxxxxxxxx"
                      placeholderTextColor="#6b7280"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      try {
                        Linking.openURL("https://nhentai.net/api/v2/user/keys");
                      } catch {}
                    }}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={{ fontSize: 11, color: colors.accent }}>
                      Générer une clé sur nhentai.net/api/v2/user/keys ↗
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Captcha Block for Web / v2 endpoints */}
              {mode !== "apikey" && captchaInfo?.site_key && (
                <View style={styles.captchaSection}>
                  <View style={styles.captchaHeader}>
                    <IconShield size={14} color={colors.accent} stroke={2} />
                    <Text style={styles.captchaTitle}>
                      Contrôle de sécurité ({captchaInfo.provider === "hcaptcha" ? "hCaptcha" : "Turnstile"})
                    </Text>
                  </View>
                  <CaptchaEmbed
                    siteKey={captchaInfo.site_key}
                    provider={captchaInfo.provider}
                    resetKey={captchaKey}
                    onToken={(tok) => {
                      setCaptchaToken(tok);
                      setErrorMessage(null);
                    }}
                    onClear={() => setCaptchaToken(null)}
                    accent={colors.accent}
                  />
                  {captchaToken ? (
                    <Text style={styles.captchaVerified}>✓ Défi de sécurité validé</Text>
                  ) : null}
                </View>
              )}

              {/* Live status / progress / error */}
              {syncStatus &&
                (powProgress ? (
                  <AuthPowProgressBar progress={powProgress} accent={colors.accent} />
                ) : (
                  <View style={[styles.statusBox, { backgroundColor: colors.tagBg }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.statusText}>{syncStatus}</Text>
                  </View>
                ))}

              {errorMessage && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Submit CTA */}
              <CardPressable
                radius={12}
                onPress={() => {
                  if (mode === "login") handleLogin();
                  else if (mode === "register") handleRegister();
                  else if (mode === "reset") handleReset();
                  else if (mode === "apikey") handleApiKeyLogin();
                }}
                disabled={loading}
                style={[styles.submitBtn, { backgroundColor: colors.accent }]}
              >
                <View style={styles.submitBtnInner}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconLogin size={18} color="#fff" stroke={2} />
                  )}
                  <Text style={styles.submitBtnText}>
                    {loading
                      ? "Traitement en cours..."
                      : mode === "login"
                        ? "Se connecter"
                        : mode === "register"
                          ? "Créer mon compte"
                          : mode === "reset"
                            ? "Réinitialiser"
                            : "Valider la clé"}
                  </Text>
                </View>
              </CardPressable>

              <Text style={styles.officialFootnote}>
                nHentai · API v2 Officielle · Authentification sécurisée
              </Text>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "92%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    gap: 4,
    marginBottom: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d1d5db",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  input: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 14,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  captchaSection: {
    marginTop: 4,
    gap: 6,
  },
  captchaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  captchaTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d1d5db",
  },
  captchaVerified: {
    fontSize: 12,
    color: "#52c41a",
    fontWeight: "700",
    marginTop: 2,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  statusText: {
    fontSize: 12,
    color: "#e5e7eb",
    flex: 1,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 16,
  },
  successBox: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22c55e",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  successText: {
    color: "#86efac",
    fontSize: 12,
    lineHeight: 16,
  },
  submitBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  officialFootnote: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
  loggedInBox: {
    gap: 14,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  syncMeta: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  typeBadge: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  syncBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "700",
  },
});
