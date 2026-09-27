import React from 'react';

export const metadata = {
  title: 'StrangerLink — Talk to a stranger',
  description: 'Text, audio, or video. No account needed. Report and block built in.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta charSet="utf-8" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#FFFFFF', color: '#111827' }}>
        <a href="#main-content" style={{ position: 'absolute', left: '-9999px' }}>Skip to main content</a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
