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
    ConnectionState,
} from "livekit-client";
import store from "../../app/store";
import {
    addRemoteTrack,
    removeRemoteTrack,
    setMyScreenTrack,
    clearMyScreenTrack,
    setIsCameraOn,
    setIsMicOn,
    setIsConnected,
} from "../../app/features/webRtc/liveKitSlice";
import phaserGame from "../main";
import { GameScene } from "../scenes/GameScene";

class LiveKitService {
    private static instance: LiveKitService;
    private room: Room | null = null;

    private constructor() {}

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
                maxRetries: 5,
                nextRetryDelayInMs: (retryContext) =>
                    Math.min(retryContext.retryCount * 1000, 5000),
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
                store.dispatch(
                    addRemoteTrack({
                        participantId: participant.identity,
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

        await this.room.connect(url, token);
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

        const tracks = await createLocalScreenTracks({ audio: false });
        const screenTrack = tracks[0];

        await this.room.localParticipant.publishTrack(screenTrack);
        store.dispatch(setMyScreenTrack(screenTrack.mediaStreamTrack));

        console.log("[LiveKit] Screen sharing started");

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
        if (!this.room) {
            console.error("[LiveKit] Cannot start webcam — not connected");
            return;
        }

        const tracks = await createLocalTracks({ audio: true, video: true });
        for (const track of tracks) {
            await this.room.localParticipant.publishTrack(track);
        }

        store.dispatch(setIsCameraOn(true));
        store.dispatch(setIsMicOn(true));
        console.log("[LiveKit] Webcam started");
    }

    public async toggleCamera(): Promise<void> {
        if (!this.room) return;
        const enabled = !this.room.localParticipant.isCameraEnabled;
        await this.room.localParticipant.setCameraEnabled(enabled);
        store.dispatch(setIsCameraOn(enabled));

        const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
        gameInstance?.updateWebcamStatus(enabled);
    }

    public async toggleMic(): Promise<void> {
        if (!this.room) return;
        const enabled = !this.room.localParticipant.isMicrophoneEnabled;
        await this.room.localParticipant.setMicrophoneEnabled(enabled);
        store.dispatch(setIsMicOn(enabled));

        const gameInstance = phaserGame.scene.keys.GameScene as GameScene;
        gameInstance?.updateMicStatus(enabled);
    }

    public async stopWebcam(): Promise<void> {
        if (!this.room) return;

        const pubs = this.room.localParticipant
            .getTrackPublications()
            .filter(
                (p) =>
                    p.source === Track.Source.Camera ||
                    p.source === Track.Source.Microphone
            );

        for (const pub of pubs) {
            if (pub.track) {
                await this.room.localParticipant.unpublishTrack(
                    pub.track as LocalTrack
                );
            }
        }

        store.dispatch(setIsCameraOn(false));
        store.dispatch(setIsMicOn(false));
        console.log("[LiveKit] Webcam stopped");
    }
}

export default LiveKitService.getInstance();
