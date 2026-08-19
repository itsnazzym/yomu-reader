/**
 * CAPTCHA widget (Turnstile / hCaptcha) — loads a REAL nhentai.net page
 * in the WebView so the origin matches the Turnstile site key's allowed
 * domains, then injects the widget via JS after the page loads.
 *
 * Using inline HTML (`source={{ html, baseUrl }}`) does NOT work because
 * Android WebView sets `window.location` to `about:blank` even with a
 * baseUrl, causing Cloudflare Turnstile to silently reject the widget.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react-native";

const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AD1A.240905.004) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/130.0.6723.102 Mobile Safari/537.36";

/** Injected BEFORE page content loads — hides the real page instantly. */
const HIDE_PAGE_JS = `
(function(){
  var s = document.createElement('style');
  s.textContent = '*, body, html, #app, #content, header, footer, nav, main, .container { display:none !important; visibility:hidden !important; }';
  (document.head || document.documentElement).appendChild(s);
  document.documentElement.style.cssText = 'background:#161622 !important;';
})();
true;
`;

/** Builds the JS that clears the page and renders Turnstile. */
function buildTurnstileInjectJS(siteKey: string, provider: string): string {
  const isHcaptcha = provider.toLowerCase().includes("hcaptcha");
  const scriptUrl = isHcaptcha
    ? "https://js.hcaptcha.com/1/api.js?onload=__captchaReady&render=explicit"
    : "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__captchaReady&render=explicit";

  return `
(function(){
  try {
    // 1. Nuke page content
    document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">';
    document.body.innerHTML = '';
    document.documentElement.style.cssText = 'margin:0;padding:0;background:#161622;height:100%;';
    document.body.style.cssText = 'margin:0;padding:8px 0 0 0;background:#161622;display:flex;justify-content:center;align-items:flex-start;height:100%;overflow:hidden;';

    // 2. Create widget container
    var root = document.createElement('div');
    root.id = 'captcha-root';
    root.style.cssText = 'display:flex;justify-content:center;align-items:center;min-width:300px;min-height:65px;';
    document.body.appendChild(root);

    // 3. Bridge functions
    function post(obj) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
    }

    // 4. Callback when SDK is ready
    window.__captchaReady = function() {
      post({ type: 'nh-captcha-ready' });
      try {
        var sdk = ${isHcaptcha ? "window.hcaptcha" : "window.turnstile"};
        if (!sdk || typeof sdk.render !== 'function') {
          post({ type: 'nh-captcha-error', error: 'SDK not available' });
          return;
        }
        sdk.render(${isHcaptcha ? "root" : "'#captcha-root'"}, {
          sitekey: '${siteKey}',
          theme: 'dark',
          size: 'normal',
          callback: function(token) { post({ type: 'nh-captcha', token: token }); },
          'expired-callback': function() { post({ type: 'nh-captcha', token: '' }); },
          'error-callback': function(err) { post({ type: 'nh-captcha-error', error: String(err || 'challenge error') }); }
        });
      } catch(e) {
        post({ type: 'nh-captcha-error', error: e.message || 'render error' });
      }
    };

    // 5. Load SDK script
    var s = document.createElement('script');
    s.src = '${scriptUrl}';
    s.onerror = function() {
      post({ type: 'nh-captcha-error', error: 'Script load failed' });
    };
    document.body.appendChild(s);
  } catch(e) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nh-captcha-error', error: e.message }));
    } catch(_) {}
  }
})();
true;
`;
}

export type CaptchaEmbedProps = {
  siteKey: string;
  provider: string;
  onToken: (token: string) => void;
  onError?: (error: string) => void;
  onClear?: () => void;
  resetKey?: number | string;
  accent?: string;
  subColor?: string;
};

export function CaptchaEmbed({
  siteKey,
  provider,
  onToken,
  onError,
  onClear,
  resetKey = 0,
  accent = "#eb2f96",
}: CaptchaEmbedProps) {
  const webViewRef = useRef<WebView>(null);
  const [internalKey, setInternalKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(null);
    injectedRef.current = false;
  }, [siteKey, provider, resetKey, internalKey]);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(null);
    injectedRef.current = false;
    setInternalKey((k) => k + 1);
    onClear?.();
  }, [onClear]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const raw = e.nativeEvent.data;
        const d = JSON.parse(raw) as {
          type?: string;
          token?: string;
          error?: string;
        };
        if (d?.type === "nh-captcha") {
          if (d.token) {
            setIsLoading(false);
            setHasError(null);
            onToken(d.token);
          } else {
            onClear?.();
          }
        } else if (d?.type === "nh-captcha-ready") {
          setIsLoading(false);
        } else if (d?.type === "nh-captcha-error") {
          setIsLoading(false);
          setHasError(d.error || "Erreur captcha");
          onError?.(d.error || "Erreur captcha");
          onClear?.();
        }
      } catch {}
    },
    [onToken, onClear, onError]
  );

  /** Inject Turnstile JS once after the real page finishes loading. */
  const handleLoadEnd = useCallback(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;
    const js = buildTurnstileInjectJS(siteKey, provider);
    webViewRef.current?.injectJavaScript(js);
  }, [siteKey, provider]);

  if (!siteKey) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTxt}>Captcha indisponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        key={`captcha-${resetKey}-${internalKey}`}
        originWhitelist={["*"]}
        source={{ uri: "https://nhentai.net/" }}
        injectedJavaScriptBeforeContentLoaded={HIDE_PAGE_JS}
        userAgent={Platform.OS === "android" ? ANDROID_CHROME_UA : undefined}
        onMessage={onMessage}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={handleLoadEnd}
        onError={() => {
          setIsLoading(false);
          setHasError("Impossible de contacter nhentai.net");
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) {
            setIsLoading(false);
            setHasError(`Erreur serveur (${e.nativeEvent.statusCode})`);
          }
        }}
        style={styles.web}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        mixedContentMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        cacheEnabled={true}
        startInLoadingState={false}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={styles.loadingTxt}>Vérification de sécurité...</Text>
        </View>
      )}

      {/* Error overlay with retry */}
      {hasError && !isLoading && (
        <View style={styles.errorOverlay}>
          <IconAlertTriangle size={16} color="#f87171" stroke={2} />
          <Text style={styles.errorTxt} numberOfLines={1}>
            {hasError}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleRetry}
            style={styles.retryBtn}
          >
            <IconRefresh size={12} color="#fff" stroke={2.2} />
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#161622",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  web: {
    width: "100%",
    height: 80,
    backgroundColor: "#161622",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#161622",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2,
  },
  loadingTxt: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#161622",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    zIndex: 3,
  },
  errorTxt: {
    fontSize: 11.5,
    color: "#fca5a5",
    flexShrink: 1,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2e2e42",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  retryTxt: {
    fontSize: 11.5,
    color: "#fff",
    fontWeight: "700",
  },
  fallback: {
    height: 80,
    borderRadius: 12,
    backgroundColor: "#161622",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.7,
  },
  fallbackTxt: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
