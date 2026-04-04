import { useCallback, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.log(error);
            return initialValue;
        }
    });

    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            setStoredValue((currentValue) => {
                const valueToStore =
                    value instanceof Function ? value(currentValue) : value;

                if (typeof window !== "undefined") {
                    const serializedValue = JSON.stringify(valueToStore);
                    const previousSerializedValue = JSON.stringify(currentValue);

                    if (serializedValue !== previousSerializedValue) {
                        window.localStorage.setItem(key, serializedValue);
                        // Dispatch event for cross-component sync in same window
                        window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key, value: valueToStore } }));
                    }
                }

                return valueToStore;
            });
        } catch (error) {
            console.log(error);
        }
    }, [key]);


    return [storedValue, setValue] as const;
}
