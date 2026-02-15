#include <WiFi.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <time.h>  // ← added for NTP Unix timestamp

const char *ssid = "Griffon";
const char *password = "10481reban";
const char *firebaseHost = "https://fir-demoapp-6f388-default-rtdb.firebaseio.com";

LiquidCrystal_I2C lcd(0x27, 2, 1, 0, 4, 5, 6, 7, 3, POSITIVE);
DHT dht(15, DHT11);

#define LED_PIN 25

#define SOIL_DRY    4095
#define SOIL_WET    2128

unsigned long lastUpload = 0, lastDisplay = 0;
float temp = 0, hum = 0;
int soilRaw = 0;
float soilPct = 0;
bool err = false;

float soilToPercent(int raw) {
  float pct = map(raw, SOIL_WET, SOIL_DRY, 100, 0);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void blinkLED() {
  digitalWrite(LED_PIN, HIGH);
  delay(200);
  digitalWrite(LED_PIN, LOW);
}

void uploadToFirebase() {
  if (err) return;

  // ← get real Unix timestamp instead of millis()
  time_t now;
  time(&now);

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

  // ← write real Unix timestamp so the sidebar can check staleness
  http.begin(String(firebaseHost) + "/sensorData/timestamp.json");
  httpCode = http.PUT(String((unsigned long)now));
  Serial.printf("  [TIME]  Unix: %lu  -->  HTTP %d\n", (unsigned long)now, httpCode);
  http.end();

  String json = "{\"temperature\":" + String(temp) +
                ",\"humidity\":" + String(hum) +
                ",\"soilMoisture\":" + String(soilPct) +
                ",\"timestamp\":" + String((unsigned long)now) + "}";  // ← was millis()

  http.begin(String(firebaseHost) + "/sensorData/history/" + String((unsigned long)now) + ".json");
  httpCode = http.PUT(json);
  Serial.printf("  [HIST]  JSON sent  -->  HTTP %d\n", httpCode);
  Serial.printf("          Payload: %s\n", json.c_str());
  http.end();

  Serial.println("----------------------------------------");
  Serial.println("           UPLOAD COMPLETE              ");
  Serial.println("----------------------------------------\n");

  blinkLED();
  delay(200);
  digitalWrite(12, LOW);
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("       DAVIE ELECTRONICS SMARTFARM      ");
  Serial.println("========================================\n");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

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
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected!");
  Serial.println("[WIFI] IP Address: " + WiFi.localIP().toString());

  lcd.clear();
  lcd.print("WiFi Connected");
  delay(1000);

  // ← sync time via NTP (UTC+3 = Nairobi)
  configTime(3 * 3600, 0, "pool.ntp.org");
  Serial.print("[NTP]  Syncing time");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" done!");

  Serial.println("[SYSTEM] Ready - uploading every 5 seconds\n");
  lcd.clear();
  lcd.print("Ready!");
  delay(1000);
  lcd.clear();
}

void loop() {
  unsigned long t = millis();

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
      Serial.printf("  [SOIL]  %.1f %% moisture  (raw: %d)\n", soilPct, soilRaw);
    }
    Serial.println("----------------------------------------\n");

    lcd.setCursor(0, 0);
    if (err) {
      lcd.print("Sensor Error    ");
      lcd.setCursor(0, 1);
      lcd.print("                ");
    } else {
      lcd.print("T:");
      lcd.print(temp, 1);
      lcd.print("C H:");
      lcd.print(hum, 0);
      lcd.print("%  ");
      lcd.setCursor(0, 1);
      lcd.print("Soil:");
      lcd.print(soilPct, 1);
      lcd.print("%      ");
    }
    lastDisplay = t;
  }

  if (t - lastUpload >= 5000) {
    uploadToFirebase();
    lastUpload = t;
  }
}
