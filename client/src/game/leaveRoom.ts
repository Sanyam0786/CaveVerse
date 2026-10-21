import store from "../app/store";
import { setRoomJoined } from "../app/features/room/roomSlice";
import {
    clearOfficeChat,
    setShowOfficeChat,
    setCurrentOfficeName,
} from "../app/features/chat/chatSlice";
import { resetLiveKitState } from "../app/features/webRtc/liveKitSlice";
import liveKitService from "./service/LiveKitService";
import phaserGame from "./main";
import { Bootstrap } from "./scenes/Bootstrap";
import { toast } from "sonner";

export async function leaveGameRoom() {
    try {
        await liveKitService.disconnect();
    } catch (err) {
        console.error("[LeaveRoom] Error disconnecting LiveKit:", err);
    }

    try {
        const bootstrap = phaserGame?.scene?.keys?.bootstrap as Bootstrap;
        if (bootstrap && bootstrap.network) {
            await bootstrap.network.leaveRoom();
        }
    } catch (err) {
        console.error("[LeaveRoom] Error leaving Colyseus room:", err);
    }

    try {
        if (phaserGame?.scene?.isActive("GameScene")) {
            phaserGame.scene.stop("GameScene");
        }
    } catch (err) {
        console.error("[LeaveRoom] Error stopping GameScene:", err);
    }

    store.dispatch(setRoomJoined(false));
    store.dispatch(clearOfficeChat());
    store.dispatch(setShowOfficeChat(false));
    store.dispatch(setCurrentOfficeName(null));
    store.dispatch(resetLiveKitState());

    toast.success("You have left the room.");
}
