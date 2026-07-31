import type { Dealer } from "@/lib/types";

type DealerMapProps = {
  dealers: Dealer[];
  selectedId?: string;
  onSelect?: (dealer: Dealer) => void;
  compact?: boolean;
};

export function DealerMap({
  dealers,
  selectedId,
  onSelect,
  compact = false,
}: DealerMapProps) {
  const selected =
    dealers.find((dealer) => dealer.id === selectedId) ?? dealers[0];

  return (
    <div
      className={`demo-map interactive-map ${compact ? "compact-map" : ""}`}
      aria-label="Temsili satış noktası haritası"
    >
      <div className="road road-one" aria-hidden="true" />
      <div className="road road-two" aria-hidden="true" />
      {dealers.map((dealer) => (
        <button
          type="button"
          className={`map-pin map-pin-button ${
            dealer.id === selected?.id ? "selected" : ""
          }`}
          style={{ left: `${dealer.mapX}%`, top: `${dealer.mapY}%` }}
          key={dealer.id}
          aria-label={`${dealer.name} satış noktasını seç`}
          onClick={() => onSelect?.(dealer)}
        >
          <span aria-hidden="true">M</span>
        </button>
      ))}
      {selected && !compact && (
        <div className="map-card">
          <strong>{selected.name}</strong>
          <span>
            {selected.district} · {selected.distance}
          </span>
          <small>{selected.hours}</small>
        </div>
      )}
    </div>
  );
}
