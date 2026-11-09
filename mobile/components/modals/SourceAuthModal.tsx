import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Linking,
  Keyboard,
  type TextInputProps,
} from "react-native";
import { AnimatePresence } from "moti";
import { MotionSection } from "@/components/motion/MotionSection";
import { AuthMotionFeedback } from "@/components/motion/AuthMotionFeedback";
import { IconExternalLink } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { AuthModalShell } from "@/components/auth/AuthModalShell";
import { lightTap } from "@/lib/haptics";
import {
  clearSourceAuth,
  loginEhentaiWithCookies,
  loginRule34,
  parseCookieString,
  useSourceAuth,
} from "@/lib/sources/authStore";
import { parseRule34CredentialInput } from "@/lib/sources/credentialInput";
import type { SourceId } from "@/lib/sources/types";
import { EhentaiLoginModal } from "./EhentaiLoginModal";
import { clearEhBrowserCookies } from "@/lib/sources/ehentaiBrowserSession";
import { AuthGuideModal, type GuideType } from "./AuthGuideModal";

function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.txt }]}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.sub}
        style={[
          styles.input,
          { color: colors.txt, backgroundColor: colors.bg, borderColor: colors.tagBg },
        ]}
      />
    </View>
  );
}

export interface SourceAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSource?: SourceId;
  onOpenNhentaiAuth?: () => void;
}

export function SourceAuthModal({
  visible,
  onClose,
  onSuccess,
  initialSource = "ehentai",
  onOpenNhentaiAuth,
}: SourceAuthModalProps) {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<SourceId>(initialSource);
  const [guideModalType, setGuideModalType] = useState<GuideType | null>(null);

  // E-Hentai form state
  const ehentaiAuth = useSourceAuth("ehentai");
  const [ehentaiLoginMode, setEhentaiLoginMode] = useState<"cookies" | "browser">("browser");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [manualCookies, setManualCookies] = useState(false);
  const [rawCookieString, setRawCookieString] = useState("");
  const [ipbMemberId, setIpbMemberId] = useState("");
  const [ipbPassHash, setIpbPassHash] = useState("");
  const [igneousCookie, setIgneousCookie] = useState("");
  const [exhentaiToggle, setExhentaiToggle] = useState(false);

  // Rule34 form state
  const rule34Auth = useSourceAuth("rule34");
  const [rule34UserId, setRule34UserId] = useState("");
  const [rule34ApiKey, setRule34ApiKey] = useState("");

  // Loading & status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setGuideModalType(null);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    }
    setActiveTab(initialSource === "rule34" ? "rule34" : "ehentai");
    setErrorMessage(null);
    setSuccessMessage(null);
    setRawCookieString("");
    if (!visible) setBrowserOpen(false);

    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [visible, initialSource]);

  useEffect(() => {
    if (!visible) return;
    setIpbMemberId(ehentaiAuth.cookies?.ipb_member_id || "");
    setIpbPassHash(ehentaiAuth.cookies?.ipb_pass_hash || "");
    setIgneousCookie(ehentaiAuth.cookies?.igneous || "");
    setExhentaiToggle(Boolean(ehentaiAuth.isExHentaiEnabled));
    setRule34UserId(rule34Auth.credentials?.userId || "");
    setRule34ApiKey(rule34Auth.credentials?.apiKey || "");
  }, [visible, ehentaiAuth, rule34Auth]);

  // Détection automatique lors du collage d'une chaîne complète de cookies
  const handleRawCookiePaste = (text: string) => {
    setRawCookieString(text);
    if (text.includes("=")) {
      const parsed = parseCookieString(text);
      if (parsed.ipb_member_id) setIpbMemberId(parsed.ipb_member_id);
      if (parsed.ipb_pass_hash) setIpbPassHash(parsed.ipb_pass_hash);
      if (parsed.igneous) setIgneousCookie(parsed.igneous);
      lightTap();
    }
  };

  const handleEhentaiLogin = async () => {
    Keyboard.dismiss();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await loginEhentaiWithCookies(
        rawCookieString.trim() || {
          ipb_member_id: ipbMemberId,
          ipb_pass_hash: ipbPassHash,
          igneous: igneousCookie,
        },
        exhentaiToggle
      );
      lightTap();
      const msg = result.isExHentaiEnabled
        ? "Session ExHentai enregistrée."
        : "Session E-Hentai enregistrée.";
      setSuccessMessage(msg);
      onSuccess?.();

      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => {
        onClose();
      }, 900);
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
            try {
              const { default: cookies } = await import("react-native-nitro-cookies");
              await clearEhBrowserCookies(cookies);
              await clearSourceAuth("ehentai");
              setIpbMemberId("");
              setIpbPassHash("");
              setIgneousCookie("");
              setRawCookieString("");
              setSuccessMessage("Session E-Hentai déconnectée.");
              lightTap();
            } catch {
              setErrorMessage("Impossible d’effacer la session sécurisée. Réessayez.");
            }
          },
        },
      ]
    );
  };

  const handleRule34Login = async () => {
    Keyboard.dismiss();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const cleanUid = rule34UserId.trim();
      const cleanKey = rule34ApiKey.trim();
      await loginRule34(cleanUid, cleanKey);
      lightTap();
      setSuccessMessage("Compte Rule34 lié avec succès !");
      onSuccess?.();

      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => {
        onClose();
      }, 900);
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
            try {
              await clearSourceAuth("rule34");
              setRule34UserId("");
              setRule34ApiKey("");
              setSuccessMessage("Identifiants Rule34 retirés.");
              lightTap();
            } catch {
              setErrorMessage("Impossible d’effacer la session sécurisée. Réessayez.");
            }
          },
        },
      ]
    );
  };

  const updateRule34Field = (field: "userId" | "apiKey", text: string) => {
    const parsed = parseRule34CredentialInput(text);
    if (parsed.userId || parsed.apiKey) {
      if (parsed.userId) setRule34UserId(parsed.userId);
      if (parsed.apiKey) setRule34ApiKey(parsed.apiKey);
    } else if (field === "userId") setRule34UserId(text);
    else setRule34ApiKey(text);
  };

  const switchSource = (source: SourceId) => {
    Keyboard.dismiss();
    setActiveTab(source);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openGuide = (type: GuideType) => {
    Keyboard.dismiss();
    setGuideModalType(type);
  };

  const auth = activeTab === "rule34" ? rule34Auth : ehentaiAuth;
  const guideLink = (type: GuideType) => (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.help}
      onPress={() => openGuide(type)}
    >
      <IconExternalLink size={16} color={colors.metaText} />
      <ButtonLabel style={[styles.helpText, { color: colors.metaText }]}>
        {type === "rule34_api"
          ? "Guide pas à pas Rule34"
          : type === "ehentai_cookies"
          ? "Guide pas à pas cookies"
          : "Guide pas à pas nHentai"}
      </ButtonLabel>
    </TouchableOpacity>
  );

  return (
    <>
      <AuthModalShell visible={visible} onClose={onClose} title="Comptes et sources">
        <Text style={[styles.description, { color: colors.sub }]}>
          Chaque source utilise ses propres identifiants.
        </Text>
        <View style={styles.tabs}>
          {(["ehentai", "rule34"] as const).map((source) => (
            <TouchableOpacity
              key={source}
              disabled={loading}
              onPress={() => switchSource(source)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === source, disabled: loading }}
              style={[
                styles.tab,
                { backgroundColor: activeTab === source ? colors.tagBg : colors.bg },
              ]}
            >
              <ButtonLabel
                style={[
                  styles.tabText,
                  { color: activeTab === source ? colors.txt : colors.sub },
                ]}
              >
                {source === "ehentai" ? "E-Hentai" : "Rule34"}
              </ButtonLabel>
            </TouchableOpacity>
          ))}
        </View>

        <AnimatePresence exitBeforeEnter>
          <MotionSection key={`${activeTab}:${ehentaiLoginMode}`}>
            <Text accessibilityLiveRegion="polite" style={[styles.description, { color: colors.sub }]}>
              {auth.isLoggedIn
                ? `Connecté · ${auth.username || (activeTab === "rule34" ? "Rule34" : "E-Hentai")}`
                : activeTab === "rule34"
                ? "Une clé API est nécessaire pour consulter cette source."
                : "Mode invité · Connectez-vous pour accéder à votre compte."}
            </Text>

            {activeTab === "ehentai" ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.txt }]}>
                  Où voulez-vous vous connecter ?
                </Text>
                <View style={styles.tabs}>
                  {([false, true] as const).map((ex) => (
                    <TouchableOpacity
                      key={String(ex)}
                      disabled={loading}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: exhentaiToggle === ex }}
                      onPress={() => {
                        setExhentaiToggle(ex);
                        setErrorMessage(null);
                      }}
                      style={[
                        styles.tab,
                        { backgroundColor: exhentaiToggle === ex ? colors.tagBg : colors.bg },
                      ]}
                    >
                      <ButtonLabel style={[styles.tabText, { color: colors.txt }]}>
                        {ex ? "ExHentai" : "E-Hentai"}
                      </ButtonLabel>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.tabs}>
                  {(["browser", "cookies"] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      disabled={loading}
                      onPress={() => {
                        Keyboard.dismiss();
                        setEhentaiLoginMode(mode);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: ehentaiLoginMode === mode, disabled: loading }}
                      style={[
                        styles.tab,
                        { backgroundColor: ehentaiLoginMode === mode ? colors.tagBg : colors.bg },
                      ]}
                    >
                      <ButtonLabel style={[styles.tabText, { color: colors.txt }]}>
                        {mode === "browser" ? "Connexion directe" : "Importer des cookies"}
                      </ButtonLabel>
                    </TouchableOpacity>
                  ))}
                </View>

                {ehentaiLoginMode === "browser" ? (
                  <>
                    <Text style={[styles.description, { color: colors.txt }]}>
                      Un seul compte pour les deux sites.
                    </Text>
                    <Text style={[styles.description, { color: colors.sub }]}>
                      Ouvrez la page officielle, connectez-vous, puis Yomu récupère votre session. Aucun
                      cookie à chercher ni mot de passe à enregistrer.
                    </Text>
                    {exhentaiToggle && (
                      <Text style={[styles.description, { color: colors.sub }]}>
                        ExHentai reste soumis aux droits d’accès de votre compte.
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.description, { color: colors.sub }]}>
                      Collez vos cookies de navigateur ou de JHentai. Les champs sont remplis
                      automatiquement.
                    </Text>
                    <AuthField
                      label="Cookies de session"
                      value={rawCookieString}
                      onChangeText={handleRawCookiePaste}
                      secureTextEntry
                      editable={!loading}
                      placeholder="ipb_member_id=…; ipb_pass_hash=…"
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded: manualCookies }}
                      style={styles.help}
                      onPress={() => setManualCookies((value) => !value)}
                    >
                      <ButtonLabel style={[styles.helpText, { color: colors.txt }]}>
                        {manualCookies
                          ? "Masquer les valeurs séparées"
                          : "Renseigner les valeurs séparément"}
                      </ButtonLabel>
                    </TouchableOpacity>
                    {manualCookies && (
                      <>
                        <AuthField
                          label="Identifiant membre · ipb_member_id"
                          value={ipbMemberId}
                          onChangeText={setIpbMemberId}
                          keyboardType="number-pad"
                          editable={!loading}
                        />
                        <AuthField
                          label="Cookie de connexion · ipb_pass_hash"
                          value={ipbPassHash}
                          onChangeText={setIpbPassHash}
                          secureTextEntry
                          editable={!loading}
                        />
                        <AuthField
                          label="Cookie ExHentai · igneous"
                          value={igneousCookie}
                          onChangeText={setIgneousCookie}
                          secureTextEntry
                          editable={!loading}
                        />
                      </>
                    )}
                    {exhentaiToggle && (
                      <Text style={[styles.description, { color: colors.sub }]}>
                        ExHentai demande aussi un cookie igneous valide.
                      </Text>
                    )}
                    {guideLink("ehentai_cookies")}
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.description, { color: colors.sub }]}>
                  Collez votre User ID et votre clé API, ou la ligne complète dans l’un des champs.
                </Text>
                <TouchableOpacity
                  accessibilityRole="link"
                  style={styles.help}
                  onPress={() => {
                    void Linking.openURL("https://rule34.xxx/index.php?page=account&s=options").catch(
                      () => setErrorMessage("Impossible d’ouvrir le navigateur. Réessayez.")
                    );
                  }}
                >
                  <IconExternalLink size={18} color={colors.metaText} />
                  <ButtonLabel style={[styles.helpText, { color: colors.metaText }]}>
                    Ouvrir les options de mon compte Rule34
                  </ButtonLabel>
                </TouchableOpacity>
                {guideLink("rule34_api")}
                <AuthField
                  label="User ID Rule34"
                  value={rule34UserId}
                  onChangeText={(text) => updateRule34Field("userId", text)}
                  editable={!loading}
                  placeholder="Identifiant ou ligne complète"
                />
                <AuthField
                  label="Clé API Rule34"
                  value={rule34ApiKey}
                  onChangeText={(text) => updateRule34Field("apiKey", text)}
                  secureTextEntry
                  editable={!loading}
                />
              </>
            )}

            <AuthMotionFeedback
              loading={loading}
              error={errorMessage}
              success={successMessage}
              active={visible && guideModalType === null && !browserOpen}
            />

            <CardPressable
              onPress={
                successMessage
                  ? onClose
                  : activeTab === "rule34"
                  ? handleRule34Login
                  : ehentaiLoginMode === "browser"
                  ? () => {
                      Keyboard.dismiss();
                      setBrowserOpen(true);
                    }
                  : handleEhentaiLogin
              }
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              style={[
                styles.primaryBtn,
                Boolean(successMessage) && { backgroundColor: "#2ec4b6" },
              ]}
            >
              {loading && <ActivityIndicator color="#20252b" />}
              <ButtonLabel
                style={[
                  styles.primaryText,
                  Boolean(successMessage) && { color: "#ffffff" },
                ]}
              >
                {loading
                  ? "Connexion en cours…"
                  : successMessage
                  ? "✓ Terminé · Fermer"
                  : activeTab === "rule34"
                  ? "Enregistrer la clé Rule34"
                  : ehentaiLoginMode === "browser"
                  ? `Ouvrir la connexion ${exhentaiToggle ? "ExHentai" : "E-Hentai"}`
                  : "Enregistrer les cookies"}
              </ButtonLabel>
            </CardPressable>

            {auth.isLoggedIn && (
              <TouchableOpacity
                disabled={loading}
                accessibilityRole="button"
                style={styles.help}
                onPress={activeTab === "rule34" ? handleRule34Logout : handleEhentaiLogout}
              >
                <ButtonLabel style={styles.errorText}>Déconnecter ce compte</ButtonLabel>
              </TouchableOpacity>
            )}

            {onOpenNhentaiAuth && (
              <TouchableOpacity
                disabled={loading}
                accessibilityRole="button"
                style={styles.help}
                onPress={() => {
                  onClose();
                  onOpenNhentaiAuth();
                }}
              >
                <ButtonLabel style={[styles.helpText, { color: colors.txt }]}>
                  Gérer mon compte nHentai
                </ButtonLabel>
              </TouchableOpacity>
            )}
            {guideLink("nhentai_session")}
          </MotionSection>
        </AnimatePresence>
      </AuthModalShell>

      {visible && browserOpen && (
        <EhentaiLoginModal
          target={exhentaiToggle ? "exhentai" : "ehentai"}
          onClose={() => setBrowserOpen(false)}
          onSuccess={(ex) => {
            setBrowserOpen(false);
            setErrorMessage(null);
            setSuccessMessage(ex ? "Connecté à ExHentai." : "Connecté à E-Hentai.");
            lightTap();
            onSuccess?.();
            if (closeTimer.current) clearTimeout(closeTimer.current);
            closeTimer.current = setTimeout(() => {
              onClose();
            }, 900);
          }}
        />
      )}

      <AuthGuideModal
        visible={visible && guideModalType !== null}
        guideType={guideModalType}
        onClose={() => setGuideModalType(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    flex: 1,
    minWidth: 100,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "500" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  help: {
    minHeight: 48,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  helpText: { fontSize: 14, textDecorationLine: "underline" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { flex: 1, minWidth: 0, fontSize: 14 },
  primaryBtn: {
    minHeight: 52,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#d9dfe7",
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: "#20252b" },
  errorText: { color: "#ffb4ab", fontSize: 14, lineHeight: 21 },
  successText: { color: "#adcdb8", fontSize: 14, lineHeight: 21 },
});
