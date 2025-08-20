import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Map to CSV',
    description: 'Search places, view on map, export CSV',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen antialiased">{children}</body>
        </html>
    );
}
