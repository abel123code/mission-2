import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b0f16" },
          headerTintColor: "white",
          contentStyle: { backgroundColor: "#0b0f16" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "Home" }}   // 👈 custom header
        />
        <Stack.Screen
          name="call"
          options={{ title: "In Call" }}    // 👈 custom header
        />
      </Stack>
    </>
  );
}
