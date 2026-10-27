/* Configuration de Dealr
   Collez ici les deux valeurs de votre projet Supabase :
   Supabase > Project Settings > API (ou "Data API").
   La clé "anon" (publique) peut figurer dans le site : la sécurité des données
   est assurée par les règles d'accès (RLS) créées avec le fichier supabase.sql.
   Ne mettez JAMAIS la clé "service_role" ici. */
window.DEALR_CONFIG = {
  SUPABASE_URL: "",       // exemple : "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "",  // exemple : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  /* Administrateurs (accès à admin.html : litiges, décisions, contact des membres).
     En mode démonstration, c'est cette liste qui fait foi.
     Avec Supabase, c'est la table « admins » de la base qui fait foi (voir la fin de supabase.sql) :
     modifier cette liste ne donne alors aucun droit. */
  ADMIN_EMAILS: ["alexisguillory091@gmail.com"]
};
