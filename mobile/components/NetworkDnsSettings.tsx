import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { IconCheck } from "@tabler/icons-react-native";
import { DNS_OPTIONS, diagnoseNetwork, getDnsMode, setDnsMode, type DnsMode, type NetworkProbe } from "@/lib/networkDns";
import { useTheme } from "@/lib/ThemeContext";
import { CardPressable } from "./ui/CardPressable";
import { ButtonLabel } from "./ui/ButtonLabel";

export function NetworkDnsSettings() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<DnsMode | null>(null);
  const [busy, setBusy] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<NetworkProbe[]>([]);
  useEffect(() => {
    let active = true;
    void getDnsMode().then((value) => { if (active) setMode(value); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const select = async (value: DnsMode) => {
    setBusy(true); setError(""); setResults([]);
    try { setMode(await setDnsMode(value)); }
    catch (e) { setError(e instanceof Error ? e.message : "Modification impossible."); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setTesting(true); setError(""); setResults([]);
    try { setResults(await diagnoseNetwork()); }
    catch (e) { setError(e instanceof Error ? e.message : "Diagnostic impossible."); }
    finally { setTesting(false); }
  };
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.txt }]}>Résolution DNS</Text>
      <Text style={[styles.detail, { color: colors.sub }]}>Choix appliqué aux nouvelles connexions du catalogue et des images, sans redémarrage.</Text>
      {DNS_OPTIONS.map((option) => (
        <CardPressable key={option.id} disabled={busy || testing} onPress={() => void select(option.id)}
          accessibilityRole="radio" accessibilityState={{ selected: mode === option.id, disabled: busy || testing }}
          accessibilityLabel={option.label} radius={8}
          style={[styles.option, { borderColor: mode === option.id ? colors.sub : colors.tagBg }]}>
          <View style={{ flex: 1 }}>
            <ButtonLabel style={[styles.label, { color: colors.txt }]}>{option.label}</ButtonLabel>
            <Text style={[styles.detail, { color: colors.sub }]}>{option.detail}</Text>
          </View>
          {mode === option.id && <IconCheck size={20} color={colors.txt} />}
        </CardPressable>
      ))}
      {busy && <ActivityIndicator color={colors.sub} />}
      <CardPressable disabled={busy || testing || !mode} onPress={() => void test()} radius={8}
        accessibilityRole="button" accessibilityLabel="Tester la connexion" style={[styles.test, { backgroundColor: colors.tagBg }]}>
        {testing && <ActivityIndicator size="small" color={colors.sub} />}
        <ButtonLabel style={{ color: colors.txt }}>{testing ? "Test en cours…" : "Tester la connexion"}</ButtonLabel>
      </CardPressable>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.txt }]}>{error}</Text> : null}
      {results.map((probe) => <Text key={probe.host} selectable style={[styles.detail, { color: colors.txt }]}>
        {probe.host} · {probe.result} · {(probe.elapsedMs / 1000).toFixed(1)} s
      </Text>)}
      {results.length > 0 && <Text style={[styles.detail, { color: colors.sub }]}>HTTP indique que le serveur a répondu. Un code 403 ou 429 signale un refus ou une limitation, pas un échec DNS. Ce test ne garantit pas l’accès à chaque galerie.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 }, title: { fontSize: 16, fontWeight: "700" },
  detail: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: "600", textAlign: "left", marginBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14, borderRadius: 8 },
  test: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, borderRadius: 8 },
});
