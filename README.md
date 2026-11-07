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

Créer une application Web dans le projet Firebase `tgi-manager-pro`, activer Google dans **Authentication → Sign-in method**, créer la base Firestore en mode production et ajouter le domaine de l’application aux domaines autorisés. Copier les six valeurs de configuration Web dans un fichier local `.env.local` (ne jamais le committer) :

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Le compte Google doit également figurer dans la liste blanche `src/config/access.ts`. Après l’activation de Google Auth et l’ajout des variables, redémarrer `npm run dev`. Les coordonnées de société restent disponibles depuis `src/config/company.ts` jusqu’à leur enregistrement par un propriétaire dans Firestore.

Pour déployer les règles Firestore :

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project tgi-manager-pro
```

Les coûts d’achat ne sont pas stockés dans `articles` : les règles Firestore ne savent pas filtrer les champs d’un document lors d’une lecture. Utiliser `articleCosts/{articleId}` (owner/DG seulement) pour ces informations afin qu’un commercial ne puisse pas les extraire en contournant l’interface.

## Ajouter un type de document

Ajouter la valeur dans `DocumentType` (`src/types/index.ts`), son préfixe et son titre, puis brancher sa variante dans `DocumentRenderer`. Adapter `DocumentLayout` uniquement si sa présentation ou ses règles diffèrent, et ajouter des tests de rendu et de numérotation.

Pour modifier l’adresse, les numéros légaux ou les coordonnées TGI, éditer `src/config/company.ts`.
