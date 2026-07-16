(() => {
  const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
  const REFRESH_INTERVAL = 5 * 60 * 1000;

  const MAG_BANDS = [
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

  const REGION_PILLS = [
    { key: "all", label: "All" },
    { key: "felt", label: "Felt" },
    { key: "alert", label: "Alert" },
    { key: "tsunami", label: "Tsunami" },
    { key: "major", label: "M5+" },
  ];

  const TIME_RANGES = [
    { days: 1, label: "24h" },
    { days: 7, label: "7d" },
    { days: 30, label: "30d" },
  ];

  const SORT_OPTIONS = [
    { key: "time", label: "Most recent" },
    { key: "magnitude", label: "Strongest first" },
    { key: "depth-asc", label: "Shallow first" },
    { key: "depth-desc", label: "Deep first" },
  ];

  const state = {
    days: 7,
    minMag: 1.5,
    depth: "all",
    category: "all",
    sort: "time",
    search: "",
    visibleOnly: false,
    selectedId: null,
  };

  const els = {
    controls: document.getElementById("controls"),
    eventList: document.getElementById("event-list"),
    feedMeta: document.getElementById("feed-meta"),
    loadingToast: document.getElementById("loading-toast"),
    errorToast: document.getElementById("error-toast"),
    detailCard: document.getElementById("detail-card"),
    detailAccent: document.getElementById("detail-accent"),
    detailTitle: document.getElementById("detail-title"),
    detailSub: document.getElementById("detail-sub"),
    detailMag: document.getElementById("detail-mag"),
    detailGrid: document.getElementById("detail-grid"),
    detailCardLink: document.getElementById("usgs-link"),
    focusBtn: document.getElementById("focus-btn"),
    refreshBtn: document.getElementById("refresh-btn"),
    resetBtn: document.getElementById("reset-btn"),
    statTotal: document.getElementById("stat-total"),
    statStrongest: document.getElementById("stat-strongest"),
    statAvg: document.getElementById("stat-avg"),
    statLast24: document.getElementById("stat-last24"),
    magnitudeLegend: document.getElementById("magnitude-legend"),
    depthLegend: document.getElementById("depth-legend"),
  };

  const markerLayer = L.layerGroup();
  const markersById = new Map();
  const allEvents = [];
  let map;
  let refreshTimer = null;
  let debounceTimer = null;
  let currentVisibleEvents = [];
  let loading = false;
  let fetchToken = 0;

  init();

  function init() {
    map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,
      preferCanvas: false,
    }).setView([18, 0], 2);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    markerLayer.addTo(map);

    map.on("moveend zoomend", () => {
      if (state.visibleOnly) renderScene();
    });

    els.controls.addEventListener("click", onControlClick);
    els.controls.addEventListener("input", onControlInput);
    els.controls.addEventListener("change", onControlChange);
    els.eventList.addEventListener("click", onEventListClick);
    els.refreshBtn.addEventListener("click", () => fetchEarthquakes());
    els.resetBtn.addEventListener("click", resetFilters);
    els.focusBtn.addEventListener("click", focusSelectedEvent);

    renderLegend();
    renderControls();
    scheduleRefresh();
    fetchEarthquakes();

    window.addEventListener("resize", () => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 150);
  }

  function renderLegend() {
    els.magnitudeLegend.innerHTML = MAG_BANDS.map((band) => {
      const accent = band.color;
      return `<span class="legend__item"><span class="legend__dot" style="background:${accent}; box-shadow: 0 0 14px ${accent}55"></span><span class="legend__chip">${band.label}</span></span>`;
    }).join("");

    els.depthLegend.innerHTML = DEPTH_BANDS.map((band) => {
      return `<span class="legend__item"><span class="legend__dot" style="background:${band.color}; box-shadow: 0 0 14px ${band.color}55"></span><span class="legend__chip">${band.label}</span></span>`;
    }).join("");
  }

  function renderControls() {
    els.controls.innerHTML = `
      <div class="control-group">
        <label>Time range</label>
        <div class="pills" data-group="days">
          ${TIME_RANGES.map((range) => pillHtml(range.days, range.label, state.days === range.days, "days")).join("")}
        </div>
      </div>

      <div class="control-group">
        <label for="min-mag">Minimum magnitude <output id="min-mag-value">${state.minMag.toFixed(1)}</output></label>
        <input id="min-mag" type="range" min="0" max="8" step="0.1" value="${state.minMag}" />
      </div>

      <div class="control-group">
        <label>Event type</label>
        <div class="pills" data-group="category">
          ${REGION_PILLS.map((pill) => pillHtml(pill.key, pill.label, state.category === pill.key, "category")).join("")}
        </div>
      </div>

      <div class="control-group">
        <label>Depth filter</label>
        <div class="pills" data-group="depth">
          ${pillHtml("all", "All depths", state.depth === "all", "depth")}
          ${DEPTH_BANDS.map((band) => pillHtml(band.key, band.label, state.depth === band.key, "depth")).join("")}
        </div>
      </div>

      <div class="control-group">
        <label for="sort-select">Sort</label>
        <select id="sort-select">
          ${SORT_OPTIONS.map((opt) => `<option value="${opt.key}" ${state.sort === opt.key ? "selected" : ""}>${opt.label}</option>`).join("")}
        </select>
      </div>

      <div class="control-group">
        <label for="search-input">Search place</label>
        <input id="search-input" type="search" placeholder="Search a country, city, or region" value="${escapeHtml(state.search)}" />
      </div>

      <div class="control-group">
        <label class="pill pill--quiet" style="display:flex; align-items:center; gap:10px; justify-content:space-between; width:100%;">
          <span>Limit to visible map area</span>
          <input id="visible-only" type="checkbox" ${state.visibleOnly ? "checked" : ""} />
        </label>
      </div>
    `;

    const minMag = document.getElementById("min-mag");
    const minMagValue = document.getElementById("min-mag-value");
    if (minMag && minMagValue) {
      minMagValue.textContent = state.minMag.toFixed(1);
      minMag.setAttribute("aria-valuetext", state.minMag.toFixed(1));
    }
  }

  function pillHtml(value, label, active, group) {
    return `<button type="button" class="pill ${active ? "is-active" : ""}" data-group="${group}" data-value="${value}">${label}</button>`;
  }

  function onControlClick(event) {
    const button = event.target.closest("button[data-group]");
    if (!button) return;

    const { group, value } = button.dataset;
    if (group === "days") {
      state.days = Number(value);
      renderControls();
      fetchEarthquakes();
      return;
    }

    if (group === "category") {
      state.category = value;
      renderControls();
      renderScene();
      return;
    }

    if (group === "depth") {
      state.depth = value;
      renderControls();
      renderScene();
    }
  }

  function onControlInput(event) {
    const target = event.target;
    if (target.id === "min-mag") {
      state.minMag = Number(target.value);
      const output = document.getElementById("min-mag-value");
      if (output) output.textContent = state.minMag.toFixed(1);
      scheduleFetch();
      return;
    }

    if (target.id === "search-input") {
      state.search = target.value;
      renderScene();
    }
  }

  function onControlChange(event) {
    const target = event.target;
    if (target.id === "sort-select") {
      state.sort = target.value;
      renderScene();
      return;
    }

    if (target.id === "visible-only") {
      state.visibleOnly = target.checked;
      renderScene();
    }
  }

  function onEventListClick(event) {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    selectEvent(button.dataset.id, { flyTo: true });
  }

  function scheduleFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchEarthquakes(), 300);
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => fetchEarthquakes(true), REFRESH_INTERVAL);
  }

  async function fetchEarthquakes(silent = false) {
    const token = ++fetchToken;
    if (!silent) setLoading(true);
    setError("");
    try {
      const url = new URL(USGS_ENDPOINT);
      url.searchParams.set("format", "geojson");
      url.searchParams.set("orderby", "time");
      url.searchParams.set("limit", "5000");
      url.searchParams.set("starttime", new Date(Date.now() - state.days * 24 * 60 * 60 * 1000).toISOString());
      url.searchParams.set("minmagnitude", state.minMag.toFixed(1));

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`USGS API error ${response.status}`);
      }

      const payload = await response.json();
      if (token !== fetchToken) return;
      allEvents.length = 0;
      payload.features.forEach((feature) => {
        const quake = mapFeature(feature);
        if (quake) allEvents.push(quake);
      });

      renderScene();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to load live earthquake data");
    } finally {
      if (token === fetchToken && !silent) setLoading(false);
    }
  }

  function mapFeature(feature) {
    const coords = feature?.geometry?.coordinates;
    const props = feature?.properties || {};
    if (!coords || coords.length < 2) return null;

    return {
      id: feature.id || `${props.time}-${coords[0]}-${coords[1]}`,
      mag: Number(props.mag ?? 0),
      place: props.place || "Unknown location",
      time: Number(props.time || Date.now()),
      url: props.url || "https://earthquake.usgs.gov/",
      felt: Number.isFinite(props.felt) ? props.felt : 0,
      tsunami: Number(props.tsunami || 0),
      alert: props.alert || "",
      sig: Number(props.sig || 0),
      depth: Number(coords[2] ?? 0),
      lng: Number(coords[0]),
      lat: Number(coords[1]),
      type: props.type || "earthquake",
      status: props.status || "",
      title: props.title || "",
    };
  }

  function renderScene() {
    const filtered = getFilteredEvents();
    currentVisibleEvents = filtered;

    const selectedExists = state.selectedId && allEvents.some((event) => event.id === state.selectedId);
    if (!selectedExists && filtered.length > 0) {
      state.selectedId = filtered[0].id;
    }

    renderStats(filtered);
    renderList(filtered);
    renderMarkers(filtered);
    renderDetail();
    renderFeedMeta(filtered);
  }

  function getFilteredEvents() {
    const search = state.search.trim().toLowerCase();
    const bounds = state.visibleOnly ? map.getBounds() : null;

    let events = allEvents.filter((quake) => quake.mag >= state.minMag);

    if (state.category !== "all") {
      events = events.filter((quake) => {
        switch (state.category) {
          case "felt":
            return quake.felt > 0;
          case "alert":
            return Boolean(quake.alert);
          case "tsunami":
            return quake.tsunami === 1;
          case "major":
            return quake.mag >= 5;
          default:
            return true;
        }
      });
    }

    if (state.depth !== "all") {
      events = events.filter((quake) => depthBandKey(quake.depth) === state.depth);
    }

    if (search) {
      events = events.filter((quake) => {
        const haystack = [quake.place, quake.type, quake.title].join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    if (bounds) {
      events = events.filter((quake) => bounds.contains([quake.lat, quake.lng]));
    }

    switch (state.sort) {
      case "magnitude":
        events.sort((a, b) => b.mag - a.mag || b.time - a.time);
        break;
      case "depth-asc":
        events.sort((a, b) => a.depth - b.depth || b.time - a.time);
        break;
      case "depth-desc":
        events.sort((a, b) => b.depth - a.depth || b.time - a.time);
        break;
      default:
        events.sort((a, b) => b.time - a.time || b.mag - a.mag);
    }

    return events;
  }

  function renderStats(filtered) {
    const strongest = filtered.length ? Math.max(...filtered.map((e) => e.mag)) : null;
    const avg = filtered.length ? filtered.reduce((sum, e) => sum + e.mag, 0) / filtered.length : null;
    const last24 = filtered.filter((e) => Date.now() - e.time <= 24 * 60 * 60 * 1000).length;

    els.statTotal.textContent = formatNumber(filtered.length);
    els.statStrongest.textContent = strongest === null ? "—" : strongest.toFixed(1);
    els.statAvg.textContent = avg === null ? "—" : avg.toFixed(1);
    els.statLast24.textContent = formatNumber(last24);
  }

  function renderFeedMeta(filtered) {
    const total = allEvents.length;
    const updated = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    els.feedMeta.innerHTML = `<span>${formatNumber(filtered.length)} shown / ${formatNumber(total)} fetched · updated ${updated}</span>`;
  }

  function renderList(filtered) {
    if (filtered.length === 0) {
      els.eventList.innerHTML = `<div class="event-btn"><div class="event-dot" style="background:#94a3b8"></div><div><h3>No earthquakes match the current filters.</h3><div class="event-meta">Try lowering the magnitude threshold, clearing the search, or widening the map view.</div></div></div>`;
      return;
    }

    els.eventList.innerHTML = filtered
      .map((quake) => {
        const active = quake.id === state.selectedId;
        const magColor = magnitudeColor(quake.mag);
        const depth = depthBandLabel(quake.depth);
        const depthColor = depthBandColor(quake.depth);
        const badges = [
          `<span class="badge" style="border-color:${magColor}55; color:${magColor}">M ${quake.mag.toFixed(1)}</span>`,
          `<span class="badge badge--depth" style="border-color:${depthColor}55; color:${depthColor}">${depth}</span>`,
        ];
        if (quake.alert) badges.push(`<span class="badge badge--alert">Alert ${escapeHtml(quake.alert.toUpperCase())}</span>`);
        if (quake.tsunami === 1) badges.push(`<span class="badge badge--tsunami">Tsunami</span>`);
        if (quake.felt > 0) badges.push(`<span class="badge">${formatNumber(quake.felt)} felt</span>`);

        return `
          <button type="button" class="event-btn ${active ? "is-selected" : ""}" data-id="${escapeHtml(quake.id)}">
            <span class="event-dot" style="background:${magColor}; box-shadow: 0 0 12px ${magColor}88"></span>
            <div>
              <div class="event-title">
                <h3>${escapeHtml(quake.place)}</h3>
              </div>
              <div class="badge-row">${badges.join("")}</div>
              <div class="event-meta">${formatRelative(quake.time)} · ${formatTime(quake.time)} · depth ${quake.depth.toFixed(1)} km</div>
            </div>
          </button>
        `;
      })
      .join("");
  }

  function renderMarkers(filtered) {
    markerLayer.clearLayers();
    markersById.clear();

    filtered.forEach((quake) => {
      const radius = markerRadius(quake.mag);
      const fill = magnitudeColor(quake.mag);
      const border = depthBandColor(quake.depth);
      const selected = quake.id === state.selectedId;
      const marker = L.circleMarker([quake.lat, quake.lng], {
        radius: selected ? radius + 2.5 : radius,
        color: selected ? "#ffffff" : border,
        weight: selected ? 3 : 1.4,
        opacity: selected ? 1 : 0.9,
        fillColor: fill,
        fillOpacity: selected ? 0.98 : 0.88,
      });

      marker.addTo(markerLayer);
      marker.bindTooltip(`<strong>${escapeHtml(quake.place)}</strong><br>M ${quake.mag.toFixed(1)} · ${depthBandLabel(quake.depth)}`, {
        direction: "top",
        opacity: 0.95,
        sticky: true,
      });
      marker.on("click", () => selectEvent(quake.id, { flyTo: true }));
      markersById.set(quake.id, marker);
    });

    if (state.selectedId && markersById.has(state.selectedId)) {
      markersById.get(state.selectedId).bringToFront();
    }
  }

  function renderDetail() {
    const quake = allEvents.find((e) => e.id === state.selectedId) || currentVisibleEvents[0] || null;
    if (!quake) {
      els.detailCard.classList.remove("is-visible");
      return;
    }

    els.detailCard.classList.add("is-visible");
    const magColor = magnitudeColor(quake.mag);
    els.detailAccent.style.background = magColor;
    els.detailMag.textContent = `M ${quake.mag.toFixed(1)}`;
    els.detailMag.style.background = `${magColor}18`;
    els.detailMag.style.color = magColor;
    els.detailMag.style.borderColor = `${magColor}40`;

    els.detailTitle.textContent = quake.place;
    els.detailSub.textContent = `${depthBandLabel(quake.depth)} · ${quake.type || "earthquake"}`;
    els.detailGrid.innerHTML = [
      detailRow("Time", formatTime(quake.time)),
      detailRow("Relative", formatRelative(quake.time)),
      detailRow("Location", `${quake.lat.toFixed(3)}°, ${quake.lng.toFixed(3)}°`),
      detailRow("Depth", `${quake.depth.toFixed(1)} km`),
      detailRow("Magnitude", `${quake.mag.toFixed(1)} · ${magnitudeLabel(quake.mag)}`),
      detailRow("Significance", String(quake.sig)),
      quake.felt > 0 ? detailRow("Reported", `${formatNumber(quake.felt)} people`) : "",
      quake.alert ? detailRow("Alert", quake.alert.toUpperCase()) : "",
      quake.tsunami === 1 ? detailRow("Tsunami", "Possible tsunami") : "",
    ].filter(Boolean).join("");

    els.detailCardLink.href = quake.url;
  }

  function detailRow(label, value) {
    return `<div class="detail-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderDetailForSelected() {
    const quake = allEvents.find((e) => e.id === state.selectedId);
    if (!quake) return;
    renderDetail();
    const marker = markersById.get(quake.id);
    if (marker) marker.bringToFront();
  }

  function selectEvent(id, { flyTo = false } = {}) {
    state.selectedId = id;
    renderScene();

    const quake = allEvents.find((e) => e.id === id);
    if (!quake) return;

    if (flyTo) {
      const zoom = Math.max(map.getZoom(), 5);
      map.flyTo([quake.lat, quake.lng], zoom, { duration: 0.7 });
    }

    const marker = markersById.get(id);
    if (marker) marker.openTooltip();
  }

  function focusSelectedEvent() {
    const quake = allEvents.find((e) => e.id === state.selectedId);
    if (!quake) return;
    map.flyTo([quake.lat, quake.lng], Math.max(map.getZoom(), 5), { duration: 0.7 });
  }

  function resetFilters() {
    state.days = 7;
    state.minMag = 1.5;
    state.depth = "all";
    state.category = "all";
    state.sort = "time";
    state.search = "";
    state.visibleOnly = false;
    state.selectedId = null;
    renderControls();
    fetchEarthquakes();
  }

  function setLoading(value) {
    loading = value;
    els.loadingToast.classList.toggle("is-visible", value);
  }

  function setError(message) {
    els.errorToast.textContent = message;
    els.errorToast.classList.toggle("is-visible", Boolean(message));
  }

  function magnitudeColor(magnitude) {
    if (magnitude >= 8) return "#8b5cf6";
    if (magnitude >= 7) return "#ef4444";
    if (magnitude >= 6) return "#f97316";
    if (magnitude >= 5) return "#f59e0b";
    if (magnitude >= 4) return "#fde047";
    if (magnitude >= 3) return "#4ade80";
    if (magnitude >= 2) return "#22d3ee";
    return "#60a5fa";
  }

  function magnitudeLabel(magnitude) {
    if (magnitude >= 7) return "great";
    if (magnitude >= 6) return "strong";
    if (magnitude >= 5) return "moderate";
    if (magnitude >= 4) return "light";
    if (magnitude >= 3) return "minor";
    return "very minor";
  }

  function depthBandKey(depth) {
    if (depth < 70) return "shallow";
    if (depth < 300) return "intermediate";
    return "deep";
  }

  function depthBandLabel(depth) {
    return DEPTH_BANDS.find((band) => band.key === depthBandKey(depth))?.label || "Unknown depth";
  }

  function depthBandColor(depth) {
    return DEPTH_BANDS.find((band) => band.key === depthBandKey(depth))?.color || "#cbd5e1";
  }

  function markerRadius(magnitude) {
    return Math.max(4.5, Math.min(18, 3.5 + Math.pow(Math.max(magnitude, 0), 1.25) * 1.4));
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }

  function formatRelative(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.round(diff / 60000);
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
