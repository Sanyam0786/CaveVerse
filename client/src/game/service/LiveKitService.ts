import {
    Room,
    RoomEvent,
    RemoteParticipant,
    RemoteTrackPublication,
    RemoteTrack,
    LocalTrack,
    Track,
    createLocalScreenTracks,
    createLocalTracks,
    ScreenSharePresets,
    VideoQuality,
} from "livekit-client";
import store from "../../app/store";
import {
    addRemoteTrack,
    removeRemoteTrack,
    setMyScreenTrack,
    clearMyScreenTrack,
    setMyCameraTrack,
    clearMyCameraTrack,
    setIsCameraOn,
    setIsMicOn,
    setHasMediaStarted,
    setIsConnected,
} from "../../app/features/webRtc/liveKitSlice";
import phaserGame from "../main";
import { GameScene } from "../scenes/GameScene";

class LiveKitService {
    private static instance: LiveKitService;
    private room: Room | null = null;
    private lobbyStream: MediaStream | null = null;

    private constructor() { }

    public static getInstance(): LiveKitService {
        if (!LiveKitService.instance) {
            LiveKitService.instance = new LiveKitService();
        }
        return LiveKitService.instance;
    }

    // ── Connection ──────────────────────────────────────────────────────────────

    public async connect(url: string, token: string): Promise<void> {
        if (this.room) {
            await this.room.disconnect();
        }

        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
            reconnectPolicy: {
                nextRetryDelayInMs: (retryContext) =>
                    retryContext.retryCount > 5
                        ? null
                        : Math.min(retryContext.retryCount * 1000, 5000),
            },
        });

        // ── Track events ──────────────────────────────────────────────────────
        this.room.on(
            RoomEvent.TrackSubscribed,
            (
                track: RemoteTrack,
                pub: RemoteTrackPublication,
                participant: RemoteParticipant
            ) => {
                console.log(
                    `[LiveKit] Track subscribed from ${participant.identity}: ${track.kind} / ${pub.source}`
                );
                if (track.kind === "audio") {
                    try {
                        const el = track.attach();
                        el.id = `lk-audio-${participant.identity}-${track.sid}`;
                    } catch (e) {
                        console.warn("[LiveKit] Audio attach warning:", e);
                    }
                }
                if (pub.source === Track.Source.ScreenShare) {
                    pub.setVideoQuality(VideoQuality.HIGH);
                }
                store.dispatch(
                    addRemoteTrack({
                        participantId: participant.identity,
                        participantName:
                            participant.name || participant.identity,
                        trackSid: track.sid,
                        kind: track.kind as "audio" | "video",
                        source: pub.source, // "camera" | "microphone" | "screen_share"
                        mediaStreamTrack: track.mediaStreamTrack,
                    })
                );
            }
        );

        this.room.on(
            RoomEvent.TrackUnsubscribed,
            (
                track: RemoteTrack,
                pub: RemoteTrackPublication,
                participant: RemoteParticipant
            ) => {
                console.log(
                    `[LiveKit] Track unsubscribed from ${participant.identity}`
                );
                if (track.kind === "audio") {
                    try {
                        track.detach();
                    } catch (e) {
                        console.warn("[LiveKit] Audio detach warning:", e);
                    }
                }
                store.dispatch(
                    removeRemoteTrack({
                        participantId: participant.identity,
                        trackSid: track.sid,
                    })
                );
            }
        );

        this.room.on(RoomEvent.Disconnected, () => {
            console.log("[LiveKit] Disconnected from room");
            store.dispatch(setIsConnected(false));
        });

        this.room.on(RoomEvent.Connected, () => {
            console.log("[LiveKit] Connected to room:", this.room.name);
            store.dispatch(setIsConnected(true));
        });

        await this.room.connect(url, token, {
            autoSubscribe: true,
            rtcConfig: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:global.stun.twilio.com:3478" },
                ],
            },
        });

        // If user already started webcam in the lobby, transfer to LiveKit room
        if (this.lobbyStream) {
            this.lobbyStream.getTracks().forEach((t) => t.stop());
            this.lobbyStream = null;
        }

        if (store.getState().livekit.isCameraOn) {
            this.room.localParticipant
                .setCameraEnabled(true)
                .then((pub) => {
                    const track =
                        pub?.track?.mediaStreamTrack ||
                        this.room?.localParticipant.getTrackPublication(
                            Track.Source.Camera
                        )?.track?.mediaStreamTrack;
                    if (track) {
                        store.dispatch(setMyCameraTrack(track));
                    }
                    const gameInstance = phaserGame.scene.keys
                        .GameScene as GameScene;
                    gameInstance?.updateWebcamStatus(true);
                })
                .catch((err) => {
                    console.warn("[LiveKit] Auto-enabling camera on connect failed:", err);
                });
        }

        if (store.getState().livekit.isMicOn) {
            this.room.localParticipant
                .setMicrophoneEnabled(true)
                .then(() => {
                    const gameInstance = phaserGame.scene.keys
                        .GameScene as GameScene;
                    gameInstance?.updateMicStatus(true);
                })
                .catch((err) => {
                    console.warn("[LiveKit] Auto-enabling mic on connect failed:", err);
                });
        }
    }

    public async disconnect(): Promise<void> {
        if (this.room) {
            await this.room.disconnect();
            this.room = null;
        }
        store.dispatch(setIsConnected(false));
    }

    public getRoom(): Room | null {
        return this.room;
    }

    // ── Screen Sharing ──────────────────────────────────────────────────────────

    public async startScreenShare(): Promise<void> {
        if (!this.room) {
            console.error("[LiveKit] Cannot share screen — not connected");
            return;
        }

        const tracks = await createLocalScreenTracks({
            audio: false,
            resolution: ScreenSharePresets.h1080fps30.resolution,
        });
        const screenTrack = tracks[0];

        // Optimize track for high-clarity text and UI
        if ("contentHint" in screenTrack.mediaStreamTrack) {
            screenTrack.mediaStreamTrack.contentHint = "detail";
        }

        await this.room.localParticipant.publishTrack(screenTrack, {
            name: "screen_share",
            source: Track.Source.ScreenShare,
            simulcast: false, // Send full original quality without downscaled simulcast layers
            videoEncoding: {
                maxBitrate: 6_000_000, // 6 Mbps for crystal-clear 1080p text rendering
                maxFramerate: 30,
            },
            degradationPreference: "maintain-resolution", // Never blur text, always prioritize sharp resolution
        });
        store.dispatch(setMyScreenTrack(screenTrack.mediaStreamTrack));

        console.log("[LiveKit] Screen sharing started at 1080p (high quality)");

        // Handle user clicking browser's native "Stop Sharing" button
        screenTrack.mediaStreamTrack.addEventListener("ended", () => {
            this.stopScreenShare();
        });
    }

    public async stopScreenShare(): Promise<void> {
        if (!this.room) return;

        const pubs = this.room.localParticipant
            .getTrackPublications()
            .filter((p) => p.source === Track.Source.ScreenShare);

        for (const pub of pubs) {
            if (pub.track) {
                await this.room.localParticipant.unpublishTrack(
                    pub.track as LocalTrack
                );
            }
        }

        store.dispatch(clearMyScreenTrack());

        // Notify Phaser scene
        const gameInstance = phaserGame.scene.keys
            .GameScene as GameScene;
        gameInstance?.playerStoppedScreenSharing();

        console.log("[LiveKit] Screen sharing stopped");
    }

    // ── Camera & Microphone ─────────────────────────────────────────────────────

    public async startWebcam(): Promise<void> {
        // If not connected to a room yet, start preview in lobby
        if (!this.room) {
            try {
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                } catch {
                    // Audio might be unavailable or denied; try video only
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                    });
                }

                this.lobbyStream = stream;
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    store.dispatch(setMyCameraTrack(videoTrack));
                }
                store.dispatch(setIsCameraOn(true));
                store.dispatch(setIsMicOn(stream.getAudioTracks().length > 0));
                store.dispatch(setHasMediaStarted(true));
                console.log("[LiveKit] Lobby webcam preview started");
            } catch (err) {
                console.error("[LiveKit] Failed to access webcam in lobby:", err);
                alert("Could not access camera. Please allow camera permissions in your browser.");
            }
            return;
        }

        // Inside LiveKit room
        try {
            const pub = await this.room.localParticipant.setCameraEnabled(true);
            const track =
                pub?.track?.mediaStreamTrack ||
                this.room.localParticipant.getTrackPublication(Track.Source.Camera)
                    ?.track?.mediaStreamTrack;

            if (track) {
                store.dispatch(setMyCameraTrack(track));
            }
            store.dispatch(setIsCameraOn(true));
            store.dispatch(setHasMediaStarted(true));

            const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
            gameInstance?.updateWebcamStatus(true);
            gameInstance?.updateDisconnectStatus(false);
            console.log("[LiveKit] Camera enabled in room");
        } catch (err) {
            console.error("[LiveKit] Failed to enable camera:", err);
            alert("Could not access camera. Please allow camera permissions in your browser.");
            return;
        }

        try {
            await this.room.localParticipant.setMicrophoneEnabled(true);
            store.dispatch(setIsMicOn(true));
            const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
            gameInstance?.updateMicStatus(true);
        } catch (err) {
            console.warn("[LiveKit] Failed to enable microphone:", err);
        }
    }

    public async toggleCamera(): Promise<void> {
        if (!this.room) {
            // In lobby
            if (this.lobbyStream) {
                const videoTracks = this.lobbyStream.getVideoTracks();
                const currentlyOn = store.getState().livekit.isCameraOn;
                videoTracks.forEach((t) => (t.enabled = !currentlyOn));
                if (currentlyOn) {
                    store.dispatch(clearMyCameraTrack());
                } else if (videoTracks[0]) {
                    store.dispatch(setMyCameraTrack(videoTracks[0]));
                }
            } else {
                await this.startWebcam();
            }
            return;
        }

        const currentlyOn = store.getState().livekit.isCameraOn;
        const nextState = !currentlyOn;

        try {
            await this.room.localParticipant.setCameraEnabled(nextState);
            if (nextState) {
                const pub = this.room.localParticipant.getTrackPublication(
                    Track.Source.Camera
                );
                if (pub?.track?.mediaStreamTrack) {
                    store.dispatch(setMyCameraTrack(pub.track.mediaStreamTrack));
                }
                store.dispatch(setIsCameraOn(true));
            } else {
                store.dispatch(clearMyCameraTrack());
            }

            const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
            gameInstance?.updateWebcamStatus(nextState);
        } catch (err) {
            console.error("[LiveKit] Failed to toggle camera:", err);
        }
    }

    public async toggleMic(): Promise<void> {
        if (!this.room) {
            const nextMic = !store.getState().livekit.isMicOn;
            if (this.lobbyStream) {
                this.lobbyStream
                    .getAudioTracks()
                    .forEach((t) => (t.enabled = nextMic));
            }
            store.dispatch(setIsMicOn(nextMic));
            return;
        }

        const nextState = !store.getState().livekit.isMicOn;
        try {
            await this.room.localParticipant.setMicrophoneEnabled(nextState);
            store.dispatch(setIsMicOn(nextState));

            const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
            gameInstance?.updateMicStatus(nextState);
        } catch (err) {
            console.error("[LiveKit] Failed to toggle microphone:", err);
        }
    }

    public async stopWebcam(): Promise<void> {
        if (this.lobbyStream) {
            this.lobbyStream.getTracks().forEach((t) => t.stop());
            this.lobbyStream = null;
        }

        if (this.room) {
            await this.room.localParticipant.setCameraEnabled(false).catch(() => {});
            await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }

        store.dispatch(clearMyCameraTrack());
        store.dispatch(setIsCameraOn(false));
        store.dispatch(setIsMicOn(false));
        store.dispatch(setHasMediaStarted(false));

        const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
        gameInstance?.updateWebcamStatus(false);
        gameInstance?.updateMicStatus(false);
        gameInstance?.updateDisconnectStatus(true);
        console.log("[LiveKit] Webcam and mic stopped (disconnected)");
    }
}

export default LiveKitService.getInstance();
