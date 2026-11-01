import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ActivityStep } from '../utils/travelLogic';
import { PhotoSpot } from '../data/destinationsData';
import { ThemePalette } from '../utils/themeConfig';
import { isValidLatLng } from './CornerInteractiveMap';

interface AuraMapProps {
  center: [number, number];
  zoom: number;
  steps: ActivityStep[];
  photoSpots: PhotoSpot[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onAddPhotoSpot: (spot: PhotoSpot) => void;
  showPhotoSpots: boolean;
  theme: ThemePalette;
}

export const AuraMap: React.FC<AuraMapProps> = ({
  center,
  zoom,
  steps,
  photoSpots,
  selectedStepId,
  onSelectStep,
  onAddPhotoSpot,
  showPhotoSpots,
  theme,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeGlowLayerRef = useRef<L.Polyline | null>(null);
  const photoSpotsLayerRef = useRef<L.LayerGroup | null>(null);

  const safeCenter: [number, number] =
    Array.isArray(center) && isValidLatLng(center[0], center[1])
      ? center
      : [41.9028, 12.4964];
  const safeZoom = typeof zoom === 'number' && !isNaN(zoom) ? zoom : 14;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: safeCenter,
        zoom: safeZoom,
        zoomControl: false,
        attributionControl: false,
      });

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: theme.mapTileClass,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Attribution
      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
        .addTo(map);

      // Custom zoom control
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      photoSpotsLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    const t = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);

    return () => clearTimeout(t);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        photoSpotsLayerRef.current = null;
        routeLayerRef.current = null;
        routeGlowLayerRef.current = null;
      }
    };
  }, []);

  // Update Tile Class when theme changes
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const container = tileLayerRef.current.getContainer();
    if (container) {
      container.className = `leaflet-layer ${theme.mapTileClass}`;
    }
  }, [theme]);

  // Update center & zoom when destination changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (isValidLatLng(center[0], center[1])) {
      try {
        mapInstanceRef.current.setView(center, safeZoom, { animate: true, duration: 1.2 });
      } catch (err) {
        console.warn('Map setView error:', err);
      }
    }
  }, [center, safeZoom]);

  // Render Activity Markers & Route Polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (routeGlowLayerRef.current) {
      routeGlowLayerRef.current.remove();
      routeGlowLayerRef.current = null;
    }

    const latLngs: [number, number][] = [];

    steps.forEach((step, idx) => {
      if (!isValidLatLng(step.lat, step.lng)) return;

      latLngs.push([step.lat, step.lng]);
      const isSelected = step.id === selectedStepId;

      // Dynamic theme-based HTML Marker
      const markerHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center transform transition-transform duration-300 ${
          isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-30'
        }">
          <div style="background: ${theme.markerBg}; color: ${theme.markerText}; box-shadow: 0 4px 12px ${theme.accentGlow};" class="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs border-2 border-white transition-all ${
            isSelected ? 'ring-4 custom-pulse-marker' : ''
          }">
            ${idx + 1}
          </div>
          <div style="background: ${theme.primary};" class="absolute -bottom-1 w-2 h-2 rotate-45 transform origin-center border-r border-b border-white"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'aura-custom-marker',
        iconSize: [32, 38],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([step.lat, step.lng], { icon: customIcon });

      // Rich Light Theme Popup
      const popupContent = `
        <div class="p-2.5 max-w-[220px]">
          ${
            step.image
              ? `<img src="${step.image}" alt="${step.name}" class="w-full h-24 object-cover rounded-xl mb-2 shadow-sm border border-black/5" />`
              : ''
          }
          <div class="flex items-center gap-1.5 mb-1.5">
            <span style="background: ${theme.badgeBg}; color: ${theme.badgeText}; border: 1px solid ${theme.border};" class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Étape ${idx + 1} • ${step.time}
            </span>
          </div>
          <h4 style="color: ${theme.textHeading};" class="font-bold text-sm leading-tight mb-1 font-heading">${step.name}</h4>
          <p style="color: ${theme.textBody};" class="text-xs mb-2 line-clamp-2 leading-relaxed">${step.description}</p>
          <div class="flex items-center justify-between text-xs pt-2 border-t border-black/5">
            <span style="color: ${theme.primary};" class="font-mono font-bold">${step.price > 0 ? `${step.price} €` : 'Gratuit'}</span>
            <span style="color: ${theme.textMuted};">${step.durationMinutes} min</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: 'aura-leaflet-popup',
      });

      marker.on('click', () => {
        onSelectStep(step.id);
      });

      marker.addTo(layer);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Draw Route Polyline with current theme colors
    if (latLngs.length > 1) {
      routeGlowLayerRef.current = L.polyline(latLngs, {
        color: theme.routeGlow,
        weight: 6,
        opacity: 0.45,
        lineCap: 'round',
      }).addTo(layer);

      routeLayerRef.current = L.polyline(latLngs, {
        color: theme.routeColor,
        weight: 3,
        opacity: 0.95,
        dashArray: '8, 8',
        lineCap: 'round',
      }).addTo(map);
    }

    if (latLngs.length > 1 && !selectedStepId) {
      try {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.warn('Map fitBounds error:', err);
      }
    }
  }, [steps, selectedStepId, theme]);

  // Center on selected step
  useEffect(() => {
    if (!selectedStepId || !mapInstanceRef.current) return;
    const step = steps.find((s) => s.id === selectedStepId);
    if (step && isValidLatLng(step.lat, step.lng)) {
      try {
        mapInstanceRef.current.panTo([step.lat, step.lng], {
          animate: true,
          duration: 0.8,
        });
      } catch (err) {
        console.warn('Map panTo error:', err);
      }
    }
  }, [selectedStepId, steps]);

  // Render Photo Spots
  useEffect(() => {
    if (!mapInstanceRef.current || !photoSpotsLayerRef.current) return;

    const layer = photoSpotsLayerRef.current;
    layer.clearLayers();

    if (!showPhotoSpots) return;

    photoSpots.forEach((spot) => {
      if (!isValidLatLng(spot.lat, spot.lng)) return;

      const iconHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center transform hover:scale-125 transition-transform duration-300">
          <div style="background: ${theme.primary}; box-shadow: 0 4px 12px ${theme.accentGlow};" class="w-7 h-7 rounded-full flex items-center justify-center text-white border border-white">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'aura-photo-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

      const popupContent = `
        <div class="p-2.5 max-w-[220px]">
          <img src="${spot.image}" alt="${spot.name}" class="w-full h-24 object-cover rounded-xl mb-2 shadow-sm border border-black/5" />
          <div class="flex items-center gap-1.5 mb-1">
            <span style="background: ${theme.badgeBg}; color: ${theme.badgeText}; border: 1px solid ${theme.border};" class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              📸 Spot Photo
            </span>
          </div>
          <h4 style="color: ${theme.textHeading};" class="font-bold text-sm leading-tight mb-1 font-heading">${spot.name}</h4>
          <p style="color: ${theme.primary};" class="text-[11px] font-medium mb-1">⏰ ${spot.bestTime}</p>
          <p style="color: ${theme.textBody};" class="text-xs mb-2 leading-relaxed">${spot.tip}</p>
          <button id="add-spot-${spot.id}" style="background: ${theme.primary}; color: ${theme.primaryText};" class="w-full py-1.5 font-bold text-xs rounded-xl shadow-sm hover:brightness-110 transition-colors flex items-center justify-center gap-1 cursor-pointer">
            + Ajouter à l'itinéraire
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: 'aura-leaflet-popup',
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`add-spot-${spot.id}`);
        if (btn) {
          btn.onclick = () => {
            onAddPhotoSpot(spot);
            marker.closePopup();
          };
        }
      });

      marker.addTo(layer);
    });
  }, [photoSpots, showPhotoSpots, onAddPhotoSpot, theme]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-sm" style={{ backgroundColor: theme.bgSurfaceSubtle }}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
