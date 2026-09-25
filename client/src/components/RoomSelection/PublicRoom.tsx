import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Bootstrap } from "../../game/scenes/Bootstrap";
import { useState } from "react";
import { Button } from "../ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card";
import phaserGame from "../../game/main";
import { ArrowLeft, LoaderIcon } from "lucide-react";
import liveKitService from "../../game/service/LiveKitService";
import { WebcamButtons } from "../FloatingActions";

import CharacterCarousel from "./CharacterCarousel";
import { useAppSelector } from "../../app/hooks";

const PublicRoom = ({
    setCarouselApi,
    getSelectedCharacter,
    setShowPublicRoom,
    setShowCreateOrJoinCustomRoom,
}: {
    setCarouselApi: () => void;
    getSelectedCharacter: () => "nancy" | "ash" | "lucy" | "adam";
    setShowPublicRoom: React.Dispatch<React.SetStateAction<boolean>>;
    setShowCreateOrJoinCustomRoom: React.Dispatch<
        React.SetStateAction<boolean>
    >;
}) => {
    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap;
    const [username, setUsername] = useState("");
    const isLoading = useAppSelector((state) => state.room.isLoading);
    const isCameraOn = useAppSelector((state) => state.livekit.isCameraOn);
    const hasMediaStarted = useAppSelector((state) => state.livekit.hasMediaStarted);
    const myCameraTrack = useAppSelector((state) => state.livekit.myCameraTrack);

    const handlePublicRoomJoin = (e) => {
        e.preventDefault();
        const selectedCharacter = getSelectedCharacter();

        bootstrap.network
            .joinOrCreatePublicRoom(username, selectedCharacter)
            .then(() => {
                bootstrap.launchGame();
            });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="relative text-2xl text-center">
                    <ArrowLeft
                        className="cursor-pointer text-zinc-500 absolute left-0"
                        onClick={() => {
                            if (isCameraOn) {
                                liveKitService.stopWebcam();
                            }
                            setShowCreateOrJoinCustomRoom(false);
                            setShowPublicRoom(false);
                        }}
                    />
                    Join Public Room
                </CardTitle>
                <CardDescription className="text-center">
                    Public rooms are for meeting new people and getting
                    familiarized with the website.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 items-center">
                {myCameraTrack && (
                    <Card className="flex items-center justify-center overflow-hidden">
                        <CardContent className="p-2">
                            <video
                                ref={(el) => {
                                    if (el && myCameraTrack) {
                                        el.srcObject = new MediaStream([myCameraTrack]);
                                        el.play().catch(() => { });
                                    }
                                }}
                                autoPlay
                                playsInline
                                muted
                                className="w-48 rounded-md"
                            />
                        </CardContent>
                    </Card>
                )}
                <div>
                    <CharacterCarousel setApi={setCarouselApi} />
                    <form
                        className="grid gap-2"
                        onSubmit={handlePublicRoomJoin}
                    >
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                            }}
                        />
                        <Button
                            className="w-full cursor-pointer mt-2"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    Joining Room{" "}
                                    <LoaderIcon className="ml-2 h-4 w-4 animate-spin" />
                                </>
                            ) : (
                                "Join Room"
                            )}
                        </Button>
                    </form>
                    {/* {!hasMediaStarted ? (
                        <Button
                            className="w-full cursor-pointer mt-2"
                            variant="outline"
                            onClick={async () => {
                                await liveKitService.startWebcam();
                            }}
                        >
                            Start Webcam
                        </Button>
                    ) : (
                        <div className="flex gap-3 items-center justify-center mt-2">
                            <WebcamButtons shouldShowDisconnectButton={false} />
                        </div>
                    )} */}
                </div>
            </CardContent>
        </Card>
    );
};

export default PublicRoom;
