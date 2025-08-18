import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";


const firebaseConfig = {
  apiKey: "AIzaSyBHcrvu7pUzNSH6Tk0LhvRavHknrIox8U8",
  authDomain: "thermosafe-58f46.firebaseapp.com",
  projectId: "thermosafe-58f46",
  storageBucket: "thermosafe-58f46.appspot.com",
  messagingSenderId: "293147213871",
  appId: "1:293147213871:web:b7f5a12817d4bf57e886da",
  measurementId: "G-5BNW2FLZ54"
};

// Inicialitza Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Firestore (per guardar subscripcions, històrics, etc.)
export const db = getFirestore(firebaseApp);

// Messaging (per notificacions push)
export const messagingPromise = isSupported().then(s => 
  s ? getMessaging(firebaseApp) : null
);
