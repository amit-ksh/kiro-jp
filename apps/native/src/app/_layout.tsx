import { Stack } from "expo-router";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../features/auth/AuthProvider";
import { DeletionProvider } from "../features/auth/DeletionProvider";
import { LaunchScreen } from "../components/LaunchScreen";
export default function Layout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <AuthProvider>
          <DeletionProvider>
            <StatusBar barStyle="light-content" />
            <Stack screenOptions={{ headerShown: false }} />
          </DeletionProvider>
        </AuthProvider>
        <LaunchScreen />
      </View>
    </SafeAreaProvider>
  );
}
