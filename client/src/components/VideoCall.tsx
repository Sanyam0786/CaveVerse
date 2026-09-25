import { useRef, useEffect } from "react";
import { useAppSelector } from "../app/hooks";
import { Track } from "livekit-client";

const VideoCall = () => {
    const remoteParticipants = useAppSelector(
        (state) => state.livekit.remoteParticipants
    );
    const isCameraOn = useAppSelector((state) => state.livekit.isCameraOn);
    const isConnected = useAppSelector((state) => state.livekit.isConnected);

    // Collect remote camera + mic video tracks
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

    // Don't show anything if not connected or no tracks
    if (!isConnected) return null;
    if (!isCameraOn && remoteCameraTracks.length === 0) return null;

    return (
        <div className="absolute left-[35px] top-[10px] max-h-screen flex flex-col flex-wrap gap-2">
            {remoteCameraTracks.map(({ participantId, track }) => (
                <TrackVideo
                    key={track.trackSid}
                    track={track.mediaStreamTrack}
                    className="w-48 border-2"
                />
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
