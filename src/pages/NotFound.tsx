export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ink px-6 text-center">
      <p className="font-display text-xl text-ivory">This page doesn't exist</p>
      <p className="text-sm text-ivory-dim">Check the link, or tap the card again.</p>
    </div>
  );
}
