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
                const hideSalesWorkerColumn = () => {
                  if (!location.pathname.includes('/sales')) return;
                  document.querySelectorAll('[data-sales-worker-column="true"]').forEach((marker) => {
                    const th = marker.closest('th');
                    const table = marker.closest('table');
                    if (!th || !table) return;
                    const index = Array.from(th.parentElement.children).indexOf(th);
                    if (index < 0) return;
                    table.querySelectorAll('tr').forEach((row) => {
                      const cell = row.children[index];
                      if (cell instanceof HTMLElement) cell.style.display = 'none';
                    });
                  });
                };
                hideSalesWorkerColumn();
                new MutationObserver(hideSalesWorkerColumn).observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
