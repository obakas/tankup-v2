import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Clock3, Navigation, UserRound } from "lucide-react";

type MarkerData = {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  kind: "driver" | "customer" | "next_stop";
  description?: string | null;
};

interface LiveDeliveryMapProps {
  title?: string;
  subtitle?: string;
  driver?: MarkerData | null;
  customer?: MarkerData | null;
  nextStop?: MarkerData | null;
  lastUpdatedAt?: string | null;
  heightClassName?: string;
}

function markerStyle(kind: MarkerData["kind"]) {
  switch (kind) {
    case "driver":
      return {
        radius: 10,
        pathOptions: { color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.9, weight: 2 },
      };
    case "customer":
      return {
        radius: 10,
        pathOptions: { color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.9, weight: 2 },
      };
    default:
      return {
        radius: 8,
        pathOptions: { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.85, weight: 2 },
      };
  }
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useMemo(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);

  return null;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "No location update yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Updated ${date.toLocaleTimeString()}`;
}

function renderMarker(marker: MarkerData) {
  if (
    marker.latitude === null ||
    marker.latitude === undefined ||
    marker.longitude === null ||
    marker.longitude === undefined
  ) {
    return null;
  }

  const center: LatLngExpression = [marker.latitude, marker.longitude];
  const style = markerStyle(marker.kind);

  return (
    <CircleMarker key={`${marker.kind}-${marker.label}`} center={center} {...style}>
      <Popup>
        <div className="space-y-1">
          <p className="font-semibold">{marker.label}</p>
          {marker.description ? <p className="text-sm">{marker.description}</p> : null}
          <p className="text-xs text-muted-foreground">
            {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
          </p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function LiveDeliveryMap({
  title = "Live delivery map",
  subtitle,
  driver,
  customer,
  nextStop,
  lastUpdatedAt,
  heightClassName = "h-72",
}: LiveDeliveryMapProps) {
  const markers = [driver, customer, nextStop].filter(Boolean) as MarkerData[];

  const validPoints = markers
    .filter(
      (marker) =>
        marker.latitude !== null &&
        marker.latitude !== undefined &&
        marker.longitude !== null &&
        marker.longitude !== undefined
    )
    .map((marker) => [marker.latitude as number, marker.longitude as number] as [number, number]);

  const routeLine = validPoints.length >= 2 ? validPoints.slice(0, 2) : [];
  const hasMapData = validPoints.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {formatUpdatedAt(lastUpdatedAt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {driver ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-700 dark:text-blue-300">
              <Navigation className="h-3.5 w-3.5" />
              Driver
            </span>
          ) : null}
          {customer ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
              <UserRound className="h-3.5 w-3.5" />
              Customer
            </span>
          ) : null}
          {nextStop ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
              <Navigation className="h-3.5 w-3.5" />
              Next stop
            </span>
          ) : null}
        </div>
      </div>

      <div className={heightClassName}>
        {hasMapData ? (
          <MapContainer
            center={validPoints[0]}
            zoom={13}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={validPoints} />
            {routeLine.length === 2 ? (
              <Polyline positions={routeLine} pathOptions={{ color: "#64748b", weight: 4, opacity: 0.8 }} />
            ) : null}
            {markers.map(renderMarker)}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/30 p-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">Map is waiting for coordinates.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Once the app has both delivery coordinates and live tanker location, the map will wake up.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
