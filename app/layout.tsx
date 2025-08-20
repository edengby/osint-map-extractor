import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Map to CSV',
    description: 'Search visible map area and export CSV of what you see',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen">{children}</body>
        </html>
    );
}
