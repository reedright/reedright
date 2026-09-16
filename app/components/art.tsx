// Traced ink illustrations (Midjourney, potrace), served from public/art as <symbol>s and drawn through <use>
// so they take currentColor and follow dark mode without living in the JS bundle. Rules: docs/positioning.md §13.
const boxes = {
  band: "0 0 1436 535",
  stalk: "0 0 575 1003",
  reeds: "0 0 2394 300",
} as const;

export function Art({ name, className = "", preserveAspectRatio }: { name: keyof typeof boxes; className?: string; preserveAspectRatio?: string }) {
  return (
    <svg viewBox={boxes[name]} preserveAspectRatio={preserveAspectRatio} className={className} aria-hidden="true" focusable="false">
      <use href={`/art/${name}.svg#art`} />
    </svg>
  );
}
