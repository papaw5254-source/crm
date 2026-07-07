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
                const norm = (value) => (value || '').toLowerCase().replace(/\\s+/g, ' ').trim();

                const hideSalesWorkerBlock = () => {
                  if (!location.pathname.includes('/sales')) return;

                  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,p,span'));
                  const heading = headings.find((node) => {
                    const text = norm(node.textContent);
                    return text.includes('ishchi puli') && text.includes('sotuv');
                  });

                  if (!heading) return;

                  let target = heading;
                  for (let i = 0; i < 3; i += 1) {
                    if (!target.parentElement) break;
                    const parentText = norm(target.parentElement.textContent);
                    if (parentText.includes('jami sotuvlar') || parentText.includes("sotuv qo")) break;
                    target = target.parentElement;
                  }

                  if (target && target instanceof HTMLElement) {
                    target.style.display = 'none';
                  }
                };

                hideSalesWorkerBlock();
                new MutationObserver(hideSalesWorkerBlock).observe(document.documentElement, {
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
