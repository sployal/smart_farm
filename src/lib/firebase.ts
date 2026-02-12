import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Function to fetch current sensor data
export const fetchSensorData = async () => {
  try {
    const tempRef = ref(database, 'sensorData/temperature');
    const humRef = ref(database, 'sensorData/humidity');
    const soilRef = ref(database, 'sensorData/soilMoisture');

    const [tempSnap, humSnap, soilSnap] = await Promise.all([
      get(tempRef),
      get(humRef),
      get(soilRef)
    ]);

    return {
      temperature: tempSnap.val() || 0,
      humidity: humSnap.val() || 0,
      moisture: soilSnap.val() || 0
    };
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return { temperature: 0, humidity: 0, moisture: 0 };
  }
};

// Function to set up real-time listener
export const startRealtimeUpdates = (callback: (data: any) => void) => {
  const sensorRef = ref(database, 'sensorData');
  
  const unsubscribe = onValue(sensorRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        moisture: data.soilMoisture || 0
      });
    }
  });

  return unsubscribe;
};
