import { AccessToken, TrackSource } from "livekit-server-sdk";

// Dev defaults — when using `livekit-server --dev`
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
export const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";

/**
 * Generates a LiveKit access token for a participant.
 *
 * @param roomName  The LiveKit room name (we use the Colyseus room ID)
 * @param identity  Unique participant identity (we use the Colyseus sessionId)
 * @returns         A signed JWT string the client uses to join the LiveKit room
 */
export async function generateLiveKitToken(
    roomName: string,
    identity: string,
    name?: string
): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name: name || identity,
        ttl: "4h",
    });

    at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    });

    return at.toJwt();
}
