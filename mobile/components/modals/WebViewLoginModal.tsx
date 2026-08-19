import React, { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import {
  IconX,
  IconShield,
  IconRotateClockwise,
  IconInfoCircle,
} from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";

export interface WebViewLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (credentials: {
    sessionId: string;
    credentialType: "refresh" | "apiKey" | "sessionid";
    username?: string;
    cfClearance?: string;
    csrfToken?: string;
  }) => void;
}

const INJECTED_AUTH_JS = `
(function() {
  function getCookie(name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? decodeURIComponent(v[2]) : null;
  }

  function checkSession() {
    var cookies = document.cookie || '';
    var sessionid = getCookie('sessionid');
    var cfClearance = getCookie('cf_clearance');
    var csrfToken = getCookie('csrftoken') || getCookie('csrf_token');
    
    // Look for refresh_token in cookies or localStorage
    var refreshToken = getCookie('refresh_token');
    var username = '';
    
    try {
      if (!refreshToken && window.localStorage) {
        refreshToken = window.localStorage.getItem('refresh_token') ||
                       window.localStorage.getItem('refreshToken') ||
                       window.localStorage.getItem('token');
      }
      
      // Try to extract username from DOM if logged in
      var userElem = document.querySelector('.username, .nav_profile, a[href^="/users/"], .user-profile');
      if (userElem && userElem.innerText) {
        username = userElem.innerText.trim();
      }
    } catch(e) {}

    var url = window.location.href;
    var notOnLoginPage = !url.includes('/login');
    var hasUserNav = Boolean(
      document.querySelector('a[href^="/users/"], a[href="/favorites/"], a[href^="/logout/"], form[action^="/logout/"]')
    );

    // Auto-unlock Anti-spam submit button once Turnstile resolves
    try {
      var turnstileToken = document.querySelector('input[name="cf-turnstile-response"], [name="g-recaptcha-response"]');
      var submitBtn = document.querySelector('button[type="submit"], input[type="submit"], form button, .btn-primary');
      if (submitBtn) {
        if (turnstileToken && turnstileToken.value && turnstileToken.value.length > 5) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute('disabled');
          if (submitBtn.innerText && submitBtn.innerText.includes('Anti-spam')) {
            submitBtn.innerText = 'Se connecter (Log in)';
          }
          submitBtn.style.opacity = '1';
          submitBtn.style.pointerEvents = 'auto';
        }
      }
    } catch(e) {}

    // Auto-retrieve official API key if logged in
    if (hasUserNav && !window.__keysFetched) {
      window.__keysFetched = true;
      fetch('/api/v2/user/keys')
        .then(function(r) { return r.json(); })
        .then(function(keysData) {
          var officialKey = '';
          if (keysData && Array.isArray(keysData.keys) && keysData.keys.length > 0) {
            officialKey = keysData.keys[0].key;
          }
          if (officialKey) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_UPDATE',
              isAuthed: true,
              sessionid: officialKey,
              credentialType: 'apiKey',
              username: username,
              url: url,
              cookies: cookies
            }));
          }
        })
        .catch(function() {});
    }

    var isAuthed = Boolean(sessionid || refreshToken || (notOnLoginPage && hasUserNav));

    // Send payload to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AUTH_UPDATE',
      isAuthed: isAuthed,
      sessionid: sessionid || refreshToken || ('auth_' + Date.now()),
      refreshToken: refreshToken,
      cfClearance: cfClearance,
      csrfToken: csrfToken,
      username: username,
      url: url,
      cookies: cookies
    }));
  }

  // Check periodically and on DOM mutation
  setInterval(checkSession, 500);
  checkSession();
  window.addEventListener('load', checkSession);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkSession();
  }
})();
true;
`;

export function WebViewLoginModal({
  visible,
  onClose,
  onSuccess,
}: WebViewLoginModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("https://nhentai.net/login/");
  const [statusMessage, setStatusMessage] = useState("Veuillez saisir vos identifiants");
  const [hasCaptured, setHasCaptured] = useState(false);

  const handleMessage = (event: WebViewMessageEvent) => {
    if (hasCaptured) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.type === "AUTH_UPDATE" && data.isAuthed) {
        setHasCaptured(true);
        const credType = data.refreshToken ? "refresh" : "sessionid";
        const primarySession = data.refreshToken || data.sessionid;

        onSuccess({
          sessionId: primarySession,
          credentialType: credType,
          username: data.username || undefined,
          cfClearance: data.cfClearance || undefined,
          csrfToken: data.csrfToken || undefined,
        });
      }
    } catch {}
  };

  const handleManualConfirm = () => {
    if (hasCaptured) return;
    setHasCaptured(true);
    onSuccess({
      sessionId: "auth_" + Date.now(),
      credentialType: "sessionid",
      username: "Membre nHentai",
    });
  };

  const handleReload = () => {
    webViewRef.current?.reload();
  };

  const isNotOnLogin = !currentUrl.includes("/login");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <IconX size={22} color="#f3f4f6" stroke={2} />
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <IconShield size={16} color={colors.accent} stroke={2} />
              <Text style={styles.headerTitle}>Connexion Officielle nHentai</Text>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {statusMessage}
            </Text>
          </View>

          <Pressable
            onPress={handleReload}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBtn}
          >
            <IconRotateClockwise size={18} color="#9ca3af" stroke={2} />
          </Pressable>
        </View>

        {/* Info banner */}
        <View style={styles.banner}>
          <IconInfoCircle size={14} color="#60a5fa" stroke={1.8} />
          <Text style={styles.bannerText}>
            Connectez-vous avec vos identifiants. La session et le captcha Cloudflare seront
            automatiquement synchronisés.
          </Text>
        </View>

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Validation Cloudflare en cours...</Text>
          </View>
        )}

        {/* WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: "https://nhentai.net/login/" }}
            userAgent={
              Platform.OS === "android"
                ? "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
                : undefined
            }
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures={true}
            injectedJavaScript={INJECTED_AUTH_JS}
            onMessage={handleMessage}
            onLoadStart={() => {
              if (currentUrl.includes("/login")) setLoading(true);
            }}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(navState) => {
              setCurrentUrl(navState.url);
              if (navState.url.includes("/login")) {
                setStatusMessage("Veuillez saisir vos identifiants");
              } else {
                setLoading(false);
                setStatusMessage("Connexion validée");
              }
            }}
            style={styles.webview}
          />
        </View>

        {/* Floating Confirm Button when logged in */}
        {isNotOnLogin && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable
              onPress={handleManualConfirm}
              style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.confirmBtnText}>Valider & Synchroniser le compte →</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#161622",
    borderBottomWidth: 1,
    borderBottomColor: "#28283a",
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#202030",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(96, 165, 250, 0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(96, 165, 250, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 11.5,
    color: "#93c5fd",
    lineHeight: 16,
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1c1c28",
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webview: {
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(22, 22, 34, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#28283a",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "800",
  },
});

export default WebViewLoginModal;
