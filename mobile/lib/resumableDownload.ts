/**
 * Reprise de téléchargement : calcul d'offset HTTP Range + classification de
 * la réponse du serveur.
 *
 * Les fonctions pures sont volontairement séparées de toute dépendance React
 * Native (aucun import) pour rester testables dans node --test sans mocks.
 */

export interface ResumeState {
  /** Chemin du fichier partiel (.part) */
  partialPath: string;
  /** Octets déjà écrits sur disque */
  partialSize: number;
  /** Taille totale attendue si connue, -1 sinon */
  totalBytes: number;
}

/**
 * Offset de reprise à passer en header `Range: bytes=<offset>-`.
 * Retourne 0 si :
 * - il n'y a rien de valide à reprendre (partiel vide/négatif),
 * - la taille totale est connue et le partiel l'atteint ou la dépasse
 *   (fichier corrompu ou déjà complet → repartir proprement).
 */
export function computeResumeOffset(p: {
  partialSize: number;
  totalBytes: number;
}): number {
  const partialSize = Math.floor(p.partialSize || 0);
  if (partialSize <= 0) return 0;
  if (p.totalBytes > 0 && partialSize >= p.totalBytes) return 0;
  return partialSize;
}

export type ResumeResponseKind = "resumed" | "restarted" | "failed";

/**
 * Classe la réponse HTTP à une requête avec Range :
 * - 206 Partial Content → le serveur a repris au bon offset ;
 * - 200 OK → le serveur a ignoré le Range et renvoie tout (on écrase le .part) ;
 * - autre statut → échec (erreur réseau, 403 URL expirée, etc.).
 */
export function classifyResumeResponse(status: number): ResumeResponseKind {
  if (status === 206) return "resumed";
  if (status === 200) return "restarted";
  return "failed";
}
