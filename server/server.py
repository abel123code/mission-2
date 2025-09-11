import os
import subprocess
import asyncio
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

# LiveKit Python server SDK
from livekit import api  # pip install livekit-api

load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL")  # not strictly needed for token; handy to expose to FE if you want
LK_API_KEY = os.getenv("LIVEKIT_API_KEY")
LK_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID")

if not (LK_API_KEY and LK_API_SECRET):
    raise RuntimeError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in .env")

if not (TAVUS_API_KEY and TAVUS_REPLICA_ID and TAVUS_PERSONA_ID):
    print("Warning: Tavus credentials not fully configured. Avatar features will be disabled.")

app = FastAPI(title="LiveKit Token Server")

# CORS configuration - allow all origins for now
# TODO: Update this with your actual frontend domains after deployment
allowed_origins = ["*"]  # Allow all origins for initial deployment

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

class JoinRoomRequest(BaseModel):
    room_name: str
    participant_name: str
    mic_enabled: bool = True
    camera_enabled: bool = True
    invite_avatar: bool = False  # New field to optionally invite avatar

class InviteAvatarRequest(BaseModel):
    room_name: str
    avatar_name: str = "AI Assistant"

# Store running avatar processes
avatar_processes = {}

async def start_avatar_agent(room_name: str) -> bool:
    """
    Start an avatar agent process for the specified room.
    Returns True if successful, False otherwise.
    """
    try:
        if not (TAVUS_API_KEY and TAVUS_REPLICA_ID and TAVUS_PERSONA_ID):
            print("Tavus credentials not configured")
            return False
            
        # Check if avatar is already running for this room
        if room_name in avatar_processes:
            process = avatar_processes[room_name]
            if process.poll() is None:
                print(f"Avatar already running for room: {room_name}")
                return True
            else:
                # Process has ended, clean it up
                print(f"Cleaning up dead avatar process for room: {room_name}")
                del avatar_processes[room_name]
            
        # Set environment variables for the agent process
        env = os.environ.copy()
        env.update({
            "LIVEKIT_URL": LIVEKIT_URL,
            "LIVEKIT_API_KEY": LK_API_KEY,
            "LIVEKIT_API_SECRET": LK_API_SECRET,
            "TAVUS_API_KEY": TAVUS_API_KEY,
            "TAVUS_REPLICA_ID": TAVUS_REPLICA_ID,
            "TAVUS_PERSONA_ID": TAVUS_PERSONA_ID,
        })
        
        # Start the avatar agent process with virtual environment
        if os.name == 'nt':  # Windows
            # Use the current Python executable (which should be from the virtual environment)
            cmd = [
                sys.executable, 
                "avatar_agent.py", "connect",
                "--room", room_name
            ]
        else:  # Unix/Linux/Mac
            cmd = [
                sys.executable, 
                "avatar_agent.py", "connect",
                "--room", room_name
            ]
        
        print(f"Starting avatar agent with command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            env=env,
            cwd=os.path.dirname(os.path.abspath(__file__)),  # Use server directory
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Store the process
        avatar_processes[room_name] = process
        
        # Give it a moment to start
        await asyncio.sleep(2)
        
        # Check if process is still running
        if process.poll() is None:
            print(f"Avatar agent started successfully for room: {room_name}")
            # Read any immediate output
            try:
                stdout, stderr = process.communicate(timeout=1)
                if stdout:
                    print(f"Avatar agent stdout: {stdout}")
                if stderr:
                    print(f"Avatar agent stderr: {stderr}")
            except subprocess.TimeoutExpired:
                # Process is still running, which is good
                pass
            return True
        else:
            stdout, stderr = process.communicate()
            print(f"Avatar agent failed to start. stdout: {stdout}, stderr: {stderr}")
            return False
            
    except Exception as e:
        print(f"Error starting avatar agent: {str(e)}")
        return False

@app.get("/")
def health():
    return {"ok": True, "service": "livekit-token", "livekit_url": LIVEKIT_URL}

@app.get("/token")
def token(roomName: str = "demo", identity: str = "", name: str = ""):
    """
    Mint a client join token.
    GET /token?roomName=demo&identity=abel[&name=Abel Tan]
    """
    try:
        identity = (identity or "").strip() or f"user-{os.urandom(3).hex()}"
        name = (name or identity).strip()

        # Grants: allow this identity to join the given room
        grants = api.VideoGrants(
            room_join=True,
            room=roomName,
        )

        # Build token with fluent API (current SDK style)
        token = (
            api.AccessToken(os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET"))
            .with_identity(identity)   # participant identity (unique per room)
            .with_name(name)           # display name shown in UIs
            .with_grants(grants)
        )

        return {
            "token": token.to_jwt(),
            "roomName": roomName,
            "identity": identity,
            "name": name,
            "livekitUrl": os.getenv("LIVEKIT_URL"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TOKEN_MINT_FAILED: {e}")

@app.post("/join-room")
async def join_room(request: JoinRoomRequest):
    """
    Create a room and return a token for joining.
    This endpoint handles room creation and token generation in one call.
    Optionally starts a Tavus avatar agent for the room.
    """
    try:
        # Generate a unique identity for the participant
        identity = f"{request.participant_name}-{os.urandom(4).hex()}"
        
        # Create video grant for the room
        grant = api.VideoGrants(
            room_join=True,
            room=request.room_name,
        )
        
        # Create access token
        at = api.AccessToken(LK_API_KEY, LK_API_SECRET)
        at.with_identity(identity)
        at.with_grants(grant)
        
        # Note: LiveKit rooms are created automatically when the first participant joins
        # So we don't need to explicitly create the room here
        
        response_data = {
            "token": at.to_jwt(),
            "room_name": request.room_name,
            "identity": identity,
            "livekit_url": LIVEKIT_URL,
            "participant_name": request.participant_name,
            "mic_enabled": request.mic_enabled,
            "camera_enabled": request.camera_enabled
        }

        # Optionally start avatar agent if requested and credentials are available
        if request.invite_avatar:
            avatar_started = await start_avatar_agent(request.room_name)
            response_data["avatar_invited"] = avatar_started
            if avatar_started:
                response_data["avatar_name"] = "AI Assistant"
            else:
                response_data["avatar_error"] = "Failed to start avatar agent"
        else:
            response_data["avatar_invited"] = False
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create room and token: {str(e)}")

@app.post("/invite-avatar")
async def invite_avatar_to_room(request: InviteAvatarRequest):
    """
    Start a Tavus avatar agent for a room.
    This will spawn a separate process running the avatar agent.
    """
    try:
        if not (TAVUS_API_KEY and TAVUS_REPLICA_ID and TAVUS_PERSONA_ID):
            raise HTTPException(
                status_code=400, 
                detail="Tavus credentials not configured. Please set TAVUS_API_KEY, TAVUS_REPLICA_ID, and TAVUS_PERSONA_ID in your .env file"
            )

        avatar_started = await start_avatar_agent(request.room_name)
        
        if avatar_started:
            return {
                "success": True,
                "message": f"Avatar '{request.avatar_name}' invited to room '{request.room_name}'",
                "room_name": request.room_name,
                "avatar_name": request.avatar_name
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to start avatar agent"
            )

    except Exception as e:
        print(f"Error inviting avatar: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to invite avatar: {str(e)}"
        )

@app.get("/room-info/{room_name}")
async def get_room_info(room_name: str):
    """
    Get information about a specific room.
    """
    try:
        # Check if avatar is running for this room
        avatar_running = False
        if room_name in avatar_processes:
            process = avatar_processes[room_name]
            avatar_running = process.poll() is None  # None means still running
        
        return {
            "room_name": room_name,
            "livekit_url": LIVEKIT_URL,
            "status": "available",
            "avatar_running": avatar_running
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get room info: {str(e)}")

@app.post("/cleanup-avatar/{room_name}")
async def cleanup_avatar_process(room_name: str):
    """
    Manually clean up a stuck avatar process for a room.
    """
    try:
        if room_name in avatar_processes:
            process = avatar_processes[room_name]
            if process.poll() is None:
                # Process is still running, terminate it
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                print(f"Terminated avatar process for room: {room_name}")
            del avatar_processes[room_name]
            return {
                "success": True,
                "message": f"Cleaned up avatar process for room: {room_name}"
            }
        else:
            return {
                "success": True,
                "message": f"No avatar process found for room: {room_name}"
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to cleanup avatar process: {str(e)}"
        }

@app.get("/test-tavus")
async def test_tavus_credentials():
    """
    Test endpoint to verify Tavus credentials are properly configured.
    """
    try:
        if not (TAVUS_API_KEY and TAVUS_REPLICA_ID and TAVUS_PERSONA_ID):
            return {
                "status": "error",
                "message": "Tavus credentials not fully configured",
                "credentials": {
                    "api_key": "Set" if TAVUS_API_KEY else "Missing",
                    "replica_id": "Set" if TAVUS_REPLICA_ID else "Missing", 
                    "persona_id": "Set" if TAVUS_PERSONA_ID else "Missing"
                }
            }
        
        # Test basic imports
        try:
            from livekit import agents
            from livekit.plugins import tavus
            imports_ok = True
        except ImportError as e:
            imports_ok = False
            import_error = str(e)
        
        return {
            "status": "success",
            "message": "Tavus credentials are configured",
            "credentials": {
                "api_key": f"Set (ends with ...{TAVUS_API_KEY[-4:]})",
                "replica_id": TAVUS_REPLICA_ID,
                "persona_id": TAVUS_PERSONA_ID
            },
            "imports": {
                "livekit_agents": imports_ok,
                "livekit_tavus_plugin": imports_ok,
                "error": import_error if not imports_ok else None
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error testing Tavus credentials: {str(e)}"
        }

if __name__ == "__main__":
    import uvicorn
    # Use production settings when deployed
    is_production = os.getenv("RENDER") == "true" or os.getenv("ENVIRONMENT") == "production"
    
    uvicorn.run(
        "server:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "3001")),
        reload=not is_production,  # Disable reload in production
        workers=1 if is_production else 1,  # Single worker for now
    )
