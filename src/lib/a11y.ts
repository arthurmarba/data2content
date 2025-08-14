import { useEffect, useRef } from 'react'

export function useEscapeToClose(onClose?: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function useReturnFocus<T extends HTMLElement>() {
  const lastFocused = useRef<HTMLElement | null>(null)
  function remember() { lastFocused.current = document.activeElement as HTMLElement }
  function restore() { lastFocused.current?.focus?.() }
  return { remember, restore }
}

/** Focus trap simples: move tab do fim para o início e vice-versa */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')
      ).filter(x =>
        !x.hasAttribute('disabled') &&
        x.getAttribute('aria-hidden') !== 'true'
      )

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const nodes = focusables()
      if (nodes.length === 0) return

      // após o guard acima, é seguro usar non-null assertion
      const first = nodes[0]!
      const last  = nodes[nodes.length - 1]!

      if (e.shiftKey && document.activeElement === first) {
        last.focus()
        e.preventDefault()
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus()
        e.preventDefault()
      }
    }

    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [containerRef])
}
