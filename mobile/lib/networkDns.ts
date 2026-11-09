import { NativeModules, Platform } from "react-native";

export const DNS_OPTIONS = [
  { id: "system", label: "DNS du téléphone", detail: "DNS intégré désactivé. Utilise le DNS privé Android, dont AdGuard si vous l’avez configuré." },
  { id: "cloudflare", label: "Cloudflare", detail: "DNS chiffré fourni par Cloudflare." },
  { id: "google", label: "Google", detail: "DNS chiffré fourni par Google." },
  { id: "adguard", label: "AdGuard", detail: "DNS chiffré avec filtrage des publicités et traqueurs." },
] as const;
export type DnsMode = typeof DNS_OPTIONS[number]["id"];
export interface NetworkProbe { host: string; result: string; elapsedMs: number }
interface NativeNetwork {
  getDnsMode(): Promise<DnsMode>;
  setDnsMode(mode: DnsMode): Promise<DnsMode>;
  diagnose(): Promise<NetworkProbe[]>;
}

function nativeNetwork(): NativeNetwork {
  const native = NativeModules.YomuNetwork as NativeNetwork | undefined;
  if (Platform.OS !== "android" || !native) {
    throw new Error("Les réglages DNS nécessitent la nouvelle version Android de Yomu.");
  }
  return native;
}

// Surface a failed bridge call as well; never leave the settings spinner stuck.
async function bounded<T>(operation: Promise<T>, ms = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("La demande réseau n’a pas abouti. Réessayez.")), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

export async function getDnsMode(): Promise<DnsMode> {
  const value = await bounded(nativeNetwork().getDnsMode());
  if (!DNS_OPTIONS.some((option) => option.id === value)) throw new Error("Réglage DNS invalide.");
  return value;
}
export async function setDnsMode(mode: DnsMode): Promise<DnsMode> {
  if (!DNS_OPTIONS.some((option) => option.id === mode)) throw new Error("Réglage DNS invalide.");
  return bounded(nativeNetwork().setDnsMode(mode));
}
export async function diagnoseNetwork(): Promise<NetworkProbe[]> {
  return bounded(nativeNetwork().diagnose(), 22_000);
}
