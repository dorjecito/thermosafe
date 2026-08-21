import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { firebaseConfig } from "./firebaseConfig";

// Inicialitza Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Firestore (per guardar subscripcions, històrics, etc.)
export const db = getFirestore(firebaseApp);

// Messaging (per notificacions push)
export const messagingPromise = isSupported().then(s => 
  s ? getMessaging(firebaseApp) : null
);
