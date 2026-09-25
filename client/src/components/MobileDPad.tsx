import React, { useState, useEffect, useRef, useCallback } from "react";
import phaserGame from "../game/main";
import { GameScene } from "../game/scenes/GameScene";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap } from "lucide-react";

export default function MobileDPad() {
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [activeDirs, setActiveDirs] = useState<{
        up: boolean;
        down: boolean;
        left: boolean;
        right: boolean;
        sprint: boolean;
    }>({
        up: false,
        down: false,
        left: false,
        right: false,
        sprint: false,
    });

    // Detect if device supports touch or is a mobile screen
    useEffect(() => {
        const checkTouch = () => {
            const hasTouch =
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0 ||
                window.innerWidth <= 1024;
            setIsTouchDevice(hasTouch);
        };

        checkTouch();
        window.addEventListener("resize", checkTouch);
        return () => window.removeEventListener("resize", checkTouch);
    }, []);

    const updateDirection = useCallback((key: "up" | "down" | "left" | "right" | "sprint", isPressed: boolean) => {
        setActiveDirs((prev) => {
            if (prev[key] === isPressed) return prev;
            const next = { ...prev, [key]: isPressed };

            const gameInstance = phaserGame?.scene?.keys?.GameScene as GameScene;
            if (gameInstance?.setTouchDirection) {
                gameInstance.setTouchDirection({
                    [key]: isPressed,
                });
            }

            if (isPressed && "vibrate" in navigator) {
                try {
                    navigator.vibrate(8);
                } catch {
                    // Ignore haptic error if blocked
                }
            }

            return next;
        });
    }, []);

    // Helper for pointer handlers
    const createPointerHandlers = (dir: "up" | "down" | "left" | "right" | "sprint") => {
        return {
            onPointerDown: (e: React.PointerEvent) => {
                e.preventDefault();
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                updateDirection(dir, true);
            },
            onPointerUp: (e: React.PointerEvent) => {
                e.preventDefault();
                e.stopPropagation();
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                updateDirection(dir, false);
            },
            onPointerCancel: (e: React.PointerEvent) => {
                e.preventDefault();
                updateDirection(dir, false);
            },
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };
    };

    if (!isTouchDevice) {
        return null;
    }

    const btnBase =
        "flex items-center justify-center rounded-2xl select-none transition-all duration-75 active:scale-95 touch-none";
    const dpadBtnStyle =
        "w-14 h-14 bg-black/65 backdrop-blur-md border border-white/20 text-white shadow-xl hover:bg-black/75";
    const dpadBtnActive = "bg-indigo-600/90 border-indigo-400 text-white shadow-indigo-500/50 shadow-lg scale-95";

    return (
        <>
            {/* ─── Left Thumb: 4-Way D-Pad ─── */}
            <div
                className="fixed bottom-6 left-6 z-40 select-none touch-none pointer-events-auto"
                style={{ touchAction: "none" }}
            >
                <div className="relative w-44 h-44 flex items-center justify-center">
                    {/* Center background plate */}
                    <div className="absolute w-20 h-20 rounded-full bg-black/35 backdrop-blur-sm border border-white/10 pointer-events-none" />

                    {/* UP */}
                    <button
                        {...createPointerHandlers("up")}
                        className={`absolute top-0 left-1/2 -translate-x-1/2 ${btnBase} ${dpadBtnStyle} ${
                            activeDirs.up ? dpadBtnActive : ""
                        }`}
                        aria-label="Move Up"
                    >
                        <ChevronUp className="w-8 h-8 pointer-events-none" />
                    </button>

                    {/* DOWN */}
                    <button
                        {...createPointerHandlers("down")}
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${btnBase} ${dpadBtnStyle} ${
                            activeDirs.down ? dpadBtnActive : ""
                        }`}
                        aria-label="Move Down"
                    >
                        <ChevronDown className="w-8 h-8 pointer-events-none" />
                    </button>

                    {/* LEFT */}
                    <button
                        {...createPointerHandlers("left")}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 ${btnBase} ${dpadBtnStyle} ${
                            activeDirs.left ? dpadBtnActive : ""
                        }`}
                        aria-label="Move Left"
                    >
                        <ChevronLeft className="w-8 h-8 pointer-events-none" />
                    </button>

                    {/* RIGHT */}
                    <button
                        {...createPointerHandlers("right")}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 ${btnBase} ${dpadBtnStyle} ${
                            activeDirs.right ? dpadBtnActive : ""
                        }`}
                        aria-label="Move Right"
                    >
                        <ChevronRight className="w-8 h-8 pointer-events-none" />
                    </button>
                </div>
            </div>

            {/* ─── Right Thumb: Sprint (Run) Button ─── */}
            <div
                className="fixed bottom-6 right-6 z-40 select-none touch-none pointer-events-auto"
                style={{ touchAction: "none" }}
            >
                <button
                    {...createPointerHandlers("sprint")}
                    className={`${btnBase} w-16 h-16 rounded-full bg-indigo-600/80 backdrop-blur-md border border-indigo-400 text-white shadow-xl active:bg-indigo-500 hover:bg-indigo-600 ${
                        activeDirs.sprint
                            ? "bg-amber-500 border-amber-300 text-black shadow-amber-500/50 shadow-lg scale-95"
                            : ""
                    }`}
                    aria-label="Sprint"
                >
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                        <Zap className={`w-7 h-7 ${activeDirs.sprint ? "fill-black" : "fill-white"}`} />
                        <span className="text-[10px] font-bold tracking-tight">RUN</span>
                    </div>
                </button>
            </div>
        </>
    );
}
