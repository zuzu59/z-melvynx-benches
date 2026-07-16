(() => {
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
  const REFRESH_MS = 5 * 60 * 1000;
  const MAX_EVENTS = 5000;

  const MAG_COLORS = [
    { min: 8, label: "8+", color: "#8b5cf6" },
    { min: 7, label: "7–7.9", color: "#ef4444" },
    { min: 6, label: "6–6.9", color: "#f97316" },
    { min: 5, label: "5–5.9", color: "#f59e0b" },
    { min: 4, label: "4–4.9", color: "#fde047" },
    { min: 3, label: "3–3.9", color: "#4ade80" },
    { min: 2, label: "2–2.9", color: "#22d3ee" },
    { min: 0, label: "<2", color: "#60a5fa" },
  ];

  const DEPTH_BANDS = [
    { key: "shallow", label: "Shallow < 70 km", color: "#38bdf8" },
    { key: "intermediate", label: "Intermediate 70–300 km", color: "#a78bfa" },
    { key: "deep", label: "Deep 300+ km", color: "#f472b6" },
  ];

  const state = {
    days: 7,
    minMag: 1.5,
    depth: "all",
    flag: "all",
    sort: "time",
    search: "",
    visibleOnly: false,
    selectedId: null,
  };

  const els = {
    filterForm: document.getElementById("filters"),
    minMag: document.getElementById("min-mag"),
    minMagValue: document.getElementById("min-mag-value"),
    depthFilter: document.getElementById("depth-filter"),
    flagFilter: document.getElementById("flag-filter"),
    sortFilter: document.getElementById("sort-filter"),
    searchFilter: document.getElementById("search-filter"),
    visibleFilter: document.getElementById("visible-filter"),
    eventList: document.getElementById("event-list"),
    feedMeta: document.getElementById("feed-meta"),
    refreshBtn: document.getElementById("refresh-btn"),
    resetBtn: document.getElementById("reset-btn"),
    loading: document.getElementById("loading"),
    error: document.getElementById("error"),
    details: document.getElementById("details"),
    detailsAccent: document.getElementById("details-accent"),
    detailsTitle: document.getElementById("details-title"),
    detailsSubtitle: document.getElementById("details-subtitle"),
    detailsMag: document.getElementById("details-mag"),
    detailsGrid: document.getElementById("details-grid"),
    focusBtn: document.getElementById("focus-btn"),
    usgsLink: document.getElementById("usgs-link"),
    statCount: document.getElementById("stat-count"),
    statMax: document.getElementById("stat-max"),
    statAvg: document.getElementById("stat-avg"),
    stat24h: document.getElementById("stat-24h"),
    magnitudeLegend: document.getElementById("magnitude-legend"),
    depthLegend: document.getElementById("depth-legend"),
  };

  const mapState = {
    map: null,
    layer: null,
    markers: new Map(),
  };

  const dataset = [];
  let refreshTimer = null;
  let debounceTimer = null;
  let fetchToken = 0;

  init();

  function init() {
    mapState.map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,
      preferCanvas: true,
    }).setView([18, 0], 2);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapState.map);

    mapState.layer = L.layerGroup().addTo(mapState.map);

    renderLegends();
    wireEvents();
    scheduleRefresh();
    fetchEarthquakes();

    mapState.map.on("moveend zoomend", () => {
      if (state.visibleOnly) renderScene();
    });

    window.addEventListener("resize", () => mapState.map.invalidateSize());
    setTimeout(() => mapState.map.invalidateSize(), 120);
  }

  function wireEvents() {
    els.minMag.addEventListener("input", () => {
      state.minMag = Number(els.minMag.value);
      els.minMagValue.textContent = state.minMag.toFixed(1);
      scheduleFetch();
    });

    els.depthFilter.addEventListener("change", () => {
      state.depth = els.depthFilter.value;
      renderScene();
    });

    els.flagFilter.addEventListener("change", () => {
      state.flag = els.flagFilter.value;
      renderScene();
    });

    els.sortFilter.addEventListener("change", () => {
      state.sort = els.sortFilter.value;
      renderScene();
    });

    els.searchFilter.addEventListener("input", () => {
      state.search = els.searchFilter.value;
      renderScene();
    });

    els.visibleFilter.addEventListener("change", () => {
      state.visibleOnly = els.visibleFilter.checked;
      renderScene();
    });

    els.refreshBtn.addEventListener("click", () => fetchEarthquakes(false));
    els.resetBtn.addEventListener("click", resetFilters);
    els.focusBtn.addEventListener("click", focusSelectedEvent);
    els.eventList.addEventListener("click", onListClick);
    els.filterForm.querySelectorAll(".segmented__btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.days = Number(button.dataset.value);
        updateSegmented();
        fetchEarthquakes(false);
      });
    });
  }

  function updateSegmented() {
    els.filterForm.querySelectorAll(".segmented__btn").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.value) === state.days);
    });
  }

  function renderLegends() {
    els.magnitudeLegend.innerHTML = MAG_COLORS.map((band) => chipHtml(band.color, band.label)).join("");
    els.depthLegend.innerHTML = DEPTH_BANDS.map((band) => chipHtml(band.color, band.label)).join("");
  }

  function chipHtml(color, label) {
    return `<span class="chip"><span class="chip__dot" style="background:${color}; box-shadow:0 0 12px ${color}66"></span>${escapeHtml(label)}</span>`;
  }

  async function fetchEarthquakes(silent = true) {
    const token = ++fetchToken;
    if (!silent) setLoading(true);
    setError("");
    els.refreshBtn.disabled = true;

    try {
      const url = new URL(USGS_ENDPOINT);
      url.searchParams.set("format", "geojson");
      url.searchParams.set("orderby", "time");
      url.searchParams.set("limit", String(MAX_EVENTS));
      url.searchParams.set("starttime", new Date(Date.now() - state.days * 24 * 60 * 60 * 1000).toISOString());
      url.searchParams.set("minmagnitude", state.minMag.toFixed(1));

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`USGS API error ${response.status}`);

      const payload = await response.json();
      if (token !== fetchToken) return;

      dataset.length = 0;
      for (const feature of payload.features || []) {
        const quake = normalizeFeature(feature);
        if (quake) dataset.push(quake);
      }

      if (!state.selectedId && dataset[0]) state.selectedId = dataset[0].id;
      renderScene();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earthquake data");
    } finally {
      if (token === fetchToken && !silent) setLoading(false);
      els.refreshBtn.disabled = false;
    }
  }

  function normalizeFeature(feature) {
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties || {};
    if (!coords || coords.length < 2) return null;

    return {
      id: feature.id || `${props.time}-${coords[0]}-${coords[1]}`,
      title: props.title || "Unknown earthquake",
      place: props.place || "Unknown location",
      type: props.type || "earthquake",
      time: Number(props.time || Date.now()),
      mag: Number(props.mag ?? 0),
      depth: Number(coords[2] ?? 0),
      lng: Number(coords[0]),
      lat: Number(coords[1]),
      url: props.url || "https://earthquake.usgs.gov/",
      felt: Number.isFinite(props.felt) ? props.felt : 0,
      alert: props.alert || "",
      tsunami: Number(props.tsunami || 0),
      sig: Number(props.sig || 0),
    };
  }

  function renderScene() {
    const filtered = getFilteredEvents();
    const selectedVisible = state.selectedId && filtered.some((quake) => quake.id === state.selectedId);
    if (!selectedVisible && filtered.length > 0) {
      state.selectedId = filtered[0].id;
    }

    renderStats(filtered);
    renderFeedMeta(filtered);
    renderList(filtered);
    renderMarkers(filtered);
    renderDetails(filtered);
  }

  function getFilteredEvents() {
    const bounds = state.visibleOnly ? mapState.map.getBounds() : null;
    const search = state.search.trim().toLowerCase();

    let events = dataset.filter((quake) => quake.mag >= state.minMag);

    if (state.depth !== "all") {
      events = events.filter((quake) => depthBandKey(quake.depth) === state.depth);
    }

    if (state.flag !== "all") {
      events = events.filter((quake) => {
        switch (state.flag) {
          case "felt":
            return quake.felt > 0;
          case "alert":
            return Boolean(quake.alert);
          case "tsunami":
            return quake.tsunami === 1;
          case "m5":
            return quake.mag >= 5;
          default:
            return true;
        }
      });
    }

    if (search) {
      events = events.filter((quake) => {
        const haystack = `${quake.title} ${quake.place} ${quake.type}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    if (bounds) {
      events = events.filter((quake) => bounds.contains([quake.lat, quake.lng]));
    }

    const sorted = events.slice();
    switch (state.sort) {
      case "magnitude":
        sorted.sort((a, b) => b.mag - a.mag || b.time - a.time);
        break;
      case "depth-asc":
        sorted.sort((a, b) => a.depth - b.depth || b.time - a.time);
        break;
      case "depth-desc":
        sorted.sort((a, b) => b.depth - a.depth || b.time - a.time);
        break;
      default:
        sorted.sort((a, b) => b.time - a.time || b.mag - a.mag);
    }

    return sorted;
  }

  function renderStats(events) {
    const strongest = events.length ? Math.max(...events.map((e) => e.mag)) : null;
    const avg = events.length ? events.reduce((sum, e) => sum + e.mag, 0) / events.length : null;
    const last24 = events.filter((e) => Date.now() - e.time <= 24 * 60 * 60 * 1000).length;

    els.statCount.textContent = formatNumber(events.length);
    els.statMax.textContent = strongest === null ? "—" : strongest.toFixed(1);
    els.statAvg.textContent = avg === null ? "—" : avg.toFixed(1);
    els.stat24h.textContent = formatNumber(last24);
  }

  function renderFeedMeta(events) {
    const updated = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    els.feedMeta.textContent = `${formatNumber(events.length)} shown / ${formatNumber(dataset.length)} loaded · updated ${updated}`;
  }

  function renderList(events) {
    if (!events.length) {
      els.eventList.innerHTML = `<div class="event-item"><div class="event-item__dot" style="background:#94a3b8"></div><div><h3>No earthquakes match the current filters.</h3><div class="event-item__meta">Try a lower minimum magnitude, clear search, or widen the map.</div></div></div>`;
      return;
    }

    els.eventList.innerHTML = events.map((quake) => eventCard(quake)).join("");
  }

  function eventCard(quake) {
    const active = quake.id === state.selectedId;
    const magColor = magnitudeColor(quake.mag);
    const depthColor = depthColorByDepth(quake.depth);
    const badges = [
      `<span class="badge" style="color:${magColor}; border-color:${magColor}55">M ${quake.mag.toFixed(1)}</span>`,
      `<span class="badge badge--depth" style="color:${depthColor}; border-color:${depthColor}55">${depthBandLabel(quake.depth)}</span>`,
    ];

    if (quake.alert) badges.push(`<span class="badge badge--alert">Alert ${escapeHtml(quake.alert.toUpperCase())}</span>`);
    if (quake.tsunami === 1) badges.push(`<span class="badge badge--tsunami">Tsunami</span>`);
    if (quake.felt > 0) badges.push(`<span class="badge">${formatNumber(quake.felt)} felt</span>`);

    return `
      <button class="event-item ${active ? "is-selected" : ""}" type="button" data-id="${escapeHtml(quake.id)}">
        <span class="event-item__dot" style="background:${magColor}; box-shadow: 0 0 12px ${magColor}88"></span>
        <div>
          <h3>${escapeHtml(quake.place)}</h3>
          <div class="badges">${badges.join("")}</div>
          <div class="event-item__meta">${formatRelative(quake.time)} · ${formatAbsolute(quake.time)} · depth ${quake.depth.toFixed(1)} km</div>
        </div>
      </button>
    `;
  }

  function renderMarkers(events) {
    mapState.layer.clearLayers();
    mapState.markers.clear();

    for (const quake of events) {
      const magColor = magnitudeColor(quake.mag);
      const depthColor = depthColorByDepth(quake.depth);
      const selected = quake.id === state.selectedId;
      const marker = L.circleMarker([quake.lat, quake.lng], {
        radius: selected ? markerRadius(quake.mag) + 2.5 : markerRadius(quake.mag),
        fillColor: magColor,
        fillOpacity: selected ? 0.98 : 0.9,
        color: selected ? "#ffffff" : depthColor,
        weight: selected ? 3 : 1.5,
        opacity: selected ? 1 : 0.85,
      });

      marker.bindTooltip(
        `<div class="popup"><h3>${escapeHtml(quake.place)}</h3><p>M ${quake.mag.toFixed(1)} · ${depthBandLabel(quake.depth)}</p><div class="popup__row">${formatRelative(quake.time)} · ${formatAbsolute(quake.time)}</div></div>`,
        { sticky: true, direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => selectEvent(quake.id, { flyTo: true }));
      marker.addTo(mapState.layer);
      mapState.markers.set(quake.id, marker);
    }

    if (state.selectedId && mapState.markers.has(state.selectedId)) {
      mapState.markers.get(state.selectedId).bringToFront();
    }
  }

  function renderDetails(events) {
    const selected = dataset.find((e) => e.id === state.selectedId) || null;
    const quake = events.some((e) => e.id === state.selectedId) ? selected : events[0] || null;
    if (!quake) {
      els.details.classList.remove("is-visible");
      return;
    }

    els.details.classList.add("is-visible");
    const magColor = magnitudeColor(quake.mag);
    els.detailsAccent.style.background = magColor;
    els.detailsTitle.textContent = quake.place;
    els.detailsSubtitle.textContent = `${depthBandLabel(quake.depth)} · ${quake.type || "earthquake"}`;
    els.detailsMag.textContent = `M ${quake.mag.toFixed(1)}`;
    els.detailsMag.style.color = magColor;
    els.detailsMag.style.background = `${magColor}18`;
    els.detailsMag.style.borderColor = `${magColor}40`;
    els.detailsGrid.innerHTML = [
      detailRow("Time", formatAbsolute(quake.time)),
      detailRow("Relative", formatRelative(quake.time)),
      detailRow("Location", `${quake.lat.toFixed(3)}°, ${quake.lng.toFixed(3)}°`),
      detailRow("Depth", `${quake.depth.toFixed(1)} km`),
      detailRow("Magnitude", `${quake.mag.toFixed(1)} · ${magnitudeLabel(quake.mag)}`),
      detailRow("Significance", String(quake.sig)),
      quake.felt > 0 ? detailRow("Felt", `${formatNumber(quake.felt)} reports`) : "",
      quake.alert ? detailRow("Alert", quake.alert.toUpperCase()) : "",
      quake.tsunami === 1 ? detailRow("Tsunami", "Possible tsunami") : "",
    ].filter(Boolean).join("");
    els.usgsLink.href = quake.url;
  }

  function detailRow(label, value) {
    return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function selectEvent(id, { flyTo = false } = {}) {
    state.selectedId = id;
    renderScene();

    const quake = dataset.find((e) => e.id === id);
    if (!quake) return;

    if (flyTo) {
      const zoom = Math.max(mapState.map.getZoom(), 5);
      mapState.map.flyTo([quake.lat, quake.lng], zoom, { duration: 0.65 });
    }

    const marker = mapState.markers.get(id);
    if (marker) marker.openTooltip();
  }

  function focusSelectedEvent() {
    const quake = dataset.find((e) => e.id === state.selectedId);
    if (!quake) return;
    mapState.map.flyTo([quake.lat, quake.lng], Math.max(mapState.map.getZoom(), 5), { duration: 0.65 });
  }

  function onListClick(event) {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    selectEvent(button.dataset.id, { flyTo: true });
  }

  function resetFilters() {
    state.days = 7;
    state.minMag = 1.5;
    state.depth = "all";
    state.flag = "all";
    state.sort = "time";
    state.search = "";
    state.visibleOnly = false;
    state.selectedId = null;

    els.minMag.value = "1.5";
    els.minMagValue.textContent = "1.5";
    els.depthFilter.value = "all";
    els.flagFilter.value = "all";
    els.sortFilter.value = "time";
    els.searchFilter.value = "";
    els.visibleFilter.checked = false;
    updateSegmented();
    fetchEarthquakes(false);
  }

  function updateSegmented() {
    els.filterForm.querySelectorAll(".segmented__btn").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.value) === state.days);
    });
  }

  function scheduleFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchEarthquakes(true), 280);
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => fetchEarthquakes(true), REFRESH_MS);
  }

  function setLoading(active) {
    els.loading.hidden = !active;
  }

  function setError(message) {
    if (!message) {
      els.error.hidden = true;
      els.error.textContent = "";
      return;
    }
    els.error.hidden = false;
    els.error.textContent = message;
  }

  async function fetchEarthquakes(showLoading = false) {
    const token = ++fetchToken;
    if (showLoading) setLoading(true);
    setError("");
    els.refreshBtn.disabled = true;

    try {
      const url = new URL(USGS_ENDPOINT);
      url.searchParams.set("format", "geojson");
      url.searchParams.set("orderby", "time");
      url.searchParams.set("limit", String(MAX_EVENTS));
      url.searchParams.set("starttime", new Date(Date.now() - state.days * 24 * 60 * 60 * 1000).toISOString());
      url.searchParams.set("minmagnitude", state.minMag.toFixed(1));

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`USGS API error ${response.status}`);

      const payload = await response.json();
      if (token !== fetchToken) return;

      dataset.length = 0;
      for (const feature of payload.features || []) {
        const quake = normalizeFeature(feature);
        if (quake) dataset.push(quake);
      }

      if (!state.selectedId && dataset[0]) state.selectedId = dataset[0].id;
      renderScene();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load live earthquake data");
    } finally {
      if (token === fetchToken && showLoading) setLoading(false);
      els.refreshBtn.disabled = false;
    }
  }

  function normalizeFeature(feature) {
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties || {};
    if (!coords || coords.length < 2) return null;

    return {
      id: feature.id || `${props.time}-${coords[0]}-${coords[1]}`,
      title: props.title || "Unknown earthquake",
      place: props.place || "Unknown location",
      type: props.type || "earthquake",
      time: Number(props.time || Date.now()),
      mag: Number(props.mag ?? 0),
      depth: Number(coords[2] ?? 0),
      lng: Number(coords[0]),
      lat: Number(coords[1]),
      url: props.url || "https://earthquake.usgs.gov/",
      felt: Number.isFinite(props.felt) ? props.felt : 0,
      alert: props.alert || "",
      tsunami: Number(props.tsunami || 0),
      sig: Number(props.sig || 0),
    };
  }

  function magnitudeColor(mag) {
    if (mag >= 8) return "#8b5cf6";
    if (mag >= 7) return "#ef4444";
    if (mag >= 6) return "#f97316";
    if (mag >= 5) return "#f59e0b";
    if (mag >= 4) return "#fde047";
    if (mag >= 3) return "#4ade80";
    if (mag >= 2) return "#22d3ee";
    return "#60a5fa";
  }

  function depthColorByDepth(depth) {
    return DEPTH_BANDS.find((band) => band.key === depthBandKey(depth))?.color || "#cbd5e1";
  }

  function depthBandKey(depth) {
    if (depth < 70) return "shallow";
    if (depth < 300) return "intermediate";
    return "deep";
  }

  function depthBandLabel(depth) {
    return DEPTH_BANDS.find((band) => band.key === depthBandKey(depth))?.label || "Unknown depth";
  }

  function magnitudeLabel(mag) {
    if (mag >= 7) return "great";
    if (mag >= 6) return "strong";
    if (mag >= 5) return "moderate";
    if (mag >= 4) return "light";
    if (mag >= 3) return "minor";
    return "very minor";
  }

  function markerRadius(mag) {
    return Math.max(4.5, Math.min(18, 3.5 + Math.pow(Math.max(mag, 0), 1.24) * 1.4));
  }

  function formatAbsolute(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }

  function formatRelative(timestamp) {
    const minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
