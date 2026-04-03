import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Colegios',
        short_name: 'Colegios',
        description: 'A comprehensive school management system powered by Colegios.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1e3a5f',
        theme_color: '#1e3a5f',
        orientation: 'portrait-primary',
        scope: '/',
        lang: 'en',
        categories: ['education', 'productivity'],
        // App icon — uses the Colegios logo from /public/colegios/logo.png
        icons: [
            { src: '/colegios/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/colegios/logo.png', sizes: '512x512', type: 'image/png' },
            { src: '/colegios/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            {
                name: 'Dashboard',
                url: '/dashboard',
                description: 'Go to the admin dashboard',
                icons: [{ src: '/colegios/logo.png', sizes: '192x192' }],
            },
            {
                name: 'Parent Portal',
                url: '/parent-dashboard',
                description: 'Go to the parent portal',
                icons: [{ src: '/colegios/logo.png', sizes: '192x192' }],
            },
        ],
    };
}
