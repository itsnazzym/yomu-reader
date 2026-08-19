import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { StyleSheet, View, Animated, ActivityIndicator, StyleProp, Pressable } from "react-native";
import { Image, ImageProps, ImageStyle } from "expo-image";
import { IconReload } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

export interface SmartImageProps extends Omit<ImageProps, "source"> {
  uri: string;
  style?: StyleProp<ImageStyle>;
  aspectRatio?: number;
  priority?: "low" | "normal" | "high";
  showLoader?: boolean;
  recyclingKey?: string;
}

/**
 * Résout précisément le domaine CDN nHentai (t.nhentai.net pour les miniatures/couvertures, i.nhentai.net pour les pages pleines)
 */
export function resolveCdnHostAndPath(uri: string): { host: string; path: string } {
  if (!uri) return { host: "", path: "" };
  const clean = uri.replace(/^https?:\/\//, "");
  const slashIdx = clean.indexOf("/");
  const rawHost = slashIdx !== -1 ? clean.slice(0, slashIdx).toLowerCase() : clean.toLowerCase();
  const pathOnly = slashIdx !== -1 ? clean.slice(slashIdx + 1) : "";

  if (!/(^|\.)nhentai\.net$/i.test(rawHost)) {
    return { host: rawHost, path: pathOnly };
  }

  // Toutes les miniatures, couvertures, et aperçus de pages sont sur t.nhentai.net (ou t1..t4)
  const isThumb =
    rawHost.startsWith("t") ||
    pathOnly.includes("thumb.") ||
    pathOnly.includes("cover.") ||
    /\/\d+t\.[a-z0-9]+$/i.test(pathOnly) ||
    /^\d+t\.[a-z0-9]+$/i.test(pathOnly);

  const targetHost = isThumb ? "t.nhentai.net" : "i.nhentai.net";
  return { host: targetHost, path: pathOnly };
}

/**
 * Résout l'URL optimisée Photon CDN pour un préchargement direct
 */
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
  ...rest
}: SmartImageProps) {
  const { colors } = useTheme();
  const [retryIndex, setRetryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Synchronously reset state if uri changed in recycled view
  const prevUriRef = useRef(uri);
  if (prevUriRef.current !== uri) {
    prevUriRef.current = uri;
    if (retryIndex !== 0) setRetryIndex(0);
    if (!loading) setLoading(true);
    if (hasError) setHasError(false);
  }

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  // Build high-speed, unblocked CDN candidates
  const candidateUrls = useMemo(() => {
    if (!uri) return [];

    const { host: targetHost, path: pathOnly } = resolveCdnHostAndPath(uri);
    if (!targetHost || !pathOnly) {
      return [uri];
    }

    return [
      // 1. Photon Edge CDN (Instant 200 OK, bypasses all French/EU ISP DNS blocks)
      `https://i0.wp.com/${targetHost}/${pathOnly}`,
      `https://i1.wp.com/${targetHost}/${pathOnly}`,
      `https://i2.wp.com/${targetHost}/${pathOnly}`,
      `https://i3.wp.com/${targetHost}/${pathOnly}`,
      // 2. DuckDuckGo Proxy
      `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(`https://${targetHost}/${pathOnly}`)}`,
      // 3. Direct original URL
      uri,
    ];
  }, [uri]);

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
            toValue: 0.3,
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
  }, [loading, hasError]);

  const currentUri = candidateUrls[retryIndex] || uri;
  const effectiveRecyclingKey = recyclingKey || uri;

  const handleError = useCallback(() => {
    if (retryIndex < candidateUrls.length - 1) {
      setRetryIndex((prev) => prev + 1);
    } else {
      setLoading(false);
      setHasError(true);
    }
  }, [retryIndex, candidateUrls.length]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setHasError(false);
  }, []);

  const handleManualRetry = useCallback(() => {
    setRetryIndex(0);
    setLoading(true);
    setHasError(false);
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: "#0d0d14" },
        aspectRatio ? { aspectRatio } : null,
        style as any,
      ]}
    >
      {currentUri && !hasError ? (
        <Image
          recyclingKey={effectiveRecyclingKey}
          source={{
            uri: currentUri,
            headers: {
              Referer: "https://nhentai.net/",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            },
          }}
          style={[StyleSheet.absoluteFillObject, style]}
          contentFit={contentFit}
          transition={0}
          priority={priority}
          cachePolicy="memory-disk"
          onError={handleError}
          onLoad={handleLoad}
          {...rest}
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
          style={[StyleSheet.absoluteFillObject, styles.errorBox, { backgroundColor: "#13131d" }]}
        >
          <IconReload size={18} color="#6b7280" stroke={1.8} />
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
});

export default SmartImage;
