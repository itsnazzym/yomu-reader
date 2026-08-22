import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { IconLock } from "@tabler/icons-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/ThemeContext";
import { useAppLock } from "@/lib/appLockStore";

export function AppLockGate(): React.ReactElement | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { enabled, unlocked, biometric, unlockWithPin, tryBiometricUnlock } = useAppLock();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || unlocked || !biometric) return;
    void tryBiometricUnlock();
  }, [enabled, unlocked, biometric, tryBiometricUnlock]);

  if (!enabled || unlocked) return null;

  const handleSubmit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        setError("Code incorrect");
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.page, borderColor: colors.tagBg }]}>
        <IconLock size={28} color={colors.accent} strokeWidth={2} />
      </View>
      <Text style={[styles.title, { color: colors.txt }]}>Yomu verrouillé</Text>
      <Text style={[styles.sub, { color: colors.sub }]}>
        Entre ton code PIN pour ouvrir la bibliothèque.
      </Text>
      <TextInput
        value={pin}
        onChangeText={(value) => {
          setPin(value.replace(/\D/g, "").slice(0, 8));
          setError(null);
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={8}
        placeholder="PIN"
        placeholderTextColor="#6b7280"
        style={[styles.input, { backgroundColor: colors.page, color: colors.txt }]}
        onSubmitEditing={() => {
          void handleSubmit();
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          void handleSubmit();
        }}
        disabled={pin.length < 4 || busy}
        style={[
          styles.btn,
          { backgroundColor: pin.length < 4 ? colors.tagBg : colors.accent },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Déverrouiller</Text>
        )}
      </Pressable>
      {biometric ? (
        <Pressable
          onPress={() => {
            void tryBiometricUnlock();
          }}
          style={styles.bioBtn}
        >
          <Text style={[styles.bioText, { color: colors.accent }]}>Empreinte / Face ID</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
  },
  input: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: 10,
  },
  error: {
    color: "#ff4757",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  btn: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  bioBtn: {
    marginTop: 14,
    padding: 8,
  },
  bioText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
