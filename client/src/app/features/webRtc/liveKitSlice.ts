import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Represents one track from a remote participant
export interface RemoteTrackEntry {
    participantId: string;
    participantName?: string;
    trackSid: string;
    kind: "audio" | "video";
    source: string; // "camera" | "microphone" | "screen_share"
    mediaStreamTrack: MediaStreamTrack;
}

interface LiveKitState {
    /** Remote participants, keyed by participantId (= Colyseus sessionId) */
    remoteParticipants: Map<string, RemoteTrackEntry[]>;
    /** Local screen share track (if currently sharing) */
    myScreenTrack: MediaStreamTrack | null;
    /** Local camera track (if camera is enabled) */
    myCameraTrack: MediaStreamTrack | null;
    /** Whether we are currently screen sharing */
    isScreenSharing: boolean;
    /** Whether the local camera is on */
    isCameraOn: boolean;
    /** Whether the local mic is on */
    isMicOn: boolean;
    /** Whether the user has started media (camera/mic session active) */
    hasMediaStarted: boolean;
    /** Whether the LiveKit room connection is active */
    isConnected: boolean;
}

const initialState: LiveKitState = {
    remoteParticipants: new Map(),
    myScreenTrack: null,
    myCameraTrack: null,
    isScreenSharing: false,
    isCameraOn: false,
    isMicOn: false,
    hasMediaStarted: false,
    isConnected: false,
};

const liveKitSlice = createSlice({
    name: "livekit",
    initialState,
    reducers: {
        /** Called when a remote participant publishes a track */
        addRemoteTrack: (state, action: PayloadAction<RemoteTrackEntry>) => {
            const { participantId, trackSid } = action.payload;
            const existing = state.remoteParticipants.get(participantId) || [];
            const filtered = existing.filter((t) => t.trackSid !== trackSid);
            const updated = new Map(state.remoteParticipants);
            updated.set(participantId, [...filtered, action.payload]);
            state.remoteParticipants = updated;
        },

        /** Called when a remote participant unpublishes / disconnects */
        removeRemoteTrack: (
            state,
            action: PayloadAction<{ participantId: string; trackSid: string }>
        ) => {
            const { participantId, trackSid } = action.payload;
            const updated = new Map(state.remoteParticipants);
            const tracks = (updated.get(participantId) || []).filter(
                (t) => t.trackSid !== trackSid
            );
            if (tracks.length === 0) {
                updated.delete(participantId);
            } else {
                updated.set(participantId, tracks);
            }
            state.remoteParticipants = updated;
        },

        /** Remove all tracks for a participant (e.g. they left the room) */
        removeParticipant: (state, action: PayloadAction<string>) => {
            const updated = new Map(state.remoteParticipants);
            updated.delete(action.payload);
            state.remoteParticipants = updated;
        },

        /** Called when local screen sharing starts */
        setMyScreenTrack: (
            state,
            action: PayloadAction<MediaStreamTrack>
        ) => {
            state.myScreenTrack = action.payload;
            state.isScreenSharing = true;
        },

        /** Called when local screen sharing stops */
        clearMyScreenTrack: (state) => {
            state.myScreenTrack = null;
            state.isScreenSharing = false;
        },

        /** Called when local camera stream starts */
        setMyCameraTrack: (
            state,
            action: PayloadAction<MediaStreamTrack>
        ) => {
            state.myCameraTrack = action.payload;
            state.isCameraOn = true;
        },

        /** Called when local camera stream stops */
        clearMyCameraTrack: (state) => {
            state.myCameraTrack = null;
            state.isCameraOn = false;
        },

        setIsCameraOn: (state, action: PayloadAction<boolean>) => {
            state.isCameraOn = action.payload;
        },

        setIsMicOn: (state, action: PayloadAction<boolean>) => {
            state.isMicOn = action.payload;
        },

        setHasMediaStarted: (state, action: PayloadAction<boolean>) => {
            state.hasMediaStarted = action.payload;
        },

        setIsConnected: (state, action: PayloadAction<boolean>) => {
            state.isConnected = action.payload;
        },

        /** Full reset — called when leaving the game */
        resetLiveKitState: (state) => {
            state.remoteParticipants = new Map();
            state.myScreenTrack = null;
            state.myCameraTrack = null;
            state.isScreenSharing = false;
            state.isCameraOn = false;
            state.isMicOn = false;
            state.hasMediaStarted = false;
            state.isConnected = false;
        },

        /** Clears remote tracks and screen share when stepping out of an office into the hallway */
        clearOfficeMedia: (state) => {
            state.remoteParticipants = new Map();
            state.myScreenTrack = null;
            state.isScreenSharing = false;
        },
    },
});

export const {
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
    resetLiveKitState,
    clearOfficeMedia,
} = liveKitSlice.actions;

export default liveKitSlice.reducer;
