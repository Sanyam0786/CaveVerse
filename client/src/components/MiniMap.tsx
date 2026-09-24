import { useEffect, useRef, useState, useCallback } from "react";
import { Event, phaserEvents } from "../game/EventBus";
import { OfficeManager } from "../game/scenes/OfficeManager";
import { Maximize2, Minimize2, MapPin, Users, Compass } from "lucide-react";

// ─── Map world dimensions (pixels in Phaser world space) ────────────────────
// 75 × 37 tiles @ 32 px each = 2400 × 1184 px
const WORLD_W = 2400;
const WORLD_H = 1184;

// ─── Responsive Minimap Canvas Dimensions ──────────────────────────────────
const COMPACT_W = 248;
const COMPACT_H = Math.round((COMPACT_W * WORLD_H) / WORLD_W); // 122px

const EXPANDED_W = 380;
const EXPANDED_H = Math.round((EXPANDED_W * WORLD_H) / WORLD_W); // 187px

export type PlayerDot = {
    sessionId: string;
    x: number;
    y: number;
    isMe: boolean;
    username: string;
    anim?: string;
};

export type CamViewport = {
    x: number;
    y: number;
    width: number;
    height: number;
};

import { OFFICE_PRETTY_NAMES } from "../lib/utils";

export default function MiniMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef<PlayerDot[]>([]);
    const camRef = useRef<CamViewport | null>(null);
    const mapImgRef = useRef<HTMLImageElement | null>(null);
    const rafRef = useRef<number>(0);

    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [currentOfficeName, setCurrentOfficeName] = useState<string>("Hallway");
    const [playerCount, setPlayerCount] = useState<number>(1);
    const [playerCoords, setPlayerCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const width = isExpanded ? EXPANDED_W : COMPACT_W;
    const height = isExpanded ? EXPANDED_H : COMPACT_H;

    // Load pre-rendered map image
    useEffect(() => {
        const img = new Image();
        img.src = "/assets/map/minimap.png";
        img.onload = () => {
            mapImgRef.current = img;
        };
        img.onerror = () => {
            const thumb = new Image();
            thumb.src = "/assets/map/minimap_thumb.png";
            thumb.onload = () => {
                mapImgRef.current = thumb;
            };
        };
    }, []);

    // World → minimap coordinate transform
    const wx = useCallback((worldX: number) => (worldX / WORLD_W) * width, [width]);
    const wy = useCallback((worldY: number) => (worldY / WORLD_H) * height, [height]);

    // Detect current office for local player
    const detectOffice = useCallback((px: number, py: number): string => {
        for (const zone of OfficeManager.OFFICES) {
            const r = zone.rect;
            if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) {
                return OFFICE_PRETTY_NAMES[zone.name] || zone.name;
            }
        }
        return "Hallway";
    }, []);

    // ── Main Render Frame ────────────────────────────────────────────────────
    const draw = useCallback((now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Support High-DPI / Retina displays
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Map Image
        const mapImg = mapImgRef.current;
        if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
            ctx.drawImage(mapImg, 0, 0, width, height);
        } else {
            // Blueprint fallback while loading image
            ctx.fillStyle = "#161b26";
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
            ctx.lineWidth = 1;
            const step = width / 12;
            for (let x = 0; x <= width; x += step) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            }
            for (let y = 0; y <= height; y += step) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            }
        }

        // Subtle dark ambient vignette overlay to make HUD markers pop
        const vignette = ctx.createRadialGradient(
            width / 2, height / 2, width * 0.25,
            width / 2, height / 2, width * 0.65
        );
        vignette.addColorStop(0, "rgba(10, 15, 28, 0.02)");
        vignette.addColorStop(1, "rgba(10, 15, 28, 0.35)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        // 2. Office Zone Outlines & Badges
        const myPlayer = playersRef.current.find((p) => p.isMe);
        for (const zone of OfficeManager.OFFICES) {
            const zx = wx(zone.rect.x);
            const zy = wy(zone.rect.y);
            const zw = wx(zone.rect.width);
            const zh = wy(zone.rect.height);

            const isPlayerInside = myPlayer
                ? myPlayer.x >= zone.rect.x &&
                myPlayer.x <= zone.rect.x + zone.rect.width &&
                myPlayer.y >= zone.rect.y &&
                myPlayer.y <= zone.rect.y + zone.rect.height
                : false;

            // if (isPlayerInside) {
            //     // Subtle highlight fill for current active office
            //     ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
            //     ctx.fillRect(zx, zy, zw, zh);

            //     // Active glowing border
            //     ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
            //     ctx.lineWidth = 1.2;
            //     ctx.strokeRect(zx, zy, zw, zh);

            //     // Tactical corner bracket accents
            //     const cornerSize = Math.min(6, zw * 0.15, zh * 0.15);
            //     ctx.strokeStyle = "#38bdf8";
            //     ctx.lineWidth = 2;
            //     // Top-left
            //     ctx.beginPath();
            //     ctx.moveTo(zx, zy + cornerSize); ctx.lineTo(zx, zy); ctx.lineTo(zx + cornerSize, zy);
            //     ctx.stroke();
            //     // Bottom-right
            //     ctx.beginPath();
            //     ctx.moveTo(zx + zw, zy + zh - cornerSize); ctx.lineTo(zx + zw, zy + zh); ctx.lineTo(zx + zw - cornerSize, zy + zh);
            //     ctx.stroke();
            // } else {
            //     // Subtle architectural room boundary
            //     ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            //     ctx.lineWidth = 0.8;
            //     ctx.strokeRect(zx, zy, zw, zh);
            // }

            // Room Name Label Capsule (only displayed when expanded)
            if (isExpanded) {
                const label = OFFICE_PRETTY_NAMES[zone.name] || zone.name;
                const textY = zy + zh - 10;
                const textX = zx + zw / 2;

                ctx.save();
                ctx.font = "600 8px Inter, system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const metrics = ctx.measureText(label);
                const pillW = metrics.width + 8;
                const pillH = 13;

                ctx.fillStyle = isPlayerInside ? "rgba(14, 116, 144, 0.75)" : "rgba(15, 23, 42, 0.65)";
                ctx.strokeStyle = isPlayerInside ? "rgba(56, 189, 248, 0.5)" : "rgba(255, 255, 255, 0.15)";
                ctx.lineWidth = 0.7;

                // Rounded pill background
                const r = pillH / 2;
                ctx.beginPath();
                ctx.roundRect(textX - pillW / 2, textY - pillH / 2, pillW, pillH, r);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = isPlayerInside ? "#e0f2fe" : "rgba(255, 255, 255, 0.85)";
                ctx.fillText(label, textX, textY);
                ctx.restore();
            }
        }

        // 3. Camera Viewport Rectangle (Frustum)
        // const cam = camRef.current;
        // if (cam) {
        //     const cx = wx(cam.x);
        //     const cy = wy(cam.y);
        //     const cw = wx(cam.width);
        //     const ch = wy(cam.height);

        //     ctx.save();
        //     ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        //     ctx.fillRect(cx, cy, cw, ch);

        //     ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        //     ctx.lineWidth = 1;
        //     ctx.setLineDash([3, 2]);
        //     ctx.strokeRect(cx, cy, cw, ch);
        //     ctx.restore();
        // }

        // 4. Render Other Players
        for (const p of playersRef.current) {
            if (p.isMe) continue;
            const px = wx(p.x);
            const py = wy(p.y);

            // Amber glowing dot
            ctx.save();
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 6;
            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            ctx.arc(px, py, isExpanded ? 3.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Inner white dot
            ctx.fillStyle = "#fffbeb";
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(px, py, isExpanded ? 1.5 : 1, 0, Math.PI * 2);
            ctx.fill();

            // Player username tag above dot
            const nameTag = p.username || "Player";
            ctx.font = isExpanded ? "600 7.5px Inter, sans-serif" : "600 6px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            const tagMetrics = ctx.measureText(nameTag);
            const tagW = tagMetrics.width + 6;
            const tagH = isExpanded ? 11 : 9;
            const tagY = py - (isExpanded ? 5 : 4);

            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.roundRect(px - tagW / 2, tagY - tagH, tagW, tagH, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#fef3c7";
            ctx.fillText(nameTag, px, tagY - 1.5);
            ctx.restore();
        }

        // 5. Render Local Player ("You")
        if (myPlayer) {
            const px = wx(myPlayer.x);
            const py = wy(myPlayer.y);

            // Animated radar ripple ring
            const pulsePeriod = 1500;
            const pulseProgress = (now % pulsePeriod) / pulsePeriod;
            const maxPulseR = isExpanded ? 14 : 10;
            const pulseR = 3 + pulseProgress * (maxPulseR - 3);
            const pulseAlpha = (1 - pulseProgress) * 0.75;

            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(px, py, pulseR, 0, Math.PI * 2);
            ctx.stroke();

            // Secondary subtle glowing aura
            const aura = ctx.createRadialGradient(px, py, 0, px, py, isExpanded ? 8 : 6);
            aura.addColorStop(0, "rgba(56, 189, 248, 0.6)");
            aura.addColorStop(1, "rgba(56, 189, 248, 0)");
            ctx.fillStyle = aura;
            ctx.beginPath();
            ctx.arc(px, py, isExpanded ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();

            // Directional pointer if moving
            if (myPlayer.anim) {
                let angle: number | null = null;
                if (myPlayer.anim.includes("_up")) angle = -Math.PI / 2;
                else if (myPlayer.anim.includes("_down")) angle = Math.PI / 2;
                else if (myPlayer.anim.includes("_left")) angle = Math.PI;
                else if (myPlayer.anim.includes("_right")) angle = 0;

                if (angle !== null) {
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(angle);
                    ctx.fillStyle = "#38bdf8";
                    ctx.beginPath();
                    ctx.moveTo(isExpanded ? 7 : 5, 0);
                    ctx.lineTo(isExpanded ? 3 : 2, -3);
                    ctx.lineTo(isExpanded ? 3 : 2, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Core glowing beacon
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(px, py, isExpanded ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();

            // Bright white central spark
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(px, py, isExpanded ? 1.8 : 1.3, 0, Math.PI * 2);
            ctx.fill();

            // "You" indicator tag
            const youLabel = "YOU";
            ctx.font = isExpanded ? "700 7.5px Inter, sans-serif" : "700 6px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            const tagMetrics = ctx.measureText(youLabel);
            const tagW = tagMetrics.width + 6;
            const tagH = isExpanded ? 11 : 9;
            const tagY = py - (isExpanded ? 6 : 5);

            ctx.fillStyle = "rgba(14, 116, 144, 0.9)";
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.roundRect(px - tagW / 2, tagY - tagH, tagW, tagH, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.fillText(youLabel, px, tagY - 1.5);
            ctx.restore();
        }

        // 6. Tactical Crosshair / Corner Notches for Outer Frame
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 1;
        const cornerLen = 8;
        ctx.beginPath(); ctx.moveTo(0, cornerLen); ctx.lineTo(0, 0); ctx.lineTo(cornerLen, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(width - cornerLen, 0); ctx.lineTo(width, 0); ctx.lineTo(width, cornerLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, height - cornerLen); ctx.lineTo(0, height); ctx.lineTo(cornerLen, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(width - cornerLen, height); ctx.lineTo(width, height); ctx.lineTo(width, height - cornerLen); ctx.stroke();

        ctx.restore();
    }, [width, height, wx, wy, isExpanded]);

    // ── Animation Loop ───────────────────────────────────────────────────────
    useEffect(() => {
        let running = true;
        const loop = (time: number) => {
            if (!running) return;
            draw(time);
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => {
            running = false;
            cancelAnimationFrame(rafRef.current);
        };
    }, [draw]);

    // ── EventBus Listener for Player & Camera Updates ────────────────────────
    useEffect(() => {
        const onUpdate = (data: any) => {
            let playersList: PlayerDot[] = [];
            let camData: CamViewport | null = null;

            if (Array.isArray(data)) {
                playersList = data;
            } else if (data && typeof data === "object") {
                playersList = data.players || [];
                camData = data.cam || null;
            }

            playersRef.current = playersList;
            camRef.current = camData;

            const me = playersList.find((p) => p.isMe);
            if (me) {
                setPlayerCoords({ x: Math.round(me.x), y: Math.round(me.y) });
                setCurrentOfficeName(detectOffice(me.x, me.y));
            }
            setPlayerCount(playersList.length);
        };

        phaserEvents.on(Event.MINIMAP_UPDATE, onUpdate);
        return () => {
            phaserEvents.off(Event.MINIMAP_UPDATE, onUpdate);
        };
    }, [detectOffice]);

    return (
        <div
            style={{
                width: width,
                position: "relative",
                borderRadius: "14px",
                overflow: "hidden",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                background: "rgba(13, 17, 28, 0.88)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow:
                    "0 12px 36px rgba(0,0,0,0.65), 0 0 20px rgba(56, 189, 248, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                userSelect: "none",
            }}
        >
            {/* Header Bar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "linear-gradient(180deg, rgba(20, 28, 45, 0.95) 0%, rgba(13, 17, 28, 0.85) 100%)",
                    borderBottom: "1px solid rgba(56, 189, 248, 0.18)",
                    fontSize: "11px",
                    fontFamily: "Inter, system-ui, sans-serif",
                }}
            >
                {/* Left: Map title & Live radar blinker */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#22c55e",
                            boxShadow: "0 0 8px #22c55e",
                            display: "inline-block",
                        }}
                    /> */}
                    <span
                        style={{
                            color: "#e0f2fe",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            fontSize: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <Compass size={11} color="#38bdf8" />
                        MINIMAP
                    </span>
                </div>

                {/* Center: Current Office Pill */}
                {/* <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        borderRadius: "10px",
                        padding: "2px 7px",
                        color: "#38bdf8",
                        fontSize: "9.5px",
                        fontWeight: 600,
                        maxWidth: isExpanded ? "180px" : "110px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    title={currentOfficeName}
                >
                    <MapPin size={9} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {currentOfficeName}
                    </span>
                </div> */}

                {/* Right: Expand/Minimize Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            color: "rgba(255,255,255,0.6)",
                            fontSize: "9.5px",
                            fontWeight: 500,
                        }}
                    >
                        <Users size={10} color="#fbbf24" />
                        <span>{playerCount}</span>
                    </div>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? "Collapse minimap" : "Expand minimap"}
                        style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: "5px",
                            padding: "3px",
                            cursor: "pointer",
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#38bdf8";
                            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#94a3b8";
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                        }}
                    >
                        {isExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                    </button>
                </div>
            </div>

            {/* Canvas Display */}
            <div style={{ position: "relative", width: width, height: height, background: "#0f172a" }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        width: width,
                        height: height,
                        display: "block",
                        imageRendering: "pixelated",
                    }}
                />
            </div>

            {/* Footer Bar: Legend & Coordinates */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 8px",
                    background: "rgba(10, 15, 26, 0.95)",
                    borderTop: "1px solid rgba(56, 189, 248, 0.12)",
                    fontSize: "8.5px",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "Inter, system-ui, sans-serif",
                }}
            >
                {/* Legend */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span
                            style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "#38bdf8",
                                boxShadow: "0 0 5px #38bdf8",
                                display: "inline-block",
                            }}
                        />
                        <span>You</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span
                            style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "#f59e0b",
                                boxShadow: "0 0 5px #f59e0b",
                                display: "inline-block",
                            }}
                        />
                        <span>Others</span>
                    </span>
                </div>

                {/* Coordinates */}
                {/* <div
                    style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "8px",
                        letterSpacing: "0.03em",
                        color: "rgba(56, 189, 248, 0.7)",
                    }}
                >
                    {playerCoords.x},{playerCoords.y}
                </div> */}
            </div>
        </div>
    );
}
