// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCX3YBHYbJQx2E4bZaAsdbMiDZY8n78CY",
  authDomain: "thermosafe-7bdfc.firebaseapp.com",
  projectId: "thermosafe-7bdfc",
  storageBucket: "thermosafe-7bdfc.appspot.com",
  messagingSenderId: "1001271905837",
  appId: "1:1001271905837:web:9509a0612c526dcba072a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };