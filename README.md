# ThermoSafe – Risc per calor

**ThermoSafe** és una aplicació web progressiva (PWA) que ajuda a avaluar el risc per calor en activitats a l'aire lliure, seguint els criteris oficials de l'INSST i el Ministeri de Sanitat.

## 🔥 Funcionalitats

- **Sensació tèrmica** (heat index) calculada i mostrada en temps real.
- **Alertes visuals i sonores** en cas de risc tèrmic extrem.
- **Consulta automàtica cada 30 minuts** per mantenir la informació actualitzada.
- **Interfície moderna**, responsiva i compatible amb mode fosc.
- Disponible en **català**, **castellà**, **gallec** i **basc**, amb canvi automàtic segons l'idioma del navegador.

## 📊 Funcionalitats principals

- Càlcul del **risc per calor** en temps real segons la temperatura i la humitat relativa.
- Visualització de la **temperatura real**, **índex de calor percebut**, **índex UV**, **irradiància solar** i **velocitat del vent**.
- Recomanacions preventives adaptades al nivell de risc, incloses indicacions nocturnes.
- Llegendes consultables i avisos contextuals per a cada índex.
- Disponible en **català**, **castellà**, **gallec** i **basc**.
- 100% **anònima**, sense registre ni recollida de dades personals.
- Compatible amb tots els navegadors moderns, instal·lable com a app al dispositiu.

## 📈 Tecnologies utilitzades

- **React** amb Vite
- **OpenWeather API** (dades meteorològiques)
- **OpenUV API** (index UV, irradiància i temps d'exposició)
- **Tailwind CSS** per al disseny
- **PWA** i servei de notificacions push (FCM)

## 🚀 Desplegament

L'aplicació està desplegada a [thermosafe.app](https://thermosafe.app) mitjançant Vercel.

També disponible en versó de proves a Google Play (canal tancat amb més de 12 testers actius).

## 📄 Documentació

- [Memòria tècnica resumida (PDF)](./docs/memoria_thermosafe.pdf)
- [Política de privacitat](https://thermosafe.app/privacy.html)

## 🙏 Atribucions

- Dades meteorològiques: OpenWeather
- Radiació UV i irradiància: OpenUV.io
- Icons i pictogrames: Lucide, Heroicons

## ✨ Desenvolupador

Esteve Montalvo i Camps  
Enginyer informàtic i tècnic en jardineria  
[Contacte per correu electrònic](mailto:esteve.montalvo@gmail.com)
