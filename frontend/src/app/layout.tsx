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
                const clean = (value) => (value || '').toLowerCase().replace(/\\s+/g, ' ').trim();
                const hidden = new WeakSet();

                const hideNode = (node) => {
                  if (node instanceof HTMLElement && !hidden.has(node)) {
                    node.style.display = 'none';
                    hidden.add(node);
                  }
                };

                const hideSalesWorkerBlock = () => {
                  if (!location.pathname.includes('/sales')) return;

                  const all = Array.from(document.querySelectorAll('body *'));
                  const title = all.find((node) => {
                    const text = clean(node.textContent);
                    const ownChildText = Array.from(node.children || [])
                      .map((child) => clean(child.textContent))
                      .join(' ');

                    return text.includes('ishchi puli') &&
                      text.includes('sotuv') &&
                      !ownChildText.includes('jami sotuvlar') &&
                      !ownChildText.includes("sotuv qo'shish");
                  });

                  if (!(title instanceof HTMLElement)) return;

                  const headerRow = title.closest('div') || title;
                  hideNode(headerRow);

                  let cursor = headerRow.nextElementSibling;
                  let hiddenSiblings = 0;

                  while (cursor instanceof HTMLElement && hiddenSiblings < 3) {
                    const text = clean(cursor.textContent);
                    const looksLikeWorker =
                      text.includes('bu oy hisoblandi') ||
                      text.includes('berildi') ||
                      text.includes('oldingi qarz') ||
                      text.includes('jami qarz') ||
                      text.includes("sanalar bo'yicha ishchi puli") ||
                      text.includes('sanalar bo‘yicha ishchi puli') ||
                      text.includes('hali ishchi puli');

                    if (!looksLikeWorker) break;

                    const next = cursor.nextElementSibling;
                    hideNode(cursor);
                    cursor = next;
                    hiddenSiblings += 1;
                  }
                };

                hideSalesWorkerBlock();
                new MutationObserver(hideSalesWorkerBlock).observe(document.body, {
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
