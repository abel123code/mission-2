import { useEffect, useState } from "react";
import { View, Text, SafeAreaView, Button, Platform, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LiveKitRoom, useRoomContext, useLocalParticipant, VideoTrack, useTracks } from "@livekit/react-native";
import { Track } from "livekit-client";
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const TOKEN_BASE = process.env.EXPO_PUBLIC_API_URL || "https://mission-2-3.onrender.com";   

function Controls({ 
  isMicEnabled, 
  setIsMicEnabled, 
  isCameraEnabled, 
  setIsCameraEnabled 
}: {
  isMicEnabled: boolean;
  setIsMicEnabled: (enabled: boolean) => void;
  isCameraEnabled: boolean;
  setIsCameraEnabled: (enabled: boolean) => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled: livekitMic, isCameraEnabled: livekitCam } = useLocalParticipant();
  
  console.log("Controls: Mic enabled:", livekitMic, "Camera enabled:", livekitCam);
  console.log("Local participant:", localParticipant?.identity, localParticipant?.name);
  
  const handleMicToggle = async () => {
    const newMicState = !isMicEnabled;
    setIsMicEnabled(newMicState);
    if (localParticipant) {
      try {
        await localParticipant.setMicrophoneEnabled(newMicState);
        console.log("Microphone set successfully to:", newMicState);
      } catch (error) {
        console.error("Error setting microphone:", error);
        // Revert state if failed
        setIsMicEnabled(!newMicState);
      }
    }
  };
  
  const handleCameraToggle = async () => {
    const newCameraState = !isCameraEnabled;
    console.log("Camera toggle: ", isCameraEnabled, " -> ", newCameraState);
    setIsCameraEnabled(newCameraState);
    if (localParticipant) {
      try {
        await localParticipant.setCameraEnabled(newCameraState);
        console.log("Camera set successfully to:", newCameraState);
      } catch (error) {
        console.error("Error setting camera:", error);
        // Revert state if failed
        setIsCameraEnabled(!newCameraState);
      }
    }
  };
  
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 8 }}>
      <Button
        title={isMicEnabled ? "Mute" : "Unmute"}
        onPress={handleMicToggle}
      />
      <Button
        title={isCameraEnabled ? "Camera Off" : "Camera On"}
        onPress={handleCameraToggle}
      />
      <Button title="Leave" color="#c33" onPress={() => router.back()} />
    </View>
  );
}

function Grid() {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera]);
  
  console.log("Grid: Number of video tracks:", tracks.length);
  tracks.forEach((trackRef, index) => {
    console.log(`Track ${index}:`, trackRef.participant?.identity, trackRef.participant?.name);
  });
  
  return (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
      {tracks.map((trackRef, index) => (
        <View key={index} style={{ width: "50%", height: 240, padding: 4 }}>
          <VideoTrack trackRef={trackRef} style={{ flex: 1 }} />
          <Text style={{ 
            position: 'absolute', 
            bottom: 8, 
            left: 8, 
            color: 'white', 
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 4,
            borderRadius: 4,
            fontSize: 12
          }}>
            {trackRef.participant?.name || trackRef.participant?.identity || 'Unknown'}
          </Text>
        </View>
      ))}
      {tracks.length === 0 && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 16 }}>No video tracks available</Text>
          <Text style={{ color: 'white', fontSize: 12, marginTop: 8 }}>Check camera permissions</Text>
        </View>
      )}
    </View>
  );
}

export default function CallScreen() {
  const { room: roomName, name, mic, cam, avatar } = useLocalSearchParams<{ 
    room: string; 
    name: string; 
    mic: string; 
    cam: string; 
    avatar: string; 
  }>();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(mic === 'true');
  const [isCameraEnabled, setIsCameraEnabled] = useState(cam === 'true');

  // Request microphone and camera permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Request microphone permission
        const micPermission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.MICROPHONE 
          : PERMISSIONS.ANDROID.RECORD_AUDIO;
        
        const micResult = await request(micPermission);
        
        if (micResult === RESULTS.DENIED || micResult === RESULTS.BLOCKED) {
          Alert.alert(
            'Microphone Permission Required',
            'This app needs microphone access for video calls. Please enable it in your device settings.',
            [{ text: 'OK' }]
          );
        }

        // Request camera permission
        const cameraPermission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.CAMERA 
          : PERMISSIONS.ANDROID.CAMERA;
        
        const cameraResult = await request(cameraPermission);
        
        if (cameraResult === RESULTS.DENIED || cameraResult === RESULTS.BLOCKED) {
          Alert.alert(
            'Camera Permission Required',
            'This app needs camera access for video calls. Please enable it in your device settings.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    };

    requestPermissions();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log("Attempting to connect to:", `${TOKEN_BASE}/join-room`);
        console.log("Platform:", Platform.OS);
        console.log("Request payload:", {
          room_name: roomName || 'demo',
          participant_name: name || 'user',
          mic_enabled: mic === 'true',
          camera_enabled: cam === 'true',
          invite_avatar: avatar === 'true'
        });

        // Use the /join-room endpoint with POST request
        const response = await fetch(`${TOKEN_BASE}/join-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_name: roomName || 'demo',
            participant_name: name || 'user',
            mic_enabled: mic === 'true',
            camera_enabled: cam === 'true',
            invite_avatar: avatar === 'true'
          })
        });

        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Server error:", errorData);
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const json = await response.json();
        console.log("Token response:", { 
          hasToken: !!json.token, 
          hasUrl: !!json.livekit_url,
          roomName: json.room_name,
          avatarInvited: json.avatar_invited
        });

        if (!json.token) {
          throw new Error("No token received from server");
        }

        setToken(json.token);
        setServerUrl(json.livekit_url);
        
        // Handle avatar status
        if (json.avatar_invited) {
          setAvatarStatus(`Avatar "${json.avatar_name}" invited to the room!`);
        } else if (avatar === 'true') {
          setAvatarStatus("Avatar invitation failed or not configured");
        }
      } catch (e: any) {
        console.error("Token fetch error:", e);
        setErr(e.message || "Failed to fetch token");
      }
    })();
  }, [roomName, name, mic, cam, avatar]);

  if (err) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: "red", padding: 16, textAlign: 'center' }}>
          Error: {err}
        </Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!token || !serverUrl) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ padding: 16 }}>Getting token…</Text>
        {avatarStatus && (
          <Text style={{ padding: 16, color: '#10b981', textAlign: 'center' }}>
            {avatarStatus}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {avatarStatus && (
        <View style={{ 
          backgroundColor: '#10b981', 
          padding: 8, 
          alignItems: 'center' 
        }}>
          <Text style={{ color: 'white', fontSize: 12 }}>
            {avatarStatus}
          </Text>
        </View>
      )}
      
      {/* Discreet room name display */}
      <View style={{
        position: 'absolute',
        top: 50,
        left: 16,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
      }}>
        <Text style={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          fontSize: 10,
          fontFamily: 'monospace'
        }}>
          Room: {roomName}
        </Text>
      </View>
      
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        audio={isMicEnabled}
        video={isCameraEnabled}
        onDisconnected={() => router.back()}
      >
        <Grid />
        <Controls 
          isMicEnabled={isMicEnabled}
          setIsMicEnabled={setIsMicEnabled}
          isCameraEnabled={isCameraEnabled}
          setIsCameraEnabled={setIsCameraEnabled}
        />
      </LiveKitRoom>
    </View>
  );
}
