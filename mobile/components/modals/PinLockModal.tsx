import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { IconLock, IconX } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";

interface PinLockModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
}

export function PinLockModal({
  visible,
  title,
  subtitle,
  confirmLabel = "Enregistrer",
  onClose,
  onSubmit,
}: PinLockModalProps) {
  const { colors } = useTheme();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setPin("");
    setConfirm("");
    setError(null);
  };

  const handleSave = async (): Promise<void> => {
    if (pin.length < 4) {
      setError("4 chiffres minimum");
      return;
    }
    if (pin !== confirm) {
      setError("Les codes ne correspondent pas");
      return;
    }
    const ok = await onSubmit(pin);
    if (ok) {
      reset();
      onClose();
    } else {
      setError("Impossible d'enregistrer le code");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          reset();
          onClose();
        }}
      >
        <Pressable
          style={[styles.card, { backgroundColor: colors.page, borderColor: colors.tagBg }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <IconLock size={16} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.title, { color: colors.txt }]}>{title}</Text>
            </View>
            <Pressable
              onPress={() => {
                reset();
                onClose();
              }}
              hitSlop={8}
            >
              <IconX size={16} color={colors.sub} strokeWidth={2} />
            </Pressable>
          </View>
          {subtitle ? (
            <Text style={[styles.sub, { color: colors.sub }]}>{subtitle}</Text>
          ) : null}
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="Nouveau PIN"
            placeholderTextColor="#6b7280"
            style={[styles.input, { backgroundColor: colors.bg, color: colors.txt }]}
          />
          <TextInput
            value={confirm}
            onChangeText={(value) => setConfirm(value.replace(/\D/g, "").slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="Confirmer"
            placeholderTextColor="#6b7280"
            style={[styles.input, { backgroundColor: colors.bg, color: colors.txt }]}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => {
              void handleSave();
            }}
            style={[styles.btn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.btnText}>{confirmLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  sub: {
    fontSize: 12,
    marginBottom: 10,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
    letterSpacing: 4,
  },
  error: {
    color: "#ff4757",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
  },
});
