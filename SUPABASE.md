# Passage à Supabase : ce qu'il faudra faire

Dealr est maintenant branché à une vraie base Supabase (projet `dealr`, région Europe/Paris). Ce fichier liste ce qui est fait et ce qu'il reste à régler.

Dernière mise à jour : 29 octobre 2026 (branchement fait le jour même).

## 1. Mise en route (obligatoire)

- [x] **Créer le projet Supabase** (région Europe/Paris). Fait le 29/10/2026, projet `dealr`, organisation `DealR`, plan Free.
- [x] **Remplir `config.js`** avec `SUPABASE_URL` et `SUPABASE_ANON_KEY`. Fait et poussé sur GitHub.
- [x] **Exécuter tout `supabase.sql`** dans le SQL Editor (sections 0 à 10). Fait le 29/10/2026, succès.
- [x] **Créer le compte administrateur** (alexisguillory091@gmail.com), confirmer son email et l'insérer dans la table `admins`. Fait le 29/10/2026 (une ligne dans `admins`).
- [x] **Réglages d'authentification** (Authentication → URL Configuration). Fait le 29/10/2026 :
  - Site URL : `https://jovial-crisp-3893a0.netlify.app`
  - Redirect URLs : `…/connexion.html` et `…/connexion.html?reset=1`
  - **À refaire** si le site change d'adresse (nom de domaine définitif).
- [ ] **Emails en français** : personnaliser les emails de confirmation et de réinitialisation (Authentication → Emails).
- [ ] **Envoi d'emails** : le service d'email intégré de Supabase est limité (quelques emails par heure). Avant le lancement, brancher un vrai service d'envoi (SMTP : Brevo, Resend…) dans Authentication → Emails → SMTP Settings.
- [ ] **Vérifier que le bandeau « Mode démonstration »** a disparu sur toutes les pages.
- [ ] **Test à deux comptes** : créer un second compte (prestataire ou entreprise de test) et vérifier, depuis un autre appareil ou navigateur, qu'il apparaît bien dans la marketplace — preuve que les données sont partagées et non plus stockées par navigateur.
- [ ] **Test avec Jérémy** : qu'il crée un compte sur le vrai site et vérifier que vous voyez bien les mêmes données tous les deux.

## 2. Ce qui ne marche vraiment qu'avec Supabase (à tester maintenant que c'est branché)

- [ ] **Support** : tester l'envoi d'un message depuis la page Contact avec un compte membre, et la réponse depuis le compte admin.
- [ ] **Mot de passe oublié** : tester la réception de l'email de réinitialisation.
- **Messagerie** : rafraîchissement toutes les 4 secondes (`messages.html`). À remplacer plus tard par Supabase Realtime pour recevoir les messages instantanément.

## 3. Sécurité à renforcer

- [ ] **Informations juridiques des entreprises** (section 10) : la vérification SIREN via le registre officiel se fait dans le navigateur. Une personne technique pourrait marquer une saisie comme « vérifiée » sans passer par le registre. À faire : une **Edge Function** qui interroge le registre (recherche-entreprises.api.gouv.fr) et pose elle-même `verified = true`. Le verrouillage après vérification est déjà en place dans la base.
- [ ] **Paiements** : ils sont **simulés** (aucun argent réel). Le passage d'un deal à `funded` (argent au coffre) et à `released` / `refunded` devra être fait **par le serveur** après confirmation d'un vrai prestataire de paiement (Stripe Connect, Mangopay, Lemonway…), jamais par le navigateur. Voir la note « IMPORTANT pour la version réelle » dans la section 4 de `supabase.sql`.
- [x] **Accès administrateur** : seul le compte présent dans la table `admins` accède à `admin.html`.
- Note : la vue `certifications_public` apparaît « UNRESTRICTED » dans Supabase. C'est voulu : elle ne montre que les certifications vérifiées, sans justificatif.

## 4. Stockage des fichiers (à déplacer vers Supabase Storage)

En démonstration, les fichiers étaient enregistrés en texte (base64) dans les données. Avec Supabase, il vaudra mieux utiliser **Storage** :

- [ ] **Justificatifs de certification** (aujourd'hui dans la table `certifications`, 1,5 Mo max) → bucket **privé**, lisible seulement par le membre et les admins.
- [ ] **Photos de profil, logos et portfolio** (aujourd'hui dans `profiles.data`) → bucket public, avec une taille maximale.
- [ ] **PDF des devis et factures** : aujourd'hui recréés à la demande. Envisager de conserver l'original de chaque facture (obligation de conservation).

## 5. Données de démonstration

- [x] **Profils d'exemple** (`profils.js`, `DEALR_PROS`) affichés sur l'accueil et la marketplace : **décision du 29/10/2026, on les garde** pour les tests et le marketing, avec la mention « Profil d'exemple ». À reconsidérer quand il y aura assez de vrais membres.
- [ ] **Missions de la marketplace** : aujourd'hui une liste fixe dans `marketplace.html`. Créer une table `missions` (publication d'un besoin par une entreprise ou un particulier).

## 6. Factures et obligations légales

- [ ] **Freelances** : seules les entreprises doivent remplir leurs informations juridiques avant de facturer. Décider si on applique la même règle aux freelances (SIRET obligatoire).
- [ ] Faire valider le modèle de facture par un comptable. Prévoir la **facturation électronique** obligatoire en France (réception obligatoire pour toutes les entreprises depuis septembre 2026 ; émission obligatoire en septembre 2026 pour les grandes et moyennes entreprises, en septembre 2027 pour les PME et microentreprises).

## 7. Après chaque mise à jour du code

- [ ] Relancer `supabase.sql` si le fichier a changé. Depuis le 29/10/2026, Claude applique lui-même les changements de la base via le connecteur Supabase (sections 11 et 12 déjà appliquées).
- [ ] Sur Netlify : déployer puis publier (la publication automatique est verrouillée).

## Sécurité

Voir `SECURITE.md` : registre des failles, mis à jour à chaque audit.

## Rappels utiles

- **Mot de passe de la base Postgres** : généré à la création du projet, gardé par Alexis. Ne jamais le partager.
- **Clé `service_role` / `secret`** : jamais mise dans le code ni partagée, contrairement à la clé `anon` (publique, déjà dans `config.js`).
- **Confirmer un compte à la main** (si un email n'arrive pas) : dans le SQL Editor, `update auth.users set email_confirmed_at = now() where email = '…';`
- **Donner les droits admin** : `insert into public.admins (user_id) select id from auth.users where email = '…' on conflict do nothing;`
- Formulaire de contact : Netlify Forms, avec notification par email (fonctionne déjà, hors Supabase).
- Recherche de villes : fichier `communes-fr.json` dans le site (pas de base nécessaire).
- Recherche d'entreprises et d'adresses : services publics gratuits appelés depuis le navigateur (hors Supabase).
