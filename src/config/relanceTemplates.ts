export const relanceTemplates: Record<1 | 2 | 3, string> = {
  1: [
    "Objet : Rappel amiable de règlement",
    "Bonjour {client},",
    "",
    "Sauf erreur de notre part, la facture {numero}, d’un montant de {montant}, arrivée à échéance le {echeance}, reste en attente de règlement depuis {retard} jour(s).",
    "Nous vous remercions de bien vouloir procéder à son règlement ou de nous informer de sa date prévisionnelle.",
    "",
    "Bien cordialement,",
    "TGI Ascenseurs",
  ].join("\n"),
  2: [
    "Objet : Relance de règlement — facture {numero}",
    "Bonjour {client},",
    "",
    "Malgré notre précédent rappel, la facture {numero} de {montant}, échue le {echeance} ({retard} jour(s) de retard), demeure impayée.",
    "Merci de régulariser la situation ou de nous confirmer une date ferme de paiement.",
    "",
    "Cordialement,",
    "TGI Ascenseurs",
  ].join("\n"),
  3: [
    "Objet : Mise en demeure de régler la facture {numero}",
    "Madame, Monsieur,",
    "",
    "Nous vous mettons en demeure de régler sous huit jours la facture {numero}, d’un montant de {montant}, échue le {echeance} et présentant {retard} jour(s) de retard.",
    "À défaut de règlement ou d’accord écrit dans ce délai, nous nous réservons le droit d’engager les démarches appropriées.",
    "",
    "Veuillez agréer, Madame, Monsieur, nos salutations distinguées.",
    "TGI Ascenseurs",
  ].join("\n"),
};

export function buildRelanceMessage(
  level: 1 | 2 | 3,
  values: {
    client: string;
    numero: string;
    montant: string;
    echeance: string;
    retard: number;
  },
): string {
  return relanceTemplates[level].replace(
    /\{(client|numero|montant|echeance|retard)\}/g,
    (_match, key: keyof typeof values) => String(values[key]),
  );
}
