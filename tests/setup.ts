import '@testing-library/jest-dom'
import { vi } from 'vitest'

// X-Libs' popover and dialog stubs need a document; Node tests have no window.
if (typeof window !== 'undefined') await import('@x-tech-laboratories/x-libs/web/react/test_stubs')

// jsdom does not implement matchMedia — provide a default stub; Node tests have no window.
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Stands in for IntersectionObserver and scrolling, which jsdom lacks.
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
}
