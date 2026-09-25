# CaveVerse - Project Run Commands

This document contains step-by-step instructions to set up and run the **CaveVerse** project on any machine.

---

## 🏗️ Architecture Overview

CaveVerse consists of three core services running simultaneously:

1. **LiveKit SFU Server** (Port `7880`) — Handles WebRTC media streaming (video calls, audio, screen sharing).
2. **Colyseus Game Server** (Port `2567`) — Manages player presence, movement physics, office state, chat, and LiveKit token generation.
3. **Vite Frontend Client** (Port `5173`) — React 18 + Phaser 3 interactive 2D virtual office web application.

---

## 📋 Prerequisites

Ensure the following are installed on your system:

### 1. Node.js
- **Node.js**: `v18.x` or `v20.x` recommended (Minimum: `v16.13.0`)
- **npm**: `v8.x` or higher

Check your installation:
```bash
node -v
npm -v
```

### 2. LiveKit Server CLI
Install the LiveKit server binary for your operating system:

- **macOS (via Homebrew):**
  ```bash
  brew install livekit
  ```

- **Linux:**
  ```bash
  curl -sSL https://get.livekit.io | bash
  ```

- **Windows (via Winget or PowerShell):**
  ```powershell
  winget install LiveKit.LiveKitServer
  ```

- **Docker (Alternative for any OS):**
  ```bash
  docker run --rm -it -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev
  ```

---

## 📦 Step 1: Install Dependencies

Navigate to the project root directory (`CaveVerse-master`) and install packages for both the backend server and frontend client:

```bash
# 1. Install Backend (Colyseus) dependencies
cd server
npm install

# 2. Install Frontend (React + Phaser) dependencies
cd ../client
npm install
```

---

## 🚀 Step 2: Start the Project (3 Separate Terminals)

Open **3 separate terminal windows / tabs** in the project directory:

### Terminal 1: LiveKit SFU Media Server
```bash
livekit-server --dev --rtc.force_tcp
```
> **Port:** `7880`  
> **Note:** `--dev` uses default development credentials (`devkey` / `secret`). `--rtc.force_tcp` ensures stable WebRTC connectivity across firewalls and local networks.

---

### Terminal 2: Colyseus Backend Server
```bash
cd server
npm run dev
```
> **Port:** `2567`  
> **Note:** Uses `tsx watch` for auto-reloading on code changes.

---

### Terminal 3: Vite Frontend Client
```bash
cd client
npm run dev
```
> **URL:** `http://localhost:5173`  
> **Note:** Compiles React, TailwindCSS, and Phaser assets with instant HMR.

---

## 🌐 Step 3: Open the Application

Open your browser and navigate to:
```
http://localhost:5173
```

1. Enter your name.
2. Select your character avatar.
3. Click **Join Room** to enter the virtual office lobby!

---

## 📱 Testing on Mobile & Multiple Devices

### Option A: Local Wi-Fi Network
To access CaveVerse from another device on the same local Wi-Fi:

1. Find your host laptop's local IP address:
   - **macOS / Linux:** `ifconfig | grep "inet "` (e.g. `192.168.1.50`)
   - **Windows:** `ipconfig` (IPv4 Address)
2. Start the client binding to host:
   ```bash
   cd client
   npm run dev -- --host
   ```
3. Open `http://<YOUR_LOCAL_IP>:5173` on the other device.

### Option B: Remote / Mobile Testing with Ngrok (Recommended for Camera & Mic)
Mobile browsers (iOS Safari and Android Chrome) require **HTTPS** to grant camera and microphone access. Use **Ngrok** to create a secure tunnel:

```bash
ngrok http 5173
```
Copy the generated `https://xxxx.ngrok-free.dev` URL and open it on your phone or remote laptop!

---

## 🛠️ Common Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Port already in use (`7880`, `2567`, or `5173`)** | A previous server instance is still running in background. | Find and kill process: `lsof -i :<PORT>` then `kill -9 <PID>` |
| **Camera / Mic blocked on phone** | Mobile browsers block camera/mic on insecure `http://` connections. | Use an HTTPS tunnel via Ngrok: `ngrok http 5173` |
| **Other user cannot see video in the lobby** | By design, camera in the lobby is a private self-preview. | Walk both characters into the **same Office** (e.g. Main Workstation). Video and voice will connect automatically. |
| **Microphone icon stays on in browser** | Mute must stop the hardware stream. | The codebase handles this automatically by stopping `mediaStreamTrack` hardware capture and unpublishing tracks upon mute. |
