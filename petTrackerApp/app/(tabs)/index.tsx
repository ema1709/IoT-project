import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePetStore } from "@/stores/petStore";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect } from "react";
import HeroCard from '../card';


const owner = {
  name: "John Doe",
  location: "Copenhagen, Denmark",
  image: "https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg",
};

const pets = [
  { name: "Milo", type: "Dog", image: "https://www.zooplus.co.uk/magazine/wp-content/uploads/2019/03/English-Cocker-Spaniel-Puppy.webp" },
  { name: "Coco", type: "Dog", image: "https://www.vidavetcare.com/wp-content/uploads/sites/234/2022/04/golden-retriever-dog-breed-info.jpeg" }
];

export default function HomeScreen() {

  useFocusEffect(
    useCallback(() => {
      usePetStore.getState().clearPet(); // reset selected pet
    }, [])
  );

  const setTemperature = usePetStore((state) => state.setTemperature);
  const setHumidity = usePetStore((state) => state.setHumidity);
  const setLatestActivity = usePetStore((state) => state.setLatestActivity);
  const setLatestLat = usePetStore((state) => state.setLatestLat);
  const setLatestLong = usePetStore((state) => state.setLatestLong);
  const setLatestBattery = usePetStore((state) => state.setLatestBattery);

useEffect(() => {
  async function fetchSensorAndLocation() {
    try {
      // 1. Fetch your IoT data
      const res = await fetch("https://iotprotoapi-a9h3ewdacjg6bzg8.francecentral-01.azurewebsites.net/messages");
      const data = await res.json();

      if (!data || data.length === 0) return;


      //const sensor = data[0];

      interface Sensor {
        id: string;
        deviceId: string;
        lastUpdated: string;
        temperature_c: number;
        humidity_pct: number;
        activity_index: number;
        activity_index_avg: number;
        spi_raw: string;
        battery_percent: number;
        _ts: number;
      }

      const sensor = data.find((item: Sensor) => item.id === "temp-sensor");

      console.log(sensor)

      // Update your state values
      setTemperature(sensor.temperature_c);
      setHumidity(sensor.humidity_pct);
      setLatestActivity(sensor.activity_index_avg);
      setLatestBattery(sensor.battery_percent);

      // 2. Build the wifiAccessPoints array
      const wifiAccessPoints = [
        {
          macAddress: sensor.macAddress1,
          signalStrength: sensor.signalStrength1,
        },
        {
          macAddress: sensor.macAddress2,
          signalStrength: sensor.signalStrength2,
        },
        {
          macAddress: sensor.macAddress3,
          signalStrength: sensor.signalStrength3,
        },
      ].filter(x => x.macAddress && x.signalStrength); // avoid nulls

      // 3. Call Google Geolocation API
      const geoRes = await fetch(
        "https://www.googleapis.com/geolocation/v1/geolocate?key=AIzaSyBCcZt87r0BnicODppqSUi0eq0L5NTOccI",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wifiAccessPoints }),
        }
      );
      const geoData = await geoRes.json();
      setLatestLat(geoData.location.lat);
      setLatestLong(geoData.location.lng);
      console.log( geoData);
      
    } catch (error) {
      console.error("Error:", error);
    }
  }

  fetchSensorAndLocation();
}, []);


  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/Logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Your Pets!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <HeroCard owner={owner} pets={pets} />
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    top: 10,
    left: -50,
    position: 'absolute',
  },
});
