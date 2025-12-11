#include <WiFi.h>
#include <TinyGPS.h>
#include <SPI.h>
#include "Adafruit_MAX1704X.h"
#include <Wire.h>

//battery
Adafruit_MAX17048 maxlipo;
byte bytemsg = 0x00;
bool sendBatteryNext = false;

#define LED_PIN 2 

// SPI to pro mini
#define PIN_MOSI 23
#define PIN_MISO 19
#define PIN_SCK  18
#define PIN_SS   5
SPIClass spi(VSPI);

const unsigned long SCAN_INTERVAL_MS = 10 * 1000UL; // set scan interval
const long SERIAL_BAUD = 115200;   // debug (Serial)

//GNSS stuff below
const long SERIAL2_BAUD = 9600;
const int SERIAL2_RX_PIN = 25; 
const int SERIAL2_TX_PIN = 26;
TinyGPS gps;
float lat = TinyGPS::GPS_INVALID_F_ANGLE;
float lon = TinyGPS::GPS_INVALID_F_ANGLE;
int G = 0;
char c = 0;

//Wifi-scan
const int TOP_N = 3;                                // number of networks to be transmitted
struct NetInfo {
  String bssid;
  int32_t rssi;
};

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  //Pro-mini serial
  spi.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);//SPI to pro mini
  
  Serial.begin(SERIAL_BAUD);
  delay(100);
  //Fuel gauge pins
  Wire.begin(21, 22);
  
  pinMode(PIN_SS, OUTPUT);
  digitalWrite(PIN_SS, HIGH);
  //GNSS serial
  Serial2.begin(SERIAL2_BAUD, SERIAL_8N1, SERIAL2_RX_PIN, SERIAL2_TX_PIN);
  
  //set low voltage alert
  while (!maxlipo.begin()) {
      Serial.println(F("Couldnt find Adafruit MAX17048?\nMake sure a battery is plugged in!"));
    }
    maxlipo.setAlertVoltages(3.3, 4.2); //Figure out what the drop out voltage should
    maxlipo.setResetVoltage(3.3);

  delay(1000);
  // WiFi in station mode, disconnected (we only scan)
  WiFi.mode(WIFI_MODE_STA);
  WiFi.disconnect(true);
  delay(100);

  Serial.println();
  Serial.println("ESP32 GPS starting...");
}


//sort by best RSSI
void sort_desc_by_rssi(NetInfo arr[], int n) {
  for (int i = 1; i < n; ++i) {
    NetInfo key = arr[i];
    int j = i - 1;
    while (j >= 0 && arr[j].rssi < key.rssi) {
      arr[j + 1] = arr[j];
      --j;
    }
    arr[j + 1] = key;
  }
}
//compress data to be sent
String cleanString(const String &s) {
  String out = s;

  out.replace(":", "");    // remove colons from BSSIDs
  out.replace(",", "");    // remove comma between BSSID and RSSI
  out.replace("-", "");    // remove minus sign
  out.replace(";", ",");   // semicolons → commas
  out.replace(".", "");    // semicolons → commas
  return out;
}


void do_scan_and_report() {
  String out = "";
  int16_t networks = WiFi.scanNetworks(false, false); //no hidden networks. google database has to know the netowork
  // networks > 3 for testing gnss
  if (networks < 3) {//switch to gnss
    if (G==1) {  // returns true when a valid fix is received
      G = 0;
      out = "G";
      out += String(lat, 6);
      out += String(lon, 6);
      Serial.println("Sending GNSS lat and lon over SPI:");
      WiFi.scanDelete();
      out = cleanString(out);
      Serial.println(out);     // debug
      String received = spiTransferMessage(out);
      return;
    } else {
      Serial.println("GPS failed");
      out = "GPS failed";
      return;
    }
  } 
  else { //do wifi scan
    out = "W";
    NetInfo *all = new NetInfo[networks];
    for (int i = 0; i < networks; ++i) {
      all[i].bssid = WiFi.BSSIDstr(i);
      all[i].rssi  = WiFi.RSSI(i);
      Serial.println(all[i].bssid);
    }
    sort_desc_by_rssi(all, networks);
    int toSend = min((int)networks, TOP_N);
    
    int added = 0;
    String usedRouters = "";
    // loop that sorts out BSSIDs on same router with different ports by comparing BSSIDs
    for (int i = 0; i < networks && added < TOP_N; ++i) {
      if (!isRandomizedMAC(all[i].bssid)) {
        String routerID = all[i].bssid.substring(0, 14);
        if (usedRouters.indexOf(routerID) != -1 && added >= 2) {
          continue;
        }
        usedRouters += routerID + ",";
        out += all[i].bssid;
        out += String(all[i].rssi);
        added++;
      }
    }
  
    out = cleanString(out);
    Serial.println("Sending BSSIDs and RSSIDs over SPI:");
    Serial.println(out);
    String received = spiTransferMessage(out);
  
    delete[] all;
    WiFi.scanDelete();
  }
}
//Function to sort out randomized BSSID so that we are more likely to get a BSSID known to google
bool isRandomizedMAC(const String& mac) {
    int firstByte = strtol(mac.substring(0, 2).c_str(), nullptr, 16);
    return (firstByte & 0x02);  // if bit 1 is set → randomized
}
//SPI transfer
String spiTransferMessage(const String &msg) {
  digitalWrite(PIN_SS, LOW);
  String response = "";
  for (int i = 0; i < msg.length(); i++) {
    response += (char)spi.transfer(msg[i]);
  }
  digitalWrite(PIN_SS, HIGH);
  return response;
}
//Get battery percentage, in 7 LSB and low voltage alert in 1MSB(Alert not handled by backend)
byte getBatteryPercentByte() {
  float percent = maxlipo.cellPercent();
  if (percent < 0) percent = 0; 
  if (percent > 100) percent = 100;
  bytemsg = ((byte)round(percent));

  if (maxlipo.isActiveAlert()) {
    uint8_t status_flags = maxlipo.getAlertStatus();
    if (status_flags & MAX1704X_ALERTFLAG_VOLTAGE_LOW) {
      Serial.print(", Voltage low");
      bytemsg |= 0x80;
      maxlipo.clearAlertFlag(MAX1704X_ALERTFLAG_VOLTAGE_LOW); // clear the alert
    }
  }
  return bytemsg;
}

void loop() {
  static unsigned long lastScan = 0;

  if (millis() - lastScan >= SCAN_INTERVAL_MS) {
    lastScan = millis();
    
    if (sendBatteryNext) {
      // ---- SEND BATTERY over SPI ----
      byte pct = getBatteryPercentByte();
      String msg = "B" + String(pct);
      Serial.println("Sending battery over SPI:");
      Serial.println(msg);

      digitalWrite(LED_PIN, HIGH);   // LED ON during TX
      spiTransferMessage(msg);
      delay(200);
      digitalWrite(LED_PIN, LOW);    // LED OFF

    } else {
      // ---- SEND GPS/WIFI MESSAGE ----
      digitalWrite(LED_PIN, HIGH);   // LED ON during TX
      do_scan_and_report();
      delay(200);
      digitalWrite(LED_PIN, LOW);    // LED OFF
    }

    sendBatteryNext = !sendBatteryNext;   // flip for next cycle
  }

  //Scan for GNSS fix
  while (Serial2.available()) {
    char c = Serial2.read();
    if (gps.encode(c)) {
      G = 1;
      gps.f_get_position(&lat, &lon);
    }
  }
}
