import { usePetStore } from "@/stores/petStore"; // ✅ import the store
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

type Pet = {
  name: string;
  type: string;
  image: string;
};

type Owner = {
  name: string;
  location: string;
  image: string;
};

type HeroCardProps = {
  owner: Owner;
  pets: Pet[];
};

const HeroCard: React.FC<HeroCardProps> = ({ owner, pets }) => {
  const router = useRouter();
  const setPet = usePetStore((state) => state.setPet); // ✅ store setter

  return (
    <View style={styles.card}>
      {/* Owner Section */}
      <View style={styles.ownerSection}>
        <Image source={{ uri: owner.image }} style={styles.ownerImage} />
        <View>
          <Text style={styles.ownerName}>{owner.name}</Text>
          <Text style={styles.ownerLocation}>{owner.location}</Text>
        </View>
      </View>

      {/* Pets Section */}
      <Text style={styles.sectionTitle}>Pets</Text>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.name}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setPet(item); // ✅ store pet globally
              router.push("/(tabs)/pet-profile"); // navigate
            }}
            style={styles.petCard}
          >
            <Image source={{ uri: item.image }} style={styles.petImage} />
            <Text style={styles.petName}>{item.name}</Text>
            <Text style={styles.petType}>{item.type}</Text>
          </Pressable>
        )}
      />
    </View>
  );
};

export default HeroCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ownerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  ownerImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  ownerName: {
    fontSize: 20,
    fontWeight: "600",
  },
  ownerLocation: {
    color: "#6b7280",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  petCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    marginBottom: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  petImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 6,
  },
  petName: {
    fontWeight: "500",
  },
  petType: {
    fontSize: 12,
    color: "#6b7280",
  },
});
