'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download, Share } from 'lucide-react';
import { getEnv } from "@/lib/env";

const schoolName = getEnv('SCHOOL_NAME') || 'School Management System';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallBanner() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [showMiniButton, setShowMiniButton] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isEdgeFallback, setIsEdgeFallback] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    // Ref so async callbacks always see the live "prompt received" state without stale closures
    const installPromptReceived = useRef(false);

    useEffect(() => {
        // Suppress banner on desktop/laptop — the browser URL bar install icon is sufficient there
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }

        // Skip if already installed as PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // ── Dismissal check FIRST, before any timeout is scheduled ──────────────
        // This prevents the async setTimeout from overriding a prior dismissal.
        const dismissed = localStorage.getItem('pwa-banner-dismissed');
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const recentlyDismissed = !!dismissed && (Date.now() - parseInt(dismissed, 10) < sevenDays);

        const isIOSDevice =
            /iPad|iPhone|iPod/.test(navigator.userAgent) &&
            !(window as unknown as { MSStream: unknown }).MSStream;
        setIsIOS(isIOSDevice);

        // iOS: no beforeinstallprompt — show static "Add to Home Screen" instructions
        if (isIOSDevice) {
            if (!recentlyDismissed) {
                setTimeout(() => setShowBanner(true), 3000);
            }
            return; // no further event handlers needed for iOS
        }

        // ── beforeinstallprompt handler (Chrome, Edge, Samsung Internet, Firefox) ──
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            installPromptReceived.current = true;
            // Clear the Edge fallback timer if it hasn't fired yet
            if (edgeTimeoutId) clearTimeout(edgeTimeoutId);
            setInstallPrompt(e as BeforeInstallPromptEvent);
            if (!recentlyDismissed) {
                setTimeout(() => setShowBanner(true), 3000);
            } else {
                // Banner suppressed by recent dismissal, but keep prompt for mini-button
                setShowMiniButton(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // ── Edge / other Chromium-based browser fallback ─────────────────────────
        //
        // Edge on Android uses stricter engagement heuristics than Chrome and may
        // never fire beforeinstallprompt on a first visit. After 5 seconds, if the
        // event still hasn't arrived, we show manual install instructions specific
        // to the detected browser so the user is never left without guidance.
        let edgeTimeoutId: ReturnType<typeof setTimeout> | null = null;

        if (!recentlyDismissed) {
            const ua = navigator.userAgent;
            const isEdge = /Edg\//.test(ua);
            // Samsung Internet, Firefox for Android, etc. also may not fire the event
            const isOtherBrowser = !isEdge && !/Chrome\//.test(ua);

            if (isEdge || isOtherBrowser) {
                edgeTimeoutId = setTimeout(() => {
                    if (!installPromptReceived.current) {
                        setIsEdgeFallback(true);
                        setShowBanner(true);
                    }
                }, 5000);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            if (edgeTimeoutId) clearTimeout(edgeTimeoutId);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
            setShowMiniButton(false);
            setInstallPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
        // If a native install prompt is still available, surface a persistent mini-button
        // so the user can still install later without having to know about the address-bar icon.
        if (installPrompt) {
            setShowMiniButton(true);
        }
    };

    if (isInstalled) return null;

    // ── Mini install button — shown after the main banner is dismissed ──────────
    if (!showBanner && showMiniButton && installPrompt) {
        return (
            <button
                onClick={handleInstallClick}
                title={`Install ${schoolName}`}
                style={{
                    position: 'fixed',
                    bottom: '1.25rem',
                    right: '1.25rem',
                    zIndex: 9999,
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(30, 58, 95, 0.45)',
                    color: 'white',
                }}
                aria-label={`Install ${schoolName}`}
            >
                <Download size={20} />
            </button>
        );
    }

    if (!showBanner) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                width: 'calc(100% - 2rem)',
                maxWidth: '480px',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(30, 58, 95, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'slideUp 0.4s ease-out',
                color: 'white',
            }}
        >
            <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

            {/* App Icon */}
            <img
                src={'/colegios/logo.png'}
                alt={schoolName}
                style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0 }}
            />

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>
                    Install {schoolName}
                </p>
                {isIOS ? (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.85, lineHeight: 1.4 }}>
                        Tap <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> then &ldquo;Add to Home Screen&rdquo;
                    </p>
                ) : isEdgeFallback ? (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.85, lineHeight: 1.4 }}>
                        Tap <span style={{ fontWeight: 700 }}>⋯</span> menu &rarr; &ldquo;Add to phone&rdquo; to install
                    </p>
                ) : (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.85 }}>
                        Install app for quick access, offline support
                    </p>
                )}
            </div>

            {/* Install button (only on non-iOS where we have the prompt) */}
            {!isIOS && installPrompt && (
                <button
                    onClick={handleInstallClick}
                    style={{
                        background: 'white',
                        color: '#1e3a5f',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <Download size={14} />
                    Install
                </button>
            )}

            {/* Dismiss */}
            <button
                onClick={handleDismiss}
                style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    flexShrink: 0,
                }}
                aria-label="Dismiss install banner"
            >
                <X size={16} />
            </button>
        </div>
    );
}
