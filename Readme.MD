# CaveVerse

Hey there! 👋 Welcome to **CaveVerse** — an interactive 2D virtual office and metaverse where people can walk around, collaborate, and hang out in real-time. Chat with teammates, join video/voice calls with spatial proximity, share screens, or work together in private rooms.

---

## 🚀 Tech Stack

### Frontend (Client)
- **[React 18](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)**: Modular UI component architecture with strict type safety.
- **[Vite](https://vitejs.dev/)**: Fast, modern frontend build tool and development server.
- **[Phaser 3](https://phaser.io/)**: 2D game engine powering the virtual office world, tilemaps, character animations, collisions, and movement.
- **[LiveKit Client](https://livekit.io/) (`livekit-client`)**: WebRTC SFU client handling real-time audio chat, HD video streaming, and screen sharing.
- **[Colyseus.js](https://colyseus.io/) (`colyseus.js`)**: WebSocket client synchronizing player positions, states, and room events.
- **[Redux Toolkit](https://redux-toolkit.js.org/) (`@reduxjs/toolkit`, `react-redux`)**: Global state management for room status, chat history, and live media streams.
- **[Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)**: Modern design system with Radix UI accessible primitives.
- **[Motion](https://motion.dev/) (Framer Motion)**: Smooth animations and micro-interactions for media controls and floating action bars.
- **[Lucide React](https://lucide.dev/)**: Icon system across UI controls.
- **[Sonner](https://sonner.emilkowal.ski/)**: Toast notifications for game and connection alerts.

### Backend (Server)
- **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)**: Server-side runtime.
- **[Colyseus](https://colyseus.io/)**: Authoritative multiplayer game server orchestrating lobbies, public/private custom rooms, and player state synchronization.
- **[Express](https://expressjs.com/)**: REST API endpoints for room token generation and management.
- **[LiveKit Server SDK](https://docs.livekit.io/home/server/generating-tokens/) (`livekit-server-sdk`)**: Generation of secure access tokens for LiveKit video and audio sessions.
- **[LiveKit SFU](https://livekit.io/)**: Selective Forwarding Unit (SFU) providing scalable, low-latency audio/video routing.

---

## ✨ Features

- **2D Virtual Office Space**: Walk around custom-designed tiled office maps with animated avatars.
- **HD Video & Audio Calls**: Proximity and office-based real-time video/voice powered by LiveKit SFU.
- **Screen Sharing**: Stream presentations or code directly inside office rooms.
- **Public & Custom Private Rooms**: Join open public lobbies or create password-protected private custom rooms.
- **Global & Office-Specific Chat**: Communicate globally across the campus or privately with teammates inside the same room.
- **Live Minimap**: Expandable radar minimap with player dot tracking and coordinate readouts.
- **Mobile Touch Controls**: On-screen D-Pad and sprint controls optimized for mobile touch devices.
- **Clean Leave Room Flow**: Dedicated one-click room exit with state cleanup returning to the lobby.

---

## 📖 Setup & Run Guide

For step-by-step instructions on setting up and running CaveVerse, please refer to [PROJECT_RUN_COMMANDS.md](./PROJECT_RUN_COMMANDS.md).

