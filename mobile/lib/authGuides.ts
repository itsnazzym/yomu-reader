export type GuideType = "ehentai_cookies" | "ehentai_forum" | "rule34_api" | "nhentai_session";

export interface AuthGuide {
  title: string;
  sourceLabel: string;
  location: string;
  illustrationTitle: string;
  fields: { name: string; destination: string; note: string }[];
  sequence?: string[];
  steps: string[];
  tips: string[];
}

/** Explanatory diagrams, never replicas of an authenticated page or real secrets. */
export const AUTH_GUIDES: Record<GuideType, AuthGuide> = {
  rule34_api: {
    title: "Configurer la clé API Rule34",
    sourceLabel: "Rule34",
    location: "Compte › Options",
    illustrationTitle: "API Access Credentials",
    sequence: ["Generate New Key", "Save", "Copier les valeurs"],
    fields: [
      { name: "api_key", destination: "Clé API Rule34", note: "La valeur située après api_key=." },
      { name: "user_id", destination: "User ID Rule34", note: "Le nombre situé après user_id=." },
    ],
    steps: [
      "Ouvrez les options de votre compte sur rule34.xxx.",
      "Dans « API Access Credentials », cochez « Generate New Key », puis enregistrez avec « Save ».",
      "Copiez la ligne contenant api_key et user_id. Collez-la dans l’un des deux champs Rule34 de Yomu : les valeurs sont réparties automatiquement.",
    ],
    tips: ["La clé est personnelle. Ne la partagez pas.", "Vous pouvez aussi renseigner les deux valeurs séparément."],
  },
  ehentai_cookies: {
    title: "Importer les cookies E-Hentai",
    sourceLabel: "E-Hentai / ExHentai",
    location: "Navigateur sur ordinateur › Application ou Stockage › Cookies",
    illustrationTitle: "Valeurs à copier",
    fields: [
      { name: "ipb_member_id", destination: "Identifiant membre", note: "Identifiant numérique de votre compte." },
      { name: "ipb_pass_hash", destination: "Cookie de connexion", note: "Copiez la valeur complète, sans le nom du cookie." },
      { name: "igneous", destination: "Cookie ExHentai", note: "À renseigner si vous utilisez ExHentai." },
    ],
    steps: [
      "Sur un ordinateur, connectez-vous à votre compte E-Hentai dans le navigateur.",
      "Ouvrez les outils de développement avec F12. Dans Chrome ou Edge, choisissez « Application » ; dans Firefox, « Stockage ». Ouvrez la rubrique « Cookies » du site concerné.",
      "Repérez les noms du schéma et copiez leurs valeurs dans les champs correspondants de Yomu. Pour ExHentai, consultez également les cookies de ce domaine.",
    ],
    tips: ["Les cookies donnent accès à votre session : gardez leurs valeurs privées.", "L’import d’une chaîne complète de cookies remplit aussi les champs automatiquement."],
  },
  ehentai_forum: {
    title: "Se connecter au forum E-Hentai",
    sourceLabel: "E-Hentai",
    location: "forums.e-hentai.org › Compte existant",
    illustrationTitle: "Votre compte, dans Yomu",
    fields: [
      { name: "Nom d’utilisateur", destination: "Nom d’utilisateur du forum", note: "Celui de votre compte sur le forum." },
      { name: "Mot de passe", destination: "Mot de passe du forum", note: "Saisi dans un champ masqué." },
    ],
    steps: [
      "Choisissez « Compte forum » dans la connexion E-Hentai de Yomu.",
      "Saisissez le nom d’utilisateur et le mot de passe de votre compte existant sur forums.e-hentai.org.",
      "Appuyez sur « Se connecter à E-Hentai » et attendez le résultat de la connexion.",
    ],
    tips: ["Si la connexion directe est refusée ou nécessite une vérification supplémentaire, utilisez l’import de cookies depuis une session déjà ouverte."],
  },
  nhentai_session: {
    title: "Retrouver la session nHentai",
    sourceLabel: "nHentai",
    location: "Navigateur sur ordinateur › Application ou Stockage › Cookies › nhentai.net",
    illustrationTitle: "Cookie de session",
    fields: [
      { name: "sessionid", destination: "Connexion nHentai de Yomu", note: "Copiez uniquement la valeur du cookie." },
    ],
    steps: [
      "Sur un ordinateur, connectez-vous à votre compte sur nhentai.net.",
      "Ouvrez les outils de développement (F12), puis « Application » ou « Stockage » et les cookies de nhentai.net.",
      "Repérez sessionid et copiez sa valeur. La connexion nHentai de Yomu distingue les types d’identifiants lors de l’import.",
    ],
    tips: ["Ne partagez pas le cookie de session. Si vous disposez d’une clé API nHentai, utilisez-la dans l’onglet « Clé API »."],
  },
};
