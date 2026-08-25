import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import {
  IconShare,
  IconX,
  IconQrcode,
  IconCopy,
  IconDevices,
} from "@tabler/icons-react-native";
import { QRCodeView } from "../ui/QRCodeView";
import { useTheme } from "../../lib/ThemeContext";
import { mediumImpact, successFeedback, warningFeedback } from "../../lib/haptics";

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
      successFeedback();
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.warn("[QuickShareModal] Échec de la copie dans le presse-papiers:", error);
      warningFeedback();
    }
  };

  const handleNativeShare = async () => {
    try {
      mediumImpact();

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
    } catch (error) {
      console.warn("[QuickShareModal] Échec du partage système:", error);
      warningFeedback();
    }
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

        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.page, borderColor: colors.tagBg },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                <IconShare size={18} color="#ffffff" strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Partage rapide</Text>
                <Text style={styles.headerSubtitle}>
                  Partage instantané via iOS, Android et code QR
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer le partage"
            >
              <IconX size={20} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Manga Badge Info */}
          <View style={[styles.mangaBadge, { backgroundColor: colors.tagBg }]}>
            <Text style={[styles.mangaId, { color: colors.accent }]}>#d{id}</Text>
            <Text style={[styles.mangaTitle, { color: colors.txt }]} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
          </View>

          {/* Quick System AirDrop / Share Action Button */}
          <TouchableOpacity
            style={[styles.airdropMainButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
            onPress={handleNativeShare}
            accessibilityRole="button"
            accessibilityLabel="Partager avec le partage système"
          >
            <View style={styles.airdropBtnContent}>
              <IconDevices size={20} color="#ffffff" strokeWidth={2} />
              <Text style={styles.airdropBtnText}>
                {Platform.OS === "ios"
                  ? "Envoyer via AirDrop / Partage iOS"
                  : "Partager via Quick Share / Android"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Mode Switcher Tabs */}
          <View style={[styles.tabsContainer, { backgroundColor: colors.bg }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "qr" && { backgroundColor: colors.accent + "26" },
              ]}
              onPress={() => setActiveTab("qr")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "qr" }}
              accessibilityLabel="Afficher le code QR"
            >
              <IconQrcode
                size={16}
                color={activeTab === "qr" ? colors.accent : colors.sub}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "qr" ? colors.accent : colors.sub },
                  activeTab === "qr" && styles.tabBtnTextActive,
                ]}
              >
                Code QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "links" && { backgroundColor: colors.accent + "26" },
              ]}
              onPress={() => setActiveTab("links")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "links" }}
              accessibilityLabel="Afficher les liens à copier"
            >
              <IconCopy
                size={15}
                color={activeTab === "links" ? colors.accent : colors.sub}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "links" ? colors.accent : colors.sub },
                  activeTab === "links" && styles.tabBtnTextActive,
                ]}
              >
                Copier les liens
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
                style={[styles.linkRow, { backgroundColor: colors.tagBg }]}
                onPress={() => handleCopy(shareUrl, "web")}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Copier le lien web ${shareUrl}`}
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Lien web</Text>
                  <Text style={styles.linkVal} numberOfLines={1} ellipsizeMode="tail">
                    {shareUrl}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    { backgroundColor: colors.tagBg },
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
                style={[styles.linkRow, { backgroundColor: colors.tagBg }]}
                onPress={() => handleCopy(markdownLink, "md")}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Copier le lien Markdown"
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Discord / Markdown</Text>
                  <Text style={styles.linkVal} numberOfLines={1} ellipsizeMode="tail">
                    {markdownLink}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    { backgroundColor: colors.tagBg },
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
                style={[styles.linkRow, { backgroundColor: colors.tagBg }]}
                onPress={() => handleCopy(String(id), "id")}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Copier l'identifiant ${id}`}
              >
                <View style={styles.linkInfo}>
                  <Text style={styles.linkLabel}>Identifiant du manga</Text>
                  <Text style={[styles.linkVal, { color: colors.accent, fontWeight: "700" }]}>
                    {idTag}
                  </Text>
                </View>
                <View
                  style={[
                    styles.copyPill,
                    { backgroundColor: colors.tagBg },
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  mangaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  mangaId: {
    fontSize: 12,
    fontWeight: "800",
  },
  mangaTitle: {
    flex: 1,
    fontSize: 12,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  airdropMainButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  airdropBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  airdropBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabBtnTextActive: {
    fontWeight: "700",
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  qrWhiteBox: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  qrHelpText: {
    fontSize: 11.5,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 16,
  },
  linksContainer: {
    gap: 10,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
  },
  linkInfo: {
    flex: 1,
    marginRight: 10,
  },
  linkLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    marginBottom: 2,
  },
  linkVal: {
    fontSize: 12.5,
    color: "#f3f4f6",
    fontWeight: "500",
  },
  copyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyPillActive: {
    backgroundColor: "#52c41a",
  },
  copyPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#ffffff",
  },
});
