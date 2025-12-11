import { usePetStore } from "@/stores/petStore";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import MiniMap from "../../components/minimap";

export default function PetProfile() {
  const { selectedPet, latestTemperature, latestHumidity, latestActivity, latestLat, latestLong, latestBattery } = usePetStore();

  if (!selectedPet) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>No pet selected 🐾</Text>
        <Text style={styles.subtext}>Go back to Home and pick one!</Text>
      </View>
    );
  }

  // Dummy stats
  const dummyStats = {
    kmWalked: 5.2,
    timesEaten: 3,
    walks: 2,
    locationImage: "https://s.hdnux.com/photos/01/22/35/43/21616848/4/rawImage.jpg",
  };

  const activateBuzzer = () => {
    fetch("https://iotprotoapi-a9h3ewdacjg6bzg8.francecentral-01.azurewebsites.net/downlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "temp-sensor",
        payload: "AQ==", // Base64
        fPort: 10
      })
    });
    alert(`Buzzer for ${selectedPet.name} is on! 🐾`);
  };

  const deactivateBuzzer = () => {
    fetch("https://iotprotoapi-a9h3ewdacjg6bzg8.francecentral-01.azurewebsites.net/downlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "temp-sensor",
        payload: "AA==", // Base64
        fPort: 10
      })
    });
    alert(`Buzzer for ${selectedPet.name} is off! 🐾`);
  }

  const standardBuzzer = () => {
    fetch("https://iotprotoapi-a9h3ewdacjg6bzg8.francecentral-01.azurewebsites.net/downlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "temp-sensor",
        payload: "Ag==", // Base64
        fPort: 10
      })
    });
    alert(`Standard mode for ${selectedPet.name} is selected! 🐾`);
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Image source={{ uri: selectedPet.image ?? "" }} style={styles.petImage} />

        <Text style={styles.name}>{selectedPet.name}</Text>
        <Text style={styles.type}>{selectedPet.type}</Text>
        <Text style={styles.type}>Temperature: {latestTemperature}</Text>
        <Text style={styles.type}>Humidity: {latestHumidity}</Text>
        <Text style={styles.type}>Activity Index: {latestActivity}</Text>

        <AnimatedCircularProgress
          size={120}
          width={12}
          fill={Number(latestBattery ?? 50)}
          tintColor="#4caf50"
          backgroundColor="#e0e0e0"
        >
          {() => <Text>{latestBattery}%</Text>}
        </AnimatedCircularProgress>


        {typeof latestLat === "number" && typeof latestLong === "number" ? (
          <MiniMap lat={latestLat} lng={latestLong} />
        ) : (
          <Text style={{ marginVertical: 20 }}>Location unavailable</Text>
        )}


        <TouchableOpacity style={styles.button} onPress={activateBuzzer}>
          <Text style={styles.buttonText}>Turn Buzzer On</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={deactivateBuzzer}>
          <Text style={styles.buttonText}>Force Buffer Off</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={standardBuzzer}>
          <Text style={styles.buttonText}>Standard Buzzer Mode</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 20,
  },
  petImage: {
    marginTop: 60,
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#4f46e5",
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
    color: "#111827",
  },
  type: {
    fontSize: 18,
    color: "#6b7280",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#e0e7ff",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    color: "#4f46e5",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  map: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  placeholder: {
    fontSize: 20,
    fontWeight: "600",
    color: "#9ca3af",
  },
  subtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 6,
  },
  scrollContent: {
    paddingBottom: 50,
  },
});
