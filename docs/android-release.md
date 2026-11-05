# Release Android reconciliada amb la versió 27

## Estat inicial

- Branca de treball: `android/reconcile-release-27`.
- Base: `main`, commit `86a9f7693dbc8fde96d5f7981570327b191a5554`.
- `git status --short` buit abans de modificar; cap canvi aliè sobreescrit.
- Referència: `~/Downloads/ThermoSafe - Google Play package.zip`, AAB 27 / 1.2.2,
  package `app.vercel.thermosafe.twa`, min/target/compile SDK 23/36/36.
- El versionCode 28 està confirmat i s'ha utilitzat correctament a Google Play Internal Testing.

## Configuració

- Package i namespace: `app.vercel.thermosafe.twa`.
- Versió: 28 / 1.2.3. El versionCode 28 està confirmat i s'ha utilitzat correctament a Google Play Internal Testing. La versió web no canvia.
- SDK: min 24, target 36, compile 36. Eines i ABH sense actualitzar.
- Manifest web: `https://thermosafe.app/manifest.webmanifest`.
- Notificacions TWA actives; geolocalització web sense Location Delegation nativa.
- Launcher: USER_PORTRAIT amb API > 26; UNSPECIFIED amb API <= 26.
- Classes `riscclimatic` conservades, sense registre al manifest. Se n'ha retirat
  també l'import/handler de localització per poder retirar la dependència.
- Generador declarat `bubblewrap-cli`: identifica aquest projecte, no PWABuilder.
  No s'ha executat cap generador.

## Signatura i build local

Requisits: JDK 17, Android SDK 36, dependències Gradle disponibles i upload key
autoritzada. El wrapper continua a Gradle 8.11.1 i AGP a 8.9.1.

Configura `THERMOSAFE_KEYSTORE_PATH` amb la ruta local al keystore autoritzat.
Àlies: `my-key-alias`.

El build requereix **dues variables d'entorn**:

- `THERMOSAFE_STORE_PASSWORD`: contrasenya del keystore.
- `THERMOSAFE_KEY_PASSWORD`: contrasenya de la clau.

No posar-les en fitxers versionats, arguments `-P`, exemples amb valors reals o
logs. En zsh es poden introduir sense eco ni guardar el valor a l'historial:

```zsh
read -rs 'THERMOSAFE_STORE_PASSWORD?Contrasenya del keystore: '
echo
read -rs 'THERMOSAFE_KEY_PASSWORD?Contrasenya de la clau: '
echo
export THERMOSAFE_STORE_PASSWORD THERMOSAFE_KEY_PASSWORD
./gradlew clean
./gradlew bundleRelease
./gradlew assembleRelease
unset THERMOSAFE_STORE_PASSWORD THERMOSAFE_KEY_PASSWORD
```

No usar `--debug`, build scans ni configuration cache amb secrets de signatura.
Si falta una contrasenya o el keystore, la release ha de fallar, no generar un
artefacte unsigned que sembli preparat per publicar.

SHA-256 esperat de la upload key:
`7F:CC:C9:CB:06:7C:D5:76:13:AC:BC:25:58:B0:05:EF:CC:47:68:C6:24:A1:AD:82:9F:5C:66:85:A9:D9:9C:1B`.

El certificat d'upload **no substitueix** el certificat Play App Signing a
`public/.well-known/assetlinks.json`. Aquest fitxer es manté intacte.

## Abans d'internal testing i producció

Inspeccionar AAB/APK, manifest fusionat, signatura i mapping R8. Validar TWA,
App Links, ubicació web, notificacions, retorn de segon pla i actualització des
de la release 27 a través d'internal testing. Una APK amb upload key no pot
substituir directament una instal·lació signada amb Play App Signing.

No s'autoritza cap pujada ni publicació amb aquest document. Producció requereix
validació funcional. Un rollback per als usuaris ja actualitzats necessita una
release correctora amb versionCode superior.
