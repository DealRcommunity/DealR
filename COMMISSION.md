# Modèle de commission et d'abonnements Dealr

Décision d'Alexis du 07/11/2026. À valider avec les associés et l'expert-comptable.
**Ce modèle n'est pas encore sur le site.** Il sera branché avec les vrais paiements (Stripe Connect).

---

## 1. Qui paie Dealr ?

**Les deux côtés**, chacun un peu :

- **Le client** paie des **frais de service de 5 %** en plus du prix du deal, quelle que soit l'offre du freelance. Ces frais couvrent les frais de paiement (Stripe).
- **Le freelance** paie une **commission** sur le montant du deal. Son taux dépend de son abonnement.
- **Minimum : 5 € de commission au total par deal** (client + freelance). Ce minimum évite de perdre de l'argent sur les petits deals.

## 2. La grille

| Offre freelance | Prix | Commission freelance | Frais client |
|---|---|---|---|
| **Gratuit** | 0 € | **7 %** | 5 % |
| **Pro** | 19,99 € / mois, sans engagement | **6 %** le 1er mois, **5 %** le 2e mois, **4 %** à partir du 3e mois | 5 % |
| **Premium** | 29,99 € / mois, sans engagement | **3 %** | 5 % |

Total pris par Dealr sur un deal : **12 %** (Gratuit), **11 % → 10 % → 9 %** (Pro), **8 %** (Premium).

### Règle proposée (à valider)
**Commission du freelance divisée par 2 après 6 mois avec le même client**, dans toutes les offres. Malt fait pareil (10 % → 5 %). Sans cette règle, Dealr peut être un peu plus cher que Malt pour les relations longues.

## 3. Chaque offre a sa place

Ce que paie le freelance par mois (Pro compté à 4 %, à partir du 3e mois) :

| Missions par mois | Gratuit | Pro | Premium | Malt (10 %) |
|---|---|---|---|---|
| 300 € | **21 €** | 31,99 € | 38,99 € | 30 € |
| 600 € | **42 €** | 43,99 € | 47,99 € | 60 € |
| 800 € | 56 € | **51,99 €** | 53,99 € | 80 € |
| 1 000 € | 70 € | 59,99 € | 59,99 € | 100 € |
| 1 500 € | 105 € | 79,99 € | **74,99 €** | 150 € |
| 3 000 € | 210 € | 139,99 € | **119,99 €** | 300 € |

- **Gratuit** est le plus avantageux jusqu'à environ **665 €** de missions par mois.
- **Pro** est le plus avantageux de **665 € à 1 000 €** par mois.
- **Premium** est le plus avantageux **au-delà de 1 000 €** par mois.
- Les 3 offres sont **toujours moins chères que Malt à 10 %**.

Pendant les 2 premiers mois, Pro (6 % puis 5 %) n'est intéressant que pour les gros volumes. Cette baisse progressive récompense la fidélité : il faudra l'expliquer clairement avec un exemple chiffré sur la page des offres.

## 4. Comparaison avec Malt (deal de 320 €, offre Gratuite)

| | Dealr | Malt |
|---|---|---|
| Commission freelance | 7 % (22,40 €) | 10 % (32 €) |
| Frais client | 5 % (16 €) | environ 5 % ou plus, selon l'offre du client |
| **Total** | **12 % (38,40 €)** | **15 % ou plus (48 € ou plus)** |

## 5. Ce que Stripe prend sur un deal (client et freelance en France, carte européenne)

| Moment | Frais |
|---|---|
| Le client paie | 1,5 % + 0,25 € sur le montant payé (frais client compris) |
| L'argent est bloqué au coffre | gratuit |
| Versement au freelance après validation | 0,25 % + 0,10 € |
| Fin du mois | 2 € par freelance payé dans le mois (une seule fois, même s'il a fait plusieurs deals) |

Cas particuliers :
- Les cartes premium ou professionnelles coûtent environ 1,9 %, les cartes hors Europe environ 3,25 % + 0,25 €.
- Un remboursement ne rend pas les frais de carte.
- Une contestation de paiement coûte environ 20 €.

Abonnements (Stripe Billing) : 1,5 % + 0,25 € par paiement, plus 0,7 % du montant facturé.

C'est **Dealr** qui paie les frais Stripe. Ils sont déduits de sa commission.

## 6. Marge de Dealr

Ce qui reste à Dealr par deal, après frais Stripe et cotisations URSSAF (environ 21,2 % en micro-entreprise). Ce n'est **jamais négatif** grâce au minimum de 5 € :

| Deal de | Gratuit | Pro 6 % | Pro 4 % | Premium 3 % |
|---|---|---|---|---|
| 50 € | 1,47 € | 1,07 € | 0,68 € | 0,68 € |
| 100 € | 5,28 € | 4,49 € | 2,92 € | 2,13 € |
| 320 € | 22,07 € | 19,55 € | 14,50 € | 11,98 € |
| 1 000 € | 73,96 € | 66,08 € | 50,32 € | 42,44 € |

Abonnements, net par abonné et par mois : **Pro ≈ 15,06 €**, **Premium ≈ 22,72 €**.

### Exemple d'un mois
100 freelances inscrits (70 Gratuit, 20 Pro, 10 Premium) et 30 deals de 320 € :

| | Montant |
|---|---|
| Abonnements | ≈ 528 € |
| Commissions | ≈ 586 € |
| **Total net** | **≈ 1 115 € par mois** |

Frais fixes à déduire :
- **environ 25 € par mois au minimum** (Supabase Pro + nom de domaine) ;
- **environ 150 € par mois** en ajoutant l'expert-comptable, l'assurance RC Pro et le médiateur.

## 7. Hypothèses des calculs

- Tarifs Stripe affichés en novembre 2026, carte européenne standard.
- Le freelance est payé une fois dans le mois (2 € de compte actif comptés sur chaque deal, ce qui est le cas le plus défavorable).
- Dealr en micro-entreprise : cotisations d'environ 21,2 % sur le chiffre d'affaires (commissions + abonnements), sans déduction des frais. L'impôt sur le revenu n'est pas compté.
- Pas de TVA sur la commission tant que Dealr reste en franchise (moins de 37 500 € de chiffre d'affaires par an). Plafond de la micro-entreprise : 83 600 € par an.

## 8. Avant de mettre en place

- [ ] Valider la grille avec les associés et l'expert-comptable.
- [ ] Décider de la règle « commission ÷ 2 après 6 mois avec le même client ».
- [ ] Décider si les abonnements sont ouverts dès le lancement ou seulement quand les missions arrivent régulièrement. Conseil : commencer avec l'offre Gratuite seule.
- [ ] Afficher clairement la commission et les frais client avant chaque paiement, et les écrire dans les conditions d'utilisation (obligatoire).
- [ ] Si une offre donne une mise en avant payante : la marquer « Sponsorisé » et modifier les mentions légales. Elles disent aujourd'hui qu'aucun prestataire ne paie pour être mieux classé.
- [ ] Brancher Stripe Connect (paiements des deals) et Stripe Billing (abonnements). Ça ferme aussi la faille critique « paiements simulés » (voir `SECURITE.md`).
- [ ] Revérifier les tarifs Stripe au moment d'ouvrir le compte.
