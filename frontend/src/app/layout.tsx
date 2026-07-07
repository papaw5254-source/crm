import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/providers'

export const metadata: Metadata = {
  title: "G'isht Zavodi CRM",
  description: 'Brick Factory Customer Relationship Management System',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const hideSalesWorkerPayment = () => {
                  if (!location.pathname.includes('/sales')) return;
                  const nodes = Array.from(document.querySelectorAll('section, div'));
                  const target = nodes.find((node) =>
                    node.textContent &&
                    node.textContent.includes('ISHCHI PULI (SOTUV)') &&
                    node.textContent.includes("Eski qarz")
                  );
                  if (target instanceof HTMLElement) {
                    target.style.display = 'none';
                  }
                };
                hideSalesWorkerPayment();
                setInterval(hideSalesWorkerPayment, 500);
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
