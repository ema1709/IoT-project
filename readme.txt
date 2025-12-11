# Pet Wearable Firmware – Arduino Pro Mini + ESP32 + LoRaWAN

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

