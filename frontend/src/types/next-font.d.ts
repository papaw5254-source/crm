export {}

declare module 'next/font/google' {
  interface NextFontResult {
    className: string
    style: { fontFamily: string; fontStyle?: string }
    variable: string
  }
  export function Inter(options?: {
    subsets?: string[]
    variable?: string
    display?: string
    preload?: boolean
    weight?: string | string[]
    style?: string | string[]
    axes?: string[]
    adjustFontFallback?: boolean
  }): NextFontResult
}
