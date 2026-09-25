import { Client, Room } from "colyseus.js";
import { BACKEND_URL } from "../backend";
import { officeNames } from "../../lib/utils";
import store from "../../app/store";
import liveKitService from "../service/LiveKitService";
import {
    addAvailableRooms,
    removeFromAvailableRooms,
    setIsLoading,
} from "../../app/features/room/roomSlice";
import {
    addGlobalChat,
    addOfficeChat,
    pushNewGlobalMessage,
    pushNewOfficeMessage,
} from "../../app/features/chat/chatSlice";
import { resetLiveKitState } from "../../app/features/webRtc/liveKitSlice";
import { Event, phaserEvents } from "../EventBus";

export default class Network {
    private client: Client;
    private room!: Room;
    private lobby!: Room;
    private username: string;
    private character: string;

    constructor() {
        this.client = new Client(BACKEND_URL);
        this.joinLobbyRoom();
    }

    /**
     * Joins default lobby room and gets & handles custom room's data.
     */
    joinLobbyRoom = async () => {
        this.lobby = await this.client.joinOrCreate("LOBBY_ROOM");
        store.dispatch(setIsLoading(false));

        this.lobby.onMessage("rooms", (rooms) => {
            rooms.forEach((room) => {
                // public room is also included so we need to ignore it
                if (room.name === "PUBLIC_ROOM") {
                    return;
                }
                store.dispatch(
                    addAvailableRooms({
                        roomId: room.roomId,
                        roomName: room.metadata.name,
                        hasPassword: room.metadata.hasPassword,
                    })
                );
            });
        });

        this.lobby.onMessage("+", ([roomId, room]) => {
            // public room is also included so we need to ignore it
            if (room.name === "PUBLIC_ROOM") {
                return;
            }
            // Avoid duplicate room entries
            const existingRooms = store.getState().room.availableRooms;
            if (!existingRooms.some((r) => r.roomId === roomId)) {
                store.dispatch(
                    addAvailableRooms({
                        roomId,
                        roomName: room.metadata.name,
                        hasPassword: room.metadata.hasPassword,
                    })
                );
            }
        });

        this.lobby.onMessage("-", (roomId) => {
            store.dispatch(removeFromAvailableRooms(roomId));
        });
    };

    /**
     * Handles joining or creating public room.
     *
     * @param username player's username
     * @param character selected avatar
     */
    joinOrCreatePublicRoom = async (username: string, character: string) => {
        store.dispatch(setIsLoading(true));

        this.username = username;
        this.character = character;
        this.room = await this.client.joinOrCreate("PUBLIC_ROOM", {
            username: this.username,
            character: this.character,
        });
        this.lobby.leave();
        store.dispatch(setIsLoading(false));
    };

    /**
     * Creates custom room.
     *
     * @param username player's username
     * @param roomName room name
     * @param password room password
     * @param character selected avatar
     */
    createCustomRoom = async (
        username: string,
        roomName: string,
        password: string | null,
        character: string
    ) => {
        store.dispatch(setIsLoading(true));

        this.username = username;
        this.character = character;
        this.room = await this.client.create("PRIVATE_ROOM", {
            name: roomName,
            password,
            username: this.username,
            character,
        });
        this.lobby.leave();
        store.dispatch(setIsLoading(false));
    };

    /**
     * Joins custom room.
     *
     * @param username player's username
     * @param roomId room id
     * @param password room password
     * @param character selected avatar
     */
    joinCustomRoom = async (
        username: string,
        roomId: string,
        password: string | null,
        character: string
    ) => {
        store.dispatch(setIsLoading(true));

        this.username = username;
        this.character = character;
        this.room = await this.client.joinById(roomId, {
            password,
            username: this.username,
            character,
        });
        this.lobby.leave();
        store.dispatch(setIsLoading(false));
    };

    /**
     * Helper method to get the appropriate state properties for each office
     *
     * @param officeName office's name
     */
    getOfficeData = (officeName: officeNames) => {
        const officeMap = {
            mainOffice: {
                members: this.room.state.mainOfficeMembers,
                chat: this.room.state.mainOfficeChat,
            },
            eastOffice: {
                members: this.room.state.eastOfficeMembers,
                chat: this.room.state.eastOfficeChat,
            },
            westOffice: {
                members: this.room.state.westOfficeMembers,
                chat: this.room.state.westOfficeChat,
            },
            northOffice1: {
                members: this.room.state.northOffice1Members,
                chat: this.room.state.northOffice1Chat,
            },
            northOffice2: {
                members: this.room.state.northOffice2Members,
                chat: this.room.state.northOffice2Chat,
            },
        };

        return officeMap[officeName];
    };

    updatePlayer(
        x: number,
        y: number,
        anim: string,
        status?: {
            isMicOn?: boolean;
            isWebcamOn?: boolean;
            isDisconnected?: boolean;
        }
    ) {
        this.room.send("UPDATE_PLAYER", {
            playerX: x,
            playerY: y,
            anim,
            status,
        });
    }

    joinOffice(officeName: officeNames) {
        this.room.send("JOIN_OFFICE", {
            username: this.username,
            office: officeName,
        });
    }

    leaveOffice(officeName: officeNames) {
        this.room.send("LEAVE_OFFICE", {
            username: this.username,
            office: officeName,
        });
    }

    /**
     * Sends new Office Chat message.
     *
     * @param message chat message
     * @param officeName player's office
     */
    addNewOfficeChatMessage = (message: string, officeName: officeNames) => {
        this.room.send("PUSH_OFFICE_MESSAGE", {
            username: this.username,
            message,
            officeName,
        });
    };

    /**
     * Sends new Global Chat message.
     *
     * @param message chat message
     */
    addNewGlobalChatMessage = (message: string) => {
        this.room.send("PUSH_GLOBAL_CHAT_MESSAGE", {
            username: this.username,
            message,
        });
    };

    /**
     * Handles all types of server messages.
     *
     * This method currently handles all types of messages from server,
     * which are this.room.onMessage, this.room.xxxx.onAdd & this.room.xxxx.onRemove
     */
    handleServerMessages = () => {
        // ── LiveKit token received on join ──────────────────────────────────────
        this.room.onMessage(
            "LIVEKIT_TOKEN",
            async ({ token, url }: { token: string; url: string }) => {
                let liveKitUrl = url;
                if (typeof window !== "undefined" && window.location) {
                    if (
                        window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1"
                    ) {
                        const proto =
                            window.location.protocol === "https:" ? "wss:" : "ws:";
                        liveKitUrl = `${proto}//${window.location.host}/livekit`;
                    }
                }
                console.log("[LiveKit] Received token, connecting to:", liveKitUrl);
                try {
                    await liveKitService.connect(liveKitUrl, token);
                } catch (err) {
                    console.error("[LiveKit] Failed to connect:", err);
                }
            }
        );

        // ── Office chat & presence ──────────────────────────────────────────────
        this.room.onMessage(
            "USER_JOINED_OFFICE",
            ({ playerSessionId, username, message, type }) => {
                store.dispatch(
                    pushNewOfficeMessage({
                        username,
                        message,
                        type,
                    })
                );
                // LiveKit handles media automatically — no manual peer calls needed
            }
        );

        this.room.onMessage(
            "NEW_OFFICE_MESSAGE",
            ({ username, message, type }) => {
                store.dispatch(
                    pushNewOfficeMessage({
                        username,
                        message,
                        type,
                    })
                );
            }
        );

        this.room.onMessage(
            "PLAYER_LEFT_OFFICE",
            ({ playerSessionId, username, message, type }) => {
                store.dispatch(
                    pushNewOfficeMessage({
                        username,
                        message,
                        type,
                    })
                );
                // No manual disconnect needed — LiveKit handles unsubscription automatically
            }
        );

        this.room.onMessage("GET_OFFICE_CHAT", (officeChat) => {
            const allMessages = officeChat.map((msg) => ({
                username: msg.username,
                message: msg.message,
                type: msg.type,
            }));
            store.dispatch(addOfficeChat(allMessages));
        });

        // ── Global chat ────────────────────────────────────────────────────────
        this.room.onMessage(
            "NEW_GLOBAL_CHAT_MESSAGE",
            ({ username, message, type }) => {
                store.dispatch(
                    pushNewGlobalMessage({
                        username,
                        message,
                        type,
                    })
                );
            }
        );

        this.room.onMessage("GET_GLOBAL_CHAT", (globalChatMessages) => {
            const allMessages = globalChatMessages.map((msg) => ({
                username: msg.username,
                message: msg.message,
                type: msg.type,
            }));
            store.dispatch(addGlobalChat(allMessages));
        });

        // ── Player presence ────────────────────────────────────────────────────
        this.room.state.players.onRemove((player, sessionId) => {
            phaserEvents.emit(Event.PLAYER_LEFT, sessionId);
        });

        this.room.state.players.onAdd((player, sessionId) => {
            // handling current player
            if (sessionId === this.room.sessionId) {
                phaserEvents.emit(
                    Event.INITIALIZE_PLAYER,
                    this.character,
                    this.username,
                    this.room.sessionId,
                    player.x,
                    player.y
                );
                return;
            }

            // handling other players
            phaserEvents.emit(Event.PLAYER_JOINED, player, sessionId);
        });
    };
}
