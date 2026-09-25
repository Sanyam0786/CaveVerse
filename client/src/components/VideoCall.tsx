import { useRef, useEffect } from "react";
import { useAppSelector } from "../app/hooks";
import { Track } from "livekit-client";
import liveKitService from "../game/service/LiveKitService";

const VideoCall = () => {
    const remoteParticipants = useAppSelector(
        (state) => state.livekit.remoteParticipants
    );
    const isCameraOn = useAppSelector((state) => state.livekit.isCameraOn);
    const myCameraTrack = useAppSelector((state) => state.livekit.myCameraTrack);
    const isConnected = useAppSelector((state) => state.livekit.isConnected);

    // Collect remote camera video tracks
    const remoteCameraTracks = Array.from(
        remoteParticipants.entries()
    ).flatMap(([participantId, tracks]) =>
        tracks
            .filter(
                (t) =>
                    (t.source === Track.Source.Camera || t.source === "camera") &&
                    t.kind === "video"
            )
            .map((t) => ({ participantId, track: t }))
    );

    // Don't show anything if neither local camera nor remote cameras are active
    if (!myCameraTrack && remoteCameraTracks.length === 0) return null;

    return (
        <div className="absolute left-[35px] top-[10px] max-h-screen flex flex-col flex-wrap gap-2 z-20 pointer-events-auto">
            {myCameraTrack && (
                <div className="relative group">
                    <LocalVideo
                        track={myCameraTrack}
                        className="w-40 md:w-48 border-2 border-emerald-500 rounded-lg shadow-lg bg-black"
                    />
                    <span className="absolute bottom-1 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        You
                    </span>
                </div>
            )}
            {remoteCameraTracks.map(({ participantId, track }) => (
                <div key={track.trackSid} className="relative group">
                    <RemoteVideo
                        participantId={participantId}
                        trackSid={track.trackSid}
                        mediaStreamTrack={track.mediaStreamTrack}
                        className="w-40 md:w-48 border-2 border-white/20 rounded-lg shadow-lg bg-black"
                    />
                    <span className="absolute bottom-1 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        {track.participantName || participantId}
                    </span>
                </div>
            ))}
        </div>
    );
};

/**
 * Renders the local player's webcam track.
 */
const LocalVideo = ({
    track,
    className,
}: {
    track: MediaStreamTrack;
    className?: string;
}) => {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!ref.current || !track) return;
        const stream = new MediaStream([track]);
        ref.current.srcObject = stream;
        ref.current.play().catch(() => {});
    }, [track]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={true}
            className={`rounded-lg ${className ?? ""}`}
        />
    );
};

/**
 * Renders a remote participant's video track using LiveKit native attach,
 * with graceful fallback to MediaStream.
 */
const RemoteVideo = ({
    participantId,
    trackSid,
    mediaStreamTrack,
    className,
}: {
    participantId: string;
    trackSid: string;
    mediaStreamTrack: MediaStreamTrack;
    className?: string;
}) => {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;

        // 1. Try LiveKit native attach first
        const cleanup = liveKitService.attachRemoteVideo(
            participantId,
            trackSid,
            el
        );

        // 2. If not ready or fallback needed, assign mediaStreamTrack
        let streamCleanup: (() => void) | undefined;
        if (!cleanup && mediaStreamTrack) {
            try {
                const stream = new MediaStream([mediaStreamTrack]);
                el.srcObject = stream;
                el.play().catch(() => {});

                const onUnmute = () => {
                    el.play().catch(() => {});
                };
                mediaStreamTrack.addEventListener("unmute", onUnmute);
                streamCleanup = () => {
                    mediaStreamTrack.removeEventListener("unmute", onUnmute);
                };
            } catch (e) {
                console.warn("[VideoCall] MediaStream fallback warning:", e);
            }
        }

        return () => {
            if (cleanup) cleanup();
            if (streamCleanup) streamCleanup();
        };
    }, [participantId, trackSid, mediaStreamTrack]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={true}
            className={`rounded-lg ${className ?? ""}`}
        />
    );
};

export default VideoCall;
