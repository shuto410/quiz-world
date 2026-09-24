/**
 * Brand artwork shared by the entry pages and the room header.
 *
 * `LogoMark` is the simplified buzzer beside the wordmark; `BuzzerArt` is the large decorative
 * buzzer on the entry pages. Both are purely decorative and hidden from assistive technology.
 */
import './BrandArt.css';

export function LogoMark() {
  return (
    <svg className="qw-logo-mark" viewBox="0 0 40 36" aria-hidden="true">
      <ellipse cx="20" cy="23" rx="19" ry="12" className="qw-logo-mark__shade" />
      <ellipse cx="20" cy="18" rx="15" ry="12" className="qw-logo-mark__side" />
      <ellipse cx="20" cy="14" rx="15" ry="12" className="qw-logo-mark__edge" />
      <ellipse cx="20.6" cy="14.6" rx="14.4" ry="11.4" className="qw-logo-mark__top" />
    </svg>
  );
}

/** Decorative buzzer (no label, not pressable) used as an illustration. */
export function BuzzerArt() {
  return (
    <span className="qw-buzzer-art" aria-hidden="true">
      <span className="qw-buzzer-art__plate" />
      <span className="qw-buzzer-art__body">
        <span className="qw-buzzer-art__side" />
        <span className="qw-buzzer-art__edge" />
        <span className="qw-buzzer-art__top" />
      </span>
    </span>
  );
}
