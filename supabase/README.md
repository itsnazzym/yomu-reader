# Mise en service de Yomu Cloud

1. Créez un projet Supabase gratuit puis exécutez la migration `migrations/20260914150000_yomu_cloud_sync.sql` dans le SQL Editor.
2. Dans Google Cloud, conservez le client OAuth de type **Web application** utilisé par Supabase et ajoutez un client **Android** pour `com.nhentaidownlo.mobile`, avec le SHA-1 du certificat de release. Ajoutez comme URI de redirection autorisée web `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Dans Supabase, activez **Authentication → Providers → Google** et renseignez le client Web. Laissez désactivés « Skip nonce checks », « Allow users without an email » et le serveur OAuth Supabase. Dans **URL Configuration**, autorisez exactement `yomureader:///cloud-auth` (les anciennes URL peuvent rester pour les builds précédentes).
4. Copiez `mobile/.env.cloud.example` vers `mobile/.env` et renseignez l'URL du projet et sa **publishable key**. Ces deux valeurs peuvent être exposées dans une application mobile; n'ajoutez jamais une `service_role` key.
5. Définissez aussi `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` dans l'environnement de build, régénérez Android puis construisez l'APK : `npx expo prebuild --platform android --clean --no-install` puis `npm run build:apk` depuis `mobile`.

La connexion Google sert uniquement d'identité. Les données Yomu sont chiffrées sur l'appareil avec une clé de récupération détenue par l'utilisateur. Une clé perdue ne peut pas être récupérée.

Sur Android, le bouton principal utilise Credential Manager : la passkey et le verrouillage de l'appareil sont proposés par Google lorsque le compte les prend en charge. Le bouton navigateur est uniquement un repli volontaire.
