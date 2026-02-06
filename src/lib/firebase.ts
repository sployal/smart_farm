import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDDYaXYiuMWJ3VrmlSjFbheQVmFCU8UN4s",
  authDomain: "fir-demoapp-6f388.firebaseapp.com",
  databaseURL: "https://fir-demoapp-6f388-default-rtdb.firebaseio.com",
  projectId: "fir-demoapp-6f388",
  storageBucket: "fir-demoapp-6f388.firebasestorage.app",
  messagingSenderId: "806807258829",
  appId: "1:806807258829:web:2eb5295e931e134b6b0b84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
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
