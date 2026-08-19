/**
 * CAPTCHA widget (Turnstile / hCaptcha).
 *
 * Loads a real nhentai.net document so `window.location.origin` matches the
 * site key, then replaces the page with the widget. Inline HTML + baseUrl
 * cannot be used: Android WebView reports `about:blank` and Turnstile
 * refuses to render.
 *
 * Do not inject global `display:none` / `visibility:hidden` — Turnstile
 * treats a hidden host as error 600010 and shows an empty checkbox.
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
import { NHENTAI_ORIGIN } from "./nhentaiCaptchaOrigin";

const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AD1A.240905.004) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/130.0.6723.102 Mobile Safari/537.36";

const WIDGET_HEIGHT = 72;

function escapeJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildTurnstileInjectJS(siteKey: string, provider: string): string {
  const isHcaptcha = provider.toLowerCase().includes("hcaptcha");
  const key = escapeJs(siteKey);
  const scriptUrl = isHcaptcha
    ? "https://js.hcaptcha.com/1/api.js?render=explicit"
    : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  return `
(function(){
  if (window.__nhCaptchaInjected) return;
  window.__nhCaptchaInjected = true;

  function post(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
  }

  function stripSheets() {
    var nodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].parentNode.removeChild(nodes[i]); } catch (e) {}
    }
  }

  function prepareHost() {
    stripSheets();
    var html = document.documentElement;
    html.style.cssText = 'margin:0;padding:0;width:100%;height:100%;background:#161622;overflow:visible;';
    if (!document.head) {
      html.appendChild(document.createElement('head'));
    }
    document.head.innerHTML =
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">';
    if (!document.body) {
      html.appendChild(document.createElement('body'));
    }
    document.body.innerHTML = '';
    document.body.style.cssText =
      'margin:0;padding:0;width:100%;height:100%;background:#161622;display:flex;justify-content:center;align-items:center;overflow:visible;visibility:visible;opacity:1;';
    var root = document.createElement('div');
    root.id = 'captcha-root';
    root.style.cssText =
      'width:300px;max-width:100%;min-width:150px;height:65px;min-height:65px;display:block;visibility:visible;opacity:1;overflow:visible;';
    document.body.appendChild(root);
    return root;
  }

  function waitVisible(el, cb, tries) {
    var n = tries == null ? 0 : tries;
    var r = el.getBoundingClientRect();
    if (r.width >= 20 && r.height >= 20) {
      cb();
      return;
    }
    if (n > 40) {
      post({ type: 'nh-captcha-error', error: 'Widget sans taille' });
      return;
    }
    setTimeout(function() { waitVisible(el, cb, n + 1); }, 50);
  }

  function renderWidget() {
    var sdk = ${isHcaptcha ? "window.hcaptcha" : "window.turnstile"};
    var root = document.getElementById('captcha-root');
    if (!sdk || typeof sdk.render !== 'function' || !root) {
      post({ type: 'nh-captcha-error', error: 'SDK not available' });
      return;
    }
    waitVisible(root, function() {
      try {
        sdk.render(${isHcaptcha ? "root" : "root"}, {
          sitekey: '${key}',
          theme: 'dark',
          size: 'normal',
          appearance: 'always',
          callback: function(token) { post({ type: 'nh-captcha', token: token }); },
          'expired-callback': function() { post({ type: 'nh-captcha', token: '' }); },
          'error-callback': function(err) {
            post({ type: 'nh-captcha-error', error: String(err || 'challenge error') });
          }
        });
        post({ type: 'nh-captcha-ready' });
      } catch (e) {
        post({ type: 'nh-captcha-error', error: e.message || 'render error' });
      }
    });
  }

  function boot() {
    try {
      prepareHost();
      var sdk = ${isHcaptcha ? "window.hcaptcha" : "window.turnstile"};
      if (sdk && typeof sdk.render === 'function') {
        renderWidget();
        return;
      }
      var done = false;
      function once() {
        if (done) return;
        done = true;
        renderWidget();
      }
      var s = document.createElement('script');
      s.src = '${scriptUrl}';
      s.async = true;
      s.onload = once;
      s.onerror = function() { post({ type: 'nh-captcha-error', error: 'Script load failed' }); };
      document.head.appendChild(s);
      setTimeout(function() {
        if (!done && (${isHcaptcha ? "window.hcaptcha" : "window.turnstile"})) once();
      }, 2500);
    } catch (e) {
      post({ type: 'nh-captcha-error', error: e.message || 'inject error' });
    }
  }

  if (!document.body) {
    setTimeout(boot, 50);
  } else {
    boot();
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

  useEffect(() => {
    if (!isLoading || hasError) return;
    const t = setTimeout(() => {
      setIsLoading(false);
      setHasError("Le captcha n'a pas chargé");
    }, 15000);
    return () => clearTimeout(t);
  }, [isLoading, hasError, resetKey, internalKey]);

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
        const d = JSON.parse(e.nativeEvent.data) as {
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

  const handleLoadEnd = useCallback(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;
    const js = buildTurnstileInjectJS(siteKey, provider);
    setTimeout(() => {
      webViewRef.current?.injectJavaScript(js);
    }, 80);
  }, [siteKey, provider]);

  if (!siteKey) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTxt}>Captcha indisponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} collapsable={false}>
      <WebView
        ref={webViewRef}
        key={`captcha-${resetKey}-${internalKey}`}
        collapsable={false}
        originWhitelist={["*"]}
        source={{ uri: `${NHENTAI_ORIGIN}/login/` }}
        userAgent={Platform.OS === "android" ? ANDROID_CHROME_UA : undefined}
        onMessage={onMessage}
        onLoadEnd={handleLoadEnd}
        onError={() => {
          setIsLoading(false);
          setHasError("Impossible de contacter nhentai.net");
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) {
            setIsLoading(false);
            setHasError(`Erreur serveur (${e.nativeEvent.statusCode})`);
          }
        }}
        style={styles.web}
        scrollEnabled={false}
        nestedScrollEnabled={true}
        javaScriptEnabled={true}
        javaScriptCanOpenWindowsAutomatically={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        mixedContentMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        cacheEnabled={false}
        startInLoadingState={false}
        androidLayerType={Platform.OS === "android" ? "software" : undefined}
        injectedJavaScriptForMainFrameOnly={true}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
      />

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={accent} />
          <Text style={styles.loadingTxt}>Vérification de sécurité...</Text>
        </View>
      )}

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
    height: WIDGET_HEIGHT,
    backgroundColor: "#161622",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  web: {
    width: "100%",
    height: WIDGET_HEIGHT,
    backgroundColor: "#161622",
    opacity: 0.99,
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
    height: WIDGET_HEIGHT,
    backgroundColor: "#161622",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.7,
  },
  fallbackTxt: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
