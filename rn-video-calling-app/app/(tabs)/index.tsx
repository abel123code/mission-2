import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

// Function to generate a unique room name
const generateRoomName = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `room-${timestamp}-${randomStr}`;
};

export default function JoinScreen() {
  const [name, setName] = useState("abel");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [inviteAvatar, setInviteAvatar] = useState(true);

  const canJoin = name.trim().length > 0;

  const handleJoin = () => {
    const roomName = generateRoomName();
    // For FE-only phase, just navigate with params.
    router.push({
      pathname: "/call",
      params: { room: roomName, name, mic: String(micOn), cam: String(camOn), avatar: String(inviteAvatar) },
    });
  };

  return (
    <View className="flex-1 items-center justify-center px-5 bg-[#0b0f16]">
      <Text className="text-white text-2xl font-semibold mb-8">Join a room</Text>

      <View className="w-full gap-4">
        <View>
          <Text className="text-neutral-300 mb-2">Your display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. abel"
            placeholderTextColor="#6b7280"
            className="border border-neutral-700 rounded-xl px-4 py-3 text-white"
          />
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-neutral-300">Mic on</Text>
            <Switch value={micOn} onValueChange={setMicOn} />
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-neutral-300">Camera on</Text>
            <Switch value={camOn} onValueChange={setCamOn} />
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-neutral-300">Invite AI Avatar</Text>
            <Switch value={inviteAvatar} onValueChange={setInviteAvatar} />
          </View>
        </View>

        <Pressable
          onPress={handleJoin}
          disabled={!canJoin}
          className={`mt-6 rounded-2xl px-5 py-4 items-center ${
            canJoin ? "bg-indigo-600" : "bg-neutral-700"
          }`}
        >
          <Text className="text-white text-base font-medium">Join</Text>
        </Pressable>
      </View>
    </View>
  );
}
