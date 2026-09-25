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
            adaptiveStream: false,
            dynacast: false,
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
                let participantOffice: string | null = null;
                try {
                    if (participant.metadata) {
                        participantOffice =
                            JSON.parse(participant.metadata).office || null;
                    }
                } catch { }

                if (this.isParticipantInSameOffice(participant.identity, participantOffice)) {
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

        this.room.on(
            RoomEvent.TrackUnpublished,
            (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log(
                    `[LiveKit] Remote track unpublished: ${participant.identity} -> ${pub.source} (${pub.kind})`
                );
                store.dispatch(
                    removeRemoteTrack({
                        participantId: participant.identity,
                        trackSid: pub.trackSid,
                    })
                );
            }
        );

        this.room.on(
            RoomEvent.TrackMuted,
            (pub: TrackPublication, participant: Participant) => {
                if (participant === this.room?.localParticipant) return;

                if (pub.kind === "audio") {
                    const el = document.getElementById(
                        `lk-audio-${participant.identity}-${pub.trackSid}`
                    ) as HTMLAudioElement;
                    if (el) el.muted = true;
                }

                // If remote camera track is muted, immediately remove from UI so last frame does not freeze
                if (pub.kind === "video" && (pub.source === Track.Source.Camera || pub.source === "camera")) {
                    console.log(`[LiveKit] Remote camera muted: removing tile for ${participant.identity}`);
                    store.dispatch(
                        removeRemoteTrack({
                            participantId: participant.identity,
                            trackSid: pub.trackSid,
                        })
                    );
                }
            }
        );

        this.room.on(
            RoomEvent.TrackUnmuted,
            (pub: TrackPublication, participant: Participant) => {
                if (participant === this.room?.localParticipant) return;

                if (pub.kind === "audio") {
                    const el = document.getElementById(
                        `lk-audio-${participant.identity}-${pub.trackSid}`
                    ) as HTMLAudioElement;
                    if (el) el.muted = false;
                }

                // If remote camera unmuted, re-add to UI if in same office
                if (pub.kind === "video" && (pub.source === Track.Source.Camera || pub.source === "camera")) {
                    if (this.isParticipantInSameOffice(participant.identity)) {
                        const track = pub.track;
                        if (track) {
                            console.log(`[LiveKit] Remote camera unmuted: restoring tile for ${participant.identity}`);
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
                        }
                    }
                }
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
     * Attaches a remote video track directly to a HTMLVideoElement using LiveKit's native attach().
     * Returns a cleanup function to detach the element, or null if not yet available.
     */
    public attachRemoteVideo(
        participantId: string,
        trackSid: string,
        videoElement: HTMLVideoElement
    ): (() => void) | null {
        if (!this.room) return null;
        const participant = this.room.getParticipantByIdentity(participantId);
        if (!participant) return null;
        const pub = participant.getTrackPublication(trackSid);
        const track = pub?.track;
        if (track && track.attach) {
            try {
                track.attach(videoElement);
                return () => {
                    try {
                        track.detach(videoElement);
                    } catch { }
                };
            } catch (err) {
                console.warn("[LiveKit] Native track attach warning:", err);
            }
        }
        return null;
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

        // 2. Perform stop screen sharing and office metadata reset in the background
        setTimeout(async () => {
            if (this.room) {
                // Stop local screen sharing cleanly in background (office-scoped only)
                await this.stopScreenShare().catch(() => { });

                // Update metadata to null so office peers immediately stop receiving our camera/mic
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

        // Check if browser supports camera
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            alert("Camera API is not supported in this browser. Please ensure you are using Safari (iOS) or Chrome (Android) over HTTPS.");
            return;
        }

        // Inside LiveKit room
        if (this.room.state !== "connected") {
            console.warn("[LiveKit] Room is not in connected state:", this.room.state);
            alert(`Voice/Video service is currently ${this.room.state}. Please wait a few seconds and try again.`);
            return;
        }

        try {
            // Attempt with front-facing camera on mobile devices
            let pub;
            try {
                pub = await this.room.localParticipant.setCameraEnabled(true, {
                    facingMode: "user",
                });
            } catch (camErr) {
                console.warn("[LiveKit] Failed with facingMode: user, falling back to default:", camErr);
                pub = await this.room.localParticipant.setCameraEnabled(true);
            }

            const track =
                pub?.track?.mediaStreamTrack ||
                this.room.localParticipant.getTrackPublication(Track.Source.Camera)
                    ?.track?.mediaStreamTrack;

            if (track) {
                store.dispatch(setMyCameraTrack(track));
            }
            store.dispatch(setIsCameraOn(true));
            store.dispatch(setHasMediaStarted(true));

            try {
                const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
                gameInstance?.updateWebcamStatus(true);
                gameInstance?.updateDisconnectStatus(false);
            } catch (uiErr) {
                console.warn("[LiveKit] UI update error:", uiErr);
            }

            console.log("[LiveKit] Camera enabled in room");
        } catch (err: any) {
            console.error("[LiveKit] Failed to enable camera:", err);
            const errName = err?.name || "Error";
            const errMsg = err?.message || String(err);
            if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
                alert("Camera permission denied. Please tap the lock / settings icon in your browser address bar and allow Camera access.");
            } else {
                alert(`Could not access camera (${errName}: ${errMsg}).\nPlease check your browser's camera permissions.`);
            }
            return;
        }

        try {
            await this.room.localParticipant.setMicrophoneEnabled(true);
            store.dispatch(setIsMicOn(true));
            const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
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
            let pub;
            if (nextState) {
                try {
                    pub = await this.room.localParticipant.setCameraEnabled(true, {
                        facingMode: "user",
                    });
                } catch {
                    pub = await this.room.localParticipant.setCameraEnabled(true);
                }
                const track =
                    pub?.track?.mediaStreamTrack ||
                    this.room.localParticipant.getTrackPublication(
                        Track.Source.Camera
                    )?.track?.mediaStreamTrack;
                if (track) {
                    store.dispatch(setMyCameraTrack(track));
                }
                store.dispatch(setIsCameraOn(true));
            } else {
                await this.room.localParticipant.setCameraEnabled(false).catch(() => {});
                store.dispatch(clearMyCameraTrack());

                // Completely stop and unpublish camera tracks so peers immediately remove the video tile
                const camPubs = this.room.localParticipant
                    .getTrackPublications()
                    .filter((p) => p.kind === Track.Kind.Video && (p.source === Track.Source.Camera || p.source === "camera"));

                for (const pub of camPubs) {
                    if (pub.track) {
                        try {
                            pub.track.mediaStreamTrack.enabled = false;
                            pub.track.mediaStreamTrack.stop();
                        } catch { }
                        await this.room.localParticipant.unpublishTrack(pub.track as LocalTrack).catch(() => {});
                    }
                }
            }

            const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
            gameInstance?.updateWebcamStatus(nextState);
        } catch (err: any) {
            console.error("[LiveKit] Failed to toggle camera:", err);
            const errName = err?.name || "Error";
            const errMsg = err?.message || String(err);
            if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
                alert("Camera permission denied. Please allow Camera access in your browser settings.");
            } else {
                alert(`Could not toggle camera (${errName}: ${errMsg})`);
            }
        }
    }

    public async toggleMic(): Promise<void> {
        const currentlyOn = store.getState().livekit.isMicOn;
        const nextState = !currentlyOn;
        console.log(`[LiveKit] Toggling mic: currentlyOn=${currentlyOn} -> nextState=${nextState}`);

        // 1. Immediately update UI state so button and character sprite respond instantly
        store.dispatch(setIsMicOn(nextState));
        try {
            const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
            gameInstance?.updateMicStatus(nextState);
        } catch (uiErr) {
            console.warn("[LiveKit] UI mic update warning:", uiErr);
        }

        // 2. In lobby preview mode (before room connection)
        if (!this.room) {
            if (this.lobbyStream) {
                this.lobbyStream.getAudioTracks().forEach((t) => {
                    t.enabled = nextState;
                    if (!nextState) {
                        try { t.stop(); } catch { }
                    }
                });
            }
            return;
        }

        // 3. Inside LiveKit room
        if (!nextState) {
            // Turning mic OFF: Mute, stop hardware capture and unpublish so OS/browser mic dot turns OFF
            try {
                await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {});

                const audioPubs = this.room.localParticipant
                    .getTrackPublications()
                    .filter((p) => p.kind === Track.Kind.Audio || p.source === Track.Source.Microphone);

                for (const pub of audioPubs) {
                    if (pub.track) {
                        try {
                            pub.track.mediaStreamTrack.enabled = false;
                            pub.track.mediaStreamTrack.stop();
                        } catch { }
                        await this.room.localParticipant.unpublishTrack(pub.track as LocalTrack).catch(() => {});
                    }
                }
                console.log("[LiveKit] Microphone completely disabled and hardware stopped");
            } catch (err) {
                console.error("[LiveKit] Error disabling microphone:", err);
            }
        } else {
            // Turning mic ON: Re-acquire fresh audio track and publish
            try {
                await this.room.localParticipant.setMicrophoneEnabled(true);
                console.log("[LiveKit] Microphone enabled and published");
            } catch (err) {
                console.error("[LiveKit] Failed to enable microphone:", err);
                // Revert state if permission denied
                store.dispatch(setIsMicOn(false));
                try {
                    const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
                    gameInstance?.updateMicStatus(false);
                } catch { }
                alert("Could not access microphone. Please check your browser's microphone permissions.");
            }
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

            // Stop and unpublish all audio tracks cleanly
            const audioPubs = this.room.localParticipant
                .getTrackPublications()
                .filter((p) => p.kind === Track.Kind.Audio || p.source === Track.Source.Microphone);

            for (const pub of audioPubs) {
                if (pub.track) {
                    try {
                        pub.track.mediaStreamTrack.enabled = false;
                        pub.track.mediaStreamTrack.stop();
                    } catch { }
                    await this.room.localParticipant.unpublishTrack(pub.track as LocalTrack).catch(() => {});
                }
            }
        }

        store.dispatch(clearMyCameraTrack());
        store.dispatch(setIsCameraOn(false));
        store.dispatch(setIsMicOn(false));
        store.dispatch(setHasMediaStarted(false));

        try {
            const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
            gameInstance?.updateWebcamStatus(false);
            gameInstance?.updateMicStatus(false);
            gameInstance?.updateDisconnectStatus(true);
        } catch { }
        console.log("[LiveKit] Webcam and mic stopped (disconnected)");
    }
}

export default LiveKitService.getInstance();
