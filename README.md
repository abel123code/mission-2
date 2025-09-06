# AI Avatar Video Calling App - Complete Process Flow / How it works

# Individual set up instructions for server and frontend in their own respective folder

## 🎯 Overview

This project implements a real-time video calling application with an AI avatar that can see, hear, think, and respond to users. The system combines React Native mobile app, LiveKit for real-time communication, OpenAI for AI processing, and Tavus for visual avatar representation.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   FastAPI       │    │   LiveKit       │
│   Mobile App    │◄──►│   Server        │◄──►│   Server        │
│                 │    │                 │    │                 │
│ - Join Screen   │    │ - Token Gen     │    │ - Room Mgmt     │
│ - Call Screen   │    │ - Avatar Agent  │    │ - Media Streams │
│ - Controls      │    │ - Process Mgmt  │    │ - WebRTC        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Avatar Agent  │
                       │                 │
                       │ - OpenAI STT    │
                       │ - OpenAI LLM    │
                       │ - OpenAI TTS    │
                       │ - Silero VAD    │
                       │ - Tavus Avatar  │
                       └─────────────────┘
```

## 🔄 Complete Process Flow

### 1. User Interaction Phase

#### 1.1 Join Screen (`rn-video-calling-app/app/(tabs)/index.tsx`)

**User Actions:**

- User opens the app and sees the join screen
- User enters their display name (default: "abel")
- User toggles microphone on/off (default: on)
- User toggles camera on/off (default: on)
- User toggles "Invite AI Avatar" (default: on)
- User presses "Join" button

**Code Flow:**

```typescript
const handleJoin = () => {
  const roomName = generateRoomName(); // e.g., "room-metyln77-lu5x8d"
  router.push({
    pathname: "/call",
    params: {
      room: roomName,
      name,
      mic: String(micOn),
      cam: String(camOn),
      avatar: String(inviteAvatar),
    },
  });
};
```

**Room Name Generation:**

```typescript
const generateRoomName = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `room-${timestamp}-${randomStr}`;
};
```

### 2. Call Screen Initialization (`rn-video-calling-app/app/(tabs)/call.tsx`)

#### 2.1 Permission Request

```typescript
// Request microphone and camera permissions
const requestPermissions = async () => {
  const micPermission =
    Platform.OS === "ios"
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const cameraPermission =
    Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;

  // Request permissions and show alerts if denied
};
```

#### 2.2 Token Request

```typescript
// POST request to server for LiveKit token
const response = await fetch(`${TOKEN_BASE}/join-room`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    room_name: roomName,
    participant_name: name,
    mic_enabled: mic === "true",
    camera_enabled: cam === "true",
    invite_avatar: avatar === "true",
  }),
});
```

**Server URLs:**

cd server
uvicorn server:app --host 127.0.0.1 --port 3001 --reload

- Android Emulator: `http://10.0.2.2:3001`
- iOS Simulator: `http://192.168.1.23:3001`

### 3. Server Processing (`server/server.py`)

#### 3.1 `/join-room` Endpoint

**Request Processing:**

```python
@app.post("/join-room")
async def join_room(request: JoinRoomRequest):
    # 1. Generate unique participant identity
    identity = f"{request.participant_name}-{os.urandom(4).hex()}"

    # 2. Create LiveKit video grants
    grant = api.VideoGrants(
        room_join=True,
        room=request.room_name,
    )

    # 3. Generate access token
    at = api.AccessToken(LK_API_KEY, LK_API_SECRET)
    at.with_identity(identity)
    at.with_grants(grant)

    # 4. Start avatar agent if requested
    if request.invite_avatar:
        avatar_started = await start_avatar_agent(request.room_name)

    # 5. Return token and metadata
    return {
        "token": at.to_jwt(),
        "room_name": request.room_name,
        "identity": identity,
        "livekit_url": LIVEKIT_URL,
        "avatar_invited": avatar_started
    }
```

#### 3.2 Avatar Agent Process Management

**Process Spawning:**

```python
async def start_avatar_agent(room_name: str) -> bool:
    # 1. Check if avatar already running
    if room_name in avatar_processes:
        return True

    # 2. Set environment variables
    env = os.environ.copy()
    env.update({
        "LIVEKIT_URL": LIVEKIT_URL,
        "LIVEKIT_API_KEY": LK_API_KEY,
        "LIVEKIT_API_SECRET": LK_API_SECRET,
        "TAVUS_API_KEY": TAVUS_API_KEY,
        "TAVUS_REPLICA_ID": TAVUS_REPLICA_ID,
        "TAVUS_PERSONA_ID": TAVUS_PERSONA_ID,
    })

    # 3. Start subprocess (room name is passed via the cli --room room_name)
    cmd = [sys.executable, "avatar_agent.py", "connect", "--room", room_name]
    process = subprocess.Popen(cmd, env=env, cwd=os.path.dirname(__file__))

    # 4. Store process reference
    avatar_processes[room_name] = process

    return True
```

### 4. Avatar Agent Initialization (`server/avatar_agent.py`)

#### 4.1 Agent Entry Point

```python
async def entrypoint(ctx: agents.JobContext):
    room_name = getattr(ctx, 'room', None)
    print(f"[avatar_agent] starting for room={room_name}")

    # 1. Connect to LiveKit room
    await ctx.connect()
    print("[avatar_agent] connected")
```

### 5. LiveKit Room Connection

#### 5.1 Mobile App Connection

```typescript
// LiveKitRoom component connects using token
<LiveKitRoom
  serverUrl={serverUrl}
  token={token}
  audio={isMicEnabled}
  video={isCameraEnabled}
  onConnected={() => console.log("Connected to room")}
>
  {/* Room content */}
</LiveKitRoom>
```

#### 5.2 Room Participants

- **User**: Joins with camera/microphone tracks
- **AI Avatar**: Joins with Tavus visual representation and AI processing

### 6. Real-Time Communication Flow

#### 6.1 User Speech → Avatar Response

**Step 1: Voice Input**

1. User speaks into microphone
2. Audio captured by React Native app
3. Audio streamed to LiveKit server
4. LiveKit distributes audio to all participants

**Step 2: Avatar Processing**

1. **VAD Detection**: Silero detects when user is speaking
2. **STT Processing**: OpenAI Whisper converts speech to text
3. **LLM Processing**: GPT-4o generates response
4. **TTS Processing**: OpenAI TTS converts response to speech
5. **Avatar Rendering**: Tavus displays visual avatar speaking

**Step 3: Response Delivery**

1. Audio response streamed back through LiveKit
2. User hears avatar's voice response
3. Visual avatar shows speaking animation

#### 6.2 Event Monitoring

```python
# Monitor room events
@ctx.room.on("participant_connected")
async def on_participant_connected(participant):
    print(f"[avatar_agent] Participant connected: {participant.identity}")
    await participant.subscribe()

@ctx.room.on("track_subscribed")
def on_track_subscribed(track, publication, participant):
    if track.kind == "audio":
        print(f"[avatar_agent] Audio track received from {participant.identity}")
```

### 7. Mobile App Controls

#### 7.1 Camera/Microphone Toggles

```typescript
const handleMicToggle = async () => {
  const newMicState = !isMicEnabled;
  setIsMicEnabled(newMicState);
  if (localParticipant) {
    await localParticipant.setMicrophoneEnabled(newMicState);
  }
};

const handleCameraToggle = async () => {
  const newCameraState = !isCameraEnabled;
  setIsCameraEnabled(newCameraState);
  if (localParticipant) {
    await localParticipant.setCameraEnabled(newCameraState);
  }
};
```

#### 7.2 Video Grid Display

```typescript
function Grid() {
  const tracks = useTracks([Track.Source.Camera]);

  return (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
      {tracks.map((trackRef, index) => (
        <View key={index} style={{ width: "50%", height: 240, padding: 4 }}>
          <VideoTrack trackRef={trackRef} style={{ flex: 1 }} />
          <Text>
            {trackRef.participant?.name || trackRef.participant?.identity}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

## 🔧 Technical Components

### Frontend (React Native + Expo)

- **Framework**: Expo Router for navigation
- **Real-time**: LiveKit React Native SDK
- **Permissions**: react-native-permissions
- **Styling**: NativeWind (Tailwind CSS)

### Backend (Python + FastAPI)

- **Framework**: FastAPI
- **Real-time**: LiveKit Python SDK
- **Process Management**: subprocess.Popen
- **Environment**: Python virtual environment

### AI Processing

- **STT**: OpenAI Whisper-1
- **LLM**: OpenAI GPT-4o
- **TTS**: OpenAI TTS-1 (Alloy voice)
- **VAD**: Silero Voice Activity Detection

### Visual Avatar

- **Provider**: Tavus
- **Integration**: LiveKit Agents Tavus Plugin
- **Features**: Real-time visual representation

### Real-time Communication

- **Provider**: LiveKit
- **Protocol**: WebRTC
- **Features**: Audio/video streaming, room management

## 🚀 API Endpoints

### `POST /join-room`

**Purpose**: Create room and generate access token
**Request Body**:

```json
{
  "room_name": "room-metyln77-lu5x8d",
  "participant_name": "abel",
  "mic_enabled": true,
  "camera_enabled": true,
  "invite_avatar": true
}
```

**Response**:

```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "room_name": "room-metyln77-lu5x8d",
  "identity": "abel-a1b2c3d4",
  "livekit_url": "wss://your-livekit-server.com",
  "avatar_invited": true,
  "avatar_name": "AI Assistant"
}
```

### `GET /token` (Legacy)

**Purpose**: Generate token for existing room
**Query Parameters**: `roomName`, `identity`, `name`

### `POST /invite-avatar`

**Purpose**: Manually invite avatar to existing room
**Request Body**:

```json
{
  "room_name": "room-metyln77-lu5x8d",
  "avatar_name": "AI Assistant"
}
```

## 🔑 Environment Variables

### Required

```bash
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

### Optional (for Avatar)

```bash
TAVUS_API_KEY=your-tavus-api-key
TAVUS_REPLICA_ID=your-tavus-replica-id
TAVUS_PERSONA_ID=your-tavus-persona-id
OPENAI_API_KEY=your-openai-api-key
```

## 📱 Mobile App Permissions

### Android (`android/app/src/main/AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-feature android:name="android.hardware.camera" />
<uses-feature android:name="android.hardware.camera.autofocus" />
```

### iOS (`app.json`)

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-permissions",
        {
          "microphone": "Allow $(PRODUCT_NAME) to access your microphone",
          "camera": "Allow $(PRODUCT_NAME) to access your camera"
        }
      ]
    ]
  }
}
```

## 🎯 Key Features

1. **Automatic Room Generation**: Unique room names generated for each session
2. **Real-time Video/Audio**: LiveKit WebRTC communication
3. **AI Avatar**: Visual and conversational AI assistant
4. **Dynamic Controls**: Camera/microphone toggle functionality
5. **Cross-platform**: Works on Android and iOS
6. **Process Management**: Avatar agents managed per room
7. **Error Handling**: Comprehensive error handling and logging

## 🔄 Complete User Journey

1. **User opens app** → Join screen appears
2. **User enters name** → Display name set for the session
3. **User toggles settings** → Microphone, camera, avatar preferences
4. **User presses "Join"** → Room name generated, navigation to call screen
5. **Permissions requested** → Camera and microphone access
6. **Token requested** → Server generates LiveKit access token
7. **Avatar agent started** → Python subprocess spawned for AI processing
8. **Room connection** → User and avatar join LiveKit room
9. **Initial greeting** → Avatar greets user with voice and visual
10. **Real-time conversation** → User speaks, avatar processes and responds
11. **Controls available** → User can toggle camera/microphone
12. **Session ends** → User leaves, avatar agent terminates

This system provides a complete end-to-end solution for AI-powered video calling with real-time avatar interaction.
