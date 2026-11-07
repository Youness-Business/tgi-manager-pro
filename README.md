# TGI Ascenseurs — Gestion interne

Application Next.js App Router pour consulter les clients, le catalogue et les documents commerciaux. L’authentification, les rôles et les données métier utilisent Firebase Authentication et Firestore.

## Installation et scripts

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
```

## Arborescence

- `src/app/` : routes, layouts, chargement, erreurs et styles globaux.
- `src/components/` : interfaces partagées, navigation et variantes de documents.
- `src/config/company.ts` : coordonnées et informations légales de la société.
- `src/config/access.ts` : comptes autorisés et rôles.
- `src/context/` : authentification et abonnements Firestore temps réel.
- `src/data/` : données de démonstration typées.
- `src/lib/` : calculs, formatage et règles métier.
- `src/types/` : types TypeScript partagés.
- `firestore.rules` : autorisations Firestore côté serveur.

## Configuration Firebase

Créer une application Web dans le projet Firebase `tgi-manager-pro`, activer **E-mail/Mot de passe** et **Google** dans **Authentication → Sign-in method**, créer la base Firestore en mode production et ajouter `localhost` ainsi que le domaine de production à **Authentication → Paramètres → Domaines autorisés**. Créer/configurer uniquement les comptes autorisés dans Firebase Authentication et vérifier `email_verified` pour chacun (aucune inscription publique n’est proposée par l’application). Copier les six valeurs de configuration Web dans un fichier local `.env.local` (ne jamais le committer) :

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Les trois adresses autorisées et leurs rôles sont définis dans `src/config/access.ts` et doivent correspondre à la validation de création de profil dans `firestore.rules`. Après l’activation de l’authentification E-mail/Mot de passe, la configuration des utilisateurs et l’ajout des variables, redémarrer `npm run dev`. Les coordonnées de société restent disponibles depuis `src/config/company.ts` jusqu’à leur enregistrement par un propriétaire dans Firestore.

Pour déployer les règles Firestore :

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project tgi-manager-pro
```

Les coûts d’achat ne sont pas stockés dans `articles` : les règles Firestore ne savent pas filtrer les champs d’un document lors d’une lecture. La collection `articlesCouts/{articleId}` (owner/DG seulement) contient ces informations afin qu’un commercial ne puisse pas les extraire en contournant l’interface.

Les paiements sont enregistrés de manière immuable dans `paiements`; les changements de statut sont ajoutés à `paiementEvenements`. Les factures historiques payées sans écriture de paiement restent reconnues comme réglées et ne reçoivent pas de faux paiements. L’import de démonstration complète les caches de montant et d’échéance manquants, puis ajoute des paiements et relances d’exemple sans doublon.

## Application installable (PWA)

La PWA utilise un service worker limité aux fichiers statiques et aux icônes. Les navigations sont toujours réseau d’abord avec une page de secours hors ligne ; Firestore, Firebase Auth, les routes API et les données de l’application ne sont jamais mises en cache. La persistance hors ligne de Firestore n’est pas activée et les opérations financières ou de stock sont refusées sans connexion.

Tester l’installation et la page hors ligne sur un build de production local :

```powershell
npm run build
npm run start
```

Ouvrir `http://localhost:3000` dans un navigateur compatible avec les service workers, puis utiliser le bouton d’installation ou le menu du navigateur. Sur iOS/iPadOS, utiliser Safari → **Partager** → **Sur l’écran d’accueil**. Pour vérifier le mode hors ligne, laisser le service worker installer sa version, activer **Offline** dans les outils de développement, puis recharger une page : l’application affiche `/offline` sans exposer de données mises en cache. Dans les outils de développement, contrôler le manifest, les six ressources d’icônes, l’activation du service worker, l’absence de requêtes Firestore dans le cache et le bandeau de mise à jour après un nouveau build. Tester Lighthouse en mode mobile après authentification.

Les nouveaux fichiers statiques et le service worker ne doivent être servis qu’en HTTPS en production. Une mise à jour détectée est activée uniquement après l’action explicite **Actualiser**.

## Ajouter un type de document

Ajouter la valeur dans `DocumentType` (`src/types/index.ts`), son préfixe et son titre, puis brancher sa variante dans `DocumentRenderer`. Adapter `DocumentLayout` uniquement si sa présentation ou ses règles diffèrent, et ajouter des tests de rendu et de numérotation.

Pour modifier l’adresse, les numéros légaux ou les coordonnées TGI, éditer `src/config/company.ts`.
