import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated, ActivityIndicator, StyleProp, Pressable, ViewStyle } from "react-native";
import { Image, ImageProps, ImageStyle } from "expo-image";
import { IconReload } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useReaderSettings } from "@/lib/readerSettingsStore";
import { resolveEhentaiPageImage, getCachedEhentaiPageImage } from "@/lib/sources/ehentai";

export interface SmartImageProps extends Omit<ImageProps, "source"> {
  uri: string;
  style?: StyleProp<ImageStyle>;
  aspectRatio?: number;
  priority?: "low" | "normal" | "high";
  showLoader?: boolean;
  recyclingKey?: string;
  sensitive?: boolean;
}

/**
 * Résout précisément le domaine CDN nHentai (t.nhentai.net pour les miniatures/couvertures, i.nhentai.net pour les pages pleines)
 */
export function resolveCdnHostAndPath(uri: string): { host: string; path: string } {
  if (!uri) return { host: "", path: "" };
  if (!/^https?:\/\//i.test(uri)) return { host: "", path: "" };

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return { host: "", path: "" };
  }
  const rawHost = parsed.hostname.toLowerCase();
  if (!/^(?:t|i)(?:[1-4])?\.nhentai\.net$/.test(rawHost)) {
    return { host: "", path: "" };
  }
  const pathOnly = `${parsed.pathname.replace(/^\/+/, "")}${parsed.search}`;
  if (!pathOnly) return { host: "", path: "" };

  const isThumb = rawHost.startsWith("t");
  const targetHost = isThumb ? "t.nhentai.net" : "i.nhentai.net";
  return { host: targetHost, path: pathOnly };
}

/**
 * Résout l'URL optimisée Photon CDN pour un préchargement direct
 */
function refererForImage(imageUri: string): string {
  try {
    const host = new URL(imageUri).hostname.toLowerCase();
    if (host.includes("doujins.com")) return "https://doujins.com/";
    if (host.includes("3hentai")) return "https://fr.3hentai.net/";
    if (
      host.includes("e-hentai.org") ||
      host.includes("exhentai.org") ||
      host.includes("ehgt.org") ||
      host.includes("hath.network")
    ) {
      return "https://e-hentai.org/";
    }
    if (host.includes("rule34.xxx")) return "https://rule34.xxx/";
    if (
      host.includes("hitomi.la") ||
      host.includes("gold-usergeneratedcontent.net")
    ) {
      return "https://hitomi.la/";
    }
  } catch {
    // URL invalide : referer nHentai par défaut
  }
  return "https://nhentai.net/";
}

export function getSmartImageUri(uri: string): string {
  if (!uri) return "";
  const { host: targetHost, path: pathOnly } = resolveCdnHostAndPath(uri);
  if (!targetHost || !pathOnly) return uri;
  return `https://i0.wp.com/${targetHost}/${pathOnly}`;
}

/**
 * Préchauffe une image dans le cache mémoire/disque pour affichage instantané
 */
export async function preloadSmartImage(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const optimized = getSmartImageUri(uri);
    return await Image.prefetch(optimized, "memory-disk");
  } catch {
    return false;
  }
}

export function SmartImage({
  uri,
  style,
  contentFit = "cover",
  aspectRatio,
  priority = "normal",
  showLoader = true,
  recyclingKey,
  sensitive = false,
  ...rest
}: SmartImageProps) {
  const { colors } = useTheme();
  const { settings, ready: privacyReady } = useReaderSettings();
  const [retryIndex, setRetryIndex] = useState(0);
  const [softAttempt, setSoftAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const softAttemptRef = useRef(0);
  const softTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  // Résolution paresseuse des pages de lecteur E-Hentai (/s/...) vers l'URL d'image réelle
  const isEhPage = Boolean(
    uri && (uri.includes("e-hentai.org/s/") || uri.includes("exhentai.org/s/"))
  );
  const [resolvedUri, setResolvedUri] = useState<string>(() => {
    if (isEhPage) {
      return getCachedEhentaiPageImage(uri) || "";
    }
    return uri;
  });

  useEffect(() => {
    let active = true;
    if (isEhPage) {
      const cached = getCachedEhentaiPageImage(uri);
      if (cached) {
        setResolvedUri(cached);
      } else {
        setLoading(true);
        resolveEhentaiPageImage(uri)
          .then((directUrl) => {
            if (active) {
              setResolvedUri(directUrl);
            }
          })
          .catch(() => {
            if (active) {
              setHasError(true);
              setLoading(false);
            }
          });
      }
    } else {
      setResolvedUri(uri);
    }
    return () => {
      active = false;
    };
  }, [uri, isEhPage]);

  useEffect(() => {
    softAttemptRef.current = 0;
    if (softTimerRef.current) {
      clearTimeout(softTimerRef.current);
      softTimerRef.current = null;
    }
    if (imageTimeoutRef.current) {
      clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
    }
    setRetryIndex(0);
    setSoftAttempt(0);
    setLoading(true);
    setHasError(false);
  }, [uri, resolvedUri]);

  useEffect(() => {
    return () => {
      if (softTimerRef.current) clearTimeout(softTimerRef.current);
      if (imageTimeoutRef.current) clearTimeout(imageTimeoutRef.current);
    };
  }, []);

  const activeSourceUri = resolvedUri || uri;

  // Build high-speed, unblocked CDN candidates
  const candidateUrls = useMemo(() => {
    if (!activeSourceUri) return [];

    const { host: targetHost, path: pathOnly } = resolveCdnHostAndPath(activeSourceUri);
    if (!targetHost || !pathOnly) {
      return [activeSourceUri];
    }

    return [...new Set([
      `https://i0.wp.com/${targetHost}/${pathOnly}`,
      `https://${targetHost}/${pathOnly}`,
      activeSourceUri,
    ])];
  }, [activeSourceUri]);

  // Subtle shimmer pulse when loading
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loading && !hasError) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.6,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.25,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      shimmerAnim.setValue(0.3);
    }
    return () => {
      anim?.stop();
    };
  }, [loading, hasError, shimmerAnim]);

  const baseUri = candidateUrls[retryIndex] || activeSourceUri;
  const currentUri =
    baseUri && softAttempt > 0
      ? `${baseUri}${baseUri.includes("?") ? "&" : "?"}_yr=${softAttempt}`
      : baseUri;
  const effectiveRecyclingKey = recyclingKey || activeSourceUri;
  const MAX_SOFT_RETRIES = 2;

  useEffect(() => {
    if (!loading || hasError || !currentUri) return;
    if (imageTimeoutRef.current) clearTimeout(imageTimeoutRef.current);
    imageTimeoutRef.current = setTimeout(() => {
      if (retryIndex < candidateUrls.length - 1) {
        setRetryIndex((prev) => prev + 1);
      } else {
        setLoading(false);
        setHasError(true);
      }
    }, 10_000);
    return () => {
      if (imageTimeoutRef.current) {
        clearTimeout(imageTimeoutRef.current);
        imageTimeoutRef.current = null;
      }
    };
  }, [loading, hasError, currentUri, retryIndex, candidateUrls.length]);

  const handleError = useCallback(() => {
    if (retryIndex < candidateUrls.length - 1) {
      setRetryIndex((prev) => prev + 1);
      return;
    }
    if (softAttemptRef.current < MAX_SOFT_RETRIES) {
      softAttemptRef.current += 1;
      const delayMs = 450 * softAttemptRef.current;
      if (softTimerRef.current) clearTimeout(softTimerRef.current);
      softTimerRef.current = setTimeout(() => {
        setRetryIndex(0);
        setSoftAttempt(softAttemptRef.current);
        setLoading(true);
        setHasError(false);
      }, delayMs);
      return;
    }
    setLoading(false);
    setHasError(true);
  }, [retryIndex, candidateUrls.length]);

  const handleLoad = useCallback(() => {
    softAttemptRef.current = 0;
    if (imageTimeoutRef.current) {
      clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
    }
    setLoading(false);
    setHasError(false);
  }, []);

  const handleManualRetry = useCallback(() => {
    softAttemptRef.current = 0;
    if (softTimerRef.current) {
      clearTimeout(softTimerRef.current);
      softTimerRef.current = null;
    }
    if (imageTimeoutRef.current) {
      clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
    }
    setRetryIndex(0);
    setSoftAttempt(0);
    setLoading(true);
    setHasError(false);
  }, []);

  const containerStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (typeof aspectRatio === "number" && Number.isFinite(aspectRatio) && aspectRatio > 0) {
      return [{ aspectRatio }, style];
    }
    return style;
  }, [aspectRatio, style]);

  return (
    <View style={[styles.container, containerStyle]}>
      {currentUri && (!isEhPage || resolvedUri) ? (
        <Image
          source={{
            uri: currentUri,
            headers: {
              Referer: refererForImage(currentUri),
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            },
          }}
          style={[StyleSheet.absoluteFillObject, style]}
          contentFit={contentFit}
          transition={0}
          priority={priority}
          cachePolicy="memory-disk"
          {...rest}
          blurRadius={sensitive && settings.blurNsfwCovers ? 24 : rest.blurRadius}
          onError={handleError}
          onLoad={handleLoad}
          onDisplay={handleLoad}
        />
      ) : null}

      {loading && !hasError && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.shimmerBox,
            { backgroundColor: "#151522", opacity: shimmerAnim },
          ]}
        >
          {showLoader && (
            <ActivityIndicator size="small" color={colors.accent} style={{ opacity: 0.6 }} />
          )}
        </Animated.View>
      )}

      {hasError && (
        <Pressable
          onPress={handleManualRetry}
          accessibilityRole="button"
          accessibilityLabel="Image indisponible. Réessayer le chargement"
          style={[StyleSheet.absoluteFillObject, styles.errorBox, { backgroundColor: "#13131d" }]}
        >
          <IconReload size={18} color="#6b7280" strokeWidth={1.8} />
          {showLoader && <Text style={styles.errorText}>Image indisponible{`\n`}Réessayer</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  shimmerBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#b5b5c4", fontSize: 12, textAlign: "center", marginTop: 8, paddingHorizontal: 8 },
});

export default SmartImage;
