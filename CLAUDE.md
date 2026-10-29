# Consignes pour Claude (projet Dealr)

Dealr est une marketplace freelances / entreprises destinée à un vrai lancement commercial (vraies transactions, vrais utilisateurs). Le propriétaire est Alexis (GitHub `lapinou91`), associé à Jérémy (`jeremyseksik05-cloud`). Répondre en français, simplement : Alexis n'est pas développeur.

## Sécurité : demande explicite d'Alexis (29/10/2026)

- Tenir à jour `SECURITE.md` (registre des failles) à chaque nouvelle fonction et à chaque changement de la base.
- **Rappeler à Alexis les failles encore ouvertes** : en cours de route quand une tâche touche le sujet concerné (paiements, messagerie, comptes, données personnelles…), et systématiquement avant tout lancement ou mise en production.
- Appliquer les principes de sécurité à chaque modification : ne jamais faire confiance au navigateur pour ce qui compte (paiement, vérification, droits), règles d'accès (RLS) sur chaque table, données personnelles minimales, échappement de tout contenu affiché.
- Après chaque changement de schéma Supabase : lancer le contrôle de sécurité (advisors) et reporter le résultat.

## Base de données (Supabase)

- Projet `DealR`, id `oxlkjgbhsqfalfctuqqn`, région Paris, plan gratuit. Claude y a accès via le connecteur Supabase.
- `supabase.sql` est la copie de référence du schéma : toute migration appliquée doit y être ajoutée (en section numérotée) pour que le fichier reste rejouable de bout en bout.
- Annoncer à Alexis ce qui va être exécuté avant de modifier la base. Ne jamais supprimer de données sans son accord.
- `SUPABASE.md` liste ce qui reste à faire autour de Supabase.

## Site

- Site statique (HTML/CSS/JS, sans build), hébergé sur Netlify (site `jovial-crisp-3893a0`), publication automatique **verrouillée** : après un push, Alexis doit faire Trigger deploy puis Publish deploy.
- Dépôt : `DealRcommunity/DealR`, branche `main`.
- Tester en local avec une copie dont `config.js` est vidé (mode démonstration), jamais contre la vraie base.
