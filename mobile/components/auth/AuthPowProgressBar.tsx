import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { PowProgress } from "@/lib/api/v2/config";

export interface AuthPowProgressBarProps {
  progress: PowProgress;
  accent: string;
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "calcul…";
  }

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (totalSeconds < 1) return "< 1 s";
  if (totalSeconds < 60) return `~${totalSeconds} s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `~${minutes} min ${seconds} s` : `~${minutes} min`;
}

function formatRate(attemptsPerSecond: number): string {
  if (!Number.isFinite(attemptsPerSecond) || attemptsPerSecond <= 0) {
    return "mesure du débit…";
  }
  return `${Math.round(attemptsPerSecond).toLocaleString("fr-FR")} essais/s`;
}

export function AuthPowProgressBar({
  progress,
  accent,
}: AuthPowProgressBarProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const percent = Math.max(0, Math.min(99, progress.percent));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1_200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const shimmerWidth = 64;
  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, trackWidth],
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>Calcul cryptographique</Text>
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
            {progress.nonce.toLocaleString("fr-FR")} essais ·{" "}
            {formatRate(progress.attemptsPerSecond)} · ETA{" "}
            {formatDuration(progress.etaMs)}
          </Text>
        </View>
        <Text style={styles.percent}>{Math.round(percent)}%</Text>
      </View>

      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(2, percent)}%`,
              backgroundColor: accent,
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              width: shimmerWidth,
              backgroundColor: accent,
              transform: [{ translateX: shimmerX }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#f3f4f6",
    fontSize: 12,
    fontWeight: "800",
  },
  meta: {
    color: "#9ca3af",
    fontSize: 10.5,
  },
  percent: {
    color: "#f3f4f6",
    fontSize: 12,
    fontWeight: "800",
  },
  track: {
    height: 7,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    opacity: 0.8,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    opacity: 0.55,
  },
});
