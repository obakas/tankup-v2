import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { ExternalLink, MapPin } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

// Lazy require — isolated so a missing / incompatible native module doesn't
// crash the importing file. If it fails, every exported component falls back.
let NativeMapView: any = null;
let NativeMarker: any = null;
let NativePolyline: any = null;
let mapsAvailable = false;

try {
  const M = require("react-native-maps");
  NativeMapView = M.default;
  NativeMarker = M.Marker;
  NativePolyline = M.Polyline;
  mapsAvailable = true;
} catch {
  // Native module unavailable — all renders will show the fallback instead.
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Coord = { lat: number; lon: number; label?: string; pinColor?: string };

type MapProps = {
  driver: Coord;
  customer?: Coord | null;
  height?: number;
  showPolyline?: boolean;
  navigateTo?: Coord;
};

export type MultiMarker = {
  id: string | number;
  lat: number;
  lon: number;
  title: string;
  description?: string;
  pinColor?: string;
};

type MultiProps = {
  markers: MultiMarker[];
  initialLat?: number;
  initialLon?: number;
  height?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function openInMaps(lat: number, lon: number, label?: string) {
  const encoded = encodeURIComponent(label ?? "Location");
  const url =
    Platform.OS === "ios"
      ? `maps://?ll=${lat},${lon}&q=${encoded}`
      : `geo:${lat},${lon}?q=${lat},${lon}(${encoded})`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://maps.google.com/maps?q=${lat},${lon}`)
  );
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function distanceLabel(a: Coord, b: Coord): string {
  const km = haversineKm(a, b);
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

// ── Fallback UI ───────────────────────────────────────────────────────────────

function MapFallback({ driver, customer, navigateTo, theme }: MapProps & { theme: any }) {
  const navTarget = navigateTo ?? driver;
  return (
    <View
      className="rounded-2xl p-4 gap-3"
      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
    >
      <View className="flex-row items-center gap-2">
        <MapPin color={theme.mutedForeground} size={14} />
        <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>
          Live tracking
        </Text>
        {customer && (
          <Text className="text-xs ml-auto" style={{ color: theme.mutedForeground }}>
            {distanceLabel(driver, customer)}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => openInMaps(navTarget.lat, navTarget.lon, navTarget.label)}
        className="flex-row items-center justify-center gap-2 rounded-xl py-2"
        style={{ borderWidth: 1, borderColor: theme.border }}
      >
        <ExternalLink color={theme.primary} size={14} />
        <Text className="text-sm font-medium" style={{ color: theme.primary }}>
          {navigateTo ? "Navigate to stop" : "View in Maps"}
        </Text>
      </Pressable>
    </View>
  );
}

function MultiMapFallback({ markers, theme }: MultiProps & { theme: any }) {
  const located = markers.filter((m) => m.lat != null && m.lon != null);
  if (located.length === 0) {
    return (
      <Text className="text-sm text-center py-4" style={{ color: theme.mutedForeground }}>
        No tanker locations available.
      </Text>
    );
  }
  return (
    <View className="gap-2">
      {located.slice(0, 8).map((m) => (
        <View
          key={m.id}
          className="flex-row items-center gap-3 rounded-xl p-3"
          style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <View
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: m.pinColor ?? theme.primary }}
          />
          <View className="flex-1">
            <Text className="text-sm font-semibold" style={{ color: theme.foreground }}>
              {m.title}
            </Text>
            {m.description && (
              <Text className="text-xs capitalize" style={{ color: theme.mutedForeground }}>
                {m.description}
              </Text>
            )}
          </View>
          <Pressable onPress={() => openInMaps(m.lat, m.lon, m.title)}>
            <ExternalLink color={theme.primary} size={16} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ── Native map content (functional so hooks work inside error boundary) ────────

function MapContent({ driver, customer, height, showPolyline, navigateTo, theme }: MapProps & { theme: any }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const mapRef = useRef<any>(null);
  if (!ready) return <View style={{ height: height ?? 220, borderRadius: 16, borderWidth: 1, borderColor: theme.border }} />;
  const coords = [
    { latitude: driver.lat, longitude: driver.lon },
    ...(customer ? [{ latitude: customer.lat, longitude: customer.lon }] : []),
  ];
  const navTarget = navigateTo ?? (customer ?? driver);

  return (
    <View className="gap-2">
      <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
        <NativeMapView
          ref={mapRef}
          style={{ height: height ?? 220 }}
          scrollEnabled={false}
          onMapReady={() => {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
              animated: false,
            });
          }}
        >
          <NativeMarker
            coordinate={{ latitude: driver.lat, longitude: driver.lon }}
            title={driver.label ?? "Tanker"}
            pinColor={driver.pinColor ?? "#2563eb"}
          />
          {customer && (
            <NativeMarker
              coordinate={{ latitude: customer.lat, longitude: customer.lon }}
              title={customer.label ?? "Destination"}
              pinColor={customer.pinColor ?? "#16a34a"}
            />
          )}
          {customer && showPolyline !== false && (
            <NativePolyline
              coordinates={coords}
              strokeColor="#64748b"
              strokeWidth={3}
            />
          )}
        </NativeMapView>
      </View>

      <View className="flex-row items-center gap-2">
        {customer && (
          <View
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
            style={{ backgroundColor: theme.cardSoft ?? theme.card }}
          >
            <MapPin color={theme.mutedForeground} size={11} />
            <Text className="text-xs" style={{ color: theme.mutedForeground }}>
              {distanceLabel(driver, customer)}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => openInMaps(navTarget.lat, navTarget.lon, navTarget.label)}
          className="flex-row items-center gap-1 rounded-lg px-3 py-1 ml-auto"
          style={{ backgroundColor: theme.cardSoft ?? theme.card, borderWidth: 1, borderColor: theme.border }}
        >
          <ExternalLink color={theme.primary} size={12} />
          <Text className="text-xs font-medium" style={{ color: theme.primary }}>
            {navigateTo ? "Navigate" : "Open in Maps"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MultiMapContent({ markers, initialLat, initialLon, height, theme }: MultiProps & { theme: any }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const located = markers.filter((m) => m.lat != null && m.lon != null);
  if (!ready) return <View style={{ height: height ?? 500, borderRadius: 16, borderWidth: 1, borderColor: theme.border }} />;
  const centerLat = initialLat ?? located[0]?.lat ?? 0;
  const centerLon = initialLon ?? located[0]?.lon ?? 0;

  return (
    <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
      <NativeMapView
        style={{ height: height ?? 500 }}
        scrollEnabled={false}
        initialRegion={{ latitude: centerLat, longitude: centerLon, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        {located.map((m) => (
          <NativeMarker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            title={m.title}
            description={m.description}
            pinColor={m.pinColor ?? "#2563eb"}
          />
        ))}
      </NativeMapView>
    </View>
  );
}

// ── Error boundaries ──────────────────────────────────────────────────────────

type BoundaryState = { hasError: boolean };

class MapBoundary extends React.Component<MapProps & { theme: any }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn("[SafeMapView]", e.message); }
  render() {
    if (this.state.hasError || !mapsAvailable) return <MapFallback {...this.props} />;
    return <MapContent {...this.props} />;
  }
}


class MultiMapBoundary extends React.Component<MultiProps & { theme: any }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn("[SafeMultiMapView]", e.message); }
  render() {
    if (this.state.hasError || !mapsAvailable) return <MultiMapFallback {...this.props} />;
    return <MultiMapContent {...this.props} />;
  }
}

// ── Public exports ────────────────────────────────────────────────────────────

export function SafeMapView(props: MapProps) {
  const { theme } = useAppTheme();
  if (props.driver.lat == null || props.driver.lon == null) return null;
  return <MapBoundary {...props} theme={theme} />;
}

export function SafeMultiMapView(props: MultiProps) {
  const { theme } = useAppTheme();
  return <MultiMapBoundary {...props} theme={theme} />;
}
