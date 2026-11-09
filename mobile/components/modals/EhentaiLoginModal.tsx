import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { loginEhentaiWithCookies, type EhentaiCookies } from "@/lib/sources/authStore";
import { clearEhBrowserCookies, EH_LOGIN_URL, isEhAuthNavigation, readEhBrowserCookies, seedExBrowserCookies, type EhCookieJar } from "@/lib/sources/ehentaiBrowserSession";

/** Official login page: passwords stay on the forum, cookies enter secure storage. */
export function EhentaiLoginModal({ target, onClose, onSuccess }: {
  target: "ehentai" | "exhentai";
  onClose: () => void;
  onSuccess: (exhentai: boolean) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const jar = useRef<EhCookieJar | null>(null);
  const account = useRef<EhentaiCookies | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const completed = useRef(false);
  const [url, setUrl] = useState(EH_LOGIN_URL);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"forum" | "exhentai">("forum");
  const [error, setError] = useState("");
  const [canUseEh, setCanUseEh] = useState(false);

  useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        const { default: cookies } = await import("react-native-nitro-cookies");
        jar.current = cookies;
        await clearEhBrowserCookies(cookies);
        if (active.current) setReady(true);
      } catch {
        if (active.current) setError("La connexion intégrée n’est pas disponible dans cette version. Utilisez l’import de cookies.");
      } finally { if (active.current) setLoading(false); }
    })();
    return () => { active.current = false; };
  }, []);

  const finish = async (cookies: EhentaiCookies, ex: boolean) => {
    if (!active.current || completed.current) return;
    completed.current = true;
    try {
      await loginEhentaiWithCookies(cookies, ex);
      if (active.current) onSuccess(ex);
    } catch {
      completed.current = false;
      if (active.current) setError("Impossible d’enregistrer la session. Réessayez.");
    }
  };

  const inspect = async (pageUrl: string) => {
    if (!jar.current || busy.current || completed.current || !active.current || !isEhAuthNavigation(pageUrl)) return;
    if (new URL(pageUrl).hostname === "challenges.cloudflare.com") return;
    busy.current = true;
    try {
      if (stage === "forum") {
        const cookies = await readEhBrowserCookies(jar.current);
        if (!active.current || !cookies) return;
        account.current = cookies;
        if (target === "ehentai") { await finish(cookies, false); return; }
        await seedExBrowserCookies(jar.current, cookies);
        if (!active.current) return;
        setCanUseEh(true); setStage("exhentai"); setUrl("https://exhentai.org/"); setLoading(true);
      } else if (new URL(pageUrl).hostname === "exhentai.org" && account.current) {
        const cookies = await jar.current.get("https://exhentai.org", true);
        if (!active.current) return;
        const igneous = cookies.igneous?.value;
        if (igneous && igneous !== "mystery") await finish({ ...account.current, igneous }, true);
        else {
          setCanUseEh(true);
          setError("Votre compte est connecté à E-Hentai. L’accès ExHentai n’a pas été confirmé. Vous pouvez réessayer ou continuer avec E-Hentai.");
        }
      }
    } catch {
      if (active.current) { setError("La session n’a pas pu être récupérée. Réessayez ou utilisez vos cookies."); setCanUseEh(Boolean(account.current)); }
    } finally { busy.current = false; }
  };

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Retour aux méthodes de connexion" style={styles.action}><IconArrowLeft color={colors.txt} size={22} /></Pressable>
        <View style={styles.heading}><Text style={[styles.title, { color: colors.txt }]}>Connexion {target === "exhentai" ? "ExHentai" : "E-Hentai"}</Text><Text style={[styles.caption, { color: colors.sub }]}>{stage === "forum" ? "forums.e-hentai.org · site officiel" : "exhentai.org · activation de l’accès"}</Text></View>
        <Pressable onPress={() => { setError(""); web.current?.reload(); }} accessibilityRole="button" accessibilityLabel="Recharger la connexion" style={styles.action}><IconRefresh color={colors.txt} size={21} /></Pressable>
      </View>
      <Text style={[styles.info, { color: colors.sub }]}>Connectez-vous sur le site. Yomu récupère la session automatiquement, sans enregistrer votre mot de passe.</Text>
      {loading && <ActivityIndicator accessibilityLabel="Chargement du site" color={colors.metaText} style={{ padding: 8 }} />}
      {!!error && <Text accessibilityRole="alert" style={[styles.info, { color: "#e4b8aa" }]}>{error}</Text>}
      {canUseEh && <Pressable style={styles.action} onPress={() => { if (account.current) void finish(account.current, false); }} accessibilityRole="button"><ButtonLabel style={{ color: colors.txt }}>Continuer avec E-Hentai</ButtonLabel></Pressable>}
      {ready && <WebView ref={web} source={{ uri: url }} style={{ flex: 1 }} sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        javaScriptEnabled domStorageEnabled mixedContentMode="never" setSupportMultipleWindows={false} saveFormDataDisabled
        originWhitelist={["https://*"]} onShouldStartLoadWithRequest={request => isEhAuthNavigation(request.url)}
        onLoadStart={() => setLoading(true)} onLoadEnd={event => { setLoading(false); void inspect(event.nativeEvent.url); }}
        onError={() => { setLoading(false); setError("Le site ne répond pas. Rechargez la page ou revenez à l’import de cookies."); setCanUseEh(Boolean(account.current)); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 400) setError("Le site demande une vérification ou refuse l’accès. Terminez la vérification affichée, puis rechargez si nécessaire."); }}
        onNavigationStateChange={nav => { if (!isEhAuthNavigation(nav.url)) web.current?.stopLoading(); }} />}
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: "row", gap: 8, alignItems: "center", padding: 8 },
  heading: { flex: 1, minWidth: 0, gap: 4 }, title: { fontSize: 18, fontWeight: "600" }, caption: { fontSize: 12, lineHeight: 18 },
  action: { minWidth: 48, minHeight: 48, padding: 12, justifyContent: "center", alignItems: "center" }, info: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, lineHeight: 20 },
});
