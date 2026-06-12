import React from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Clock3, ExternalLink, MapPin, Navigation, UserRound } from "lucide-react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

// ── Types ─────────────────────────────────────────────────────────────────────

type Coord = { lat: number; lon: number; label?: string; pinColor?: string };

type MapProps = {
  driver: Coord;
  customer?: Coord | null;
  height?: number;
  showPolyline?: boolean;
  navigateTo?: Coord;
  title?: string;
  subtitle?: string;
  lastUpdatedAt?: string | null;
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

function formatUpdatedAt(value?: string | null) {
  if (!value) return "No location update yet";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "No location update yet";
  return `Updated ${new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", timeStyle: "short", hour12: true }).format(date)}`;
}

// ── Leaflet HTML builder ──────────────────────────────────────────────────────

type LeafletMarker = { lat: number; lon: number; color: string; popup?: string; type?: "driver" | "customer" };

function buildLeafletHtml(markers: LeafletMarker[], fitAll: boolean, centerLat?: number, centerLon?: number): string {
  const safeMarkers = JSON.stringify(markers);
  const center = centerLat != null ? `[${centerLat},${centerLon}]` : "null";
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e5e3df}
#map{width:100%;height:100vh}
</style>
</head><body>
<div id="map"></div>
<script>
const map=L.map('map',{zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
const data=${safeMarkers};
const pts=[];
function mkHtml(m){
  if(m.type==='driver'){
    return '<div style="background:'+m.color+';border-radius:50%;width:32px;height:32px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="white" width="17" height="17"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>';
  }
  if(m.type==='customer'){
    return '<div style="background:'+m.color+';border-radius:50%;width:28px;height:28px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/></svg></div>';
  }
  return '<div style="background:'+m.color+';width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>';
}
function mkSize(m){
  if(m.type==='driver')return[32,32];
  if(m.type==='customer')return[28,28];
  return[14,14];
}
data.forEach(function(m){
  const sz=mkSize(m);
  const icon=L.divIcon({html:mkHtml(m),className:'',iconSize:sz,iconAnchor:[sz[0]/2,sz[1]/2]});
  const mk=L.marker([m.lat,m.lon],{icon}).addTo(map);
  if(m.popup)mk.bindPopup(m.popup);
  pts.push([m.lat,m.lon]);
});
if(pts.length>=2&&${fitAll}){
  map.fitBounds(pts,{padding:[32,32],maxZoom:16});
}else if(pts.length===1){
  map.setView(pts[0],15);
}else if(${center}){
  map.setView(${center},13);
}
</script>
</body></html>`;
}

// ── Card header ───────────────────────────────────────────────────────────────

function MapCardHeader({
  title,
  subtitle,
  lastUpdatedAt,
  driver,
  customer,
  navigateTo,
  theme,
}: Pick<MapProps, "title" | "subtitle" | "lastUpdatedAt" | "driver" | "customer" | "navigateTo"> & { theme: any }) {
  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8 }}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.foreground }}>{title}</Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, color: theme.mutedForeground, marginTop: 2 }}>{subtitle}</Text>
          ) : null}
        </View>
        {lastUpdatedAt !== undefined && (
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
          >
            <Clock3 size={11} color={theme.mutedForeground} />
            <Text style={{ fontSize: 11, color: theme.mutedForeground }}>{formatUpdatedAt(lastUpdatedAt)}</Text>
          </View>
        )}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {driver ? (
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <Navigation size={11} color={theme.primary} />
            <Text style={{ fontSize: 11, color: theme.primary }}>Driver</Text>
          </View>
        ) : null}
        {customer ? (
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            style={{ backgroundColor: theme.successSoft }}
          >
            <UserRound size={11} color={theme.success} />
            <Text style={{ fontSize: 11, color: theme.success }}>Customer</Text>
          </View>
        ) : null}
        {navigateTo ? (
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            style={{ backgroundColor: theme.warningSoft }}
          >
            <Navigation size={11} color={theme.warning} />
            <Text style={{ fontSize: 11, color: theme.warning }}>Next stop</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Fallback (no internet / error) ────────────────────────────────────────────

function MapFallback({ driver, customer, navigateTo, title, theme }: MapProps & { theme: any }) {
  const navTarget = navigateTo ?? driver;
  const cardMode = !!title;
  const inner = (
    <>
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
    </>
  );
  if (cardMode) return <View className="p-4 gap-3">{inner}</View>;
  return (
    <View
      className="rounded-2xl p-4 gap-3"
      style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
    >
      {inner}
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

// ── Leaflet map renders ───────────────────────────────────────────────────────

function LeafletMapView({ driver, customer, height, navigateTo, title, theme }: MapProps & { theme: any }) {
  const cardMode = !!title;
  const navTarget = navigateTo ?? (customer ?? driver);

  const leafletMarkers: LeafletMarker[] = [
    { lat: driver.lat, lon: driver.lon, color: "#2563eb", popup: driver.label ?? "Tanker", type: "driver" },
    ...(customer ? [{ lat: customer.lat, lon: customer.lon, color: "#16a34a", popup: customer.label ?? "Customer", type: "customer" as const }] : []),
  ];
  const html = buildLeafletHtml(leafletMarkers, true);

  return (
    <View className={cardMode ? "" : "gap-2"}>
      <View
        style={{
          overflow: Platform.OS === "android" ? "visible" : "hidden",
          ...(!cardMode && { borderRadius: 16, borderWidth: 1, borderColor: theme.border }),
        }}
      >
        <WebView
          source={{ html, baseUrl: "https://openstreetmap.org" }}
          style={{ height: height ?? 220, borderRadius: Platform.OS === "android" && !cardMode ? 16 : 0 }}
          scrollEnabled={false}
          javaScriptEnabled
          originWhitelist={["*"]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          backgroundColor="#e5e3df"
        />
      </View>

      <View className="flex-row items-center gap-2" style={cardMode ? { padding: 12, paddingTop: 8 } : {}}>
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

function LeafletMultiMapView({ markers, initialLat, initialLon, height, theme }: MultiProps & { theme: any }) {
  const located = markers.filter((m) => m.lat != null && m.lon != null);
  const centerLat = initialLat ?? located[0]?.lat;
  const centerLon = initialLon ?? located[0]?.lon;

  const leafletMarkers: LeafletMarker[] = located.map((m) => ({
    lat: m.lat,
    lon: m.lon,
    color: m.pinColor ?? "#2563eb",
    popup: m.title + (m.description ? ` — ${m.description}` : ""),
    type: "driver" as const,
  }));
  const html = buildLeafletHtml(leafletMarkers, true, centerLat, centerLon);

  return (
    // overflow:hidden on a direct WebView parent collapses the view to 0 height on Android.
    // Use borderRadius only (no overflow:hidden) and rely on WebView's own clipping.
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: Platform.OS === "android" ? "visible" : "hidden" }}>
      <WebView
        source={{ html, baseUrl: "https://openstreetmap.org" }}
        style={{ height: height ?? 500, borderRadius: Platform.OS === "android" ? 16 : 0 }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        backgroundColor="#e5e3df"
      />
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
    if (this.state.hasError) return <MapFallback {...this.props} />;
    return <LeafletMapView {...this.props} />;
  }
}

class MultiMapBoundary extends React.Component<MultiProps & { theme: any }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn("[SafeMultiMapView]", e.message); }
  render() {
    if (this.state.hasError) return <MultiMapFallback {...this.props} />;
    return <LeafletMultiMapView {...this.props} />;
  }
}

// ── Public exports ────────────────────────────────────────────────────────────

export function SafeMapView(props: MapProps) {
  const { theme } = useAppTheme();
  if (props.driver.lat == null || props.driver.lon == null) return null;
  if (props.title) {
    return (
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        <MapCardHeader
          title={props.title}
          subtitle={props.subtitle}
          lastUpdatedAt={props.lastUpdatedAt}
          driver={props.driver}
          customer={props.customer}
          navigateTo={props.navigateTo}
          theme={theme}
        />
        <MapBoundary {...props} theme={theme} />
      </View>
    );
  }
  return <MapBoundary {...props} theme={theme} />;
}

export function SafeMultiMapView(props: MultiProps) {
  const { theme } = useAppTheme();
  return <MultiMapBoundary {...props} theme={theme} />;
}
