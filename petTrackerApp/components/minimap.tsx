import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

type MiniMapProps = {
  lat: number | null;
  lng: number | null;
};

export default function MiniMap({ lat, lng }: MiniMapProps) {
  if (lat == null || lng == null) return null; // skip rendering

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        }}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 20,
  },
  map: {
    flex: 1,
  },
});
