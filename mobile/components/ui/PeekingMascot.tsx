import React, { useEffect } from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface PeekingMascotProps {
  style?: ViewStyle;
  size?: number;
}

export function PeekingMascot({ style, size = 52 }: PeekingMascotProps) {
  const bobAnim = useSharedValue(0);
  const touchScale = useSharedValue(1);

  useEffect(() => {
    bobAnim.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    touchScale.value = withSequence(
      withSpring(0.85, { damping: 8, stiffness: 350 }),
      withSpring(1.12, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bobAnim.value },
      { scale: touchScale.value },
    ] as const,
  }));

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 3.6 },
          animatedStyle,
          style,
        ]}
      >
        <Image
          source={require("@/assets/images/mascot_peeking.jpg")}
          style={styles.image}
          contentFit="cover"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#2d2d42",
    backgroundColor: "#1a1a26",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
