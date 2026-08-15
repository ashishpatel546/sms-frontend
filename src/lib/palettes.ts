/**
 * THE PALETTE REGISTRY
 *
 * A palette is the second axis of the theme, independent of light/dark:
 * `data-palette` on <html> alongside `data-theme`. Adding one is a CSS block in
 * globals.css plus an entry here — nothing else in the app should ever need to
 * know a palette's name.
 *
 * The `preview` colours are the one place hex literals are legitimate outside
 * globals.css: the picker paints each palette's miniature in that palette's own
 * colours while a *different* palette is active, so it cannot read them from
 * CSS variables. Keep them in step with the blocks in globals.css by hand.
 */

export type PaletteId = 'ink' | 'assembly';

export const DEFAULT_PALETTE: PaletteId = 'ink';

/** Matches the key next-themes uses for the mode, so the two sit together. */
export const PALETTE_STORAGE_KEY = 'palette';

export interface PaletteDef {
    id: PaletteId;
    /** Shown in the picker. */
    name: string;
    /** One line under the name — what the palette is made of, not how it feels. */
    hint: string;
    /**
     * The phone's status-bar colour, per mode. It is the rail in both, so the
     * chrome above the app continues the app rather than sitting on a seam.
     */
    themeColor: { light: string; dark: string };
    /** A miniature of the shell: rail, page, two ruled lines, three status dots. */
    preview: {
        rail: string;
        canvas: string;
        surface: string;
        ink: string;
        line: string;
        /** brand · settled · act-on-this — the three pigments you actually scan for. */
        dots: [string, string, string];
    };
}

export const PALETTES: readonly PaletteDef[] = [
    {
        id: 'ink',
        name: 'Register & Ink',
        hint: 'Walnut rail, brass brand',
        themeColor: { light: '#362b1f', dark: '#140f09' },
        preview: {
            rail: '#362b1f',
            canvas: '#f2efe9',
            surface: '#ffffff',
            ink: '#211c16',
            line: '#e2ddd3',
            dots: ['#7d4907', '#0e9f6e', '#f5a524'],
        },
    },
    {
        id: 'assembly',
        name: 'Assembly',
        hint: 'White ground, flag pigments',
        themeColor: { light: '#edf2ff', dark: '#050914' },
        preview: {
            rail: '#edf2ff',
            canvas: '#f7f9fd',
            surface: '#ffffff',
            ink: '#12224f',
            line: '#e3e9f5',
            dots: ['#1b389c', '#16873b', '#ff9933'],
        },
    },
] as const;

export function isPaletteId(value: unknown): value is PaletteId {
    return PALETTES.some((p) => p.id === value);
}

export function getPalette(id: PaletteId): PaletteDef {
    return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
