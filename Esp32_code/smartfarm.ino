#include <WiFi.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <time.h>

const char *ssid         = "Griffon";
const char *password     = "10481reban";
const char *firebaseHost = "https://fir-demoapp-6f388-default-rtdb.firebaseio.com";

LiquidCrystal_I2C lcd(0x27, 2, 1, 0, 4, 5, 6, 7, 3, POSITIVE);
DHT dht(15, DHT11);

#define LED_PIN      25
#define SERVO_PIN    26       // servo signal wire → GPIO 26

#define SERVO_OPEN   90       // degrees when valve is open
#define SERVO_CLOSED 0        // degrees when valve is closed

#define SOIL_DRY     4095
#define SOIL_WET     2128

// Safety: if Firebase not reachable for this long, close valve
#define VALVE_TIMEOUT_MS 30000

Servo valveServo;

unsigned long lastUpload      = 0;
unsigned long lastDisplay     = 0;
unsigned long lastValveCheck  = 0;
unsigned long lastSuccessRead = 0;   // tracks last successful Firebase valve read

float temp = 0, hum = 0;
int   soilRaw = 0;
float soilPct = 0;
bool  err     = false;

bool  valveOpen          = false;   // current physical valve state
bool  lastCommandedState = false;   // last state written to valveConfirmed

// ---------------------------------------------------------------------------
// Servo helpers
// ---------------------------------------------------------------------------
void openValve() {
  valveServo.write(SERVO_OPEN);
  valveOpen = true;
  Serial.println("  [VALVE] OPEN");
}

void closeValve() {
  valveServo.write(SERVO_CLOSED);
  valveOpen = false;
  Serial.println("  [VALVE] CLOSED");
}

// ---------------------------------------------------------------------------
// Write confirmed valve state back to Firebase
// ---------------------------------------------------------------------------
void confirmValveState(bool open) {
  if (open == lastCommandedState) return;   // skip if unchanged
  HTTPClient http;
  http.begin(String(firebaseHost) + "/controls/valveConfirmed.json");
  http.PUT(open ? "true" : "false");
  http.end();
  lastCommandedState = open;
  Serial.printf("  [VALVE] Confirmed %s → Firebase\n", open ? "OPEN" : "CLOSED");
}

// ---------------------------------------------------------------------------
// Check Firebase for valve command and act on it
// ---------------------------------------------------------------------------
void checkValveCommand() {
  if (WiFi.status() != WL_CONNECTED) {
    // Safety: close valve if offline too long
    if (millis() - lastSuccessRead > VALVE_TIMEOUT_MS && valveOpen) {
      Serial.println("  [VALVE] WiFi lost — safety close");
      closeValve();
      confirmValveState(false);
    }
    return;
  }

  HTTPClient http;
  http.begin(String(firebaseHost) + "/controls/irrigationValve.json");
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    body.trim();
    bool wantOpen = (body == "true");
    lastSuccessRead = millis();

    if (wantOpen && !valveOpen) {
      openValve();
      confirmValveState(true);
    } else if (!wantOpen && valveOpen) {
      closeValve();
      confirmValveState(false);
    }
  } else {
    Serial.printf("  [VALVE] Firebase read failed: HTTP %d\n", code);
    // Safety timeout still applies
    if (millis() - lastSuccessRead > VALVE_TIMEOUT_MS && valveOpen) {
      Serial.println("  [VALVE] Timeout — safety close");
      closeValve();
      confirmValveState(false);
    }
  }
  http.end();
}

// ---------------------------------------------------------------------------
// Sensor helpers (unchanged from original)
// ---------------------------------------------------------------------------
float soilToPercent(int raw) {
  float pct = map(raw, SOIL_WET, SOIL_DRY, 100, 0);
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void blinkLED() {
  digitalWrite(LED_PIN, HIGH); delay(200); digitalWrite(LED_PIN, LOW);
}

// ---------------------------------------------------------------------------
// Upload sensor data (unchanged from original)
// ---------------------------------------------------------------------------
void uploadToFirebase() {
  if (err) return;

  time_t now; time(&now);

  Serial.println("----------------------------------------");
  Serial.println("         UPLOADING TO FIREBASE          ");
  Serial.println("----------------------------------------");

  digitalWrite(12, HIGH);
  HTTPClient http;
  int httpCode;

  http.begin(String(firebaseHost) + "/sensorData/temperature.json");
  httpCode = http.PUT(String(temp));
  Serial.printf("  [TEMP]  %.1f C  -->  HTTP %d\n", temp, httpCode);
  http.end();

  http.begin(String(firebaseHost) + "/sensorData/humidity.json");
  httpCode = http.PUT(String(hum));
  Serial.printf("  [HUM]   %.0f %%  -->  HTTP %d\n", hum, httpCode);
  http.end();

  http.begin(String(firebaseHost) + "/sensorData/soilMoisture.json");
  httpCode = http.PUT(String(soilPct));
  Serial.printf("  [SOIL]  %.1f %% (raw: %d)  -->  HTTP %d\n", soilPct, soilRaw, httpCode);
  http.end();

  http.begin(String(firebaseHost) + "/sensorData/timestamp.json");
  httpCode = http.PUT(String((unsigned long)now));
  Serial.printf("  [TIME]  Unix: %lu  -->  HTTP %d\n", (unsigned long)now, httpCode);
  http.end();

  String json = "{\"temperature\":" + String(temp) +
                ",\"humidity\":" + String(hum) +
                ",\"soilMoisture\":" + String(soilPct) +
                ",\"timestamp\":" + String((unsigned long)now) + "}";

  http.begin(String(firebaseHost) + "/sensorData/history/" + String((unsigned long)now) + ".json");
  httpCode = http.PUT(json);
  Serial.printf("  [HIST]  JSON sent  -->  HTTP %d\n", httpCode);
  http.end();

  Serial.println("----------------------------------------");
  Serial.println("           UPLOAD COMPLETE              ");
  Serial.println("----------------------------------------\n");

  blinkLED();
  delay(200);
  digitalWrite(12, LOW);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("       DAVIE ELECTRONICS SMARTFARM      ");
  Serial.println("========================================\n");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Servo — start closed
  valveServo.attach(SERVO_PIN);
  closeValve();

  lcd.begin(16, 2);
  lcd.backlight();
  lcd.print("Davie Electronics");
  delay(2000);

  dht.begin();
  pinMode(34, INPUT);
  pinMode(12, OUTPUT);
  digitalWrite(12, LOW);

  Serial.println("[WIFI] Connecting to: " + String(ssid));
  lcd.clear();
  lcd.print("Connecting WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\n[WIFI] Connected!");
  Serial.println("[WIFI] IP: " + WiFi.localIP().toString());

  lcd.clear();
  lcd.print("WiFi Connected");
  delay(1000);

  configTime(3 * 3600, 0, "pool.ntp.org");
  Serial.print("[NTP]  Syncing time");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) { delay(500); Serial.print("."); }
  Serial.println(" done!");

  lastSuccessRead = millis();   // initialise timeout reference

  Serial.println("[SYSTEM] Ready\n");
  lcd.clear();
  lcd.print("Ready!");
  delay(1000);
  lcd.clear();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
void loop() {
  unsigned long t = millis();

  // Read sensors every 1 s
  if (t - lastDisplay >= 1000) {
    temp    = dht.readTemperature();
    hum     = dht.readHumidity();
    soilRaw = analogRead(34);
    soilPct = soilToPercent(soilRaw);
    err     = (isnan(temp) || isnan(hum));

    Serial.println("------------ SENSOR READINGS -----------");
    if (err) {
      Serial.println("  [ERROR] DHT11 sensor read failed!");
    } else {
      Serial.printf("  [TEMP]  %.1f C\n", temp);
      Serial.printf("  [HUM]   %.0f %%\n", hum);
      Serial.printf("  [SOIL]  %.1f %% (raw: %d)\n", soilPct, soilRaw);
    }
    Serial.println("----------------------------------------\n");

    lcd.setCursor(0, 0);
    if (err) {
      lcd.print("Sensor Error    ");
      lcd.setCursor(0, 1);
      lcd.print("                ");
    } else {
      lcd.print("T:");  lcd.print(temp, 1); lcd.print("C H:"); lcd.print(hum, 0); lcd.print("%  ");
      lcd.setCursor(0, 1);
      lcd.print("Soil:"); lcd.print(soilPct, 1); lcd.print("%  V:"); lcd.print(valveOpen ? "O" : "C");
    }
    lastDisplay = t;
  }

  // Check valve command every 2 s
  if (t - lastValveCheck >= 2000) {
    checkValveCommand();
    lastValveCheck = t;
  }

  // Upload sensor data every 5 s
  if (t - lastUpload >= 5000) {
    uploadToFirebase();
    lastUpload = t;
  }
}
