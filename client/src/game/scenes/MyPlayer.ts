import store from "../../app/store";
import Network from "./Network";
import { OfficeManager } from "./OfficeManager";
import { Player } from "./Player";
import liveKitService from "../service/LiveKitService";
import {
    clearOfficeChat,
    setShowOfficeChat,
    setCurrentOfficeName,
} from "../../app/features/chat/chatSlice";
import { resetLiveKitState } from "../../app/features/webRtc/liveKitSlice";
import {
    officeNames,
    OFFICE_PRETTY_NAMES,
} from "../../lib/utils";

export class MyPlayer extends Player {
    private static SPEED = 300;
    private static SPRINT_SPEED = 600;
    private static DOUBLE_TAP_DELAY = 320; // max time in ms between taps to trigger sprint
    private static PROXIMITY_CONNECT_DELAY = 1500; // ms near player before connecting

    private lastX: number;
    private lastY: number;
    public mySessionId: string;
    private character: string;

    public get sessionId(): string {
        return this.mySessionId;
    }

    private currentOffice: officeNames;
    private network: Network;
    private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private officeManager: OfficeManager;
    private proximityPlayers = new Map<string, Player>();
    private proximityTimers = new Map<
        string,
        { enterTime: number; connected: boolean }
    >();

    // Double-tap sprint tracking
    private lastTapTimes = {
        left: 0,
        right: 0,
        up: 0,
        down: 0,
    };
    private isSprinting = false;
    private sprintDirection: "left" | "right" | "up" | "down" | null = null;

    // Mobile / Touch D-Pad input
    public touchInput = {
        left: false,
        right: false,
        up: false,
        down: false,
        sprint: false,
    };

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        character: string,
        username: string,
        mySessionId: string,
        isMicOn: boolean,
        isWebcamOn: boolean,
        network: Network,
        cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys
    ) {
        super(scene, x, y, character, username, isMicOn, isWebcamOn);

        this.character = character;
        this.mySessionId = mySessionId;
        this.officeManager = new OfficeManager();
        this.network = network;
        this.cursorKeys = cursorKeys;
    }

    /** Handles current player's movements and notifies the server. */
    private handlePlayerMovements() {
        const now = Date.now();

        // Detect double tap on arrow keys
        const leftJustDown = Phaser.Input.Keyboard.JustDown(this.cursorKeys.left);
        const rightJustDown = Phaser.Input.Keyboard.JustDown(this.cursorKeys.right);
        const upJustDown = Phaser.Input.Keyboard.JustDown(this.cursorKeys.up);
        const downJustDown = Phaser.Input.Keyboard.JustDown(this.cursorKeys.down);

        if (leftJustDown) {
            if (now - this.lastTapTimes.left <= MyPlayer.DOUBLE_TAP_DELAY) {
                this.isSprinting = true;
                this.sprintDirection = "left";
            }
            this.lastTapTimes.left = now;
        }

        if (rightJustDown) {
            if (now - this.lastTapTimes.right <= MyPlayer.DOUBLE_TAP_DELAY) {
                this.isSprinting = true;
                this.sprintDirection = "right";
            }
            this.lastTapTimes.right = now;
        }

        if (upJustDown) {
            if (now - this.lastTapTimes.up <= MyPlayer.DOUBLE_TAP_DELAY) {
                this.isSprinting = true;
                this.sprintDirection = "up";
            }
            this.lastTapTimes.up = now;
        }

        if (downJustDown) {
            if (now - this.lastTapTimes.down <= MyPlayer.DOUBLE_TAP_DELAY) {
                this.isSprinting = true;
                this.sprintDirection = "down";
            }
            this.lastTapTimes.down = now;
        }

        // Cancel sprint when the sprinting key is released
        if (this.sprintDirection && !this.cursorKeys[this.sprintDirection]?.isDown) {
            this.isSprinting = false;
            this.sprintDirection = null;
        }

        const isLeft = (this.cursorKeys?.left?.isDown ?? false) || this.touchInput.left;
        const isRight = (this.cursorKeys?.right?.isDown ?? false) || this.touchInput.right;
        const isUp = (this.cursorKeys?.up?.isDown ?? false) || this.touchInput.up;
        const isDown = (this.cursorKeys?.down?.isDown ?? false) || this.touchInput.down;

        const shouldSprint = this.isSprinting || (this.cursorKeys?.shift?.isDown ?? false) || this.touchInput.sprint;
        const currentSpeed = shouldSprint ? MyPlayer.SPRINT_SPEED : MyPlayer.SPEED;
        const animTimeScale = shouldSprint ? 1.75 : 1;

        let vx = 0;
        let vy = 0;

        // set velocity x & y and player's animation
        if (isLeft) {
            vx -= currentSpeed;
            this.playAnimation(`${this.character}_left_run`, animTimeScale);
        } else if (isRight) {
            vx += currentSpeed;
            this.playAnimation(`${this.character}_right_run`, animTimeScale);
        } else if (isUp) {
            vy -= currentSpeed;
            this.playAnimation(`${this.character}_up_run`, animTimeScale);
        } else if (isDown) {
            vy += currentSpeed;
            this.playAnimation(`${this.character}_down_run`, animTimeScale);
        } else {
            this.isSprinting = false;
            this.sprintDirection = null;

            const currentAnimKey = this.getCurrentAnimationKey();
            const parts = currentAnimKey.split("_");
            parts[2] = "idle"; // getting the last "run" animation and changing it to idle
            const idleAnim = parts.join("_");

            // this prevents sending idle animation multiple times to the server
            if (currentAnimKey !== idleAnim) {
                this.playAnimation(idleAnim, 1);
                this.network.updatePlayer(this.x, this.y, idleAnim);
            }
        }

        // set the velocity of the player
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);

        // if player is moving then send his live position to the server.
        if (vx !== 0 || vy !== 0) {
            const currentAnimKey = this.getCurrentAnimationKey();
            this.network.updatePlayer(this.x, this.y, currentAnimKey);
        }
    }

    /**
     * Handles office joining.
     *
     * @param officeName office's name
     */
    private joinOffice(officeName: officeNames) {
        this.currentOffice = officeName;
        this.proximityPlayers.clear();
        this.proximityTimers.clear();

        const prettyName = officeName ? OFFICE_PRETTY_NAMES[officeName] || officeName : null;
        store.dispatch(setCurrentOfficeName(prettyName));
        store.dispatch(setShowOfficeChat(true));

        // Notify server for office chat & presence
        this.network.joinOffice(this.currentOffice);

        // Switch LiveKit media scope to this office immediately without reconnecting
        liveKitService.joinOffice(officeName).catch(console.error);
    }

    private leaveOffice() {
        if (!this.currentOffice) return;
        const prevOffice = this.currentOffice;
        this.currentOffice = null;

        this.network.leaveOffice(prevOffice);

        store.dispatch(setCurrentOfficeName(null));
        store.dispatch(clearOfficeChat());
        store.dispatch(setShowOfficeChat(false));

        // Character exits immediately first; media and screen share stop in the background
        liveKitService.leaveOffice();
    }

    private handleOfficeJoiningAndLeaving() {
        const { x, y } = this;

        if (x !== this.lastX || y !== this.lastY) {
            const office = this.officeManager.update(x, y);

            if (office && this.currentOffice !== office) {
                if (this.currentOffice) {
                    this.leaveOffice();
                }
                this.joinOffice(office);
            } else if (!office && this.currentOffice) {
                this.leaveOffice();
            }

            this.lastX = x;
            this.lastY = y;
        }
    }

    /**
     * Starts current player's webcam via LiveKit.
     * LiveKit SFU automatically distributes to all subscribed participants.
     */
    async startWebcam(shouldConnectToOtherPlayers = false) {
        await liveKitService.startWebcam();
        this.updateDisconnectStatus(false);
    }

    /**
     * Starts streaming current player's screen via LiveKit.
     * LiveKit SFU automatically distributes to all subscribed participants.
     */
    async startScreenSharing() {
        await liveKitService.startScreenShare();
    }

    /**
     * Handles disconnect status of the player
     * If player clicks on "Disconnect from video calls" button,
     * it removes mic/webcam icons and shows disconnect icon.
     *
     * @param disconnected if true, show disconnect button otherwise show mic/webcam button
     */
    updateDisconnectStatus(disconnected: boolean) {
        this.setDisconnectIcon(disconnected);

        const status = this.getCurrentStatus();
        this.network.updatePlayer(
            this.x,
            this.y,
            this.getCurrentAnimationKey(),
            status
        );
    }

    /**
     * Handles proximity chat between players.
     *
     * The logic prioritizes disconnection checks before attempting a connection:
     * 1. If the player moves away after the timer started, disconnect and clean up.
     * 2. If the proximity player enters an office, disconnect immediately.
     * 3. Only then, if the player is still near and both are outside any office, start or complete connection.
     *
     * With LiveKit, proximity video is handled by the SFU automatically.
     * We just track proximity state for future use (e.g. showing/hiding UI).
     *
     * @param time update()'s time (from Phaser's update loop)
     * @param sessionId session ID of the proximity player
     * @param otherPlayer the proximity player's sprite
     */
    handleProximityChat(time: number, sessionId: string, otherPlayer: Player) {
        const distance = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            otherPlayer.x,
            otherPlayer.y
        );

        const isProximityPlayerInOffice = OfficeManager.isInOffice(
            otherPlayer.x,
            otherPlayer.y
        );

        // disconnect if player was previously tracked but moved away
        if (this.proximityTimers.has(sessionId) && distance > 50) {
            const timer = this.proximityTimers.get(sessionId);

            if (!timer.connected) {
                this.proximityTimers.delete(sessionId);
                return;
            }

            this.proximityPlayers.delete(sessionId);
            this.proximityTimers.delete(sessionId);
            return;
        }

        // disconnect if player is already connected and entered an office
        if (this.proximityPlayers.has(sessionId) && isProximityPlayerInOffice) {
            this.proximityPlayers.delete(sessionId);
            this.proximityTimers.delete(sessionId);
            return;
        }

        // connect if near and both are not in office
        if (
            distance <= 50 &&
            !this.currentOffice &&
            !isProximityPlayerInOffice
        ) {
            // player just came near the current player, start his timer and return
            if (!this.proximityTimers.has(sessionId)) {
                this.proximityTimers.set(sessionId, {
                    enterTime: time,
                    connected: false,
                });
                return;
            }

            // player is near for enough time and is not already connected
            const timer = this.proximityTimers.get(sessionId);
            if (
                !timer.connected &&
                time - timer.enterTime >= MyPlayer.PROXIMITY_CONNECT_DELAY
            ) {
                this.proximityPlayers.set(sessionId, otherPlayer);
                timer.connected = true;
                // LiveKit SFU automatically delivers webcam tracks to all participants
                // No manual shareWebcam() call needed
            }
        }
    }

    handlePlayerLeft(sessionId: string) {
        this.proximityPlayers.delete(sessionId);
        this.proximityTimers.delete(sessionId);
    }

    playerStoppedScreenSharing() {
        // Screen sharing state is managed directly by LiveKitService
    }

    /**
     * Stops webcam via LiveKit.
     */
    playerStoppedWebcam() {
        liveKitService.stopWebcam();
        this.updateDisconnectStatus(true);
    }

    addNewOfficeChatMessage = (message: string) => {
        this.network.addNewOfficeChatMessage(message, this.currentOffice);
    };

    /**
     * Called once after the player is initialized in the scene.
     * LiveKit connection is already established via Network.ts (LIVEKIT_TOKEN message).
     * Nothing extra to initialize here.
     */
    initializePeers = () => {
        console.log("[LiveKit] Media managed by LiveKit SFU — no peer initialization needed.");
    };

    update() {
        this.handlePlayerMovements();
        this.handleOfficeJoiningAndLeaving();
    }
}
