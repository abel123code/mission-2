# Video Calling Server Setup

This server provides LiveKit token generation and avatar agent functionality for the video calling application.

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)
- Git (to clone the repository)

## Setup Instructions

### 1. Navigate to Server Directory

```bash
cd server
```

### 2. Create Virtual Environment

```bash
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows:
.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
# Install all required packages
pip install -r requirements.txt
```

### 4. Environment Variables Setup

Create a `.env` file in the server directory with the following variables:

```env
# LiveKit Configuration
LIVEKIT_URL=your_livekit_url_here
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here

# Tavus Configuration (for avatar features)
TAVUS_API_KEY=your_tavus_api_key_here
TAVUS_REPLICA_ID=your_tavus_replica_id_here
TAVUS_PERSONA_ID=your_tavus_persona_id_here
```

### 5. Start the Server

```bash
# Start the server on port 3001
uvicorn server:app --host 0.0.0.0 --port 3001 --reload
```

The server will be available at `http://localhost:3001` or` https://mission-2-3.onrender.com`
