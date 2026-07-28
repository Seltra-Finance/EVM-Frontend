import Image from "next/image";

// Official Avalanche mark, saved locally at public/brand/avalanche-mark.svg
// (sourced from avax.network, never hotlinked, never redrawn). Referenced via
// next/image rather than inlined so its internal element ids never collide if
// this chip renders more than once on a page.
export function AvalancheChip() {
  return (
    <span className="network-chip" role="img" aria-label="Network: Avalanche">
      <Image src="/brand/avalanche-mark.svg" alt="" width={11} height={11} aria-hidden="true" unoptimized />
      Avalanche
    </span>
  );
}
