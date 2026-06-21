import { MOCK_FOOTER_BANNER } from '../mock-data'

export function FooterBanner() {
  return (
    <footer className="ch-footer-banner">
      <span className="ch-footer-banner__icon" aria-hidden>
        ♥
      </span>
      <p className="ch-footer-banner__text">{MOCK_FOOTER_BANNER}</p>
      <div className="ch-footer-banner__scene" aria-hidden />
    </footer>
  )
}
