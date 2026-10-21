import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { leaveGameRoom } from "../game/leaveRoom";

interface LeaveRoomModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function LeaveRoomModal({
    open,
    onOpenChange,
}: LeaveRoomModalProps) {
    const [isLeaving, setIsLeaving] = useState(false);

    const handleConfirm = async () => {
        setIsLeaving(true);
        try {
            await leaveGameRoom();
            onOpenChange(false);
        } catch (err) {
            console.error("Failed to leave office:", err);
            toast.error("Failed to leave cleanly.");
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white border border-zinc-200 text-zinc-900 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-red-600 text-xl font-bold">
                        Leave Room
                    </DialogTitle>
                    <DialogDescription className="text-zinc-600 text-sm mt-1">
                        Are you sure you want to exit? You will log out from the office
                        and voice/video session, and return to the main menu.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex sm:justify-end gap-2 mt-5">
                    <Button
                        variant="outline"
                        type="button"
                        disabled={isLeaving}
                        className="cursor-pointer border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        type="button"
                        disabled={isLeaving}
                        className="cursor-pointer bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2"
                        onClick={handleConfirm}
                    >
                        {isLeaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Leaving...
                            </>
                        ) : (
                            "Leave Room"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
