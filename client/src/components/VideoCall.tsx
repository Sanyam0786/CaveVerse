import { useRef, useEffect } from "react";
import { useAppSelector } from "../app/hooks";
import { Track } from "livekit-client";

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
                    t.source === Track.Source.Camera && t.kind === "video"
            )
            .map((t) => ({ participantId, track: t }))
    );

    // Don't show anything if neither local camera nor remote cameras are active
    if (!myCameraTrack && remoteCameraTracks.length === 0) return null;

    return (
        <div className="absolute left-[35px] top-[10px] max-h-screen flex flex-col flex-wrap gap-2 z-20 pointer-events-auto">
            {myCameraTrack && (
                <div className="relative group">
                    <TrackVideo
                        track={myCameraTrack}
                        className="w-48 border-2 border-emerald-500 rounded-lg shadow-lg bg-black"
                        muted={true}
                    />
                    <span className="absolute bottom-1 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        You
                    </span>
                </div>
            )}
            {remoteCameraTracks.map(({ participantId, track }) => (
                <div key={track.trackSid} className="relative group">
                    <TrackVideo
                        track={track.mediaStreamTrack}
                        className="w-48 border-2 border-white/20 rounded-lg shadow-lg bg-black"
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
 * Renders a single MediaStreamTrack in a <video> element.
 */
const TrackVideo = ({
    track,
    className,
    muted = false,
}: {
    track: MediaStreamTrack;
    className?: string;
    muted?: boolean;
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
            muted={muted}
            className={`rounded-lg ${className ?? ""}`}
        />
    );
};

export default VideoCall;
