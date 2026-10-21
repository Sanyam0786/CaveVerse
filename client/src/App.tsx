import Chat from "./components/Chat";
import { useAppSelector } from "./app/hooks";
import RoomSelection from "./components/RoomSelection/RoomSelection";
import ScreenShare from "./components/ScreenShare";
import { useState } from "react";
import FloatingActions from "./components/FloatingActions";
import { AnimatePresence } from "framer-motion";
import VideoCall from "./components/VideoCall";
import CornerActionButtons from "./game/CornerActionButtons";
import LeaveRoomModal from "./components/LeaveRoomModal";
import { Button } from "./components/ui/button";

import MobileDPad from "./components/MobileDPad";

function App() {
    const roomJoined = useAppSelector((state) => state.room.roomJoined);
    const showOfficeChat = useAppSelector((state) => state.chat.showOfficeChat);
    const [screenDialogOpen, setScreenDialogOpen] = useState(false);
    const [showChat, setShowChat] = useState(true);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);

    return (
        <>
            {!roomJoined && (
                <>
                    <RoomSelection />
                </>
            )}
            {roomJoined && (
                <>
                    <div className="fixed top-4 left-4 z-20 flex items-center gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setLeaveModalOpen(true)}
                            className="cursor-pointer shadow-md bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-1.5 rounded-full text-xs tracking-wide transition-all"
                        >
                            Leave Room
                        </Button>
                    </div>
                    {showChat && <Chat setShowChat={setShowChat} />}
                    <VideoCall />
                    <MobileDPad />
                    <AnimatePresence mode="wait">
                        <FloatingActions
                            key="floating-buttons"
                            isInsideOffice={showOfficeChat}
                            showChat={showChat}
                            setScreenDialogOpen={setScreenDialogOpen}
                            setShowChat={setShowChat}
                        />
                    </AnimatePresence>
                    <LeaveRoomModal
                        open={leaveModalOpen}
                        onOpenChange={setLeaveModalOpen}
                    />
                </>
            )}

            {showOfficeChat && (
                <>
                    <ScreenShare
                        screenDialogOpen={screenDialogOpen}
                        setScreenDialogOpen={setScreenDialogOpen}
                    />
                </>
            )}
            <CornerActionButtons isInGame={roomJoined} />
        </>
    );
}

export default App;
