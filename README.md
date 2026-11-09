# Jade : comment le code est rangé

Site en ligne : https://jadedating.app

## Les fichiers principaux

| Fichier | Ce qu'il contient |
|---|---|
| `index.html` | La structure des écrans (formulaires, boutons, sections). Il charge tous les autres fichiers. |
| `css/style.css` | L'apparence : couleurs, tailles, espacements. |
| `css/accueil-public.css` | L'apparence de la page d'accueil publique (visiteurs non connectés). |
| `css/messages.css` | L'apparence de l'écran de discussion (bulles, en-tête, fond). |
| `css/navigation.css` | L'apparence de la barre du bas, de l'en-tête et des cartes de l'Accueil. |
| `manifest.json` | Nom et couleur de l'appli quand on l'installe sur un téléphone. |
| `sw.js` | Fonctionnement hors connexion et notifications. |
| `CNAME` | Le nom de domaine (jadedating.app). Ne pas supprimer. |

## Le dossier `js/` (le fonctionnement de l'appli)

| Fichier | Partie de l'appli |
|---|---|
| `reglages.js` | Nom de l'appli, liste des pays |
| `textes/fr.js`, `textes/en.js`, `textes/th.js`… | Tous les textes, une langue par fichier |
| `langue.js` | Choix de la langue |
| `base.js` | Connexion à Supabase, outils communs, affichage du profil |
| `photos.js` | Photos du profil |
| `temps-reel.js` | Mises à jour en direct, présence en ligne |
| `connexion.js` | Inscription et connexion |
| `profil.js` | Création et modification du profil |
| `decouverte.js` | Découverte, like, pass, super like, filtres |
| `matchs.js` | Liste des matchs |
| `likes-vues.js` | Qui m'a liké, qui a vu mon profil |
| `conditions.js` | Conditions d'utilisation et confidentialité |
| `pastilles.js` | Pastilles de nouveaux messages et likes |
| `abonnements.js` | Abonnements Premium / Gold / Diamond, prix, liens Stripe |
| `activites.js` | Activités (sorties réelles) |
| `admin.js` | Espace administration |
| `messagerie.js` | Messagerie et traduction des messages |
| `signalement.js` | Signaler ou bloquer |
| `verification.js` | Vérification du profil |
| `compte.js` | Déconnexion et suppression du compte |
| `notifications.js` | Notifications |
| `parametres.js` | Mot de passe oublié et paramètres |
| `accueil-public.js` | Page d'accueil publique : boutons d'inscription et de connexion, choix des langues. Les textes sont les clés `lp_…` dans `js/textes/`. |
| `accueil.js` | Onglet Accueil : barre de recherche et cartes de profils |
| `navigation.js` | Barre du bas (Accueil, Intérêts, Activités, Messages) et en-tête (Mise à niveau, mon profil) |
| `demarrage.js` | Démarrage de l'appli (toujours chargé en dernier) |

## Le dossier `sql/` (réglages Supabase)

| Fichier | À quoi il sert |
|---|---|
| `sql/messages-sans-match.sql` | Permet d'écrire à n'importe quel membre (plus de match). À lancer une fois. |
| `sql/photos-discussion.sql` | Active l'envoi de photos dans la discussion (stockage privé + règles). À lancer une fois dans Supabase > SQL Editor. |

## Bon à savoir

- **Changer les couleurs** : en haut de `css/style.css` (vert olive `--olive`, crème `--cream`). Les couleurs de la discussion sont en haut de `css/messages.css`.

- **Changer un texte** : ouvre le fichier de la langue dans `js/textes/`. Le même mot-clé (par exemple `events_btn`) existe dans chaque langue.
- **Changer un prix** : `js/abonnements.js`, ligne `PRICES`.
- **Ajouter un nouveau fichier `js/`** : il faut aussi l'ajouter dans `index.html`, dans la liste des `<script>` en bas, avant `demarrage.js`. L'ordre compte.
- **Les 4 onglets du bas** : Accueil → `accueil.js`, Intérêts → `likes-vues.js`, Activités → `activites.js`, Messages → `matchs.js` et `messagerie.js`.
