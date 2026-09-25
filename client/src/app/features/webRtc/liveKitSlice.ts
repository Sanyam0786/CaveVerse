import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Represents one track from a remote participant
export interface RemoteTrackEntry {
    participantId: string;
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
    /** Whether we are currently screen sharing */
    isScreenSharing: boolean;
    /** Whether the local camera is on */
    isCameraOn: boolean;
    /** Whether the local mic is on */
    isMicOn: boolean;
    /** Whether the LiveKit room connection is active */
    isConnected: boolean;
}

const initialState: LiveKitState = {
    remoteParticipants: new Map(),
    myScreenTrack: null,
    isScreenSharing: false,
    isCameraOn: false,
    isMicOn: false,
    isConnected: false,
};

const liveKitSlice = createSlice({
    name: "livekit",
    initialState,
    reducers: {
        /** Called when a remote participant publishes a track */
        addRemoteTrack: (state, action: PayloadAction<RemoteTrackEntry>) => {
            const { participantId } = action.payload;
            const existing = state.remoteParticipants.get(participantId) || [];
            const updated = new Map(state.remoteParticipants);
            updated.set(participantId, [...existing, action.payload]);
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

        setIsCameraOn: (state, action: PayloadAction<boolean>) => {
            state.isCameraOn = action.payload;
        },

        setIsMicOn: (state, action: PayloadAction<boolean>) => {
            state.isMicOn = action.payload;
        },

        setIsConnected: (state, action: PayloadAction<boolean>) => {
            state.isConnected = action.payload;
        },

        /** Full reset — called when leaving the game */
        resetLiveKitState: (state) => {
            state.remoteParticipants = new Map();
            state.myScreenTrack = null;
            state.isScreenSharing = false;
            state.isCameraOn = false;
            state.isMicOn = false;
            state.isConnected = false;
        },
    },
});

export const {
    addRemoteTrack,
    removeRemoteTrack,
    removeParticipant,
    setMyScreenTrack,
    clearMyScreenTrack,
    setIsCameraOn,
    setIsMicOn,
    setIsConnected,
    resetLiveKitState,
} = liveKitSlice.actions;

export default liveKitSlice.reducer;
