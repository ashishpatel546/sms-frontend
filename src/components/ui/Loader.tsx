import { Loader2 } from "lucide-react";

interface LoaderProps {
    text?: string;
    fullScreen?: boolean;
}

export function Loader({ text = "Loading...", fullScreen = false }: LoaderProps) {
    const content = (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-slate-500">{text}</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] w-full">
                {content}
            </div>
        );
    }

    return (
        <div className="flex justify-center w-full my-8">
            {content}
        </div>
    );
}
