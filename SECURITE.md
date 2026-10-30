# Sécurité de Dealr : registre des failles

Ce registre liste les failles connues, ce qui a été corrigé et ce qui reste à faire avant le lancement. Il est mis à jour à chaque audit et à chaque nouvelle fonction.

Dernier audit : 29 octobre 2026 (base Supabase, règles d'accès, code du site). Mis à jour le 29/10 au soir : pièces jointes.

Niveaux : **Critique** = à corriger avant d'accepter de vrais utilisateurs ou de l'argent réel. **Élevé** = avant le lancement public. **Moyen** = dans les premiers mois. **Faible** = à surveiller.

## À corriger avant le lancement

### Critique

- [ ] **Paiements simulés : un membre peut se déclarer « payé » lui-même.** Aujourd'hui, c'est le navigateur qui fait passer un deal à « argent au coffre » puis « versé ». Avec deux comptes complices, on peut fabriquer de faux deals conclus, donc obtenir le badge « profil validé » et laisser de faux avis 5 étoiles.
  - Correction : brancher un vrai prestataire de paiement (Stripe Connect, Mangopay, Lemonway). Les passages `funded`, `released` et `refunded` devront être faits uniquement par le serveur (Edge Function appelée par le prestataire de paiement), jamais par le navigateur.
  - En attendant : le badge et les avis ne prouvent rien. Ne pas les mettre en avant comme une garantie.
- [ ] **Vérification du SIREN faite dans le navigateur.** Une personne technique peut marquer ses informations juridiques comme « vérifiées » sans passer par le registre officiel, et obtenir le badge « Entreprise vérifiée ».
  - Correction : une Edge Function qui interroge le registre (recherche-entreprises.api.gouv.fr) et pose elle-même `verified = true`. Le verrouillage après vérification est déjà en place.
- [ ] **Compte administrateur protégé par un simple mot de passe.** Quelqu'un qui le devine ou le vole voit toutes les conversations et tranche les litiges.
  - Correction : activer la double authentification (MFA) dans Supabase et l'exiger pour les pages admin. Mot de passe long et unique pour ce compte.

### Élevé

- [ ] **Un membre peut saisir le SIRET de quelqu'un d'autre.** Le SIRET est contrôlé (numéro valide, entreprise existante si choisie dans le registre), mais rien ne prouve que la personne est bien le dirigeant de cette entreprise. Elle pourrait faire des deals et des factures au nom d'une autre entreprise.
  - Correction : vérification d'identité (KYC) faite par le prestataire de paiement (Stripe, Mangopay le font, entreprise comprise) avant tout versement, et comparaison du nom du dirigeant avec le registre.
- [ ] **Faux messages « système » possibles dans la messagerie.** Un participant peut envoyer un message qui ressemble à un événement de deal (par exemple « paiement reçu »). Son nom reste affiché, mais ça peut tromper.
  - Correction : les messages d'événement de deal doivent être créés par la base (déclencheur sur la table `deals`), et les membres ne doivent pouvoir écrire que des messages texte.
- [ ] **Aucune limite d'envoi.** Un compte peut envoyer des centaines de messages, ouvrir des conversations avec tous les membres, créer des comptes en série.
  - Correction : limites par compte dans la base (nombre de messages par minute, nouvelles conversations par jour), bouton « Signaler », CAPTCHA à l'inscription (Supabase → Attack Protection).
- [ ] **Nom de famille complet lisible par tous.** Le site n'affiche que l'initiale (« Nina R. »), mais le nom complet est stocké dans le profil public et lisible via l'API.
  - Correction : stocker le nom de famille dans une partie privée du profil (RGPD : ne publier que le nécessaire).
- [ ] **Pages légales manquantes.** Les liens « Mentions légales », « Conditions d'utilisation » et « Confidentialité » du pied de page ne mènent nulle part. Obligatoires pour une plateforme qui traite des données personnelles et de l'argent.
  - Correction : rédiger ces pages (idéalement validées par un juriste), ajouter la suppression de compte et l'export des données (RGPD).
- [ ] **Pas de sauvegarde de la base.** Le plan gratuit de Supabase ne fait pas de sauvegardes automatiques.
  - Correction : passer au plan Pro avant le lancement (sauvegardes quotidiennes), ou exporter la base régulièrement.

### Moyen

- [ ] **Fichiers en base64 dans la base.** Justificatifs de certification, photos et portfolio sont stockés dans les tables. Ça alourdit la base (limite 500 Mo en gratuit).
  - Correction : Supabase Storage, avec un dossier privé pour les justificatifs.
- [ ] **Pièces jointes non analysées par un antivirus.** Un membre peut envoyer un PDF piégé. Les fichiers sont limités aux PDF et images (5 Mo), privés et ouverts depuis le domaine de Supabase, pas celui de Dealr, ce qui limite les risques pour le site, mais pas pour l'ordinateur de la personne qui les ouvre.
  - Correction : analyse antivirus à l'envoi (Edge Function + service d'analyse), et un message de prudence pour les fichiers venant de membres inconnus.
- [ ] **Librairie Supabase chargée depuis un site externe sans contrôle d'intégrité.** Si ce site était piraté, il pourrait injecter du code dans Dealr.
  - Correction : héberger le fichier dans le site, ou ajouter un contrôle d'intégrité (SRI).
- [ ] **Pas de politique de sécurité du contenu (CSP).** Elle limiterait les dégâts en cas d'injection de code.
  - Correction : l'ajouter dans `_headers`, en la testant d'abord en mode « Report-Only ».
- [ ] **Protection contre les mots de passe piratés désactivée** (vérification avec HaveIBeenPwned). Réglage Supabase, sans doute réservé au plan Pro.
- [ ] **Envoi d'emails limité** (environ 2 par heure avec le service intégré de Supabase). Brancher Brevo ou Resend (SMTP) avant le lancement, sinon des inscrits ne pourront pas confirmer leur compte.

## Corrigé

- [x] **29/10/2026 – Mot de passe de 8 caractères minimum exigé aussi par Supabase** (réglé par Alexis), plus seulement par le site.
- [x] **29/10/2026 – Usurpation du support dans la messagerie.** La fiche d'un participant (nom, photo, mention « support ») était écrite par le navigateur : un membre pouvait apparaître comme « Équipe Dealr ». Elle est maintenant construite par la base à partir des profils (supabase.sql, section 12 c). Le site ne reconnaît plus le support par son nom.
- [x] **29/10/2026 – Noms réservés.** Un membre ne peut plus prendre un nom contenant « Dealr » (section 12 d).
- [x] **29/10/2026 – Taille des profils limitée à 2 Mo**, pour éviter qu'un compte remplisse la base (section 12 d).
- [x] **29/10/2026 – Fonctions de contrôle durcies** : chemin de recherche fixe, fonction interne des avis et fonction « suis-je admin ? » fermées aux visiteurs (sections 12 a, b, e).
- [x] **29/10/2026 – En-têtes de sécurité Netlify** (fichier `_headers`) : le site ne peut plus être affiché dans un cadre d'un autre site (protection contre le « clickjacking »), HTTPS imposé.
- [x] **29/10/2026 – Liens du portfolio** marqués `nofollow` (pas de bonus de référencement pour les spammeurs).
- [x] Avant l'audit : règles d'accès (RLS) sur toutes les tables, messages et deals visibles des seuls participants, deals ne pouvant avancer que dans l'ordre prévu, avis seulement à la fin d'un deal et une seule fois, justificatifs de certification privés, informations juridiques verrouillées après vérification, administrateurs définis uniquement dans la base.
- [x] **29/10/2026 – Pièces jointes de la messagerie conçues de façon sécurisée** : espace de fichiers privé (aucun lien public), dossier par conversation, lecture et envoi réservés aux deux participants et à l'équipe Dealr, liens temporaires de 2 minutes, formats limités (PDF, JPG, PNG, WebP : pas de SVG ni de HTML, qui pourraient contenir du code), 5 Mo maximum contrôlés par Supabase, nom de fichier nettoyé (section 13).
- [x] **30/10/2026 – Règles des deals appliquées par la base** : un freelance ou une entreprise sans SIRET valide ne peut ni proposer ni accepter de deal, et un compte particulier ne peut jamais être payé (section 14). Le site applique les mêmes règles, mais ce n'est plus lui qui décide.

## Choix assumés (signalés par Supabase, mais voulus)

- **Vue `certifications_public` (alerte « Security Definer View »)** : elle doit être lisible par tous et ne montre que les certifications vérifiées, sans justificatif.
- **Table `admins` sans règle** : volontairement illisible depuis le site.
- **Fonctions `is_admin_id`, `deals_done`, `open_support` appelables** : le site en a besoin. Elles ne renvoient que « oui/non », un nombre de deals par membre, ou ouvrent une conversation avec le support.

## Routine

- Après chaque changement de la base : relancer le contrôle de sécurité Supabase (Advisors → Security) et mettre ce registre à jour.
- Avant le lancement : tout ce qui est « Critique » et « Élevé » doit être corrigé.
