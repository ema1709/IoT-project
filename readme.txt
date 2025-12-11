# Pet Wearable Firmware – Arduino Pro Mini + LoRaWAN (main/main.ino)
This code has been developed by Emanuele Moschillo and Pietro Ughini  and it is aimed to be uploaded on the Arduino Pro mini.
This README contains all the information needed to prepare the environment, install libraries, configure hardware, and run the firmware for the Pet Wearable project.

## 1. Hardware Requirements
Boards:
- Arduino Pro Mini 3.3V / 8 MHz
- ESP32 DevKit
- RN2483 / RN2903 LoRaWAN module
- MPU-6050 accelerometer
- DHT11 sensor
- MAX17048 fuel gauge (optional)
- LEDs and buzzer

## 2. Pin Connections
LoRa RN2483 → Pro Mini:
TX=5, RX=2, RST=4

SPI ESP32 → Pro Mini:
MOSI=MOSI, MISO=MISO, SCK=SCK, SS=10

Sensors:
DHT11=6, MPU SDA=A4, SCL=A5

Outputs:
LED Temp=9, LED Hum=3, Buzzer=8

## 3. Required Libraries
- DHT sensor library (Adafruit)
- Adafruit Unified Sensor
- Wire, SPI, SoftwareSerial (built-in)
- rn2xx3 LoRaWAN library

## 4. TTN Setup
Use AppEUI=0000000000000000 and AppKey=A8D63C2A45A77B431FB19F69CFCAAA4F.
Enable OTAA.

## 5. Firmware Behaviour
Sequential uplink cycle every 30s:
1→Temp, 2→Hum, 3→Activity Index, 4→WiFi MACs, 5→Battery.

## 6. Downlink Control (Port 10)
0=Force OFF, 1=Force ON, 2=Auto mode.

## 7. Buzzer Logic
Buzzer ON if thresholds exceeded or forced.
Automatic safety stops forced ON after 10s.

## 8. SPI Frames From ESP32
Bxxx=battery, Wxxx=WiFi scan, Gxxx=GNSS.

## 9. MPU Activity Index
AI = sum of |A(t)-A(t−1)| over time.

## 10. Upload Instructions
Select Pro Mini 5V/16MHz, install libs, upload, open Serial 115200, wait for join.


Notes:
All the frequencies in the code were set for testing reason.

# IotPrototypingBackend
This repository hosts PetTracker, the final project for the IoT Prototyping course. Inside, you’ll find the full integration pipeline between The Things Network (TTN) and Microsoft Azure, along with a React frontend and a Node.js backend that together form the application's user interface and API.

Backend Libraries
Library	Purpose
express	REST API server
cors	Enable cross-origin requests
dotenv	Load environment variables
@azure/cosmos	Read/write Cosmos DB documents
node-fetch / global fetch	Send HTTP requests to TTN

Azure Function Libraries
Library	Purpose
@azure/functions	Azure Functions runtime
@azure/cosmos	Storage of decoded sensor data

Frontend (React)
Library	Purpose
react	UI rendering
axios	HTTP requests to backend
chart.js (if used)	Visualizing data
react-router	Navigation
react	Core React framework for building UI components
react-native	Native mobile UI framework used for building screens, styles, and components
expo platform	Allows running the app in Expo environment
expo-image	High-performance image component for React Native
@react-navigation/native	Used for navigating between screens in the app
useFocusEffect	Hook that triggers re-renders when screen becomes active
@expo/vector-icons (Ionicons)	Full icon pack used for buttons, indicators, and UI elements
react-native-circular-progress	Circular progress animation used for displaying activity or battery levels

Prerequisites
1. Environment Variables
Create a .env file with:
COSMOS_ENDPOINT=xxxx
COSMOS_KEY=xxxx
DATABASE_ID=IoTMessages
CONTAINER_ID=DeviceData
TTN_APP_ID=xxxx
TTN_API_KEY=xxxx
PORT=3001

2. Azure Requirements
Azure Cosmos DB account
Database: IoTMessages
Container: DeviceData
Event Hub input configured for TTN traffic
Function App deployed and connected to Event Hub

3. The Things Network (TTN)
Application created
Device added
Payload decoder configured
Downlink API key created

4. Backend Installation & Run
npm install
node server.js

5. Frontend Installation & Run
npm install
npm start

6. Folder Contents
/backend
/react-app
/azure-function
README.md

# Pet Tracker React app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```
✅ React App – Libraries Used (Clean, Non-Duplicate Version)

Below is the cleaned list of libraries used in your React Native project, grouped and properly described as required for documentation.

📌 Core Libraries
Library	Purpose
react	Core React framework for building UI components
react-native	Native mobile UI framework used for building screens, styles, and components
expo platform	Allows running the app in Expo environment
expo-image	High-performance image component for React Native
📌 State Management
Library	Purpose
@/stores/petStore (Zustand)	Manages global state for pet data (temperature, activity, etc.)

You are using:
import { usePetStore } from "@/stores/petStore";
This implies: Zustand state management library.

📌 Navigation
Library	Purpose
@react-navigation/native	Used for navigating between screens in the app
useFocusEffect	Hook that triggers re-renders when screen becomes active
📌 Icons & UI Components
Library	Purpose
@expo/vector-icons (Ionicons)	Full icon pack used for buttons, indicators, and UI elements
react-native-circular-progress	Circular progress animation used for displaying activity or battery levels
📌 Custom Components

These come from your own codebase (not external libraries):

Component	Purpose
MiniMap	Renders map UI for GPS position
HeroCard	Custom UI card for displaying pet info
HelloWave	Animated greeting component
ParallaxScrollView	Parallax header scrolling view
ThemedText	Text component supporting light/dark mode
ThemedView	Theme-aware container component


-----main/GPS_ESP32.ino - README-----
Made by Andreas Svartá with ChatGPT.

Overview
This firmware runs on an ESP32 and alternates between:
- Scanning Wi-Fi access points and reporting strongest identifiable BSSIDs.
- Reading GNSS latitude and longitude from a GPS module on Serial2.
- Reading battery percentage and low-voltage alert from a MAX17048 fuel gauge.
- Sending all telemetry over VSPI to a downstream microcontroller such as a Pro Mini.

Required Libraries
WiFi.h             
SPI.h               
Wire.h             
TinyGPS.h            
Adafruit_MAX1704X.h

Wi-Fi Scanning
Operates in station mode without joining networks.
Scans visible non-hidden networks.
Sorts networks by RSSI strength.
Filters randomized MAC addresses and duplicate BSSIDs from the same router.
Sends the top three valid networks over SPI in compact form.
Message prefix: W

GNSS Positioning
Reads NMEA data on Serial2 at 9600 baud.
Uses TinyGPS to decode latitude and longitude.
Used when fewer than three Wi-Fi networks are detected.
Message prefix: G

Battery Monitoring
Uses MAX17048 fuel gauge over I2C (SDA pin 21, SCL pin 22).
Encodes battery information in a single byte.
Lower seven bits = battery percent from 0 to 100.
Most significant bit = low-voltage alert flag.
Message prefix: B

Telemetry Timing
Telemetry interval is 10 seconds.
The device alternates:
Cycle A: Wi-Fi or GNSS message.
Cycle B: Battery message.
LED on GPIO 2 turns on during transmissions.

Hardware Interfaces

SPI to Pro Mini (VSPI bus)
MOSI pin 23
MISO pin 19
SCK pin 18
SS pin 5
Messages are raw character streams. Device expects one return byte per transmitted byte.

GPS Module (Serial2)
RX pin 25
TX pin 26
Baud 9600

MAX17048 Fuel Gauge (I2C)
SDA pin 21
SCL pin 22
Low-voltage alert configured at 3.3 volts

