import { useId } from "react";

const F_PATH = "M34 6h24a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H43v10h11a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H43v22a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z";
const RING_PATH = "M24 15.5a20.5 20.5 0 1 1 0 41a20.5 20.5 0 1 1 0-41zM24 24.5a11.5 11.5 0 1 0 0 23a11.5 11.5 0 1 0 0-23z";

export function LogoMark({ size = 28 }: { size?: number }) {
  const clip = useId();

  return (
    <svg className="logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path fillRule="evenodd" d={RING_PATH} />
        </clipPath>
      </defs>
      <path fillRule="evenodd" d={RING_PATH} fill="var(--brand-o)" />
      <path d={F_PATH} fill="var(--brand-f)" />
      <path d={F_PATH} fill="var(--brand-mix)" clipPath={`url(#${clip})`} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="logo">
      <LogoMark size={size} />
      <span className="logo-word">
        offer<b>flow</b>
      </span>
    </div>
  );
}
