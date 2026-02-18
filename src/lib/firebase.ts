import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// ─── ESP32 Status Types ────────────────────────────────────────────────────────

export type ESP32Status = "online" | "offline" | "no_connection";

export type ESP32StatusResult = {
  status: ESP32Status;
  lastSync: string; // human-readable e.g. "Just now", "12s ago", "Offline"
};

// ─── Sensor helpers ───────────────────────────────────────────────────────────

export const fetchSensorData = async () => {
  try {
    const tempRef = ref(database, "sensorData/temperature");
    const humRef  = ref(database, "sensorData/humidity");
    const soilRef = ref(database, "sensorData/soilMoisture");

    const [tempSnap, humSnap, soilSnap] = await Promise.all([
      get(tempRef),
      get(humRef),
      get(soilRef),
    ]);

    return {
      temperature: tempSnap.val() || 0,
      humidity:    humSnap.val()  || 0,
      moisture:    soilSnap.val() || 0,
    };
  } catch (error) {
    console.error("Error fetching sensor data:", error);
    return { temperature: 0, humidity: 0, moisture: 0 };
  }
};

export const startRealtimeUpdates = (callback: (data: any) => void) => {
  const sensorRef   = ref(database, "sensorData");
  const unsubscribe = onValue(sensorRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        temperature: data.temperature  || 0,
        humidity:    data.humidity     || 0,
        moisture:    data.soilMoisture || 0,
      });
    }
  });
  return unsubscribe;
};

// ─── ESP32 Status Helper ──────────────────────────────────────────────────────

/**
 * Subscribes to both Firebase connection state and ESP32 timestamp staleness.
 *
 * Status logic:
 *  - "no_connection" → browser is not connected to Firebase at all
 *  - "offline"       → Firebase is reachable but ESP32 hasn't sent data in >15s
 *  - "online"        → Firebase connected AND ESP32 timestamp is fresh
 *
 * The ESP32 must write a Unix timestamp (seconds) to sensorData/timestamp
 * via NTP for staleness detection to work accurately.
 *
 * @param callback  Called every time status or lastSync changes
 * @returns         Unsubscribe function — call it on component unmount
 */
export const subscribeToESP32Status = (
  callback: (result: ESP32StatusResult) => void
): (() => void) => {
  // Track both states so we can combine them
  let firebaseConnected = false;
  let lastTimestamp: number | null = null;

  // Helper: formats a Unix timestamp (seconds) into a human-readable string
  const formatLastSync = (unixSeconds: number | null): string => {
    if (unixSeconds === null) return "Never";
    const nowSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = nowSeconds - unixSeconds;
    if (diffSeconds < 5)   return "Just now";
    if (diffSeconds < 60)  return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60)  return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)    return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7)      return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4)     return `${diffWeeks}w ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  };

  // Helper: derives the combined status and emits it via callback
  const emitStatus = () => {
    if (!firebaseConnected) {
      callback({ status: "no_connection", lastSync: "No connection" });
      return;
    }

    if (lastTimestamp === null) {
      // Connected to Firebase but no ESP32 data received yet
      callback({ status: "offline", lastSync: "Never" });
      return;
    }

    const nowSeconds  = Math.floor(Date.now() / 1000);
    const diffSeconds = nowSeconds - lastTimestamp;
    const isStale     = diffSeconds > 15; // ESP32 uploads every 5s, so 15s is generous

    callback({
      status:   isStale ? "offline" : "online",
      lastSync: formatLastSync(lastTimestamp), // ✅ always routes through formatLastSync
    });
  };

  // 1️⃣ Subscribe to Firebase's built-in connection indicator
  const connectedRef    = ref(database, ".info/connected");
  const unsubConnected  = onValue(connectedRef, (snap) => {
    firebaseConnected = snap.val() === true;
    emitStatus();
  });

  // 2️⃣ Subscribe to the ESP32's timestamp field
  const timestampRef    = ref(database, "sensorData/timestamp");
  const unsubTimestamp  = onValue(timestampRef, (snap) => {
    if (snap.exists()) {
      lastTimestamp = snap.val() as number;
    }
    emitStatus();
  });

  // 3️⃣ Re-evaluate staleness every 5 seconds even if no new data arrives
  //    This ensures the status flips to "offline" if the ESP32 goes silent
  const interval = setInterval(emitStatus, 5000);

  // Return a single unsubscribe function that cleans everything up
  return () => {
    unsubConnected();
    unsubTimestamp();
    clearInterval(interval);
  };
};