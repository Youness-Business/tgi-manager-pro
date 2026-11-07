export type Client = {
  id: string;
  nom: string;
  adresse: string;
  telephone: string;
  ice: string;
};

export type Article = {
  id: string;
  reference: string;
  designation: string;
  categorie: ArticleCategory;
  prixUnitaireHT: number;
  unite: string;
  type?: "produit" | "service";
  stockQte?: number;
  seuilAlerte?: number;
  prixAchatHT?: number;
  prixVenteHT?: number;
  emplacement?: string;
};

export type ArticleCategory =
  | "Moteurs"
  | "Câbles"
  | "Portes"
  | "Électronique"
  | "Services";

export type DocumentType = "facture" | "devis" | "recu" | "bon_livraison";

export type DocumentStatus = "en_attente" | "paye" | "annule";

export type LigneDocument = {
  articleId: string;
  reference?: string;
  designation: string;
  qte: number;
  prixUnitaireHT: number;
};

export type PaymentMethod = "especes" | "virement" | "cheque";

export type DateInput =
  | Date
  | string
  | number
  | { seconds: number; nanoseconds?: number }
  | { toDate: () => Date }
  | null
  | undefined;

export type Document = {
  id: string;
  type: DocumentType;
  numero: string;
  clientId: string;
  dateCreation: DateInput;
  lignes: LigneDocument[];
  statut: DocumentStatus;
  remisePct?: number;
  modePaiement?: PaymentMethod;
  createdBy?: string;
  createdAt?: DateInput;
};

export type UserRole = "owner" | "dg" | "commercial";

export type UserProfile = {
  uid: string;
  email: string;
  nom: string;
  role: UserRole;
  actif: boolean;
  createdAt?: DateInput;
  photoURL?: string;
};

export type ContratType = "maintenance" | "installation";
export type Periodicite = "mensuelle" | "trimestrielle" | "annuelle";
export type ContratStatut = "actif" | "expire" | "resilie" | "brouillon";

export type FacturePeriode = {
  key: string;
  debut: DateInput;
  fin: DateInput;
  documentId: string;
};

export type Contrat = {
  id: string;
  numero: string;
  clientId: string;
  ascenseurIds: string[];
  type: ContratType;
  dateDebut: DateInput;
  dateFin: DateInput;
  periodicite: Periodicite;
  montantHT: number;
  visitesParAn: number;
  reconductionAuto: boolean;
  statut: ContratStatut;
  conditionsParticulieres: string;
  prochaineFacturation: DateInput;
  facturesPeriodes?: FacturePeriode[];
  motifResiliation?: string;
  createdBy?: string;
  createdAt?: DateInput;
  counterKey?: string;
  sequence?: number;
  year?: number;
  yearKey?: string;
};

export type AscenseurStatut =
  | "en_service"
  | "en_panne"
  | "arret"
  | "en_installation";

export type Ascenseur = {
  id: string;
  clientId: string;
  site: string;
  adresse: string;
  marque: string;
  modele: string;
  numeroSerie: string;
  annee: number;
  capacite: number;
  nbNiveaux: number;
  typeMachine: string;
  dateMiseEnService: DateInput;
  contratId?: string;
  statut: AscenseurStatut;
  prochaineVisite: DateInput;
  createdAt?: DateInput;
};

export type InterventionType = "visite" | "depannage" | "installation";
export type InterventionStatut = "a_planifier" | "planifiee" | "terminee";

export type PieceIntervention = {
  articleId: string;
  designation: string;
  qte: number;
};

export type Intervention = {
  id: string;
  numero: string;
  ascenseurId: string;
  type: InterventionType;
  date: DateInput;
  technicien: string;
  rapport: string;
  descriptionProbleme?: string;
  piecesUtilisees: PieceIntervention[];
  statut: InterventionStatut;
  duree: number;
  signatureClient: boolean;
  nomSignataire: string;
  createdBy?: string;
  createdAt?: DateInput;
  counterKey?: string;
  sequence?: number;
  year?: number;
  yearKey?: string;
};
