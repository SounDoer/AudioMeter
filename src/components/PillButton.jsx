export function PillButton({ children, accent = false, liveSnap = false, onClick }) {
  const cls = [
    "ui-pill",
    accent ? "ui-pill-accent" : "ui-pill-default",
    accent && liveSnap ? "ui-pill-live-snap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
