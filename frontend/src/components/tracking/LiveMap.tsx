"use client";

// Street map for live tracking: MapLibre GL with OpenFreeMap's Positron style (free, no API key,
// OpenStreetMap data, commercial use allowed; attribution shown by the style). Loaded only on this
// page. The shuttle marker glides between position updates; the route from the depot is drawn solid
// for the part driven and dashed for what's left to the pickup.

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
type LngLat = [number, number];

interface Props {
  start?: LngLat;
  vehicle: LngLat;
  pickup: LngLat;
  label: string;
  onError: () => void;
}

function markerEl(kind: "vehicle" | "pickup" | "start") {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  if (kind === "vehicle") {
    el.className = "relative h-6 w-6";
    el.innerHTML =
      '<span class="absolute -inset-2 rounded-full bg-ocean-500/25 motion-safe:animate-ping"></span><span class="absolute inset-0 rounded-full border-[3px] border-white bg-ocean-600 shadow-md"></span>';
  } else if (kind === "pickup") {
    el.className = "h-5 w-5 rounded-full border-[3px] border-white bg-summit-500 shadow-md";
  } else {
    el.className = "h-3 w-3 rounded-full border-2 border-obsidian-900/40 bg-white";
  }
  return el;
}

const line = (coords: LngLat[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } });

export function LiveMap({ start, vehicle, pickup, label, onError }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const car = useRef<Marker | null>(null);
  const pos = useRef<LngLat>(vehicle);
  const ready = useRef(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        const m = new ml.Map({
          container: box.current,
          style: STYLE,
          bounds: new ml.LngLatBounds(vehicle, vehicle).extend(pickup).extend(start ?? pickup),
          fitBoundsOptions: { padding: 56, maxZoom: 15 },
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        m.on("error", (e) => {
          // Tile hiccups are recoverable; only give up if the map never loaded.
          if (!ready.current) console.warn("Map error", e.error);
        });
        m.on("load", () => {
          ready.current = true;
          m.addSource("left", { type: "geojson", data: line([vehicle, pickup]) });
          m.addLayer({ id: "left", type: "line", source: "left", paint: { "line-color": "#1C1F23", "line-opacity": 0.35, "line-width": 3, "line-dasharray": [1, 2] }, layout: { "line-cap": "round" } });
          if (start) {
            m.addSource("done", { type: "geojson", data: line([start, vehicle]) });
            m.addLayer({ id: "done", type: "line", source: "done", paint: { "line-color": "#257780", "line-width": 5 }, layout: { "line-cap": "round" } });
            new ml.Marker({ element: markerEl("start") }).setLngLat(start).addTo(m);
          }
          // No popup: it would make the marker a tab stop; the pickup name is in the card beside the map.
          new ml.Marker({ element: markerEl("pickup") }).setLngLat(pickup).addTo(m);
          car.current = new ml.Marker({ element: markerEl("vehicle") }).setLngLat(vehicle).addTo(m);
        });
      } catch (err) {
        console.warn("Map unavailable", err);
        if (!cancelled) onError();
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glide the shuttle to each new position and redraw the route lines.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !car.current) {
      pos.current = vehicle;
      return;
    }
    const from = pos.current;
    const to = vehicle;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const stepTo = (p: LngLat) => {
      pos.current = p;
      car.current?.setLngLat(p);
      (m.getSource("left") as GeoJSONSource | undefined)?.setData(line([p, pickup]));
      if (start) (m.getSource("done") as GeoJSONSource | undefined)?.setData(line([start, p]));
    };
    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / 1000);
      const e = 1 - (1 - k) ** 3;
      stepTo([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vehicle, pickup, start]);

  return <div ref={box} role="region" aria-label={label} className="h-[22rem] w-full sm:h-[26rem]" />;
}
