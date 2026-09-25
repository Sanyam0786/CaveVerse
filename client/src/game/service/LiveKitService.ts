import {
    Room,
    RoomEvent,
    Participant,
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
    removeParticipant,
    setMyScreenTrack,
    clearMyScreenTrack,
    setMyCameraTrack,
    clearMyCameraTrack,
    setIsCameraOn,
    setIsMicOn,
    setHasMediaStarted,
    setIsConnected,
    clearOfficeMedia,
} from "../../app/features/webRtc/liveKitSlice";
import phaserGame from "../main";
import { GameScene } from "../scenes/GameScene";

class LiveKitService {
    private static instance: LiveKitService;
    private room: Room | null = null;
    private lobbyStream: MediaStream | null = null;
    private currentOffice: string | null = null;
    private isStoppingScreenShare = false;

    private constructor() { }

    public static getInstance(): LiveKitService {
        if (!LiveKitService.instance) {
            LiveKitService.instance = new LiveKitService();
        }
        return LiveKitService.instance;
    }

    public getCurrentOffice(): string | null {
        return this.currentOffice;
    }

    // ── Connection (Background Lobby) ──────────────────────────────────────────

    public async connect(url: string, token: string): Promise<void> {
        if (this.room) {
            await this.room.disconnect().catch(() => { });
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
            RoomEvent.TrackPublished,
            (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log(
                    `[LiveKit] Remote track published: ${participant.identity} -> ${pub.source} (${pub.kind})`
                );
                if (this.isParticipantInSameOffice(participant.identity)) {
                    if (pub.setSubscribed) pub.setSubscribed(true);
                }
            }
        );

        this.room.on(
            RoomEvent.TrackSubscribed,
            (
                track: RemoteTrack,
                pub: RemoteTrackPublication,
                participant: RemoteParticipant
            ) => {
                let participantOffice: string | null = null;
                try {
                    if (participant.metadata) {
                        participantOffice =
                            JSON.parse(participant.metadata).office || null;
                    }
                } catch { }

                const isSameOffice = this.isParticipantInSameOffice(
                    participant.identity,
                    participantOffice
                );

                console.log(
                    `[LiveKit] Track subscribed from ${participant.identity} (${pub.source}, kind: ${track.kind}): isSameOffice=${isSameOffice}, currentOffice=${this.currentOffice}`
                );

                if (isSameOffice) {
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
                            source: pub.source,
                            mediaStreamTrack: track.mediaStreamTrack,
                        })
                    );
                } else {
                    // Not in the same office — unsubscribe so bandwidth isn't wasted
                    if (pub.setSubscribed) pub.setSubscribed(false);
                }
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
                        const el = document.getElementById(
                            `lk-audio-${participant.identity}-${track.sid}`
                        );
                        el?.remove();
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

        // Remote participant updated their office metadata
        this.room.on(
            RoomEvent.ParticipantMetadataChanged,
            (_metadata: string, participant: Participant) => {
                this.syncParticipantTracks(participant as RemoteParticipant);
            }
        );

        // Remote participant left the room entirely
        this.room.on(
            RoomEvent.ParticipantDisconnected,
            (participant: RemoteParticipant) => {
                if (typeof document !== "undefined") {
                    document
                        .querySelectorAll(`audio[id^="lk-audio-${participant.identity}-"]`)
                        .forEach((el) => el.remove());
                }
                store.dispatch(removeParticipant(participant.identity));
            }
        );

        this.room.on(RoomEvent.Disconnected, () => {
            console.log("[LiveKit] Disconnected from lobby room");
            store.dispatch(setIsConnected(false));
        });

        this.room.on(RoomEvent.Connected, () => {
            console.log("[LiveKit] Connected to background lobby room:", this.room?.name);
            store.dispatch(setIsConnected(true));

            // Set initial metadata (lobby area, no office)
            if (this.currentOffice) {
                this.room?.localParticipant.setMetadata(
                    JSON.stringify({ office: this.currentOffice })
                ).catch(() => { });
            } else {
                this.room?.localParticipant.setMetadata(
                    JSON.stringify({ office: null })
                ).catch(() => { });
            }
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

        // Clean up any lobby preview stream
        if (this.lobbyStream) {
            this.lobbyStream.getTracks().forEach((t) => t.stop());
            this.lobbyStream = null;
        }
    }

    /**
     * Checks if a participant is in the same office as the local player.
     * Evaluates LiveKit metadata as well as Colyseus office membership for complete reliability.
     */
    public isParticipantInSameOffice(
        participantSessionId: string,
        participantOffice?: string | null
    ): boolean {
        if (!this.currentOffice) return false;

        // 1. Direct metadata match if provided
        if (participantOffice && participantOffice === this.currentOffice) {
            return true;
        }

        // 2. Colyseus synchronized office members
        try {
            const gameScene = phaserGame?.scene?.keys?.GameScene as any;
            const network = gameScene?.network;
            if (network?.getOfficeData) {
                const officeData = network.getOfficeData(
                    this.currentOffice as any
                );
                if (
                    officeData?.members &&
                    officeData.members.has(participantSessionId)
                ) {
                    return true;
                }
            }
        } catch { }

        // 3. LiveKit participant metadata direct parse
        try {
            const p = this.room?.getParticipantByIdentity(participantSessionId);
            if (p?.metadata) {
                const parsed = JSON.parse(p.metadata);
                if (parsed.office === this.currentOffice) return true;
            }
        } catch { }

        return false;
    }

    /**
     * Resynchronizes media tracks for all remote participants in the room.
     */
    public syncAllParticipants(): void {
        if (!this.room) return;
        this.room.remoteParticipants.forEach((participant) => {
            this.syncParticipantTracks(participant);
        });
    }

    /**
     * Synchronizes tracks of a single remote participant based on current office.
     */
    private syncParticipantTracks(participant: RemoteParticipant): void {
        if (!participant || participant === this.room?.localParticipant) return;

        let participantOffice: string | null = null;
        try {
            if (participant.metadata) {
                participantOffice =
                    JSON.parse(participant.metadata).office || null;
            }
        } catch { }

        const isSameOffice = this.isParticipantInSameOffice(
            participant.identity,
            participantOffice
        );

        participant.trackPublications.forEach((pub) => {
            const track = pub.track;
            if (!track) {
                if (isSameOffice && pub.setSubscribed) {
                    pub.setSubscribed(true);
                }
                return;
            }

            if (isSameOffice) {
                if (pub.setSubscribed) pub.setSubscribed(true);

                if (track.kind === "audio") {
                    try {
                        let el = document.getElementById(
                            `lk-audio-${participant.identity}-${track.sid}`
                        ) as HTMLAudioElement;
                        if (!el) {
                            el = track.attach();
                            el.id = `lk-audio-${participant.identity}-${track.sid}`;
                        }
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
                        source: pub.source,
                        mediaStreamTrack: track.mediaStreamTrack,
                    })
                );
            } else {
                if (pub.setSubscribed) pub.setSubscribed(false);

                if (track.kind === "audio") {
                    try {
                        track.detach();
                        const el = document.getElementById(
                            `lk-audio-${participant.identity}-${track.sid}`
                        );
                        el?.remove();
                    } catch { }
                }

                store.dispatch(
                    removeRemoteTrack({
                        participantId: participant.identity,
                        trackSid: track.sid,
                    })
                );
            }
        });
    }

    /**
     * Called when the player enters an office room.
     * Updates participant metadata and connects office media instantly
     * WITHOUT tearing down or reconnecting the background LiveKit connection.
     */
    public async joinOffice(officeName: string): Promise<void> {
        this.currentOffice = officeName;
        console.log(`[LiveKit] Joined office zone: ${officeName}`);

        if (this.room) {
            await this.room.localParticipant.setMetadata(
                JSON.stringify({ office: officeName })
            ).catch(console.warn);

            this.room.remoteParticipants.forEach((participant) => {
                this.syncParticipantTracks(participant);
            });
        }
    }

    /**
     * Called when the player leaves an office room into the hallway.
     * The character exits immediately and UI updates with zero freeze.
     * Stopping screen sharing and unpublishing media runs smoothly in the background.
     */
    public leaveOffice(): void {
        this.currentOffice = null;
        console.log("[LiveKit] Left office zone; character exits immediately, media stopping in background");

        // 1. Immediately update UI so character walks out smoothly with zero lag or freeze
        store.dispatch(clearOfficeMedia());

        const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
        gameInstance?.updateWebcamStatus(false);
        gameInstance?.updateMicStatus(false);
        // gameInstance?.updateDisconnectStatus(true);

        // 2. Perform stop screen sharing and media unpublishing in the background
        setTimeout(async () => {
            if (this.room) {
                // Stop local screen sharing cleanly in background
                await this.stopScreenShare().catch(() => { });

                // Turn off camera & mic publications (without destroying WebRTC peer connection)
                await this.room.localParticipant.setCameraEnabled(false).catch(() => { });
                await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => { });

                // Update metadata to null so peers know we left
                await this.room.localParticipant.setMetadata(
                    JSON.stringify({ office: null })
                ).catch(console.warn);

                // Unsubscribe & detach all remote participants
                this.room.remoteParticipants.forEach((participant) => {
                    participant.trackPublications.forEach((pub) => {
                        if (pub.setSubscribed) pub.setSubscribed(false);
                        if (pub.track?.kind === "audio") {
                            try {
                                pub.track.detach();
                            } catch { }
                        }
                    });
                });
            }

            // Clean up attached audio elements
            if (typeof document !== "undefined") {
                document
                    .querySelectorAll('audio[id^="lk-audio-"]')
                    .forEach((el) => el.remove());
            }
        }, 50);
    }

    /**
     * Complete teardown: called ONLY when leaving the entire game session.
     */
    public async disconnect(): Promise<void> {
        this.currentOffice = null;
        if (this.room) {
            await this.stopScreenShare().catch(() => { });
            await this.room.disconnect().catch(() => { });
            this.room = null;
        }

        if (this.lobbyStream) {
            this.lobbyStream.getTracks().forEach((t) => t.stop());
            this.lobbyStream = null;
        }

        if (typeof document !== "undefined") {
            document
                .querySelectorAll('audio[id^="lk-audio-"]')
                .forEach((el) => el.remove());
        }

        store.dispatch(clearOfficeMedia());
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
        if (!this.room || this.isStoppingScreenShare) return;
        this.isStoppingScreenShare = true;

        // 1. Immediately update UI state so there is zero delay or freeze
        store.dispatch(clearMyScreenTrack());

        try {
            const pubs = this.room.localParticipant
                .getTrackPublications()
                .filter((p) => p.source === Track.Source.ScreenShare);

            for (const pub of pubs) {
                if (pub.track) {
                    try {
                        pub.track.mediaStreamTrack.stop();
                    } catch { }
                    await this.room.localParticipant.unpublishTrack(
                        pub.track as LocalTrack
                    ).catch(() => { });
                }
            }

            console.log("[LiveKit] Screen sharing stopped");
        } finally {
            this.isStoppingScreenShare = false;
        }
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
            await this.room.localParticipant.setCameraEnabled(false).catch(() => { });
            await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => { });
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
