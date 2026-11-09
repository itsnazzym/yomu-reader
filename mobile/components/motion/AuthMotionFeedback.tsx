import React from "react";
import { StyleSheet, Text } from "react-native";
import { AnimatePresence, MotiView } from "moti";
import { IconAlertCircle } from "@tabler/icons-react-native";
import { useReduceMotion } from "@/lib/reduceMotion";
import { MotionGlyph } from "./MotionGlyph";

export function AuthMotionFeedback({ loading, error, success, active }: {
  loading: boolean;
  error?: string | null;
  success?: string | null;
  active: boolean;
}) {
  const reduced = useReduceMotion();
  const status = error ? "error" : success ? "success" : loading ? "loading" : null;
  const message = error || success || "Connexion en cours…";
  return <AnimatePresence>
    {status && <MotiView key={`${status}:${message}`}
      from={{ opacity: 0, translateY: reduced ? 0 : 16 }}
      animate={{ opacity: 1, translateY: 0, translateX: status === "error" && !reduced ? [0, -10, 10, -6, 6, 0] : 0 }}
      exit={{ opacity: 0 }} transition={{ type: "timing", duration: reduced ? 80 : 180 }}
      style={styles.row}>
      {status === "error" ? <IconAlertCircle size={26} color="#ffb4ab" /> :
        <MotionGlyph kind={status === "success" ? "success" : "loading"} active={active} />}
      <Text accessibilityRole={status === "error" ? "alert" : "text"}
        accessibilityLiveRegion={status === "error" ? "assertive" : "polite"}
        style={[styles.message, { color: status === "error" ? "#ffb4ab" : "#d9dfe7" }]}>{message}</Text>
    </MotiView>}
  </AnimatePresence>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  message: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21 },
});
