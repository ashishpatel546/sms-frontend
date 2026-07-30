import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   INDETERMINATE WAITS

   Prefer a skeleton (see Skeletons.tsx) whenever the shape of what is coming
   is known — it holds the layout still and reads as "your page, arriving".

   Reach for a spinner only when the shape genuinely is not known yet, or when
   the wait belongs to an action rather than a region: a submitting button, a
   modal fetching one record, a re-validating filter.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * An inline spinner sized to the text beside it. `currentColor`, so it takes
 * the colour of whatever it sits in — a brass button, a danger link — instead
 * of pinning a colour of its own.
 */
export function Spinner({ className }: { className?: string }) {
    return (
        <Loader2
            aria-hidden
            className={cn("size-4 shrink-0 animate-spin text-current", className)}
        />
    );
}

interface LoaderProps {
    text?: string;
    fullScreen?: boolean;
}

/**
 * A centred spinner with a caption, for a region that is waiting.
 *
 * The colours are brand tokens rather than the `blue-600`/`slate-500` this
 * used to hardcode. Those only looked right because the legacy bridge in
 * globals.css was quietly remapping them; a component this widely used should
 * not depend on that.
 */
export function Loader({ text = "Loading…", fullScreen = false }: LoaderProps) {
    const content = (
        <div
            role="status"
            className="flex flex-col items-center justify-center space-y-3 p-8"
        >
            <Loader2 className="size-7 animate-spin text-brand" aria-hidden />
            <span className="text-[13px] font-medium text-ink-muted">{text}</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="flex min-h-[50vh] w-full items-center justify-center">
                {content}
            </div>
        );
    }

    return <div className="my-8 flex w-full justify-center">{content}</div>;
}
