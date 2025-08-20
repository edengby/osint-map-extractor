import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Map to CSV',
    description: 'Search visible map area and export CSV of what you see',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-sm text-slate-600">
            <div className="mx-auto max-w-7xl px-6">
                Need help? Contact{' '}
                <a
                    href="mailto:osinthelpil@gmail.com"
                    className="text-blue-600 underline"
                >
                    osinthelpil@gmail.com
                </a>
            </div>
        </footer>
        </body>
        </html>
    );
}
