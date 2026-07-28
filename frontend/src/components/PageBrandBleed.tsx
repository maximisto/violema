import { useLocation } from 'react-router-dom';

/* Marketing-only mark: the product surface stays clean. */
const PRODUCT_ROUTE_PREFIXES = ['/dashboard', '/dashboard-preview', '/admin', '/settings', '/connect', '/plans'];

export default function PageBrandBleed() {
  const { pathname } = useLocation();
  const isProductSurface = PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProductSurface) return null;
  return (
    <img
      className="page-brand-bleed"
      src="/brand/po-half-logo.png"
      alt=""
      aria-hidden="true"
      width={206}
      height={430}
      decoding="async"
      draggable={false}
    />
  );
}
