import { useEffect, useState } from "react";
import { View, Text, SafeAreaView, Button, Platform, Alert, TouchableOpacity, Image } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LiveKitRoom, useRoomContext, useLocalParticipant, VideoTrack, useTracks } from "@livekit/react-native";
import { Track } from "livekit-client";
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Ionicons } from '@expo/vector-icons';

const TOKEN_BASE = "https://8a84c4f7e0d1.ngrok-free.app";   
//const TOKEN_BASE = "https://mission-2-3.onrender.com"

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
        if (newCameraState) {
          // When turning camera on, try to enable it
          await localParticipant.setCameraEnabled(true);
        } else {
          // When turning camera off, just disable it
          await localParticipant.setCameraEnabled(false);
        }
        console.log("Camera set successfully to:", newCameraState);
      } catch (error) {
        console.error("Error setting camera:", error);
        // Don't revert state on error - just log it and continue
        // The UI will show placeholder when camera is off
      }
    }
  };
  
  return (
    <View className="flex-row justify-center items-center py-5 px-5 bg-black/80 gap-8">
      <TouchableOpacity 
        className={`w-14 h-14 rounded-full justify-center items-center shadow-lg ${
          isMicEnabled ? 'bg-blue-500' : 'bg-red-500'
        }`}
        onPress={handleMicToggle}
      >
        <Ionicons 
          name={isMicEnabled ? "mic" : "mic-off"} 
          size={24} 
          color="white" 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="w-16 h-16 rounded-full justify-center items-center bg-red-500 shadow-lg"
        onPress={() => router.back()}
      >
        <Ionicons name="call" size={24} color="white" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        className={`w-14 h-14 rounded-full justify-center items-center shadow-lg ${
          isCameraEnabled ? 'bg-blue-500' : 'bg-red-500'
        }`}
        onPress={handleCameraToggle}
      >
        <Ionicons 
          name={isCameraEnabled ? "videocam" : "videocam-off"} 
          size={24} 
          color="white" 
        />
      </TouchableOpacity>
    </View>
  );
}

function Grid({ isCameraEnabled }: { isCameraEnabled: boolean }) {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();
  
  console.log("Grid: Number of video tracks:", tracks.length);
  tracks.forEach((trackRef, index) => {
    console.log(`Track ${index}:`, trackRef.participant?.identity, trackRef.participant?.name);
  });
  
  // Separate local and remote tracks
  const localTrack = tracks.find(track => track.participant?.identity === localParticipant?.identity);
  const remoteTracks = tracks.filter(track => track.participant?.identity !== localParticipant?.identity);
  
  if (tracks.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <Text className="text-white text-base font-medium">No video tracks available</Text>
        <Text className="text-white/70 text-xs mt-2">Check camera permissions</Text>
      </View>
    );
  }
  
  return (
    <View className="flex-1 bg-black">
      {/* Main video feed - show the first remote track or local if no remote */}
      <View className="flex-1 relative">
        {remoteTracks.length > 0 ? (
          <VideoTrack 
            trackRef={remoteTracks[0]} 
            style={{ flex: 1, width: '100%', height: '100%' }} 
          />
        ) : localTrack ? (
          <VideoTrack 
            trackRef={localTrack} 
            style={{ flex: 1, width: '100%', height: '100%' }} 
          />
        ) : null}
        
        {/* Participant name overlay */}
        {remoteTracks.length > 0 && (
          <View className="absolute bottom-5 left-5 bg-black/60 px-3 py-1.5 rounded-2xl">
            <Text className="text-white text-sm font-medium">
              {remoteTracks[0].participant?.name || remoteTracks[0].participant?.identity || 'Unknown'}
            </Text>
          </View>
        )}
      </View>
      
      {/* Picture-in-Picture for local video - positioned above control buttons */}
      <View className="absolute bottom-24 right-5 w-24 h-16 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
        {isCameraEnabled && localTrack ? (
          <VideoTrack 
            trackRef={localTrack} 
            style={{ flex: 1, width: '100%', height: '100%' }} 
          />
        ) : (
          <View className="flex-1 justify-center items-center bg-gray-700">
            <Ionicons name="person" size={20} color="white" />
          </View>
        )}
        <View className="absolute bottom-0.5 left-0.5 right-0.5 bg-black/60 px-1 py-0.5 rounded text-center">
          <Text className="text-white text-xs font-medium">
            {localTrack?.participant?.name || 'You'}
          </Text>
        </View>
      </View>
      
      {/* Additional remote participants as small tiles */}
      {remoteTracks.length > 1 && (
        <View className="absolute top-15 left-5 flex-row gap-2">
          {remoteTracks.slice(1).map((trackRef, index) => (
            <View key={index} className="w-20 h-25 rounded-lg overflow-hidden bg-gray-800">
              <VideoTrack 
                trackRef={trackRef} 
                style={{ flex: 1, width: '100%', height: '100%' }} 
              />
              <Text className="absolute bottom-0.5 left-0.5 right-0.5 text-white text-xs bg-black/60 px-1 py-0.5 rounded text-center">
                {trackRef.participant?.name || trackRef.participant?.identity || 'Unknown'}
              </Text>
            </View>
          ))}
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
        <Grid isCameraEnabled={isCameraEnabled} />
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

