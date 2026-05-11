type ViolemaLogoProps = {
  className?: string;
  imageClassName?: string;
};

export default function ViolemaLogo({
  className = '',
  imageClassName = '',
}: ViolemaLogoProps) {
  return (
    <span className={`violema-logo-electric flex shrink-0 items-center ${className}`} aria-hidden="true">
      <img
        src="/brand/violema-logo-20260510.png"
        alt=""
        className={`h-full w-full object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.22)] ${imageClassName}`}
        decoding="async"
      />
    </span>
  );
}
