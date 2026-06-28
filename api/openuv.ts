import { getApps, initializeApp } from "firebase/app";
import {
  doc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBHcrvu7pUzNSH6Tk0LhvRavHknrIox8U8",
  authDomain: "thermosafe-58f46.firebaseapp.com",
  projectId: "thermosafe-58f46",
  storageBucket: "thermosafe-58f46.appspot.com",
  messagingSenderId: "293147213871",
  appId: "1:293147213871:web:b7f5a12817d4bf57e886da",
};

const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

function getUsageDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function trackExternalApiUsage(provider: "openuv", hasError: boolean) {
  const date = getUsageDateKey();
  const ref = doc(db, "apiUsage", `${provider}_${date}`);

  try {
    await setDoc(
      ref,
      {
        provider,
        date,
        calls: increment(1),
        errors: increment(hasError ? 1 : 0),
        lastCallAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("[apiUsage] No s'ha pogut registrar consum OpenUV:", error);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const { endpoint = "uv", lat } = req.query;
  const lng = req.query.lng || req.query.lon;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat/lng" });
  }

  const path = endpoint === "forecast" ? "forecast" : "uv";

  let usageTracked = false;

  try {
    const r = await fetch(
      `https://api.openuv.io/api/v1/${path}?lat=${lat}&lng=${lng}`,
      {
        headers: {
          "x-access-token": process.env.OPENUV_KEY,
        },
      }
    );

    await trackExternalApiUsage("openuv", !r.ok);
    usageTracked = true;

    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    if (!usageTracked) {
      await trackExternalApiUsage("openuv", true);
    }
    return res.status(500).json({ error: "fail" });
  }
}
