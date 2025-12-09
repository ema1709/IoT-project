#include <Wire.h>
#include <SPI.h>
#include "DHT.h"
#include <math.h>
#include <SoftwareSerial.h>
#include <rn2xx3.h>

// ===================== PIN DEFINITIONS =====================
// LoRa RN2483 connections (via SoftwareSerial)
#define LORA_RX 5
#define LORA_TX 2
#define LORA_RST 4
#define SS_PIN 10          // SPI Slave Select from ESP32

// DHT11 temperature/humidity sensor
#define DHT_PIN 6
#define DHT_TYPE DHT11

// Actuators and LEDs
#define LED_TEMP_PIN 9
#define LED_HUM_PIN  3
#define BUZZER_PIN   8

// Thresholds for automatic alerts
#define TEMP_THRESHOLD 35.0
#define HUM_THRESHOLD  60.0


// ===================== OBJECT INSTANCES =====================
DHT dht(DHT_PIN, DHT_TYPE);
SoftwareSerial mySerial(LORA_RX, LORA_TX);
rn2xx3 myLora(mySerial);

bool loraJoined = false;


// ===================== GLOBAL VARIABLES =====================
// ---------- SPI buffer (data coming FROM ESP32) ----------
volatile uint8_t spiBuf[64];
volatile uint8_t spiLen = 0;

String lastSpiFrame  = "";
String lastSpiMAC    = "";
String lastSpiBattery= "";
String lastSpiGPS    = "";


// ---------- MPU6050 variables ----------
const uint8_t MPU_ADDR = 0x68;
float prevA = NAN;
float activitySum = 0;

// Activity Index calculations
float latestAI_1s = 0;
float aiBucket    = 0;   // Accumulated activity between LoRa uplinks


// ---------- Timing ----------
unsigned long lastSample     = 0;
unsigned long lastDHT        = 0;
unsigned long lastReporting  = 0;
unsigned long lastLoRaSend   = 0;

float lastTemp = NAN;
float lastHum  = NAN;

// Periods
const unsigned long DHT_PERIOD  = 2500;   // Read humidity/temp every 2.5s
const unsigned long LORA_PERIOD = 30000;  // Send LoRa every 30s

int uplinkCycle = 1;

// Remote control flags (downlinks)
bool buzzerRemoteForceOn  = false;
bool buzzerRemoteForceOff = false;

unsigned long lastBuzzerCheck = 0;
const unsigned long BUZZER_CHECK_PERIOD = 10000;   // 10 seconds




// ===============================================================
//                       SPI INTERRUPT HANDLER
// ===============================================================
// Triggered every time ESP32 shifts a byte over SPI.
// Data is stored in spiBuf[] and acknowledged with 'A'.
ISR(SPI_STC_vect) {
  uint8_t b = SPDR;
  if (spiLen < sizeof(spiBuf)) spiBuf[spiLen++] = b;
  SPDR = 'A';     // reply byte (does not matter what, handshake only)
}



// ===============================================================
//                    MPU6050 READ FUNCTIONS
// ===============================================================

// Reads a 16-bit signed register (high + low bytes) from the MPU
int16_t i2cRead16(uint8_t reg) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);

  Wire.requestFrom(MPU_ADDR, (uint8_t)2);
  while (Wire.available() < 2);

  uint8_t hi = Wire.read();
  uint8_t lo = Wire.read();
  return (int16_t)((hi << 8) | lo);
}


// Setup: wake MPU6050 and reset activity tracking
void initialize_mpu() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);   // Power management register
  Wire.write(0x00);   // Wake up sensor
  Wire.endTransmission();

  prevA = NAN;
  activitySum = 0;
  lastSample = millis();
}



// ===============================================================
//                 LORA INITIALIZATION (OTAA JOIN)
// ===============================================================
void initLoRa() {
  Serial.println("Init LoRa...");

  // Reset LoRa module
  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);
  delay(300);
  digitalWrite(LORA_RST, HIGH);
  delay(500);

  // Autobaud RN2483
  mySerial.begin(9600);
  myLora.autobaud();

  // OTAA credentials
  const char *appEui = "0000000000000000";
  const char *appKey = "A8D63C2A45A77B431FB19F69CFCAAA4F";

  Serial.println("Joining TTN...");
  bool ok = myLora.initOTAA(appEui, appKey);

  // Retry join until success
  while (!ok) {
    Serial.println("Join failed, retrying...");
    delay(5000);
    ok = myLora.initOTAA(appEui, appKey);
  }

  Serial.println("JOIN SUCCESS 🎉");
  loraJoined = true;
}



// ===============================================================
//      ASCII STRING → HEX STRING (required by RN2483 for send)
// ===============================================================
String toHex(String s) {
  String out = "";
  char buf[3];

  for (int i = 0; i < s.length(); i++) {
    sprintf(buf, "%02X", (uint8_t)s[i]);  // ASCII → hex byte
    out += buf;
  }
  return out;
}



// ===============================================================
//         SEND UPLINK ON SPECIFIC PORT (ASCII already hex)
// ===============================================================
void sendOnPort(uint8_t port, String payloadHex) {

  // Build LoRa command (uncnf = unconfirmed uplink)
  String cmd = "mac tx uncnf " + String(port) + " " + payloadHex;

  Serial.print("TX → ");
  Serial.println(cmd);

  mySerial.println(cmd);
  delay(150);

  // ---------------- Downlink handler ----------------
  while (mySerial.available()) {
    String resp = mySerial.readStringUntil('\n');
    resp.trim();
    Serial.print("MODEM → ");
    Serial.println(resp);

    // mac_rx = downlink received
    if (resp.startsWith("mac_rx")) {

      int s1 = resp.indexOf(' ');
      int s2 = resp.indexOf(' ', s1 + 1);
      int rxPort = resp.substring(s1 + 1, s2).toInt();
      String hexDL = resp.substring(s2 + 1);

      // Convert first byte from hex → integer
      int val = strtol(hexDL.c_str(), NULL, 16);

      // Only react to port 10 (buzzer control)
      if (rxPort == 10) {

        // 0 = force buzzer OFF
        // 1 = force buzzer ON
        // 2 = return to auto mode
        if (val == 0) {
          buzzerRemoteForceOff = true;
          buzzerRemoteForceOn  = false;
        }
        else if (val == 1) {
          buzzerRemoteForceOn  = true;
          buzzerRemoteForceOff = false;
        }
        else if (val == 2) {
          buzzerRemoteForceOn  = false;
          buzzerRemoteForceOff = false;
        }

        Serial.print("DL control buzzer: val=");
        Serial.println(val);
      }
    }
  }
}



// ===============================================================
//                          SETUP
// ===============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("Boot...");

  Wire.begin();
  dht.begin();

  // Enable SPI slave mode
  pinMode(MISO, OUTPUT);
  pinMode(SS_PIN, INPUT_PULLUP);
  SPCR |= _BV(SPE) | _BV(SPIE);   // Enable SPI + SPI interrupt

  // Outputs
  pinMode(LED_TEMP_PIN, OUTPUT);
  pinMode(LED_HUM_PIN,  OUTPUT);
  pinMode(BUZZER_PIN,    OUTPUT);

  initialize_mpu();   // Start accelerometer
  initLoRa();         // Join TTN

  Serial.println("System ready");
}



// ===============================================================
//                            LOOP
// ===============================================================
void loop() {
  unsigned long now = millis();


  // =============================================================
  //                        SPI HANDLING
  // =============================================================
  // Detect the moment ESP32 releases SS (frame complete)
  static int lastSS = HIGH;
  int currentSS = digitalRead(SS_PIN);

  if (lastSS == HIGH && currentSS == LOW)
    spiLen = 0;   // new SPI frame incoming

  if (lastSS == LOW && currentSS == HIGH) {
    // SS rising edge → frame finished
    String msg = "";
    for (uint8_t i = 0; i < spiLen; i++)
      msg += (char)spiBuf[i];

    msg.trim();
    lastSpiFrame = msg;

    Serial.print("SPI → ");
    Serial.println(msg);

    if (msg.length() > 0) {
      char type = msg[0];

      // Frame starts with Bxxx → Battery
      if (type == 'B') {
        lastSpiBattery = msg.substring(1);
        Serial.print("BATTERY STORED → ");
        Serial.println(lastSpiBattery);
      }
      // Frame starts with Wxxx → WiFi MAC scan
      else if (type == 'W') {
        lastSpiMAC = msg;
        Serial.print("MAC STORED → ");
        Serial.println(lastSpiMAC);
      }
      // Frame starts with Gxxx → GPS data
      else if (type == 'G') {
        lastSpiGPS = msg;
        Serial.print("GPS STORED → ");
        Serial.println(lastSpiGPS);
      }
      else {
        Serial.println("SPI frame type unknown, stored only in lastSpiFrame");
      }
    }
  }

  lastSS = currentSS;



  // =============================================================
  //                 MPU6050 ACTIVITY SAMPLING
  // =============================================================
  if (now - lastSample >= 40) {   // sample at 25 Hz
    lastSample += 40;

    int16_t ax = i2cRead16(0x3B);
    int16_t ay = i2cRead16(0x3D);
    int16_t az = i2cRead16(0x3F);

    // Convert raw values to m/s²
    float axg = ax / 16384.0 * 9.81;
    float ayg = ay / 16384.0 * 9.81;
    float azg = az / 16384.0 * 9.81;

    // Magnitude of acceleration vector
    float Amag = sqrt(axg*axg + ayg*ayg + azg*azg);

    // Activity = |difference between samples|
    if (!isnan(prevA)) activitySum += fabs(Amag - prevA);

    prevA = Amag;
  }



  // =============================================================
  //                    READ DHT11 SENSOR
  // =============================================================
  if (now - lastDHT >= DHT_PERIOD) {
    lastDHT += DHT_PERIOD;
    lastTemp = dht.readTemperature();
    lastHum  = dht.readHumidity();
  }



  // =============================================================
  //                    DEBUG PRINT + BUZZER LOGIC
  // =============================================================
  if (now - lastReporting >= 1000) {   // every 1s
    lastReporting += 1000;

    // Compute 1-second AI value
    latestAI_1s = activitySum;
    activitySum = 0;

    // Accumulate into bucket (sent every 30s)
    aiBucket += latestAI_1s;

    Serial.print("AI=");
    Serial.print(latestAI_1s);
    Serial.print(" T=");
    Serial.print(lastTemp);
    Serial.print(" H=");
    Serial.print(lastHum);
    Serial.print(" SPI=");
    Serial.println(lastSpiFrame);

    // ----- Threshold evaluation -----
    bool tempHigh = (!isnan(lastTemp) && lastTemp > TEMP_THRESHOLD);
    bool humHigh  = (!isnan(lastHum)  && lastHum  > HUM_THRESHOLD);

    // LED indicators
    digitalWrite(LED_TEMP_PIN, tempHigh ? HIGH : LOW);
    digitalWrite(LED_HUM_PIN,  humHigh  ? HIGH : LOW);

    // Determine buzzer state:
    bool buzzerState;

    // Downlink override (forces)
    if (buzzerRemoteForceOff) buzzerState = false;
    else if (buzzerRemoteForceOn) buzzerState = true;
    // Automatic mode (threshold-based)
    else buzzerState = (tempHigh || humHigh);

    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  }



  // =============================================================
  //               SAFETY RESET OF REMOTE BUZZER FORCE
  // =============================================================
  // for test reason the buzzer is turned off after 10 seconds

  if (buzzerRemoteForceOn && (now - lastLoRaSend >= BUZZER_CHECK_PERIOD)) {
      buzzerRemoteForceOff = true;
      buzzerRemoteForceOn  = false;
      
  }



  // =============================================================
  //                      PERIODIC LORA UPLINK
  // =============================================================
  if (loraJoined && (now - lastLoRaSend >= LORA_PERIOD)) {
    lastLoRaSend = now;

    switch (uplinkCycle) {

      // ---------------- TEMP (Port 1) ----------------
      case 1:
        Serial.println("Sending TEMP on port 1");
        sendOnPort(1, toHex(String(lastTemp)));
        uplinkCycle = 2;
        break;

      // ---------------- HUM (Port 2) ----------------
      case 2:
        Serial.println("Sending HUM on port 2");
        sendOnPort(2, toHex(String(lastHum)));
        uplinkCycle = 3;
        break;

      // ---------------- ACTIVITY INDEX (Port 3) ----------------
      case 3:
        Serial.println("Sending AI BUCKET on port 3");
        sendOnPort(3, toHex(String(aiBucket, 1)));
        aiBucket = 0;   // Reset activity accumulation
        uplinkCycle = 4;
        break;

      // ---------------- WiFi MAC SCAN (Port 4) ----------------
      case 4:
        Serial.println("Sending MAC WiFi on port 4");
        if (lastSpiMAC.length() > 0)
          sendOnPort(4, toHex(lastSpiMAC));
        uplinkCycle = 5;
        break;

      // ---------------- BATTERY (Port 5) ----------------
      case 5:
        Serial.println("Sending BATTERY on port 5");
        if (lastSpiBattery.length() > 0)
          sendOnPort(5, toHex(lastSpiBattery));
        uplinkCycle = 1;  // Restart cycle
        break;
    }
  }
}