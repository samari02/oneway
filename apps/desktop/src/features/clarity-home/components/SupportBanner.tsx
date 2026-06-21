import { MOCK_SUPPORT_BANNER } from '../mock-data'

export function SupportBanner() {
  return (
    <div className="ch-support-banner" role="note">
      <span className="ch-support-banner__icon" aria-hidden>
        ✨
      </span>
      <p className="ch-support-banner__text">{MOCK_SUPPORT_BANNER}</p>
    </div>
  )
}
