import React, { useState } from 'react';

interface GoogleMapsLocationPickerProps {
  initialAddress: string;
  initialCoords?: string;
  onLocationSaved: (newAddress: string, coords: string, placeName: string) => void;
}

export const GoogleMapsLocationPicker: React.FC<GoogleMapsLocationPickerProps> = ({
  initialAddress,
  initialCoords = '-34.603722, -58.423145',
  onLocationSaved
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialAddress);
  const [currentAddress, setCurrentAddress] = useState(initialAddress);
  const [currentCoords, setCurrentCoords] = useState(initialCoords);
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map');
  const [zoomLevel, setZoomLevel] = useState(16);
  const [isSaved, setIsSaved] = useState(false);
  const [pinOffset, setPinOffset] = useState({ x: 50, y: 50 }); // percentage on map

  // Preset location suggestions for quick picking
  const presetLocations = [
    {
      name: 'Av. Corrientes 4520, Almagro, CABA',
      coords: '-34.603722, -58.423145',
      area: 'Almagro'
    },
    {
      name: 'Av. Santa Fe 3200, Palermo, CABA',
      coords: '-34.588145, -58.411233',
      area: 'Palermo'
    },
    {
      name: 'Av. Cabildo 2040, Belgrano, CABA',
      coords: '-34.561214, -58.456891',
      area: 'Belgrano'
    },
    {
      name: 'Av. Rivadavia 5100, Caballito, CABA',
      coords: '-34.620188, -58.438912',
      area: 'Caballito'
    }
  ];

  const handleSelectPreset = (loc: typeof presetLocations[0]) => {
    setCurrentAddress(loc.name);
    setSearchQuery(loc.name);
    setCurrentCoords(loc.coords);
    setIsSaved(false);
    setPinOffset({ x: 50, y: 50 });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setCurrentAddress(searchQuery.trim());
    setIsSaved(false);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(15, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(15, Math.min(85, ((e.clientY - rect.top) / rect.height) * 100));
    setPinOffset({ x, y });

    // Derive slight lat/lng adjustments based on pin placement
    const [baseLat, baseLng] = currentCoords.split(',').map((c) => parseFloat(c.trim()) || 0);
    const newLat = (baseLat + (50 - y) * 0.00015).toFixed(6);
    const newLng = (baseLng + (x - 50) * 0.00015).toFixed(6);
    setCurrentCoords(`${newLat}, ${newLng}`);
    setIsSaved(false);
  };

  const handleSaveLocation = () => {
    onLocationSaved(currentAddress, currentCoords, currentAddress.split(',')[0]);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3500);
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    currentAddress
  )}`;

  return (
    <div className="bg-[#fcf8ff] rounded-2xl p-4 border border-[#cfc2d2]/40 space-y-3 mt-3">
      {/* Header / Toggle Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-lg">pin_drop</span>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-[#1a1a26]">
              Ubicación en Google Maps
            </h4>
            <p className="text-[11px] text-[#7e7482]">
              Configura el punto exacto en el mapa para las citas de tus clientes
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 shadow-xs flex items-center gap-1 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">
            {isOpen ? 'expand_less' : 'tune'}
          </span>
          <span>{isOpen ? 'Ocultar mapa' : 'Configurar en mapa'}</span>
        </button>
      </div>

      {/* Current Saved Location Preview Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-[#cfc2d2]/30 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[#4b0878] text-base shrink-0">
            my_location
          </span>
          <div className="min-w-0">
            <span className="font-bold text-[#1a1a26] truncate block">{currentAddress}</span>
            <span className="text-[10px] text-[#7e7482] block font-mono">
              Coordenadas GPS: {currentCoords}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-[#2e004e] hover:text-[#4b0878] hover:underline flex items-center gap-1"
          >
            <span>Ver en Google Maps</span>
            <span className="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        </div>
      </div>

      {/* Expanded Interactive Google Maps Selector */}
      {isOpen && (
        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
          {/* Search bar inside Google Maps picker */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-[#7e7482] text-sm absolute left-3 top-3">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar dirección, calle o referencia en Google Maps..."
                className="w-full bg-white text-xs pl-8 pr-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] focus:ring-1 focus:ring-[#2e004e]"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2.5 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              Buscar
            </button>
          </form>

          {/* Preset quick suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-[#7e7482] font-semibold">Sugerencias:</span>
            {presetLocations.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => handleSelectPreset(loc)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  currentAddress === loc.name
                    ? 'bg-[#2e004e] text-white font-bold'
                    : 'bg-white text-[#4c4451] hover:bg-[#f5f2ff] border border-[#cfc2d2]/30'
                }`}
              >
                📍 {loc.area}
              </button>
            ))}
          </div>

          {/* Interactive Simulated Google Maps Canvas */}
          <div className="relative rounded-2xl overflow-hidden border border-[#cfc2d2]/50 shadow-inner select-none">
            {/* Map Top Bar Controls */}
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-xs rounded-xl p-1 shadow-md border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setMapType('map')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  mapType === 'map'
                    ? 'bg-[#2e004e] text-white'
                    : 'text-[#4c4451] hover:bg-gray-100'
                }`}
              >
                Mapa
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  mapType === 'satellite'
                    ? 'bg-[#2e004e] text-white'
                    : 'text-[#4c4451] hover:bg-gray-100'
                }`}
              >
                Satélite
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-3 right-3 z-20 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel(Math.min(19, zoomLevel + 1))}
                className="w-8 h-8 flex items-center justify-center font-bold text-[#1a1a26] hover:bg-gray-100 border-b border-gray-100 cursor-pointer"
                title="Acercar"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.max(12, zoomLevel - 1))}
                className="w-8 h-8 flex items-center justify-center font-bold text-[#1a1a26] hover:bg-gray-100 cursor-pointer"
                title="Alejar"
              >
                -
              </button>
            </div>

            {/* Interactive Map Visual Surface */}
            <div
              onClick={handleMapClick}
              className={`w-full h-64 sm:h-72 relative cursor-crosshair transition-colors ${
                mapType === 'map'
                  ? 'bg-[#e5e3df]'
                  : 'bg-[#1c2c1c]'
              }`}
              style={{
                backgroundImage:
                  mapType === 'map'
                    ? 'radial-gradient(#cfcbbf 1px, transparent 1px), linear-gradient(to right, #dedad0 1px, transparent 1px), linear-gradient(to bottom, #dedad0 1px, transparent 1px)'
                    : 'radial-gradient(#304830 1px, transparent 1px), linear-gradient(to right, #243424 1px, transparent 1px), linear-gradient(to bottom, #243424 1px, transparent 1px)',
                backgroundSize: '40px 40px, 80px 80px, 80px 80px'
              }}
              title="Haz clic en cualquier punto del mapa para ubicar tu salón"
            >
              {/* Street Graphics Overlay */}
              <svg className="w-full h-full pointer-events-none opacity-80" xmlns="http://www.w3.org/2000/svg">
                {/* Main Avenues */}
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke={mapType === 'map' ? '#ffffff' : '#455a45'} strokeWidth="16" />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke={mapType === 'map' ? '#ffffff' : '#455a45'} strokeWidth="16" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke={mapType === 'map' ? '#fcd567' : '#5c785c'} strokeWidth="4" />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke={mapType === 'map' ? '#fcd567' : '#5c785c'} strokeWidth="4" />

                {/* Secondary Streets */}
                <line x1="0" y1="25%" x2="100%" y2="25%" stroke={mapType === 'map' ? '#ffffff' : '#334833'} strokeWidth="8" />
                <line x1="0" y1="75%" x2="100%" y2="75%" stroke={mapType === 'map' ? '#ffffff' : '#334833'} strokeWidth="8" />
                <line x1="25%" y1="0" x2="25%" y2="100%" stroke={mapType === 'map' ? '#ffffff' : '#334833'} strokeWidth="8" />
                <line x1="75%" y1="0" x2="75%" y2="100%" stroke={mapType === 'map' ? '#ffffff' : '#334833'} strokeWidth="8" />

                {/* Parks / Green areas */}
                <rect x="60%" y="15%" width="25%" height="25%" rx="12" fill={mapType === 'map' ? '#c8e6c9' : '#1e381e'} />
                <text x="65%" y="28%" fontSize="10" fontWeight="bold" fill={mapType === 'map' ? '#2e7d32' : '#81c784'}>
                  Parque Almagro
                </text>

                {/* Street Names */}
                <text x="5%" y="47%" fontSize="11" fontWeight="bold" fill={mapType === 'map' ? '#5f6368' : '#cbd5e1'}>
                  Av. Corrientes
                </text>
                <text x="52%" y="20%" fontSize="10" fontWeight="600" fill={mapType === 'map' ? '#70757a' : '#cbd5e1'}>
                  Av. Medrano
                </text>
              </svg>

              {/* Interactive Pin Marker with info popup */}
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-full transition-all duration-150 pointer-events-none"
                style={{ left: `${pinOffset.x}%`, top: `${pinOffset.y}%` }}
              >
                {/* Floating Info Tooltip */}
                <div className="bg-[#2e004e] text-white px-3 py-1.5 rounded-xl shadow-xl border border-[#f9b900] text-[11px] font-bold whitespace-nowrap mb-1 flex items-center gap-1.5 animate-bounce">
                  <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                  <span>{currentAddress.split(',')[0]}</span>
                </div>

                {/* Pin Icon Graphic */}
                <div className="flex flex-col items-center">
                  <span className="material-symbols-outlined text-[#ea4335] text-4xl drop-shadow-md">
                    location_on
                  </span>
                  <div className="w-3 h-1.5 bg-black/40 rounded-full blur-[1px] -mt-1"></div>
                </div>
              </div>

              {/* Instructions banner on map */}
              <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] text-[#4c4451] font-medium shadow-xs border border-gray-200">
                👆 Haz clic para reubicar el pin exacto
              </div>
            </div>
          </div>

          {/* Action Row: Save Location & Customer Usage Explanation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-[#4c4451] space-y-0.5">
              <span className="font-bold text-[#1a1a26] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#f9b900]">check_circle</span>
                <span>Uso para información de clientes:</span>
              </span>
              <p className="text-[#7e7482]">
                Esta ubicación exacta se incluirá automáticamente en la confirmación de turnos por WhatsApp y en el portal de citas para que los clientes lleguen guiados con GPS.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveLocation}
                className="py-2.5 px-4 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm text-[#f9b900]">
                  {isSaved ? 'check' : 'save'}
                </span>
                <span>{isSaved ? '¡Ubicación guardada!' : 'Guardar ubicación en Google Maps'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
