// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Enviar notificació manual de test
exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
  try {
    const token = req.query.token; // El token FCM del dispositiu
    if (!token) {
      return res.status(400).send("Falta el token FCM!");
    }

    const message = {
      notification: {
        title: "ThermoSafe · Prova",
        body: "Funciona la notificació push 🚀",
      },
      token: token,
    };

    await admin.messaging().send(message);
    res.send("Notificació enviada correctament!");
  } catch (error) {
    console.error("Error enviant notificació:", error);
    res.status(500).send(error.toString());
  }
});
