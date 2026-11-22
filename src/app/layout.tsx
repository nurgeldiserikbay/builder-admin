import type { Metadata } from 'next';
import '@fontsource-variable/onest';
import './globals.css';
import { WakeApi } from './wake-api';

export const metadata: Metadata = {
  title: 'BuildPath Admin',
  description: 'Internal administration console for BuildPath.',
};

/** The API's public health address, for waking it from the browser; only an https address is passed. */
function wakeUrl(): string | null {
  const raw = process.env.API_INTERNAL_URL?.trim().replace(/\/$/, '');
  return raw && /^https:\/\//.test(raw) ? `${raw}/api/v1/health` : null;
}

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WakeApi url={wakeUrl()} />{children}</body>
    </html>
  );
}
