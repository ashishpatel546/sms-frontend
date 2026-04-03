'use client';

import { useState, useEffect } from 'react';
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
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Suppress banner on desktop/laptop — the browser URL bar install icon is sufficient there
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return;
        }

        // Check if already installed as PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Check if iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream;
        setIsIOS(isIOSDevice);

        // Listen for Android/Desktop install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
            // Show banner after a small delay (better UX)
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // On iOS, show banner if not in standalone mode
        if (isIOSDevice) {
            setTimeout(() => setShowBanner(true), 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
            setInstallPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        // Don't show again for 7 days
        localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
    };

    // Check if dismissed recently
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-banner-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed, 10);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedTime < sevenDays) {
                setShowBanner(false);
            }
        }
    }, []);

    if (isInstalled || !showBanner) return null;

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
