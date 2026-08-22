import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  PanResponder,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  IconX,
  IconCheck,
  IconPhoto,
  IconRotateClockwise,
  IconZoomIn,
  IconZoomOut,
  IconRefresh,
  IconMove,
  IconSparkles,
} from "@/components/ui/TablerIcons";
import { useTheme } from "@/lib/ThemeContext";
import { lightTap } from "@/lib/haptics";

const CROP_SIZE = 260; // Size of the circular crop viewport in px

export interface AvatarCropResult {
  uri: string;
  isAnimatedGif: boolean;
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

interface AvatarCropModalProps {
  visible: boolean;
  initialImageUri?: string | null;
  username?: string;
  onClose: () => void;
  onSave: (result: AvatarCropResult) => Promise<void>;
}

export function AvatarCropModal({
  visible,
  initialImageUri,
  username = "User",
  onClose,
  onSave,
}: AvatarCropModalProps) {
  const { colors } = useTheme();

  const [currentUri, setCurrentUri] = useState<string | null>(initialImageUri || null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [saving, setSaving] = useState(false);
  const [isAnimatedGif, setIsAnimatedGif] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ width?: number; height?: number; ext?: string }>({});

  // Sync initialImageUri when opened
  useEffect(() => {
    if (visible) {
      if (initialImageUri) {
        setupImage(initialImageUri);
      } else {
        handlePickImage();
      }
    } else {
      // Reset state on close
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
      setRotation(0);
    }
  }, [visible, initialImageUri]);

  const setupImage = (uri: string) => {
    setCurrentUri(uri);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setRotation(0);

    const clean = uri.toLowerCase();
    const isGif = clean.endsWith(".gif") || clean.includes("image/gif") || clean.includes(".gif?");
    setIsAnimatedGif(isGif);

    const extMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch ? extMatch[1].toUpperCase() : isGif ? "GIF" : "IMG";
    setImageMeta({ ext });
  };

  // PanResponder to allow dragging/repositioning the image
  const panOffset = useRef({ x: 0, y: 0 });
  const panCurrent = useRef({ x: 0, y: 0 });

  useEffect(() => {
    panCurrent.current = { x: translateX, y: translateY };
  }, [translateX, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panOffset.current = { ...panCurrent.current };
      },
      onPanResponderMove: (_evt, gestureState) => {
        const maxOffset = CROP_SIZE * (scale - 0.5);
        const nextX = Math.max(-maxOffset, Math.min(maxOffset, panOffset.current.x + gestureState.dx));
        const nextY = Math.max(-maxOffset, Math.min(maxOffset, panOffset.current.y + gestureState.dy));
        setTranslateX(nextX);
        setTranslateY(nextY);
      },
      onPanResponderRelease: () => {
        lightTap();
      },
    })
  ).current;

  // Pick an image from device gallery/storage (supports all formats: GIF, PNG, JPG, WebP, etc.)
  const handlePickImage = async () => {
    lightTap();
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission requise",
          "Veuillez autoriser l'accès à la galerie pour sélectionner votre photo de profil."
        );
        if (!currentUri) onClose();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false, // We use our custom pan/zoom/crop viewport for full control
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setupImage(asset.uri);
      } else if (!currentUri) {
        onClose();
      }
    } catch (err: unknown) {
      console.warn("Image picker error:", err);
      Alert.alert("Erreur", "Impossible de charger l'image sélectionnée.");
      if (!currentUri) onClose();
    }
  };

  const handleRotate = () => {
    lightTap();
    setRotation((r) => (r + 90) % 360);
  };

  const handleZoom = (delta: number) => {
    lightTap();
    setScale((s) => Math.max(1, Math.min(3.5, Number((s + delta).toFixed(2)))));
  };

  const handleReset = () => {
    lightTap();
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setRotation(0);
  };

  // Save the cropped / chosen avatar to local documentDirectory
  const handleConfirmSave = async () => {
    if (!currentUri) return;
    lightTap();
    setSaving(true);
    try {
      const avatarDir = `${FileSystem.documentDirectory}avatars/`;
      const dirInfo = await FileSystem.getInfoAsync(avatarDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });
      }

      // Determine extension (preserve .gif for animation, or .png / .jpg)
      let ext = "png";
      if (isAnimatedGif || currentUri.toLowerCase().endsWith(".gif")) {
        ext = "gif";
      } else if (currentUri.toLowerCase().endsWith(".jpg") || currentUri.toLowerCase().endsWith(".jpeg")) {
        ext = "jpg";
      } else if (currentUri.toLowerCase().endsWith(".webp")) {
        ext = "webp";
      }

      const destFilename = `avatar_${Date.now()}.${ext}`;
      const destUri = `${avatarDir}${destFilename}`;

      // Copy the original asset to the application's persistent documents directory
      await FileSystem.copyAsync({
        from: currentUri,
        to: destUri,
      });

      await onSave({
        uri: destUri,
        isAnimatedGif,
        scale,
        translateX,
        translateY,
        rotation,
      });

      onClose();
    } catch (err: unknown) {
      console.warn("Avatar save error:", err);
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible d'enregistrer la photo de profil."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: "#12121a", borderColor: "#28283a" }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.modalTitle}>Recadrer la photo</Text>
                {isAnimatedGif && (
                  <View style={[styles.gifBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.gifBadgeText}>GIF ANIMÉ ✦</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalSub}>
                Glissez et zoomez pour cadrer votre avatar nHentai
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <IconX size={20} color="#9ca3af" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Interactive Crop Viewport */}
          <View style={styles.cropViewportContainer}>
            <View style={styles.cropFrame} {...panResponder.panHandlers}>
              {currentUri ? (
                <View
                  style={[
                    styles.imageTransformContainer,
                    {
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                        { rotate: `${rotation}deg` },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: currentUri }}
                    style={styles.fullImage}
                    contentFit="cover"
                  />
                </View>
              ) : (
                <ActivityIndicator size="large" color={colors.accent} />
              )}

              {/* Darkened Mask with Circular Cutout */}
              <View style={styles.cutoutRingOverlay} pointerEvents="none">
                <View style={[styles.cutoutCircle, { borderColor: colors.accent }]} />
                {/* Subtle reticle crosshairs */}
                <View style={styles.crosshairH} />
                <View style={styles.crosshairV} />
              </View>

              {/* Drag Hint Pill */}
              <View style={styles.dragHintPill} pointerEvents="none">
                <IconMove size={12} color="#fff" strokeWidth={2} />
                <Text style={styles.dragHintText}>Glisser pour déplacer</Text>
              </View>
            </View>
          </View>

          {/* Preview Row & Format info */}
          <View style={styles.previewsRow}>
            <View style={styles.previewItem}>
              <View style={[styles.miniAvatarWrap, { width: 52, height: 52, borderColor: colors.accent }]}>
                {currentUri && (
                  <Image
                    source={{ uri: currentUri }}
                    style={[
                      styles.miniAvatarImg,
                      {
                        transform: [
                          { translateX: translateX * (52 / CROP_SIZE) },
                          { translateY: translateY * (52 / CROP_SIZE) },
                          { scale },
                          { rotate: `${rotation}deg` },
                        ],
                      },
                    ]}
                    contentFit="cover"
                  />
                )}
              </View>
              <Text style={styles.previewLabel}>Profil</Text>
            </View>

            <View style={styles.previewItem}>
              <View style={[styles.miniAvatarWrap, { width: 34, height: 34, borderColor: "#3a3a4c" }]}>
                {currentUri && (
                  <Image
                    source={{ uri: currentUri }}
                    style={[
                      styles.miniAvatarImg,
                      {
                        transform: [
                          { translateX: translateX * (34 / CROP_SIZE) },
                          { translateY: translateY * (34 / CROP_SIZE) },
                          { scale },
                          { rotate: `${rotation}deg` },
                        ],
                      },
                    ]}
                    contentFit="cover"
                  />
                )}
              </View>
              <Text style={styles.previewLabel}>Commentaire</Text>
            </View>

            <View style={styles.previewMeta}>
              <Text style={styles.metaTitle} numberOfLines={1}>
                {username}
              </Text>
              <Text style={styles.metaSub}>
                Format : <Text style={{ color: "#fff", fontWeight: "700" }}>{imageMeta.ext || "Image"}</Text> · {scale.toFixed(1)}x
              </Text>
            </View>
          </View>

          {/* Controls Bar: Zoom, Rotate, Reset */}
          <View style={styles.controlsBar}>
            {/* Zoom Controls */}
            <View style={styles.zoomControlGroup}>
              <Pressable
                onPress={() => handleZoom(-0.2)}
                disabled={scale <= 1}
                style={[styles.toolBtn, scale <= 1 && styles.toolBtnDisabled]}
                accessibilityLabel="Zoom arrière"
              >
                <IconZoomOut size={16} color={scale <= 1 ? "#555" : "#f3f4f6"} strokeWidth={2} />
              </Pressable>

              <View style={styles.scaleDisplay}>
                <Text style={styles.scaleText}>{scale.toFixed(1)}x</Text>
              </View>

              <Pressable
                onPress={() => handleZoom(0.2)}
                disabled={scale >= 3.5}
                style={[styles.toolBtn, scale >= 3.5 && styles.toolBtnDisabled]}
                accessibilityLabel="Zoom avant"
              >
                <IconZoomIn size={16} color={scale >= 3.5 ? "#555" : "#f3f4f6"} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Rotate & Reset Buttons */}
            <View style={styles.extraToolsGroup}>
              <Pressable
                onPress={handleRotate}
                style={styles.toolBtnWithLabel}
                accessibilityLabel="Pivoter de 90 degrés"
              >
                <IconRotateClockwise size={16} color="#f3f4f6" strokeWidth={2} />
                <Text style={styles.toolBtnLabel}>{rotation}°</Text>
              </Pressable>

              <Pressable
                onPress={handleReset}
                style={styles.toolBtnWithLabel}
                accessibilityLabel="Réinitialiser le cadrage"
              >
                <IconRefresh size={15} color="#9ca3af" strokeWidth={2} />
                <Text style={styles.toolBtnLabel}>Centrer</Text>
              </Pressable>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handlePickImage}
              style={[styles.changeImageBtn, { borderColor: "#2c2c3e", backgroundColor: "#181826" }]}
            >
              <IconPhoto size={16} color="#f3f4f6" strokeWidth={2} />
              <Text style={styles.changeImageText}>Autre image</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirmSave}
              disabled={saving || !currentUri}
              style={[
                styles.saveBtn,
                { backgroundColor: currentUri ? colors.accent : "#2d2d40" },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconCheck size={18} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Valider l'Avatar</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f3f4f6",
    letterSpacing: -0.2,
  },
  gifBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gifBadgeText: {
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalSub: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e1e2c",
    alignItems: "center",
    justifyContent: "center",
  },
  cropViewportContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  cropFrame: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0d0d14",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  imageTransformContainer: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: CROP_SIZE,
    height: CROP_SIZE,
  },
  cutoutRingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  cutoutCircle: {
    width: CROP_SIZE - 12,
    height: CROP_SIZE - 12,
    borderRadius: (CROP_SIZE - 12) / 2,
    borderWidth: 2,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  crosshairH: {
    position: "absolute",
    width: 16,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  crosshairV: {
    position: "absolute",
    height: 16,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  dragHintPill: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  dragHintText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  previewsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161622",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222234",
  },
  previewItem: {
    alignItems: "center",
    gap: 4,
  },
  miniAvatarWrap: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1.5,
    backgroundColor: "#0d0d14",
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarImg: {
    width: "100%",
    height: "100%",
  },
  previewLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#9ca3af",
  },
  previewMeta: {
    flex: 1,
    marginLeft: 4,
    gap: 2,
  },
  metaTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  metaSub: {
    fontSize: 11,
    color: "#9ca3af",
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  zoomControlGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181826",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "#242436",
  },
  scaleDisplay: {
    paddingHorizontal: 8,
    minWidth: 42,
    alignItems: "center",
  },
  scaleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#202030",
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnDisabled: {
    opacity: 0.4,
  },
  extraToolsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolBtnWithLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#181826",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: "#242436",
  },
  toolBtnLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#d1d5db",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  changeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  changeImageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
});
