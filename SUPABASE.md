# Passage à Supabase : ce qu'il faudra faire

Aujourd'hui, Dealr fonctionne en **mode démonstration** : comptes, profils, messages, deals et documents sont enregistrés dans le navigateur de chaque visiteur. Ce fichier liste tout ce qu'il faudra régler ou modifier le jour où l'on branche la vraie base Supabase.

Dernière mise à jour : 29 octobre 2026.

## 1. Mise en route (obligatoire)

- [ ] **Créer le projet Supabase** (région Europe, pour les données des membres).
- [ ] **Remplir `config.js`** avec `SUPABASE_URL` et `SUPABASE_ANON_KEY` (Project Settings → API). Ne jamais y mettre la clé `service_role`.
- [ ] **Exécuter tout `supabase.sql`** dans le SQL Editor (sections 0 à 10). Le fichier peut être relancé sans risque après chaque mise à jour.
- [ ] **Créer le compte administrateur** sur le site, puis relancer la section 6 de `supabase.sql` (insertion dans la table `admins`). Avec Supabase, c'est cette table qui donne les droits admin, plus la liste `ADMIN_EMAILS` de `config.js`.
- [ ] **Réglages d'authentification** (Authentication → URL Configuration) :
  - Site URL : l'adresse du site Netlify (ou le nom de domaine définitif).
  - Redirect URLs : ajouter `…/connexion.html` et `…/connexion.html?reset=1` (confirmation de compte et mot de passe oublié).
  - Personnaliser en français les emails de confirmation et de réinitialisation.
- [ ] **Vérifier que le bandeau « Mode démonstration »** a disparu sur toutes les pages.

## 2. Ce qui ne marche vraiment qu'avec Supabase

- **Support** : en démonstration, la discussion avec « Équipe Dealr » ne fonctionne que dans le même navigateur. Avec Supabase, elle passe par la fonction `open_support` (section 7) : tester l'envoi depuis la page Contact avec un compte membre, et la réponse depuis le compte admin.
- **Messagerie** : rafraîchissement toutes les 4 secondes (`messages.html`). À remplacer plus tard par Supabase Realtime pour recevoir les messages instantanément.
- **Mot de passe oublié** : désactivé en démonstration, à tester avec Supabase.

## 3. Sécurité à renforcer

- [ ] **Informations juridiques des entreprises** (section 10) : la vérification SIREN via le registre officiel se fait dans le navigateur. Une personne technique pourrait marquer une saisie comme « vérifiée » sans passer par le registre. À faire : une **Edge Function** qui interroge le registre (recherche-entreprises.api.gouv.fr) et pose elle-même `verified = true`. Le verrouillage après vérification est déjà en place dans la base.
- [ ] **Paiements** : ils sont **simulés** (aucun argent réel). Le passage d'un deal à `funded` (argent au coffre) et à `released` / `refunded` devra être fait **par le serveur** après confirmation d'un vrai prestataire de paiement (Stripe Connect, Mangopay, Lemonway…), jamais par le navigateur. Voir la note « IMPORTANT pour la version réelle » dans la section 4 de `supabase.sql`.
- [ ] **Accès administrateur** : vérifier que seuls les comptes de la table `admins` voient `admin.html` et `admin-certifs.html`.

## 4. Stockage des fichiers (à déplacer vers Supabase Storage)

En démonstration, les fichiers sont enregistrés en texte (base64) dans les données. Avec Supabase, il vaudra mieux utiliser **Storage** :

- [ ] **Justificatifs de certification** (aujourd'hui dans la table `certifications`, 1,5 Mo max) → bucket **privé**, lisible seulement par le membre et les admins.
- [ ] **Photos de profil, logos et portfolio** (aujourd'hui dans `profiles.data`) → bucket public, avec une taille maximale.
- [ ] **PDF des devis et factures** : aujourd'hui recréés à la demande. Envisager de conserver l'original de chaque facture (obligation de conservation).

## 5. Données de démonstration à retirer ou signaler

- [ ] **Profils d'exemple** (`profils.js`, `DEALR_PROS`) affichés sur l'accueil et la marketplace : à retirer, ou à garder avec la mention « Profil d'exemple ».
- [ ] **Missions de la marketplace** : aujourd'hui une liste fixe dans `marketplace.html`. Créer une table `missions` (publication d'un besoin par une entreprise ou un particulier).

## 6. Factures et obligations légales

- [ ] **Freelances** : seules les entreprises doivent remplir leurs informations juridiques avant de facturer. Décider si on applique la même règle aux freelances (SIRET obligatoire).
- [ ] Faire valider le modèle de facture par un comptable. Prévoir la **facturation électronique** obligatoire en France (réception obligatoire pour toutes les entreprises depuis septembre 2026 ; émission obligatoire en septembre 2026 pour les grandes et moyennes entreprises, en septembre 2027 pour les PME et microentreprises).

## 7. Après chaque mise à jour du code

- [ ] Relancer `supabase.sql` si le fichier a changé (les sections récentes : 9 certifications, 10 informations juridiques).
- [ ] Sur Netlify : déployer puis publier (la publication automatique est verrouillée).

## Hors Supabase, déjà en place

- Formulaire de contact : Netlify Forms, avec notification par email (fonctionne déjà).
- Recherche de villes : fichier `communes-fr.json` dans le site (pas de base nécessaire).
- Recherche d'entreprises et d'adresses : services publics gratuits appelés depuis le navigateur.
