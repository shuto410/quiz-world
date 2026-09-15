/** Mode-neutral stage separates the current prompt, content and controls from room operations. */
import { useId, type ReactNode } from 'react';
import './GamePanel.css';

/** A mode supplies presentation slots; this component never interprets game state. */
type GamePanelProps = {
  modeName: string;
  layout?: 'stacked' | 'split';
  highlighted?: boolean;
  prominentTitle?: boolean;
  /** Place supplied content first, with the section heading available to assistive technology. */
  contentPrimary?: boolean;
  phase: string;
  title: string;
  description: string;
  children?: ReactNode;
  controls?: ReactNode;
  supplement?: ReactNode;
};

export function GamePanel({
  modeName,
  layout = 'stacked',
  highlighted = false,
  prominentTitle = false,
  contentPrimary = false,
  phase,
  title,
  description,
  children,
  controls,
  supplement,
}: GamePanelProps) {
  const titleId = useId();
  return (
    <section
      className={`qw-game qw-game--${layout}`}
      data-highlighted={highlighted}
      data-prominent-title={prominentTitle}
      data-content-primary={contentPrimary}
      aria-labelledby={titleId}
    >
      <header className="qw-game__header">
        <span className="qw-game__mode">{modeName}</span>
        <span className="qw-game__phase">{phase}</span>
      </header>
      <div className="qw-game__stage">
        <div className="qw-game__prompt" aria-live="polite" aria-atomic="true">
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
      {controls ? <div className="qw-game__controls">{controls}</div> : null}
      {supplement ? <div className="qw-game__supplement">{supplement}</div> : null}
    </section>
  );
}
