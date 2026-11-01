import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Minimize2,
  Columns,
  Layers,
  Footprints,
  Compass,
  Navigation,
  X,
} from 'lucide-react';
import { ActivityStep, calculateHaversineKm } from '../utils/travelLogic';
import { PhotoSpot, DiscoveryPlace } from '../data/destinationsData';
import { ThemePalette } from '../utils/themeConfig';
import { triggerHaptic } from '../utils/haptics';

export const isValidLatLng = (lat: unknown, lng: unknown): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const safeFlyTo = (
  map: L.Map | null,
  target: [number, number],
  targetZoom = 15,
  options?: L.ZoomPanOptions
) => {
  if (!map || !isValidLatLng(target[0], target[1])) return;
  try {
    const size = map.getSize();
    // In Leaflet, if container width or height is <= 10px, flyTo divides by 0 and throws Invalid LatLng object: (NaN, NaN)
    if (!size || size.x <= 10 || size.y <= 10) {
      map.invalidateSize();
      map.setView(target, targetZoom, { animate: false });
    } else {
      map.flyTo(target, targetZoom, options || { duration: 0.8 });
    }
  } catch (err) {
    console.warn('safeFlyTo fallback:', err);
    try {
      map.setView(target, targetZoom, { animate: false });
    } catch {
      // safe fallback
    }
  }
};

const safeFitBounds = (
  map: L.Map | null,
  coords: [number, number][],
  padding: [number, number] = [30, 30]
) => {
  if (!map || coords.length === 0) return;
  const validCoords = coords.filter((c) => isValidLatLng(c[0], c[1]));
  if (validCoords.length === 0) return;
  if (validCoords.length === 1) {
    safeFlyTo(map, validCoords[0], 15);
    return;
  }
  try {
    const size = map.getSize();
    if (!size || size.x <= 10 || size.y <= 10) {
      map.invalidateSize();
    }
    const bounds = L.latLngBounds(validCoords);
    map.fitBounds(bounds, { padding, maxZoom: 15 });
  } catch (err) {
    console.warn('safeFitBounds fallback:', err);
    if (validCoords[0]) {
      safeFlyTo(map, validCoords[0], 14);
    }
  }
};

interface CornerInteractiveMapProps {
  center: [number, number];
  zoom: number;
  steps: ActivityStep[];
  photoSpots?: PhotoSpot[];
  discoveryPlaces?: DiscoveryPlace[];
  selectedStepId: string | null;
  inspectedPlace: DiscoveryPlace | null;
  isOpen: boolean;
  dockPosition: 'corner' | 'left-pane';
  onToggleDock: () => void;
  onClose: () => void;
  onSelectStep: (stepId: string) => void;
  theme: ThemePalette;
}

export const CornerInteractiveMap: React.FC<CornerInteractiveMapProps> = ({
  center,
  zoom,
  steps,
  selectedStepId,
  inspectedPlace,
  isOpen,
  dockPosition,
  onToggleDock,
  onClose,
  onSelectStep,
  theme,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const [activeLayer, setActiveLayer] = useState<'voyage' | 'satellite'>('voyage');

  const safeCenter: [number, number] =
    Array.isArray(center) && isValidLatLng(center[0], center[1])
      ? center
      : [41.9028, 12.4964];
  const safeZoom = typeof zoom === 'number' && !isNaN(zoom) ? zoom : 14;

  // Initialize Leaflet Map once DOM is ready
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: safeCenter,
        zoom: safeZoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    // Force map invalidateSize after animation frames when opened or docked
    const timer1 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 60);

    const timer2 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 320);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen, dockPosition]);

  // Cleanup Leaflet Map on Unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });

    const tileUrl =
      activeLayer === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(mapInstanceRef.current);
  }, [activeLayer]);

  // Update Markers & Route Polyline & Safe FlyTo
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const routeCoords: [number, number][] = [];

    // 1. Render steps
    steps.forEach((step, idx) => {
      if (!isValidLatLng(step.lat, step.lng)) return;

      routeCoords.push([step.lat, step.lng]);
      const isSelected = step.id === selectedStepId;

      const iconHtml = `
        <div style="
          background-color: ${isSelected ? theme.primary : '#18152B'};
          color: ${isSelected ? theme.primaryText : '#FFFFFF'};
          border: 2px solid ${isSelected ? '#FFFFFF' : theme.primary};
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.2s ease;
          ${isSelected ? 'transform: scale(1.25);' : ''}
        ">
          ${idx + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'aura-step-marker',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([step.lat, step.lng], { icon: customIcon });

      marker.on('click', () => {
        triggerHaptic('hover');
        onSelectStep(step.id);
      });

      marker.bindTooltip(
        `<div style="font-family:'Plus Jakarta Sans', sans-serif; font-size:12px; font-weight:700;">
          ${idx + 1}. ${step.name} (${step.time})
        </div>`,
        { direction: 'top', offset: [0, -16] }
      );

      markersGroup.addLayer(marker);
    });

    // 2. Render inspected place if available
    if (inspectedPlace && isValidLatLng(inspectedPlace.lat, inspectedPlace.lng)) {
      const inspectIcon = L.divIcon({
        className: 'aura-inspect-marker',
        html: `
          <div style="
            background: #D97706;
            color: #FFFFFF;
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 0 6px rgba(217,119,6,0.35);
            width: 36px;
            height: 36px;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            animation: pulse 2s infinite;
          ">
            ★
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const inspectMarker = L.marker([inspectedPlace.lat, inspectedPlace.lng], {
        icon: inspectIcon,
      }).bindTooltip(
        `<div style="font-family:'Plus Jakarta Sans'; font-size:12px; font-weight:700;">
          ${inspectedPlace.name} · ${
          inspectedPlace.period === 'day'
            ? '☀️ Journée'
            : inspectedPlace.period === 'evening'
            ? '🍽️ Dîner'
            : '🌙 Nuit'
        }
        </div>`,
        { permanent: true, direction: 'top', offset: [0, -18] }
      );

      markersGroup.addLayer(inspectMarker);
    }

    // 3. Render route polyline
    if (routeCoords.length >= 2) {
      const polyline = L.polyline(routeCoords, {
        color: theme.primary,
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round',
      }).addTo(map);

      routeLayerRef.current = polyline;
    }

    // 4. Safe Auto-Focus when map is visible
    if (isOpen) {
      const focusTimer = setTimeout(() => {
        if (!mapInstanceRef.current) return;
        if (inspectedPlace && isValidLatLng(inspectedPlace.lat, inspectedPlace.lng)) {
          safeFlyTo(mapInstanceRef.current, [inspectedPlace.lat, inspectedPlace.lng], 15, { duration: 1 });
        } else if (selectedStepId) {
          const step = steps.find((s) => s.id === selectedStepId);
          if (step && isValidLatLng(step.lat, step.lng)) {
            safeFlyTo(mapInstanceRef.current, [step.lat, step.lng], 15, { duration: 0.8 });
          }
        } else if (routeCoords.length > 0) {
          safeFitBounds(mapInstanceRef.current, routeCoords, [40, 40]);
        }
      }, 70);

      return () => clearTimeout(focusTimer);
    }
  }, [steps, selectedStepId, inspectedPlace, theme, isOpen]);

  // Selected step data for bottom inspector
  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0];
  const activeIndex = steps.findIndex((s) => s.id === selectedStepId);
  const nextStep =
    activeIndex >= 0 && activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;

  return (
    <div
      style={{
        borderColor: theme.border,
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
      }}
      aria-hidden={!isOpen}
      className={`fixed z-40 border rounded-3xl overflow-hidden backdrop-blur-xl transition-all duration-300 flex flex-col ${
        !isOpen
          ? 'opacity-0 pointer-events-none scale-95 translate-y-4 invisible'
          : 'opacity-100 pointer-events-auto scale-100 translate-y-0 visible'
      } ${
        dockPosition === 'left-pane'
          ? 'top-20 left-4 bottom-4 w-[calc(100%-2rem)] sm:w-[500px] lg:w-[48%] xl:w-[45%]'
          : 'bottom-4 left-4 w-[360px] sm:w-[440px] h-[360px] sm:h-[400px]'
      }`}
    >
      {/* Map Header Toolbar */}
      <div
        style={{
          backgroundColor: theme.bgSurface,
          borderColor: theme.border,
        }}
        className="p-3 border-b flex items-center justify-between shrink-0 select-none"
      >
        <div className="flex items-center gap-2">
          <div
            style={{ backgroundColor: theme.badgeBg, color: theme.primary }}
            className="w-7 h-7 rounded-xl flex items-center justify-center font-bold"
          >
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 style={{ color: theme.textHeading }} className="font-heading font-extrabold text-xs">
              Carte Interactive du Trajet
            </h4>
            <p style={{ color: theme.textMuted }} className="text-[10px]">
              {steps.length} étapes · {inspectedPlace ? `Focus : ${inspectedPlace.name}` : 'En direct'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Layer Toggle */}
          <button
            onClick={() => {
              triggerHaptic('hover');
              setActiveLayer(activeLayer === 'voyage' ? 'satellite' : 'voyage');
            }}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:border-black/20"
            title="Changer de vue cartographique"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{activeLayer === 'voyage' ? 'Plan' : 'Satellite'}</span>
          </button>

          {/* Reset View / Fit Bounds */}
          <button
            onClick={() => {
              triggerHaptic('hover');
              if (steps.length > 0 && mapInstanceRef.current) {
                const coords: [number, number][] = steps
                  .filter((s) => isValidLatLng(s.lat, s.lng))
                  .map((s) => [s.lat, s.lng]);
                safeFitBounds(mapInstanceRef.current, coords, [30, 30]);
              }
            }}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-1.5 rounded-xl border hover:border-black/20 transition-all cursor-pointer"
            title="Recadrer sur toutes les étapes"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>

          {/* Dock / Expand Toggle */}
          <button
            onClick={() => {
              triggerHaptic('hover');
              onToggleDock();
            }}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-1.5 rounded-xl border hover:border-black/20 transition-all cursor-pointer"
            title={dockPosition === 'corner' ? 'Agrandir en volet à gauche' : 'Réduire en coin flottant'}
          >
            {dockPosition === 'corner' ? <Columns className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          <button
            onClick={() => {
              triggerHaptic('cancel');
              onClose();
            }}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-1.5 rounded-xl border hover:text-rose-600 transition-all cursor-pointer"
            title="Masquer la carte"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map Container Viewport */}
      <div className="flex-1 relative w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Selected Step Mini Inspector Bar */}
        {activeStep && (
          <div
            style={{
              backgroundColor: theme.bgSurface,
              borderColor: theme.border,
            }}
            className="absolute bottom-3 left-3 right-3 p-2.5 rounded-2xl border shadow-lg backdrop-blur-md flex items-center justify-between text-xs z-1000"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span
                style={{
                  backgroundColor: theme.primary,
                  color: theme.primaryText,
                }}
                className="w-5 h-5 rounded-full font-mono font-bold text-[10px] flex items-center justify-center shrink-0"
              >
                {activeIndex >= 0 ? activeIndex + 1 : '★'}
              </span>
              <div className="truncate">
                <span style={{ color: theme.textHeading }} className="font-bold font-heading truncate block">
                  {inspectedPlace ? inspectedPlace.name : activeStep.name}
                </span>
                <span style={{ color: theme.textMuted }} className="text-[10px]">
                  {inspectedPlace ? inspectedPlace.address : `${activeStep.time} • ${activeStep.address}`}
                </span>
              </div>
            </div>

            {nextStep && !inspectedPlace && isValidLatLng(activeStep.lat, activeStep.lng) && isValidLatLng(nextStep.lat, nextStep.lng) && (
              <div
                style={{
                  backgroundColor: theme.bgSurfaceSubtle,
                  borderColor: theme.border,
                }}
                className="border rounded-xl px-2 py-1 flex items-center gap-1.5 shrink-0 ml-2 text-[11px]"
              >
                <Footprints style={{ color: theme.primary }} className="w-3 h-3" />
                <span style={{ color: theme.textHeading }} className="font-mono font-bold">
                  {calculateHaversineKm(activeStep.lat, activeStep.lng, nextStep.lat, nextStep.lng)} km
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
