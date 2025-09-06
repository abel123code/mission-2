# Deploying to Render

This guide will help you deploy the LiveKit video calling server to Render.

## Prerequisites

1. A Render account (sign up at [render.com](https://render.com))
2. Your LiveKit credentials (API key and secret)
3. Your Tavus credentials (optional, for avatar features)
4. Your OpenAI API key (for avatar features)

## Deployment Steps

### 1. Prepare Your Repository

Make sure your server code is in a Git repository and pushed to GitHub, GitLab, or Bitbucket.

### 2. Create a New Web Service on Render

1. Log in to your Render dashboard
2. Click "New +" and select "Web Service"
3. Connect your repository
4. Choose the repository containing your server code

### 3. Configure the Service

Use these settings:

- **Name**: `livekit-video-calling-server` (or your preferred name)
- **Environment**: `Python 3`
- **Region**: Choose the closest region to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `server` (since your server code is in the server folder)
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### 4. Set Environment Variables

In the Render dashboard, go to the "Environment" tab and add these variables:

#### Required Variables:

```
LIVEKIT_URL=your_livekit_url_here
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
```

#### Optional Variables (for avatar features):

```
TAVUS_API_KEY=your_tavus_api_key_here
TAVUS_REPLICA_ID=your_tavus_replica_id_here
TAVUS_PERSONA_ID=your_tavus_persona_id_here
OPENAI_API_KEY=your_openai_api_key_here
```

#### Render-specific Variables:

```
RENDER=true
HOST=0.0.0.0
PORT=10000
```

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your service
3. Wait for the deployment to complete (usually 2-5 minutes)

### 6. Test Your Deployment

Once deployed, you can test your server:

1. **Health Check**: Visit `https://your-service-name.onrender.com/`

   - Should return: `{"ok": true, "service": "livekit-token", "livekit_url": "your_url"}`

2. **Token Generation**: Test the token endpoint:

   ```
   GET https://your-service-name.onrender.com/token?roomName=test&identity=user1&name=Test User
   ```

3. **Join Room**: Test the join room endpoint:
   ```bash
   curl -X POST https://your-service-name.onrender.com/join-room \
     -H "Content-Type: application/json" \
     -d '{
       "room_name": "test-room",
       "participant_name": "Test User",
       "mic_enabled": true,
       "camera_enabled": true
     }'
   ```

## Configuration Files

The following files are included for Render deployment:

- **`Procfile`**: Tells Render how to start your application
- **`runtime.txt`**: Specifies the Python version
- **`requirements.txt`**: Lists all Python dependencies with pinned versions
- **`render.yaml`**: Optional configuration file for automated deployments

## Important Notes

### CORS Configuration

The server is currently configured to allow all origins (`["*"]`) for initial deployment. This makes it easy to test and connect from any frontend.

**After you deploy and know your frontend domains**, you should update the CORS configuration in `server.py` for better security:

```python
allowed_origins = [
    "https://your-frontend-domain.com",
    "https://your-frontend-domain.onrender.com",
    "http://localhost:3000",  # For local development
    "http://localhost:8081",  # For React Native development
]
```

**Steps to update CORS after deployment:**

1. Deploy your server first (with `allowed_origins = ["*"]`)
2. Deploy your frontend and note its domain
3. Update the `allowed_origins` list in `server.py`
4. Commit and push the changes
5. Render will automatically redeploy with the updated CORS settings

### Avatar Features

If you want to use avatar features, make sure to:

1. Set all required Tavus and OpenAI environment variables
2. Test the avatar functionality using the `/test-tavus` endpoint
3. Note that avatar processes may have different behavior in the cloud environment

### Scaling

- The current configuration uses a single worker
- For higher traffic, consider upgrading to a paid plan and adjusting worker count
- Monitor your service logs for any issues

### Monitoring

- Use Render's built-in monitoring and logs
- Check the "Logs" tab in your Render dashboard for any errors
- Monitor the health check endpoint regularly

## Troubleshooting

### Common Issues:

1. **Build Failures**: Check that all dependencies in `requirements.txt` are compatible
2. **Environment Variables**: Ensure all required variables are set correctly
3. **CORS Issues**: Update the allowed origins in production
4. **Avatar Issues**: Verify Tavus and OpenAI credentials are correct

### Getting Help:

- Check Render's documentation: [render.com/docs](https://render.com/docs)
- Review your service logs in the Render dashboard
- Test endpoints individually to isolate issues

## Security Considerations

1. **Environment Variables**: Never commit sensitive credentials to your repository
2. **CORS**: Restrict allowed origins in production
3. **HTTPS**: Render provides HTTPS by default
4. **API Keys**: Rotate your API keys regularly
5. **Monitoring**: Set up alerts for unusual activity

## Cost Optimization

- Start with the free tier for testing
- Monitor usage and upgrade only when needed
- Consider using Render's auto-sleep feature for development environments
- Optimize your code to reduce resource usage
