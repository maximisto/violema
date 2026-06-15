import { brandMarks } from '../content/brandMarks';

function Mark({ name, path, dup = false }: { name: string; path: string; dup?: boolean }) {
  return (
    <div
      className={`group flex flex-none items-center gap-2.5 text-[#828ea4] transition-colors duration-300 hover:text-white ${dup ? 'marquee-dup' : ''}`}
      aria-hidden={dup || undefined}
    >
      <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem] flex-none" fill="currentColor">
        <path d={path} />
      </svg>
      <span className="whitespace-nowrap text-[1.02rem] font-semibold tracking-[-0.02em]">{name}</span>
    </div>
  );
}

export default function BrandMarquee() {
  return (
    <div className="systems-rail relative overflow-hidden py-1">
      <div className="systems-track flex w-max items-center gap-11 pr-11">
        {brandMarks.map((mark) => (
          <Mark key={mark.name} name={mark.name} path={mark.path} />
        ))}
        {brandMarks.map((mark) => (
          <Mark key={`dup-${mark.name}`} name={mark.name} path={mark.path} dup />
        ))}
      </div>
    </div>
  );
}
