type Props = Record<string, any>
export function track(name: string, props?: Props) {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', name, props || {})
    } else {
      if (process.env.NODE_ENV !== 'production') console.debug('[track]', name, props || {})
    }
  } catch {
    /* noop */
  }
}
