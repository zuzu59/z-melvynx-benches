import { useEffect, useState, useCallback, useRef } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// --- Types ---

interface GeoJSONFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number] // [lng, lat]
  }
  properties: {
    mag: number
    place: string
    time: number
    url: string
    felt?: number
    tsunami?: number
    alert?: string
    status: string
    tsunami预警?: number
    sig: number
  }
}

interface GeoJSONResponse {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
  metadata: {
    count: number
    generated: number
    url: string
    title: string
    status: number
  }
}

interface Earthquake {
  id: string
  mag: number
  place: string
  time: number
  url: string
  felt?: number
  tsunami?: number
  alert?: string
  sig: number
  lng: number
  lat: number
}

// --- Constants ---

const MAGNITUDE_COLORS: Record<number, string> = {
  2: "#00c853", // Green - Minor
  3: "#64dd17", // Light Green - Minor
  4: "#ffd600", // Yellow - Moderate
  5: "#ff9100", // Orange - Light Moderate
  6: "#ff3d00", // Red-Orange - Moderate Strong
  7: "#d50000", // Red - Strong
  8: "#8e0000", // Dark Red - Very Strong
}

function getMagnitudeColor(mag: number): string {
  const thresholds = [2, 3, 4, 5, 6, 7, 8]
  for (const t of thresholds) {
    if (mag < t) return MAGNITUDE_COLORS[t - 1] || "#00c853"
  }
  return "#8e0000"
}

function getMagnitudeSize(mag: number): number {
  // Radius in pixels, non-linear scale
  return Math.max(4, Math.min(24, mag * 3.5))
}

function getMagnitudeLabel(mag: number): string {
  if (mag < 2) return "Micro"
  if (mag < 3) return "Very Minor"
  if (mag < 4) return "Minor"
  if (mag < 5) return "Light"
  if (mag < 6) return "Moderate"
  if (mag < 7) return "Strong"
  if (mag < 8) return "Major"
  return "Great"
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

// --- Components ---

function CustomIcon(mag: number) {
  const color = getMagnitudeColor(mag)
  const size = getMagnitudeSize(mag)
  const half = size / 2

  return L.divIcon({
    className: "earthquake-marker",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, ${lightenColor(color, 40)} 0%, ${color} 60%, ${darkenColor(color, 30)} 100%);
          box-shadow: 0 0 ${size / 3}px ${color}80, 0 0 ${size / 6}px ${color}40;
          border: 1.5px solid rgba(255,255,255,0.6);
        ">
        </div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size * 2.5}px;
          height: ${size * 2.5}px;
          border-radius: 50%;
          border: 1.5px solid ${color}40;
          animation: pulse 2s ease-out infinite;
        "></div>
      </div>
    `,
    iconSize: [size * 3, size * 3],
    iconAnchor: [size, size],
    popupAnchor: [0, -size],
  })
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)))
  const g = Math.min(255, Math.floor(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * (percent / 100)))
  const b = Math.min(255, Math.floor((num & 0xff) + (255 - (num & 0xff)) * (percent / 100)))
  return `rgb(${r},${g},${b})`
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.floor((num >> 16) * (1 - percent / 100))
  const g = Math.floor(((num >> 8) & 0xff) * (1 - percent / 100))
  const b = Math.floor((num & 0xff) * (1 - percent / 100))
  return `rgb(${r},${g},${b})`
}

// Pulse animation keyframes are injected globally
const styleSheet = document.createElement("style")
styleSheet.textContent = `
  @keyframes pulse {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  }
  .leaflet-container {
    background: #0a0e17;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .leaflet-popup-content {
    margin: 0;
  }
  #earthquake-panel::-webkit-scrollbar {
    width: 6px;
  }
  #earthquake-panel::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
  }
  .marker-label {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 10px;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5);
    white-space: nowrap;
    pointer-events: none;
    letter-spacing: 0.3px;
  }
`
if (!document.querySelector("#ep-style")) {
  styleSheet.id = "ep-style"
  document.head.appendChild(styleSheet)
}

// --- Main App ---

export default function App() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuake, setSelectedQuake] = useState<Earthquake | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<number>(7) // days
  const [minMag, setMinMag] = useState<number>(1)
  const [maxMag, setMaxMag] = useState<number>(10)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEarthquakes = useCallback(async () => {
    setRefreshing(true)
    try {
      setError(null)
      const daysAgo = Date.now() - timeRange * 24 * 60 * 60 * 1000
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(daysAgo).toISOString()}&minmagnitude=${minMag}&maxmagnitude=${maxMag}&orderby=time`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data: GeoJSONResponse = await response.json()

      const parsed: Earthquake[] = data.features.map((f) => ({
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        url: f.properties.url,
        felt: f.properties.felt,
        tsunami: f.properties.tsunami,
        alert: f.properties.alert,
        sig: f.properties.sig,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }))
      setEarthquakes(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch earthquake data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeRange, minMag, maxMag])

  useEffect(() => {
    fetchEarthquakes()
    const interval = setInterval(fetchEarthquakes, 5 * 60 * 1000) // Refresh every 5 min
    return () => clearInterval(interval)
  }, [fetchEarthquakes])

  const stats = {
    total: earthquakes.length,
    avgMag:
      earthquakes.length > 0
        ? (earthquakes.reduce((sum, e) => sum + e.mag, 0) / earthquakes.length).toFixed(1)
        : "—",
    maxMag:
      earthquakes.length > 0 ? Math.max(...earthquakes.map((e) => e.mag)).toFixed(1) : "—",
    recent24h: earthquakes.filter((e) => Date.now() - e.time < 24 * 3600 * 1000).length,
  }

  const sortedQuakes = [...earthquakes].sort((a, b) => b.mag - a.mag)

  return (
    <div className="h-svh w-svw flex bg-[#0a0e17] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0d1220]">
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">Earthquake Explorer</h1>
          </div>
          <p className="text-xs text-white/40 ml-9">Live seismic activity</p>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-2 border-b border-white/10">
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-lg font-bold tabular-nums">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Events</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-lg font-bold tabular-nums">{stats.maxMag}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Max Mag</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-lg font-bold tabular-nums">{stats.avgMag}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Avg Mag</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-lg font-bold tabular-nums">{stats.recent24h}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Last 24h</div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-white/10 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-medium">
              Time Range
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: "24h", value: 1 },
                { label: "7d", value: 7 },
                { label: "30d", value: 30 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    timeRange === opt.value
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-medium">
              Min Magnitude: {minMag}
            </label>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={minMag}
              onChange={(e) => setMinMag(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-1.5 rounded-full bg-white/10"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 block font-medium">
              Color Legend
            </label>
            <div className="space-y-1">
              {[
                { mag: "8+", color: "#8e0000", label: "Great" },
                { mag: "7", color: "#d50000", label: "Strong" },
                { mag: "6", color: "#ff3d00", label: "Mod. Strong" },
                { mag: "5", color: "#ff9100", label: "Moderate" },
                { mag: "4", color: "#ffd600", label: "Light" },
                { mag: "3", color: "#64dd17", label: "Minor" },
                { mag: "2", color: "#00c853", label: "Very Minor" },
              ].map((item) => (
                <div key={item.mag} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }}
                  />
                  <span className="text-white/50">{item.mag}</span>
                  <span className="text-white/30">— {item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Earthquake List */}
        <div className="flex-1 overflow-y-auto" id="earthquake-panel">
          <div className="p-3 flex items-center justify-between border-b border-white/10">
            <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
              Events ({earthquakes.length})
            </span>
            <button
              onClick={fetchEarthquakes}
              disabled={refreshing}
              className="text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors font-medium"
            >
              {refreshing ? "Updating..." : "Refresh"}
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {sortedQuakes.map((quake) => (
              <button
                key={quake.id}
                onClick={() => {
                  setSelectedQuake(quake)
                }}
                className="w-full text-left p-3 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                    style={{
                      backgroundColor: getMagnitudeColor(quake.mag),
                      boxShadow: `0 0 8px ${getMagnitudeColor(quake.mag)}80`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white/90 truncate">
                      {quake.place}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{ color: getMagnitudeColor(quake.mag) }}
                      >
                        M {quake.mag}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {getMagnitudeLabel(quake.mag)}
                      </span>
                      <span className="text-[10px] text-white/25">•</span>
                      <span className="text-[10px] text-white/40">
                        {formatTimeAgo(quake.time)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Error Banner */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm shadow-xl max-w-md">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#0d1220]/90 backdrop-blur-sm text-white/80 px-4 py-2 rounded-lg text-sm shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading earthquakes...
            </div>
          </div>
        )}

        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          {earthquakes.map((quake) => (
            <CircleMarker
              key={quake.id}
              center={[quake.lat, quake.lng]}
              radius={getMagnitudeSize(quake.mag)}
              pathOptions={{
                color: "white",
                weight: 1,
                opacity: 0.6,
                fillColor: getMagnitudeColor(quake.mag),
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedQuake(quake)
                },
              }}
            >
              <Popup>
                <QuakePopupContent quake={quake} />
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Selected Quake Detail Panel (overlay) */}
        {selectedQuake && (
          <div className="absolute top-4 right-4 z-[1000] w-80 bg-[#0d1220]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ backgroundColor: getMagnitudeColor(selectedQuake.mag) }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{
                      backgroundColor: getMagnitudeColor(selectedQuake.mag) + "20",
                      color: getMagnitudeColor(selectedQuake.mag),
                      border: `1px solid ${getMagnitudeColor(selectedQuake.mag)}40`,
                    }}
                  >
                    M {selectedQuake.mag}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{selectedQuake.place}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wider">
                      {getMagnitudeLabel(selectedQuake.mag)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQuake(null)}
                  className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-2.5">
                <DetailRow icon="🕐" label="Time" value={formatDate(selectedQuake.time)} />
                <DetailRow icon="📍" label="Location" value={`${selectedQuake.lat.toFixed(2)}°, ${selectedQuake.lng.toFixed(2)}°`} />
                <DetailRow icon="📊" label="Magnitude" value={`${selectedQuake.mag.toFixed(1)} (${getMagnitudeLabel(selectedQuake.mag)})`} />
                <DetailRow icon="📐" label="Significance" value={selectedQuake.sig.toString()} />
                {selectedQuake.alert && (
                  <DetailRow icon="🚨" label="Alert" value={selectedQuake.alert.toUpperCase()} highlight />
                )}
                {selectedQuake.felt !== undefined && selectedQuake.felt > 0 && (
                  <DetailRow icon="👥" label="Reported by" value={`${selectedQuake.felt} people`} />
                )}
                {selectedQuake.tsunami === 1 && (
                  <DetailRow icon="🌊" label="Tsunami" value="Yes — possible tsunami" highlight />
                )}
              </div>

              <a
                href={selectedQuake.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full text-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 hover:text-white transition-colors border border-white/10"
              >
                View on USGS →
              </a>
            </div>
          </div>
        )}

        {/* Bottom info bar */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-[#0d1220]/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-white/30 border border-white/5">
          Source: USGS • Auto-refresh every 5 min
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function QuakePopupContent({ quake }: { quake: Earthquake }) {
  return (
    <div className="p-2 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
          style={{
            backgroundColor: getMagnitudeColor(quake.mag) + "25",
            color: getMagnitudeColor(quake.mag),
          }}
        >
          M {quake.mag}
        </div>
        <div>
          <div className="font-semibold text-sm">{quake.place}</div>
          <div className="text-[10px] text-white/50">
            {formatTimeAgo(quake.time)} • {getMagnitudeLabel(quake.mag)}
          </div>
        </div>
      </div>
      {quake.alert && (
        <div className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded mb-1 font-medium">
          ⚠️ {quake.alert.toUpperCase()}
        </div>
      )}
      {quake.tsunami === 1 && (
        <div className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded mb-1 font-medium">
          🌊 Possible tsunami
        </div>
      )}
      <div className="text-[10px] text-white/40 space-y-0.5">
        <div>{quake.lat.toFixed(3)}°N, {Math.abs(quake.lng).toFixed(3)}°{quake.lng >= 0 ? "E" : "W"}</div>
        {quake.felt !== undefined && quake.felt > 0 && (
          <div>Felt by {quake.felt} people</div>
        )}
      </div>
      <a
        href={quake.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-center text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        USGS Details →
      </a>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 text-xs ${highlight ? "bg-red-600/10 -mx-1 px-1 py-0.5 rounded" : ""}`}>
      <span className="w-4 text-center">{icon}</span>
      <span className="text-white/40 w-16 flex-shrink-0">{label}</span>
      <span className={highlight ? "text-red-400 font-medium" : "text-white/80"}>
        {value}
      </span>
    </div>
  )
}
