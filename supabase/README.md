# Mise en service de Yomu Cloud

1. Créez un projet Supabase gratuit puis exécutez la migration `migrations/20260914150000_yomu_cloud_sync.sql` dans le SQL Editor.
2. Dans Google Cloud, créez un client OAuth de type **Web application**. Ajoutez comme URI de redirection autorisée `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Dans Supabase, activez **Authentication → Providers → Google** et renseignez ce client OAuth. Dans **URL Configuration**, autorisez exactement `yomureader://cloud-auth` (et `nhentaidownlo://cloud-auth` si vous voulez aussi tester une ancienne build).
4. Copiez `mobile/.env.cloud.example` vers `mobile/.env` et renseignez l'URL du projet et sa **publishable key**. Ces deux valeurs peuvent être exposées dans une application mobile; n'ajoutez jamais une `service_role` key.
5. Régénérez Android puis construisez l'APK : `npx expo prebuild --platform android --clean --no-install` puis `npm run build:apk` depuis `mobile`.

La connexion Google sert uniquement d'identité. Les données Yomu sont chiffrées sur l'appareil avec une clé de récupération détenue par l'utilisateur. Une clé perdue ne peut pas être récupérée.
