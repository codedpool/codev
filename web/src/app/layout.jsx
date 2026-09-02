import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';
import Providers from './providers';

export const metadata = {
  title: { default: 'Codev', template: '%s · Codev' },
  description: 'Codev — a collaborative browser IDE with an AI pair programmer.',
};

export const viewport = { themeColor: '#0a0b0e', colorScheme: 'dark' };

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: '#c8f04a', colorBackground: '#161920', colorText: '#e8eaef', colorInputBackground: '#0d0f13', borderRadius: '6px', fontFamily: 'Inter Variable, Inter, system-ui, sans-serif' },
        elements: { card: { boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' } },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
