/* Configuration de Dealr
   Collez ici les deux valeurs de votre projet Supabase :
   Supabase > Project Settings > API (ou "Data API").
   La clé "anon" (publique) peut figurer dans le site : la sécurité des données
   est assurée par les règles d'accès (RLS) créées avec le fichier supabase.sql.
   Ne mettez JAMAIS la clé "service_role" ici. */
window.DEALR_CONFIG = {
  SUPABASE_URL: "https://oxlkjgbhsqfalfctuqqn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bGtqZ2Joc3FmYWxmY3R1cXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNjE4ODksImV4cCI6MjEwODgzNzg4OX0.01jKP9E8Q87uQw1KZPZmB2Bj8Iy4yvZGUiusNwGAIFw",

  /* Administrateurs (accès à admin.html : litiges, décisions, contact des membres).
     En mode démonstration, c'est cette liste qui fait foi.
     Avec Supabase, c'est la table « admins » de la base qui fait foi (voir la fin de supabase.sql) :
     modifier cette liste ne donne alors aucun droit. */
  ADMIN_EMAILS: ["alexisguillory091@gmail.com"]
};
