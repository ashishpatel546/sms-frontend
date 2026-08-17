import type { PaletteDef } from "@/lib/palettes";

/**
 * A miniature of the app shell, painted in one palette's colours.
 *
 * The point is that it shows a palette *other* than the one currently applied —
 * so every colour here is an inline literal from the registry rather than a
 * token. It is the only component in the app that is allowed to do that.
 *
 * What it draws is the actual composition you are choosing between: the rail
 * against the canvas, a card on that canvas, a line of type, and the three
 * pigments you scan a school screen for — brand, settled, act-on-this. A row of
 * colour circles would show the same hex values and tell you nothing about how
 * they sit together.
 */
export function PalettePreview({
    palette,
    className,
}: {
    palette: PaletteDef;
    className?: string;
}) {
    const { rail, canvas, surface, ink, line, dots } = palette.preview;

    return (
        <span
            aria-hidden
            className={[
                "grid shrink-0 overflow-hidden rounded-md border",
                className ?? "h-10 w-14",
            ].join(" ")}
            style={{
                gridTemplateColumns: "13px 1fr",
                background: canvas,
                borderColor: line,
            }}
        >
            {/* The rail */}
            <span style={{ background: rail }} />

            {/* The work beside it: a card on the canvas, two ruled lines, and
                the three pigments. The card is what shows whether surface and
                canvas actually separate — the thing a flat swatch can't say. */}
            <span className="flex flex-col p-0.75">
                <span
                    className="flex flex-1 flex-col gap-0.75 rounded-[3px] p-0.75"
                    style={{ background: surface, border: `1px solid ${line}` }}
                >
                    <span
                        className="block h-[2.5px] w-[65%] rounded-full"
                        style={{ background: ink }}
                    />
                    <span
                        className="block h-[2.5px] w-[90%] rounded-full"
                        style={{ background: line }}
                    />
                    <span className="mt-auto flex gap-0.5">
                        {dots.map((dot) => (
                            <span
                                key={dot}
                                className="block size-1 rounded-full"
                                style={{ background: dot }}
                            />
                        ))}
                    </span>
                </span>
            </span>
        </span>
    );
}
