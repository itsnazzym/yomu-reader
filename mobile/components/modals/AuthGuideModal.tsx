import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from "react-native";
import { IconX, IconBook, IconExternalLink } from "@tabler/icons-react-native";
import { useTheme } from "@/lib/ThemeContext";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { lightTap } from "@/lib/haptics";

export type GuideType = "ehentai_cookies" | "ehentai_forum" | "rule34_api" | "nhentai_session";

interface GuideConfig {
  title: string;
  sourceLabel: string;
  badgeColor: string;
  image?: any;
  steps: string[];
  tips: string[];
}

const GUIDES: Record<GuideType, GuideConfig> = {
  rule34_api: {
    title: "Comment obtenir sa Clé API Rule34 gratuite",
    sourceLabel: "Rule34",
    badgeColor: "#7ebd78",
    image: require("@/assets/images/guides/rule34_api_guide.png"),
    steps: [
      "1. Rendez-vous sur rule34.xxx/index.php?page=account&s=options (Options de compte).",
      "2. Dans la section 'API Access Credentials', repérez le champ contenant &api_key=&user_id=...",
      "3. Cochez la case obligatoire : '[x] Generate New Key DO NOT CLICK IF YOU DON'T UNDERSTAND WHAT THIS IS'.",
      "4. Descendez tout en bas à gauche de la page et cliquez sur le bouton gris 'Save'.",
      "5. La page recharge : copiez la clé générée dans &api_key= ou collez toute la ligne dans Yomu !",
    ],
    tips: [
      "Votre User ID est le nombre après user_id= (ex: 6978141).",
      "Dans Yomu Reader, vous pouvez coller directement l'intégralité du texte &api_key=...&user_id=... : l'application remplit automatiquement les deux champs.",
    ],
  },
  ehentai_cookies: {
    title: "Comment récupérer les Cookies E-Hentai & ExHentai",
    sourceLabel: "E-Hentai / ExHentai",
    badgeColor: "#e63946",
    image: require("@/assets/images/guides/ehentai_cookies_guide.png"),
    steps: [
      "1. Sur votre PC ou navigateur mobile, connectez-vous sur e-hentai.org ou forums.e-hentai.org.",
      "2. Ouvrez les Outils de développement (touche F12 ou clic droit > Inspecter).",
      "3. Allez dans l'onglet 'Application' (Chrome/Edge) ou 'Stockage' (Firefox).",
      "4. Déroulez 'Cookies' > 'https://e-hentai.org'.",
      "5. Copiez les valeurs des cookies : ipb_member_id (nombre), ipb_pass_hash (32 caractères) et igneous (requis pour Panda 🐼).",
    ],
    tips: [
      "Le cookie 'igneous' est indispensable pour débloquer ExHentai (le Panda triste).",
      "Vous pouvez aussi exporter toute la chaîne de cookies (avec une extension de cookies) et la coller directement dans le champ 'Coller chaîne brute'.",
    ],
  },
  ehentai_forum: {
    title: "Connexion directe Forums E-Hentai IP.Board",
    sourceLabel: "E-Hentai Forum",
    badgeColor: "#e63946",
    steps: [
      "1. Utilisez vos identifiants de compte enregistrés sur les forums officiels (forums.e-hentai.org).",
      "2. Renseignez votre nom d'utilisateur et votre mot de passe de forum.",
      "3. L'application effectue l'authentification HTTPS isolée et extrait automatiquement vos cookies de session ipb.",
    ],
    tips: [
      "Si vous avez la vérification en 2 étapes activée sur votre compte forum, préférez le mode 'Cookies manuels'.",
    ],
  },
  nhentai_session: {
    title: "Synchronisation de compte nHentai",
    sourceLabel: "nHentai",
    badgeColor: "#ed2553",
    image: require("@/assets/images/guides/nhentai_session_guide.png"),
    steps: [
      "1. Connectez-vous à votre compte sur nhentai.net.",
      "2. Ouvrez la console DevTools (F12) > onglet 'Application' > 'Cookies' > 'https://nhentai.net'.",
      "3. Récupérez la valeur du cookie 'sessionid'.",
      "4. Renseignez-la pour synchroniser vos favoris en ligne directement dans l'application.",
    ],
    tips: [
      "Le cookie sessionid permet à Yomu d'ajouter et retirer des favoris directement sur votre profil en ligne.",
    ],
  },
};

export interface AuthGuideModalProps {
  visible: boolean;
  guideType: GuideType | null;
  onClose: () => void;
}

export function AuthGuideModal({ visible, guideType, onClose }: AuthGuideModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  if (!guideType || !GUIDES[guideType]) return null;
  const guide = GUIDES[guideType];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: "#12121a", borderColor: "#28283c" }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.badge, { backgroundColor: guide.badgeColor + "28" }]}>
                <Text style={[styles.badgeText, { color: guide.badgeColor }]}>{guide.sourceLabel}</Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.txt }]} numberOfLines={2}>
                {guide.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                lightTap();
                onClose();
              }}
              style={styles.closeBtn}
              accessibilityLabel="Fermer le guide"
            >
              <IconX size={20} color={colors.sub} />
            </TouchableOpacity>
          </View>

          {/* Contenu */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Capture d'écran exacte si disponible */}
            {guide.image && (
              <View style={styles.imageContainer}>
                <Image
                  source={guide.image}
                  style={[styles.guideImage, { width: Math.min(width - 64, 460) }]}
                  resizeMode="contain"
                />
                <Text style={styles.imageCaption}>
                  Capture d'écran exacte &bull; Éléments à repérer et valeurs à copier
                </Text>
              </View>
            )}

            {/* Étapes numérotées */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.txt }]}>Instructions détaillées :</Text>
              {guide.steps.map((st, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={[styles.stepText, { color: "#d1d5db" }]}>{st}</Text>
                </View>
              ))}
            </View>

            {/* Conseils & astuces */}
            {guide.tips.length > 0 && (
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>💡 Astuce pratique :</Text>
                {guide.tips.map((tp, i) => (
                  <Text key={i} style={styles.tipText}>
                    &bull; {tp}
                  </Text>
                ))}
              </View>
            )}

            {/* Bouton de fermeture */}
            <TouchableOpacity
              onPress={() => {
                lightTap();
                onClose();
              }}
              style={[styles.gotItBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
            >
              <ButtonLabel style={styles.gotItText}>J'ai compris, revenir à la connexion</ButtonLabel>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e2c",
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 18,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#0d0d14",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#242436",
  },
  guideImage: {
    height: 220,
    borderRadius: 8,
  },
  imageCaption: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 6,
    fontStyle: "italic",
    textAlign: "center",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  stepRow: {
    marginBottom: 8,
    paddingLeft: 4,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 19,
  },
  tipsBox: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38bdf8",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 18,
    marginBottom: 3,
  },
  gotItBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gotItText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
