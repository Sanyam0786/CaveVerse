import { ScreenShareIcon, ScreenShareOff } from "lucide-react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useState, useRef, useEffect } from "react";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { useAppSelector } from "../app/hooks";
import { Track } from "livekit-client";
import liveKitService from "../game/service/LiveKitService";
import FullScreenPlayer from "./FullScreenPlayer";
import phaserGame from "../game/main";
import { GameScene } from "../game/scenes/GameScene";

const ScreenShare = ({
    screenDialogOpen,
    setScreenDialogOpen,
}: {
    screenDialogOpen: boolean;
    setScreenDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
    const remoteParticipants = useAppSelector(
        (state) => state.livekit.remoteParticipants
    );
    const myScreenTrack = useAppSelector(
        (state) => state.livekit.myScreenTrack
    );
    const isScreenSharing = useAppSelector(
        (state) => state.livekit.isScreenSharing
    );

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [fullScreenTrack, setFullScreenTrack] =
        useState<MediaStreamTrack | null>(null);
    const [fullScreenUsername, setFullScreenUsername] = useState("");

    const resolveUsername = (
        participantId: string,
        trackName?: string
    ): string => {
        if (trackName && trackName !== participantId) {
            return trackName;
        }
        try {
            const gameScene = phaserGame?.scene?.keys?.GameScene as GameScene;
            if (gameScene?.getPlayerUsername) {
                const found = gameScene.getPlayerUsername(participantId);
                if (found && found !== participantId) return found;
            }
        } catch { }
        return participantId;
    };

    // Collect all remote screen share tracks with resolved usernames
    const remoteScreenTracks = Array.from(remoteParticipants.entries()).flatMap(
        ([participantId, tracks]) =>
            tracks
                .filter((t) => t.source === Track.Source.ScreenShare)
                .map((t) => ({
                    participantId,
                    track: t,
                    username: resolveUsername(participantId, t.participantName),
                }))
    );

    const hasContent = isScreenSharing || remoteScreenTracks.length > 0;

    const startScreenSharing = async () => {
        setScreenDialogOpen(false);
        await liveKitService.startScreenShare();
        toast(<div className="font-semibold">Started Screen Sharing</div>);
    };

    const handleStopScreenSharing = async () => {
        await liveKitService.stopScreenShare();
        toast(<div className="font-semibold">Stopped Screen Sharing</div>);
    };

    const handleFullScreen = (track: MediaStreamTrack, username: string) => {
        setFullScreenTrack(track);
        setFullScreenUsername(username);
        setIsFullScreen(true);
    };

    if (isFullScreen && fullScreenTrack) {
        const stream = new MediaStream([fullScreenTrack]);
        return (
            <FullScreenPlayer
                username={fullScreenUsername}
                stream={stream}
                setIsFullScreen={setIsFullScreen}
                isLocalPresenter={
                    isScreenSharing && fullScreenUsername === "Your Screen"
                }
                onStopSharing={handleStopScreenSharing}
            />
        );
    }

    return (
        <>
            <Dialog open={screenDialogOpen} onOpenChange={setScreenDialogOpen}>
                <DialogContent className="h-[55%] flex flex-col justify-between">
                    <DialogHeader className="mt-3">
                        <DialogTitle className="text-center font-semibold text-lg">
                            Shared Screens
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            View and manage shared screens in this office.
                        </DialogDescription>
                    </DialogHeader>
                    <div
                        className={`grid ${hasContent
                            ? "grid-cols-2 auto-rows-max"
                            : "text-center place-items-center"
                            } h-full overflow-auto gap-3 mt-2 py-2`}
                    >
                        {hasContent ? (
                            <>
                                {/* My screen share preview */}
                                {isScreenSharing && myScreenTrack && (
                                    <Card
                                        className="cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all"
                                        onClick={() =>
                                            handleFullScreen(
                                                myScreenTrack,
                                                "Your Screen"
                                            )
                                        }
                                    >
                                        <CardHeader className="py-2.5 px-3">
                                            <CardTitle className="truncate text-sm flex items-center justify-between">
                                                <span>Your Screen</span>
                                                <span className="text-xs text-emerald-500 font-medium">
                                                    Presenting
                                                </span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-3 pb-3">
                                            <TrackVideo
                                                track={myScreenTrack}
                                                muted
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Remote screen shares */}
                                {remoteScreenTracks.map(
                                    ({ track, username }) => (
                                        <Card
                                            key={track.trackSid}
                                            className="cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all"
                                            onClick={() =>
                                                handleFullScreen(
                                                    track.mediaStreamTrack,
                                                    username
                                                )
                                            }
                                        >
                                            <CardHeader className="py-2.5 px-3">
                                                <CardTitle className="truncate text-sm flex items-center justify-between">
                                                    <span>{username}'s Screen</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="px-3 pb-3">
                                                <TrackVideo
                                                    track={
                                                        track.mediaStreamTrack
                                                    }
                                                />
                                            </CardContent>
                                        </Card>
                                    )
                                )}
                            </>
                        ) : (
                            <div>
                                <h1 className="font-semibold text-lg">
                                    No screen is being streamed {">_<"}
                                </h1>
                                <h1 className="font-semibold text-sm mt-2">
                                    Start streaming your screen now, by clicking
                                    below button 👇🏻
                                </h1>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-center">
                        {isScreenSharing ? (
                            <Button
                                className="cursor-pointer"
                                onClick={handleStopScreenSharing}
                            >
                                Stop Screen Sharing
                                <ScreenShareOff />
                            </Button>
                        ) : (
                            <Button
                                className="cursor-pointer"
                                onClick={startScreenSharing}
                            >
                                Share Your Screen
                                <ScreenShareIcon />
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Toaster position="bottom-left" closeButton />
        </>
    );
};

/**
 * A small helper that renders a MediaStreamTrack inside a <video> element.
 * Re-attaches when the track changes.
 */
const TrackVideo = ({
    track,
    muted = false,
}: {
    track: MediaStreamTrack;
    muted?: boolean;
}) => {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!ref.current || !track) return;
        const stream = new MediaStream([track]);
        ref.current.srcObject = stream;
        ref.current.play().catch(() => { });
    }, [track]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            disablePictureInPicture
            className="rounded-lg w-full pointer-events-none select-none object-contain"
        />
    );
};

export default ScreenShare;
