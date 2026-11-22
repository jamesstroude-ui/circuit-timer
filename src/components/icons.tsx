// Simple icons as inline SVG (no icon font, works offline). They use the text colour.

export function IconBack() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="currentColor">
      <rect x="4" y="5" width="3" height="14" rx="1" />
      <path d="M20 5v14L8.5 12z" />
    </svg>
  );
}

export function IconForward() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="currentColor">
      <rect x="17" y="5" width="3" height="14" rx="1" />
      <path d="M4 5v14l11.5-7z" />
    </svg>
  );
}
