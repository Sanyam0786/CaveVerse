import { sanitizeUserIdForScreenSharing } from "../../lib/utils";
import {
    addScreenStream,
    setMyScreenStream,
    stopScreenSharing,
} from "../../app/features/webRtc/screenSlice";
import store from "../../app/store";
import Peer from "peerjs";

// ICE server configuration — replaces broken PeerJS defaults
const ICE_CONFIG = {
    config: {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
        ],
        iceCandidatePoolSize: 10,
    },
};

class ScreenSharing {
    private static instance: ScreenSharing;
    private peer: Peer | null = null;
    private initializationPromise: Promise<Peer> | null = null;
    myScreenStream: MediaStream;

    private constructor() { }

    public static getInstance(): ScreenSharing {
        if (!ScreenSharing.instance) {
            ScreenSharing.instance = new ScreenSharing();
        }
        return ScreenSharing.instance;
    }

    public getPeer(): Peer | null {
        return this.peer;
    }

    public async initializePeer(userId: string): Promise<Peer> {
        // If already initializing, return the existing promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // If already initialized, return the peer
        if (this.peer) {
            return Promise.resolve(this.peer);
        }

        // Create a new initialization promise
        this.initializationPromise = new Promise((resolve, reject) => {
            const sanitizedId = sanitizeUserIdForScreenSharing(userId);
            const peer = new Peer(sanitizedId, ICE_CONFIG);

            peer.on("open", (id) => {
                this.peer = peer;

                resolve(peer);
            });

            peer.on("call", (call) => {
                console.log("[ScreenSharing] Receiving call from:", call.peer);
                call.answer();

                call.on("stream", (userStream) => {
                    console.log(
                        "[ScreenSharing] Stream received, tracks:",
                        userStream.getTracks().map((t) => `${t.kind}:${t.readyState}`)
                    );
                    store.dispatch(
                        addScreenStream({ peerId: call.peer, call, userStream })
                    );
                });

                call.on("error", (err) => {
                    console.error("[ScreenSharing] Call error:", err);
                });
            });

            peer.on("error", (error) => {
                console.error("Peer error:", error);
                reject(error);
            });
        });

        return this.initializationPromise;
    }

    public shareScreen(sessionId: string) {
        if (!this.peer) {
            console.error("Cannot call peer - Peer not initialized");
            throw new Error("Peer not initialized");
        }

        const myScreenStream = store.getState().screen.myScreenStream;
        if (!myScreenStream) {
            return;
        }

        try {
            const userId = sanitizeUserIdForScreenSharing(sessionId);
            this.peer.call(userId, myScreenStream);
        } catch (err) {
            console.error("Error while sharing screen: ", err);
            throw err;
        }
    }

    async getUserMedia() {
        const stream = await navigator.mediaDevices.getDisplayMedia();
        store.dispatch(setMyScreenStream(stream));

        const [track] = stream.getTracks();

        // this is callled when player uses browser provided "stop screen sharing" button.
        track.onended = () => {
            store.dispatch(stopScreenSharing());
        };
    }
}

export default ScreenSharing.getInstance();
