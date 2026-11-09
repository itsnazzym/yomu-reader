import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TextInput, ActivityIndicator, Alert, Switch, TouchableOpacity, Linking, Keyboard, type TextInputProps } from "react-native";
import { AnimatePresence } from "moti";
import { MotionSection } from "@/components/motion/MotionSection";
import { AuthMotionFeedback } from "@/components/motion/AuthMotionFeedback";
import { IconBook, IconExternalLink } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { AuthModalShell } from "@/components/auth/AuthModalShell";
import { lightTap } from "@/lib/haptics";
import { clearSourceAuth, loginEhentaiWithCookies, loginEhentaiWithCredentials, loginRule34, parseCookieString, useSourceAuth } from "@/lib/sources/authStore";
import { parseRule34CredentialInput } from "@/lib/sources/credentialInput";
import type { SourceId } from "@/lib/sources/types";
import { AuthGuideModal, type GuideType } from "./AuthGuideModal";

function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return <View style={styles.field}>
    <Text style={[styles.fieldLabel, { color: colors.txt }]}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
      placeholderTextColor={colors.sub} style={[styles.input, { color: colors.txt, backgroundColor: colors.bg, borderColor: colors.tagBg }]} />
  </View>;
}

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
  const [guideModalType, setGuideModalType] = useState<GuideType | null>(null);

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
    if (!visible) setGuideModalType(null);
    setActiveTab(initialSource === "rule34" ? "rule34" : "ehentai");
    setErrorMessage(null);
    setSuccessMessage(null);
    setRawCookieString("");
    setEhentaiPassword("");
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
    if (text.includes("=") && text.includes(";")) {
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
            try {
              await clearSourceAuth("ehentai");
              setIpbMemberId("");
              setIpbPassHash("");
              setIgneousCookie("");
              setRawCookieString("");
              setSuccessMessage("Session E-Hentai déconnectée.");
              lightTap();
            } catch { setErrorMessage("Impossible d’effacer la session sécurisée. Réessayez."); }
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
            } catch { setErrorMessage("Impossible d’effacer la session sécurisée. Réessayez."); }
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
  const openGuide = (type: GuideType) => { Keyboard.dismiss(); setGuideModalType(type); };
  const guideLink = (type: GuideType) => (
    <TouchableOpacity onPress={() => openGuide(type)} style={styles.help} accessibilityRole="button">
      <IconBook size={18} color={colors.metaText} />
      <ButtonLabel style={[styles.helpText, { color: colors.metaText }]}>Guide illustré avec captures d’écran</ButtonLabel>
    </TouchableOpacity>
  );
  const auth = activeTab === "rule34" ? rule34Auth : ehentaiAuth;
  return <>
    <AuthModalShell visible={visible && guideModalType === null} onClose={onClose} title="Comptes et sources">
      <Text style={[styles.description, { color: colors.sub }]}>Chaque source utilise ses propres identifiants.</Text>
      <View style={styles.tabs}>
        {(["ehentai", "rule34"] as const).map(source => <TouchableOpacity key={source}
          disabled={loading} onPress={() => switchSource(source)} accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === source, disabled: loading }}
          style={[styles.tab, { backgroundColor: activeTab === source ? colors.tagBg : colors.bg }]}>
          <ButtonLabel style={[styles.tabText, { color: activeTab === source ? colors.txt : colors.sub }]}>{source === "ehentai" ? "E-Hentai" : "Rule34"}</ButtonLabel>
        </TouchableOpacity>)}
      </View>
      <AnimatePresence exitBeforeEnter>
      <MotionSection key={`${activeTab}:${ehentaiLoginMode}`}>
      <Text accessibilityLiveRegion="polite" style={[styles.description, { color: colors.sub }]}>
        {auth.isLoggedIn ? `Connecté · ${auth.username || (activeTab === "rule34" ? "Rule34" : "E-Hentai")}` : activeTab === "rule34" ? "Une clé API est nécessaire pour consulter cette source." : "Mode invité · Connectez-vous pour accéder à votre compte."}
      </Text>
      {activeTab === "ehentai" ? <>
        <View style={styles.tabs}>
          {(["cookies", "forum"] as const).map(mode => <TouchableOpacity key={mode} disabled={loading}
            onPress={() => { Keyboard.dismiss(); setEhentaiLoginMode(mode); setErrorMessage(null); setSuccessMessage(null); }}
            accessibilityRole="tab" accessibilityState={{ selected: ehentaiLoginMode === mode, disabled: loading }}
            style={[styles.tab, { backgroundColor: ehentaiLoginMode === mode ? colors.tagBg : colors.bg }]}>
            <ButtonLabel style={[styles.tabText, { color: colors.txt }]}>{mode === "cookies" ? "Cookies" : "Compte forum"}</ButtonLabel>
          </TouchableOpacity>)}
        </View>
        {guideLink(ehentaiLoginMode === "cookies" ? "ehentai_cookies" : "ehentai_forum")}
        {ehentaiLoginMode === "cookies" ? <>
          <AuthField label="Importer les cookies" value={rawCookieString} onChangeText={handleRawCookiePaste} secureTextEntry editable={!loading} placeholder="Collez la chaîne complète" />
          <Text style={[styles.description, { color: colors.sub }]}>Ou renseignez les valeurs séparément :</Text>
          <AuthField label="Identifiant membre · ipb_member_id" value={ipbMemberId} onChangeText={setIpbMemberId} keyboardType="number-pad" editable={!loading} />
          <AuthField label="Cookie de connexion · ipb_pass_hash" value={ipbPassHash} onChangeText={setIpbPassHash} secureTextEntry editable={!loading} />
          <AuthField label="Cookie ExHentai · igneous (facultatif)" value={igneousCookie} onChangeText={setIgneousCookie} secureTextEntry editable={!loading} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.txt }]}>Utiliser ExHentai</Text>
            <Switch value={exhentaiToggle} onValueChange={setExhentaiToggle} disabled={loading} accessibilityLabel="Utiliser ExHentai" />
          </View>
        </> : <>
          <AuthField label="Nom d’utilisateur du forum" value={ehentaiUsername} onChangeText={setEhentaiUsername} textContentType="username" editable={!loading} />
          <AuthField label="Mot de passe du forum" value={ehentaiPassword} onChangeText={setEhentaiPassword} secureTextEntry textContentType="password" editable={!loading} />
        </>}
      </> : <>
        <Text style={[styles.description, { color: colors.sub }]}>Collez votre User ID et votre clé API, ou la ligne complète dans l’un des champs.</Text>
        <TouchableOpacity accessibilityRole="link" style={styles.help}
          onPress={() => { void Linking.openURL("https://rule34.xxx/index.php?page=account&s=options").catch(() => setErrorMessage("Impossible d’ouvrir le navigateur. Réessayez.")); }}>
          <IconExternalLink size={18} color={colors.metaText} />
          <ButtonLabel style={[styles.helpText, { color: colors.metaText }]}>Ouvrir les options de mon compte Rule34</ButtonLabel>
        </TouchableOpacity>
        {guideLink("rule34_api")}
        <AuthField label="User ID Rule34" value={rule34UserId} onChangeText={text => updateRule34Field("userId", text)} editable={!loading} placeholder="Identifiant ou ligne complète" />
        <AuthField label="Clé API Rule34" value={rule34ApiKey} onChangeText={text => updateRule34Field("apiKey", text)} secureTextEntry editable={!loading} />
      </>}
      <AuthMotionFeedback loading={loading} error={errorMessage} success={successMessage} active={visible && guideModalType === null} />
      <CardPressable onPress={activeTab === "rule34" ? handleRule34Login : handleEhentaiLogin} disabled={loading}
        accessibilityRole="button" accessibilityState={{ busy: loading, disabled: loading }} style={styles.primaryBtn}>
        {loading && <ActivityIndicator color="#20252b" />}
        <ButtonLabel style={styles.primaryText}>{loading ? "Connexion en cours…" : activeTab === "rule34" ? "Enregistrer la clé Rule34" : "Se connecter à E-Hentai"}</ButtonLabel>
      </CardPressable>
      {auth.isLoggedIn && <TouchableOpacity disabled={loading} accessibilityRole="button" style={styles.help}
        onPress={activeTab === "rule34" ? handleRule34Logout : handleEhentaiLogout}>
        <ButtonLabel style={styles.errorText}>Déconnecter ce compte</ButtonLabel>
      </TouchableOpacity>}
      {onOpenNhentaiAuth && <TouchableOpacity disabled={loading} accessibilityRole="button" style={styles.help}
        onPress={() => { onClose(); onOpenNhentaiAuth(); }}>
        <ButtonLabel style={[styles.helpText, { color: colors.txt }]}>Gérer mon compte nHentai</ButtonLabel>
      </TouchableOpacity>}
      {guideLink("nhentai_session")}
      </MotionSection>
      </AnimatePresence>
    </AuthModalShell>
    <AuthGuideModal visible={visible && guideModalType !== null} guideType={guideModalType} onClose={() => setGuideModalType(null)} />
  </>;
}

const styles = StyleSheet.create({
  description: { fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { flexGrow: 1, flexBasis: "42%", minWidth: 0, minHeight: 48, padding: 12, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "500" },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  help: { minHeight: 48, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  helpText: { fontSize: 14, textDecorationLine: "underline" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { flex: 1, minWidth: 0, fontSize: 14 },
  primaryBtn: { minHeight: 52, padding: 14, borderRadius: 12, flexDirection: "row", gap: 10, justifyContent: "center", alignItems: "center", backgroundColor: "#d9dfe7" },
  primaryText: { fontSize: 15, fontWeight: "700", color: "#20252b" },
  errorText: { color: "#ffb4ab", fontSize: 14, lineHeight: 21 },
  successText: { color: "#adcdb8", fontSize: 14, lineHeight: 21 },
});
