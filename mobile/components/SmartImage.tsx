import React, { useState, useCallback, useMemo, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, StyleProp } from "react-native";
import { Image, ImageProps, ImageStyle } from "expo-image";
import { useTheme } from "@/lib/ThemeContext";

export interface SmartImageProps extends Omit<ImageProps, "source"> {
  uri: string;
  style?: StyleProp<ImageStyle>;
  aspectRatio?: number;
  priority?: "low" | "normal" | "high";
}

export function SmartImage({
  uri,
  style,
  contentFit = "cover",
  aspectRatio,
  priority = "normal",
  ...rest
}: SmartImageProps) {
  const { colors } = useTheme();
  const [retryIndex, setRetryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Build high-speed, unblocked CDN candidates
  const candidateUrls = useMemo(() => {
    if (!uri) return [];

    // Extract path e.g. "galleries/4123755/thumb.webp" or clean host
    const clean = uri.replace(/^https?:\/\//, "");
    const isThumb = clean.includes("/thumb.") || clean.includes("t.nhentai.net") || clean.includes("t3.");
    const host = isThumb ? "t.nhentai.net" : "i.nhentai.net";
    const pathOnly = clean.replace(/^[^\/]+\//, "");

    return [
      // 1. Photon Edge CDN (Instant 200 OK, bypasses all French/EU ISP DNS blocks)
      `https://i0.wp.com/${host}/${pathOnly}`,
      `https://i1.wp.com/${host}/${pathOnly}`,
      `https://i2.wp.com/${host}/${pathOnly}`,
      // 2. DuckDuckGo Proxy
      `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(`https://${host}/${pathOnly}`)}`,
      // 3. Direct original URL
      uri,
    ];
  }, [uri]);

  useEffect(() => {
    setRetryIndex(0);
    setLoading(true);
    setHasError(false);
  }, [uri]);

  const currentUri = candidateUrls[retryIndex] || uri;

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.tagBg },
        aspectRatio ? { aspectRatio } : null,
        style as any,
      ]}
    >
      {currentUri ? (
        <Image
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
          transition={100}
          priority={priority}
          cachePolicy="memory-disk"
          onError={handleError}
          onLoad={handleLoad}
          {...rest}
        />
      ) : null}

      {loading && !hasError && (
        <View style={[StyleSheet.absoluteFillObject, styles.loader]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  loader: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SmartImage;
