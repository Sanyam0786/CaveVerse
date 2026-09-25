export const BACKEND_URL = (() => {
    if (typeof window !== "undefined" && window.location) {
        if (
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1"
        ) {
            const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${proto}//${window.location.host}/colyseus`;
        }
    }
    return import.meta.env.DEV
        ? "ws://localhost:2567"
        : import.meta.env.VITE_BACKEND_URL;
})();
