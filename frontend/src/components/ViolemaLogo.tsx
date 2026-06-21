type ViolemaLogoProps = {
  className?: string;
  imageClassName?: string;
};

export default function ViolemaLogo({
  className = '',
  imageClassName = '',
}: ViolemaLogoProps) {
  // Two variants swapped purely by the `.theme-light` scope (CSS in index.css),
  // so the logo always matches its SURFACE: the dark mark on dark surfaces
  // (dashboard, studio) and the violet-tagline mark on the light marketing
  // theme, where a white tagline would vanish on bone.
  return (
    <span className={`violema-logo-electric flex shrink-0 items-center ${className}`} aria-hidden="true">
      <img
        src="/brand/violema-logo-20260510.png"
        alt=""
        className={`violema-logo-dark h-full w-full object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.22)] ${imageClassName}`}
        decoding="async"
      />
      <img
        src="/brand/violema-logo-light.png"
        alt=""
        className={`violema-logo-light h-full w-full object-contain ${imageClassName}`}
        decoding="async"
        loading="lazy"
      />
    </span>
  );
}
