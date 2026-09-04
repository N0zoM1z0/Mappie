import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MappieScreen } from "./src/MappieScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MappieScreen />
    </SafeAreaProvider>
  );
}
