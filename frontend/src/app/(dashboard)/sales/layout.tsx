'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function hideSalesWorkerPaymentBlock() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('section, div, h2, h3, p, span'))

  for (const node of nodes) {
    const text = normalizeText(node.textContent)
    const isSalesWorkerBlock =
      (text.includes('ishchi puli') && text.includes('sotuv')) ||
      text.includes("sanalar bo'yicha ishchi puli") ||
      text.includes('sanalar bo‘yicha ishchi puli')

    if (!isSalesWorkerBlock) continue

    let target: HTMLElement = node
    for (let i = 0; i < 5; i += 1) {
      const parent = target.parentElement
      if (!parent) break

      const parentText = normalizeText(parent.textContent)
      if (parentText.includes('jami sotuvlar') && parentText.includes("sotuv qo")) break
      target = parent
    }

    target.style.display = 'none'
  }
}

export default function SalesLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    hideSalesWorkerPaymentBlock()

    const observer = new MutationObserver(() => {
      hideSalesWorkerPaymentBlock()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return children
}
