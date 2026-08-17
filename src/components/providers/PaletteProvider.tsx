"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useTheme } from "next-themes";
import {
    DEFAULT_PALETTE,
    PALETTE_STORAGE_KEY,
    getPalette,
    isPaletteId,
    type PaletteId,
} from "@/lib/palettes";

interface PaletteContextValue {
    palette: PaletteId;
    setPalette: (id: PaletteId) => void;
    /** False until the client has read storage — same guard next-themes needs. */
    mounted: boolean;
}

const PaletteContext = createContext<PaletteContextValue>({
    palette: DEFAULT_PALETTE,
    setPalette: () => { },
    mounted: false,
});

/**
 * The palette half of the theme.
 *
 * next-themes owns exactly one attribute, so the palette axis needs its own
 * home. This is deliberately the *smaller* half: it writes `data-palette` on
 * <html> and persists the choice, and all the actual colour lives in
 * globals.css. Nothing here knows what blue is.
 *
 * The attribute is already stamped before first paint by the inline script in
 * layout.tsx — this provider adopts that value rather than setting it again, so
 * there is no flash and no double write on hydration.
 *
 * Must be rendered INSIDE ThemeProvider: it reads the resolved mode to keep the
 * status-bar colour in step.
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
    const { resolvedTheme } = useTheme();
    const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
    const [mounted, setMounted] = useState(false);

    // Adopt whatever the head script already stamped. Reading the attribute
    // rather than storage keeps one source of truth and survives the case where
    // storage is unreadable (private mode, storage disabled).
    useEffect(() => {
        const stamped = document.documentElement.getAttribute("data-palette");
        if (isPaletteId(stamped)) setPaletteState(stamped);
        setMounted(true);
    }, []);

    const setPalette = useCallback((id: PaletteId) => {
        setPaletteState(id);
        document.documentElement.setAttribute("data-palette", id);
        try {
            localStorage.setItem(PALETTE_STORAGE_KEY, id);
        } catch {
            /* storage disabled — the choice still applies for this session */
        }
    }, []);

    // Keep the phone's status bar on the rail colour. Both axes feed this, so
    // it re-runs when either the palette or the mode changes.
    useEffect(() => {
        if (!mounted) return;
        const mode = resolvedTheme === "dark" ? "dark" : "light";
        const colour = getPalette(palette).themeColor[mode];
        let meta = document.querySelector<HTMLMetaElement>(
            'meta[name="theme-color"]:not([media])',
        );
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
        }
        meta.content = colour;
    }, [palette, resolvedTheme, mounted]);

    const value = useMemo(
        () => ({ palette, setPalette, mounted }),
        [palette, setPalette, mounted],
    );

    return (
        <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
    );
}

export function usePalette() {
    return useContext(PaletteContext);
}
