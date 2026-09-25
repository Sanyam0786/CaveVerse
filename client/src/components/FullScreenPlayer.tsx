import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FullScreenPlayer = ({
    username,
    stream,
    setIsFullScreen,
}: {
    username: string;
    stream: MediaStream;
    setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
    isLocalPresenter?: boolean;
    onStopSharing?: () => void;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { });
        }
    }, [stream]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsFullScreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setIsFullScreen]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) setIsFullScreen(false);
            }}
        >
            <div className="relative flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-900 w-[90%] max-h-[100vh] py-3 px-5 rounded-xl border-2 border-black shadow-2xl animate-fade-in-scale">
                <div className="flex items-center justify-between text-nowrap w-full mb-1">
                    <h1 className="font-semibold text-lg w-full text-center text-zinc-900 dark:text-zinc-100">
                        {username}'s Screen
                    </h1>
                    <div className="flex items-center justify-end">
                        <button
                            onClick={() => setIsFullScreen(false)}
                            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300 cursor-pointer"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="w-full flex items-center justify-center overflow-hidden rounded-lg ">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        disablePictureInPicture
                        className="rounded-md max-h-[85vh] w-full object-contain pointer-events-none select-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default FullScreenPlayer;
