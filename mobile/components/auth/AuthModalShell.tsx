import React from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconX } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import Animated from "react-native-reanimated";
import { useModalMotion } from "@/components/motion/useModalMotion";
import { MotionGlyph } from "@/components/motion/MotionGlyph";

/** One bounded, scrollable form above the IME, including on small Android windows. */
export function AuthModalShell({ visible, onClose, title, children }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { presented, backdropStyle, cardStyle } = useModalMotion(visible);
  return (
    <Modal visible={presented} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.scrim, backdropStyle]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Animated.View style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }, cardStyle]}>
          <View style={[styles.header, { borderBottomColor: colors.tagBg }]}>
            <MotionGlyph kind="book" active={visible} />
            <Text accessibilityRole="header" style={[styles.title, { color: colors.txt }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer la connexion">
              <IconX size={22} color={colors.txt} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  scrim: { backgroundColor: "rgba(0,0,0,0.65)" },
  card: { width: "100%", maxWidth: 520, height: "92%", borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingLeft: 8, paddingRight: 8, paddingVertical: 6, borderBottomWidth: 1 },
  title: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "700", paddingVertical: 8 },
  close: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
});
