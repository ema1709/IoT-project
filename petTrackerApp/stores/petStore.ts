import { create } from "zustand";

type Pet = {
  name: string;
  type: string;
  image: string;
};

type PetStore = {
  selectedPet: Pet | null;
  setPet: (pet: Pet) => void;
  clearPet: () => void;
  latestTemperature: number | null;
  setTemperature: (temp: number) => void;
  latestHumidity: number | null;
  setHumidity: (hum: number) => void;
  latestActivity: number | null;
  setLatestActivity: (lata: number) => void;
  latestLat: number | null;
  setLatestLat: (latlat: number) => void;
  latestLong: number | null;
  setLatestLong: (latlong: number) => void;
  latestBattery: number | null;
  setLatestBattery: (latbat: number) => void;
};

export const usePetStore = create<PetStore>((set) => ({
  selectedPet: null,
  setPet: (pet) => set({ selectedPet: pet }),
  clearPet: () => set({ selectedPet: null }),
  latestTemperature: null,
  setTemperature: (temp) => set({ latestTemperature: temp }),
  latestHumidity: null,
  setHumidity: (hum) => set({latestHumidity: hum}),
  latestActivity: null,
  setLatestActivity: (lata) => set({latestActivity: lata}),
  latestLat: null,
  setLatestLat: (lat) => set({latestLat: lat}),
  latestLong: null,
  setLatestLong: (long) => set({latestLong: long}),
  latestBattery: null,
  setLatestBattery: (latbat) => set({latestBattery: latbat})
}));
