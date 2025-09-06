import os
import asyncio
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    tavus,
    silero,
)

load_dotenv()

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="You are a helpful voice AI assistant with a friendly personality. Keep responses concise and engaging. You can help with general questions, provide information, and have casual conversations.")

async def entrypoint(ctx: agents.JobContext):
    room_name = getattr(ctx, 'room', None)
    print(f"[avatar_agent] starting for room={room_name}")
    await ctx.connect()
    print("[avatar_agent] connected")

    # Create the AI agent session with all components
    session = AgentSession(
        stt=openai.STT(
            api_key=OPENAI_API_KEY,
            model="whisper-1"
        ),
        llm=openai.LLM(
            api_key=OPENAI_API_KEY,
            model="gpt-4o"
        ),
        tts=openai.TTS(
            api_key=OPENAI_API_KEY,
            model="tts-1",
            voice="alloy"
        ),
        vad=silero.VAD.load()
    )
    print("[avatar_agent] created AI agent session with STT, LLM, TTS, and VAD")

    # Create Tavus avatar session for visual representation
    avatar = tavus.AvatarSession(
        api_key=TAVUS_API_KEY,
        replica_id=TAVUS_REPLICA_ID,
        persona_id=TAVUS_PERSONA_ID,
        avatar_participant_name="AI Assistant"
    )
    print("[avatar_agent] created Tavus avatar session")
    print(f"[avatar_agent] Tavus config: replica_id={TAVUS_REPLICA_ID}, persona_id={TAVUS_PERSONA_ID}")

    # Start the Tavus avatar first
    print(f"[avatar_agent] starting Tavus avatar for room: {room_name}")
    await avatar.start(session, room=ctx.room)
    print("[avatar_agent] Tavus avatar started")

    # Start the AI agent session
    print("[avatar_agent] starting AI agent session...")
    await session.start(
        room=ctx.room,
        agent=Assistant(),
    )
    print("[avatar_agent] AI agent session started")

    # Generate initial greeting
    print("[avatar_agent] generating initial greeting...")
    await session.generate_reply(
        instructions="Greet the user warmly and offer your assistance. Keep it brief and friendly."
    )
    print("[avatar_agent] initial greeting sent")

    # Monitor for audio events
    async def monitor_audio():
        while True:
            await asyncio.sleep(10)  # Check every 10 seconds
            participants = list(ctx.room.participants.values())
            print(f"[avatar_agent] Room has {len(participants)} participants:")
            for p in participants:
                print(f"  - {p.identity} ({p.name}): mic={p.is_microphone_enabled}, cam={p.is_camera_enabled}")
    
    # Start monitoring in background
    asyncio.create_task(monitor_audio())
    
    # Monitor for audio events
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        print(f"[avatar_agent] Track subscribed: {track.kind} from {participant.identity}")
        if track.kind == "audio":
            print(f"[avatar_agent] Audio track received from {participant.identity}")
            print(f"[avatar_agent] Audio track details: source={track.source}, sid={track.sid}")
    
    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        print(f"[avatar_agent] Track published: {publication.kind} from {participant.identity}")
        if publication.kind == "audio":
            print(f"[avatar_agent] Audio track published from {participant.identity}")
            print(f"[avatar_agent] Audio track details: source={publication.source}, sid={publication.sid}")
    
    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(track, publication, participant):
        print(f"[avatar_agent] Track unsubscribed: {track.kind} from {participant.identity}")
    
    @ctx.room.on("participant_connected")
    async def on_participant_connected(participant):
        print(f"[avatar_agent] Participant connected: {participant.identity}")
        # Subscribe to the new participant's tracks
        print(f"[avatar_agent] Subscribing to tracks from new participant: {participant.identity}")
        await participant.subscribe()
    
    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        print(f"[avatar_agent] Participant disconnected: {participant.identity}")

    print("[avatar_agent] avatar session active, monitoring for audio...")
    print("[avatar_agent] Room participants:", [p.identity for p in ctx.room.participants.values()])

    try:
        while True:
            await asyncio.sleep(1)
    finally:
        print("[avatar_agent] shutting down")
        await session.aclose()

# 👇 THIS is what enables:  `python avatar_agent.py dev|start|connect --room demo`
if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))

# you physically run this command: python avatar_agent.py connect --room room-metyln77-lu5x8d
# However, when we try to "automate it", we need to call this file from server.py, meaning it will look for - if __name__ == "__main__":
# parses the room name from the command line and passes it to the entrypoint function.