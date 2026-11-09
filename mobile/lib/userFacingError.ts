/** Messages destinés à l'interface : ne pas exposer URL, adresse réseau ou réponse brute. */
export function userFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/abort|timeout|timed out|dépassé/i.test(message)) return "Le serveur met trop de temps à répondre. Réessayez.";
  if (/429|rate.?limit|trop de requêtes/i.test(message)) return "La source reçoit trop de demandes. Patientez avant de réessayer.";
  if (/403|forbidden|cloudflare|access.denied/i.test(message)) return "La source refuse temporairement l'accès. Réessayez ou choisissez une autre source.";
  if (/404|not.found|introuvable/i.test(message)) return "Ce titre n'est plus disponible sur cette source.";
  if (/network|connect|fetch|offline|socket|resolve|host|http|https?:\/\//i.test(message)) return "Connexion à la source impossible. Vérifiez votre réseau puis réessayez.";
  return "L'opération n'a pas pu aboutir. Réessayez.";
}
