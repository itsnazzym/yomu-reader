import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QRCodeView } from "../ui/QRCodeView";
import { useTheme } from "../../lib/ThemeContext";

interface QuickShareModalProps {
  visible: boolean;
  onClose: () => void;
  gallery: {
    id: number | string;
    title?: string | { english?: string; pretty?: string };
    coverUrl?: string;
    filePath?: string;
  } | null;
}

export const QuickShareModal: React.FC<QuickShareModalProps> = ({
  visible,
  onClose,
  gallery,
}) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<"qr" | "links">("qr");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!gallery) return null;

  const id = gallery.id;
  const title =
    typeof gallery.title === "string"
      ? gallery.title
      : gallery.title?.pretty || gallery.title?.english || `Manga #${id}`;

  const shareUrl = `https://nhentai.net/g/${id}/`;
  const markdownLink = `[${title}](${shareUrl})`;
  const idTag = `#d${id}`;

  const handleCopy = async (text: string, key: string) => {
    try {
      await Clipboard.setStringAsync(text);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    try {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      if (gallery.filePath && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(gallery.filePath, {
          dialogTitle: `Partager ${title}`,
          mimeType: "application/vnd.comicbook+zip",
          UTI: "com.nhentai.cbz",
        });
        return;
      }

      await Share.share({
        title: title,
        message: `${title} - ${shareUrl}`,
        url: shareUrl,
      });
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.modalCard, { backgroundColor: "#181824", borderColor: "#2d2d3e" }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Feather name="share-2" size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Quick Share & AirDrop</Text>
                <Text style={styles.headerSubtitle}>
                  Partage immédiat iOS AirDrop, Android & QR Code
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Manga Badge Info */}
          <View style={styles.mangaBadge}>
            <Text style={styles.mangaId}>#d{id}</Text>
            <Text style={styles.mangaTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          {/* Quick System AirDrop / Share Action Button */}
          <TouchableOpacity
            style={styles.airdropMainButton}
            activeOpacity={0.8}
            onPress={handleNativeShare}
          >
            <View style={styles.airdropBtnContent}>
              <MaterialCommunityIcons
                name={(Platform.OS === "ios" ? "airplay" : "share-variant") as any}
                size={22}
                color="#ffffff"
              />
              <Text style={styles.airdropBtnText}>
                {Platform.OS === "ios"
                  ? "Envoyer via AirDrop / Partage iOS"
                  : "Partager via Quick Share / Android"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "qr" && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab("qr")}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={activeTab === "qr" ? "#ffffff" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "qr" && styles.tabBtnTextActive,
                ]}
              >
                QR Code Immédiat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "links" && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab("links")}
            >
              <Feather
                name="copy"
                size={15}
                color={activeTab === "links" ? "#ffffff" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === "links" && styles.tabBtnTextActive,
                ]}
              >
                Copier Liens
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          {activeTab === "qr" ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrWhiteBox}>
                <QRCodeView value={shareUrl} size={160} fgColor="#0c0c12" bgColor="#ffffff" />
              </View>

              <Text style={styles.qrHelpText}>
                Scannez avec l'appareil photo d'un smartphone pour ouvrir ce manga instantanément.
              </Text>
            </View>
          ) : (
            <View style={styles.linksContainer}>
              {/* Clean URL */}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => handleCopy(shareUrl, "web")}
                activeOpacity={0.7}
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Lien Web</Text>
                  <Text style={styles.linkVal} numberOfLines={1}>
                    {shareUrl}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    copiedKey === "web" && styles.copyPillActive,
                  ]}
                >
                  <Text style={styles.copyPillText}>
                    {copiedKey === "web" ? "Copié !" : "Copier"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Markdown */}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => handleCopy(markdownLink, "md")}
                activeOpacity={0.7}
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Discord / Markdown</Text>
                  <Text style={styles.linkVal} numberOfLines={1}>
                    {markdownLink}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    copiedKey === "md" && styles.copyPillActive,
                  ]}
                >
                  <Text style={styles.copyPillText}>
                    {copiedKey === "md" ? "Copié !" : "Copier"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Code ID */}
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => handleCopy(String(id), "id")}
                activeOpacity={0.7}
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Code Manga ID</Text>
                  <Text style={[styles.linkVal, { color: "#ed2553", fontWeight: "700" }]}>
                    {idTag}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    copiedKey === "id" && styles.copyPillActive,
                  ]}
                >
                  <Text style={styles.copyPillText}>
                    {copiedKey === "id" ? "Copié !" : "Copier"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#ed2553",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#252535",
  },
  mangaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#20202f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a2a3e",
  },
  mangaId: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ed2553",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  mangaTitle: {
    fontSize: 12,
    color: "#e5e7eb",
    fontWeight: "600",
    flex: 1,
  },
  airdropMainButton: {
    backgroundColor: "#ed2553",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#ed2553",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  airdropBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  airdropBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#20202e",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: "#2d2d42",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  tabBtnTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: 6,
  },
  qrWhiteBox: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  qrHelpText: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  linksContainer: {
    gap: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#20202f",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#29293c",
    gap: 10,
  },
  linkInfo: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  linkVal: {
    fontSize: 12,
    color: "#e5e7eb",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  copyPill: {
    backgroundColor: "#2c2c40",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  copyPillActive: {
    backgroundColor: "#10b981",
  },
  copyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
});
