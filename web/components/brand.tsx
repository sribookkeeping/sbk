// Brand mark: indigo rounded tile with a bold $ — matches the app icons.
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[26%] bg-indigo-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.56 }}
      aria-hidden
    >
      $
    </span>
  );
}

export function BrandLockup({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="font-bold tracking-tight">SriBookKeeping</span>
    </span>
  );
}
