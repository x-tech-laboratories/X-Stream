import '@testing-library/jest-dom'
import { vi } from 'vitest'

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

// Stands in for the native popover, modal dialog and IntersectionObserver, which jsdom lacks.
if (typeof window !== 'undefined') {
  HTMLElement.prototype.showPopover = function (this: HTMLElement) { this.setAttribute('data-shown', '') }
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    this.removeAttribute('data-shown')
    this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }))
  }
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  // jsdom hides every popover, since none matches :popover-open, so a shown one is drawn again here.
  const shown_popovers = document.createElement('style')
  shown_popovers.textContent = '[popover][data-shown] { display: block !important; }'
  document.head.append(shown_popovers)
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
}
