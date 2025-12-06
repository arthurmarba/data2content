import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "chat:selectedThreadId";

export function useThreadSelection(initialId?: string | null) {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialId ?? null);
    const hasRestoredRef = useRef(false);

    // Restore from localStorage on mount
    useEffect(() => {
        if (hasRestoredRef.current) return;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setSelectedThreadId(stored);
            }
        } catch {
            // ignore
        } finally {
            hasRestoredRef.current = true;
        }
    }, []);

    const updateSelection = useCallback((id: string | null) => {
        setSelectedThreadId(id);
        try {
            if (id) {
                localStorage.setItem(STORAGE_KEY, id);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // ignore storage errors
        }
    }, []);

    return { selectedThreadId, setSelectedThreadId: updateSelection };
}
