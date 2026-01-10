import './StepWelcome.css'

interface StepWelcomeProps {
  onNext: () => void
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="step-welcome">
      <div className="step-welcome__header">
        <span className="step-welcome__logo">💧</span>
        <h1>Clarity</h1>
      </div>

      <div className="step-welcome__story">
        <p className="step-welcome__intro">
          On passe des heures sur nos écrans sans s'en rendre compte.
        </p>
        
        <p className="step-welcome__problem">
          On scroll. On refresh. On se dit "encore 5 minutes"... et une heure passe.
          <br />
          On sait qu'on veut mieux. Mais on dérive, encore et encore.
        </p>

        <p className="step-welcome__solution">
          <strong>Clarity</strong> t'aide à y voir clair.
        </p>

        <p className="step-welcome__how">
          Pas en te surveillant. Pas en te culpabilisant.
          <br />
          Juste en t'éclairant le chemin que <em>tu</em> veux suivre.
        </p>
      </div>

      <div className="step-welcome__principles">
        <div className="step-welcome__principle">
          <span className="step-welcome__icon">✨</span>
          <span>Simple — zéro prise de tête</span>
        </div>
        <div className="step-welcome__principle">
          <span className="step-welcome__icon">💚</span>
          <span>Bienveillant — jamais de culpabilité</span>
        </div>
        <div className="step-welcome__principle">
          <span className="step-welcome__icon">🧭</span>
          <span>Guide — ton copilote, pas ton surveillant</span>
        </div>
      </div>

      <button className="step-welcome__cta" onClick={onNext}>
        Commencer →
      </button>
    </div>
  )
}
