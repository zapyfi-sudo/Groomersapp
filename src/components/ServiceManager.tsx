import React, { useState } from 'react';
import { SalonService, ServicePricingBySize } from '../types';

interface ServiceManagerProps {
  services: SalonService[];
  onChangeServices: (updated: SalonService[]) => void;
  currency?: string;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({
  services,
  onChangeServices,
  currency = 'ARS'
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [pricingType, setPricingType] = useState<'unico' | 'tamano'>('unico');
  const [singlePrice, setSinglePrice] = useState(25000);
  const [sizePrices, setSizePrices] = useState<ServicePricingBySize>({
    pequeno: 20000,
    mediano: 25000,
    grande: 30000,
    extraGrande: 35000
  });
  const [imageUrl, setImageUrl] = useState('');
  const [active, setActive] = useState(true);

  const resetForm = () => {
    setName('');
    setDesc('');
    setDurationMin(60);
    setPricingType('unico');
    setSinglePrice(25000);
    setSizePrices({
      pequeno: 20000,
      mediano: 25000,
      grande: 30000,
      extraGrande: 35000
    });
    setImageUrl('');
    setActive(true);
    setEditingServiceId(null);
    setIsFormOpen(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (svc: SalonService) => {
    setEditingServiceId(svc.id);
    setName(svc.name);
    setDesc(svc.desc || '');
    setDurationMin(svc.durationMin || 60);
    setPricingType(svc.pricingType || 'unico');
    setSinglePrice(svc.price || 25000);
    if (svc.priceBySize) {
      setSizePrices(svc.priceBySize);
    } else {
      setSizePrices({
        pequeno: Math.round(svc.price * 0.8),
        mediano: svc.price,
        grande: Math.round(svc.price * 1.2),
        extraGrande: Math.round(svc.price * 1.4)
      });
    }
    setImageUrl(svc.imageUrl || '');
    setActive(svc.active ?? true);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const basePrice = pricingType === 'unico' ? singlePrice : sizePrices.mediano;

    if (editingServiceId) {
      onChangeServices(
        services.map((s) =>
          s.id === editingServiceId
            ? {
                ...s,
                name: name.trim(),
                desc: desc.trim(),
                durationMin: Number(durationMin),
                price: Number(basePrice),
                pricingType,
                priceBySize: pricingType === 'tamano' ? sizePrices : undefined,
                imageUrl: imageUrl.trim() || undefined,
                active
              }
            : s
        )
      );
    } else {
      const newSvc: SalonService = {
        id: 'svc-' + Date.now(),
        name: name.trim(),
        desc: desc.trim(),
        durationMin: Number(durationMin),
        price: Number(basePrice),
        pricingType,
        priceBySize: pricingType === 'tamano' ? sizePrices : undefined,
        imageUrl: imageUrl.trim() || undefined,
        active,
        icon: 'content_cut',
        rating: 5.0,
        reviewCount: 0
      };
      onChangeServices([...services, newSvc]);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    onChangeServices(services.filter((s) => s.id !== id));
  };

  const handleToggleActive = (id: string) => {
    onChangeServices(
      services.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
      {/* Header with clearly visible "+ Añadir servicio" button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#efecfd]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
            <span className="material-symbols-outlined text-2xl">content_cut</span>
          </div>
          <div>
            <h3 className="text-base font-black text-[#1a1a26]">Servicios</h3>
            <p className="text-xs text-[#7e7482]">
              Configura los servicios, duraciones y precios que ofreces a tus clientes
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="py-2.5 px-4 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-base text-[#f9b900]">add</span>
          <span>+ Añadir servicio</span>
        </button>
      </div>

      {/* Service Creation / Edit Modal Form */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-[#fcf8ff] rounded-2xl p-4 sm:p-5 border border-[#4b0878]/30 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-[#cfc2d2]/30">
            <h4 className="font-extrabold text-sm text-[#2e004e] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">
                {editingServiceId ? 'edit' : 'add_circle'}
              </span>
              <span>{editingServiceId ? 'Editar servicio' : 'Nuevo servicio'}</span>
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-[#7e7482] hover:text-[#1a1a26] text-xs font-bold"
            >
              ✕ Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Nombre del servicio */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Nombre del servicio *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Baño completo, Corte higiénico..."
                className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
              />
            </div>

            {/* Duración */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Duración del servicio (en minutos) *
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="bg-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none flex-1 cursor-pointer"
                >
                  <option value={20}>20 minutos (Rápido / Uñas)</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos (1 hora - Estándar)</option>
                  <option value={75}>75 minutos</option>
                  <option value={90}>90 minutos (1h 30m - Corte y Spa)</option>
                  <option value={120}>120 minutos (2 horas - Razas grandes)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-[#4c4451] block mb-1">
              Descripción del servicio
            </label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Detalla qué incluye el servicio (ej: corte higiénico, limpieza de oídos, secado...)"
              className="w-full bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
            />
          </div>

          {/* Pricing Model: Único vs Por tamaño */}
          <div className="space-y-2 bg-white rounded-xl p-3 border border-[#cfc2d2]/30">
            <span className="text-xs font-bold text-[#1a1a26] block">
              Modelo de precio:
            </span>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#1a1a26]">
                <input
                  type="radio"
                  name="pricingType"
                  value="unico"
                  checked={pricingType === 'unico'}
                  onChange={() => setPricingType('unico')}
                  className="text-[#2e004e]"
                />
                <span>Precio único</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#1a1a26]">
                <input
                  type="radio"
                  name="pricingType"
                  value="tamano"
                  checked={pricingType === 'tamano'}
                  onChange={() => setPricingType('tamano')}
                  className="text-[#2e004e]"
                />
                <span>Precio según tamaño</span>
              </label>
            </div>

            {pricingType === 'unico' ? (
              <div className="pt-2 flex items-center gap-2 max-w-xs">
                <span className="text-sm font-bold text-[#7e7482]">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={singlePrice}
                  onChange={(e) => setSinglePrice(Number(e.target.value))}
                  className="bg-[#f5f2ff] text-xs font-bold px-3 py-2 rounded-xl border border-[#cfc2d2]/30 outline-none w-full"
                />
                <span className="text-xs font-bold text-[#7e7482]">{currency}</span>
              </div>
            ) : (
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-[#7e7482] block">Pequeño</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={sizePrices.pequeno}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, pequeno: Number(e.target.value) })
                    }
                    className="w-full bg-[#f5f2ff] text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/30 outline-none mt-1"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#7e7482] block">Mediano</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={sizePrices.mediano}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, mediano: Number(e.target.value) })
                    }
                    className="w-full bg-[#f5f2ff] text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/30 outline-none mt-1"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#7e7482] block">Grande</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={sizePrices.grande}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, grande: Number(e.target.value) })
                    }
                    className="w-full bg-[#f5f2ff] text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/30 outline-none mt-1"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#7e7482] block">Extra grande</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={sizePrices.extraGrande}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, extraGrande: Number(e.target.value) })
                    }
                    className="w-full bg-[#f5f2ff] text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/30 outline-none mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Estado & Imagen */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1a1a26]">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-[#2e004e] rounded"
              />
              <span>Servicio activo para reservas</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 shadow-xs cursor-pointer flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                <span>{imageUrl ? 'Cambiar foto' : 'Subir foto (opcional)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-[#ba1a1a] hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#cfc2d2]/30">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#4c4451] text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all"
            >
              {editingServiceId ? 'Guardar cambios del servicio' : 'Crear servicio'}
            </button>
          </div>
        </form>
      )}

      {/* Services List Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {services.length === 0 ? (
          <div className="col-span-full py-8 text-center text-[#7e7482] text-xs bg-[#fcf8ff] rounded-2xl border border-dashed border-[#cfc2d2]">
            No tienes servicios configurados. Haz clic en "+ Añadir servicio" para crear el primero.
          </div>
        ) : (
          services.map((svc) => (
            <div
              key={svc.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                svc.active
                  ? 'bg-[#fcf8ff] border-[#cfc2d2]/40 hover:border-[#2e004e]/60 shadow-xs'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#f2daff] text-[#2e004e] flex items-center justify-center font-bold shrink-0">
                      <span className="material-symbols-outlined text-base">
                        {svc.icon || 'content_cut'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-[#1a1a26] leading-snug">
                        {svc.name}
                      </h4>
                      <span className="text-[11px] font-semibold text-[#7e7482] flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {svc.durationMin} minutos
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      svc.active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {svc.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {svc.desc && (
                  <p className="text-xs text-[#4c4451] line-clamp-2 leading-relaxed">
                    {svc.desc}
                  </p>
                )}

                {/* Price Display */}
                <div className="pt-1">
                  {svc.pricingType === 'tamano' && svc.priceBySize ? (
                    <div className="text-[11px] text-[#4c4451] bg-white rounded-lg p-2 border border-[#cfc2d2]/30 space-y-0.5">
                      <span className="font-bold text-[#2e004e] block">Por tamaño:</span>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <span>P: ${svc.priceBySize.pequeno.toLocaleString()}</span>
                        <span>M: ${svc.priceBySize.mediano.toLocaleString()}</span>
                        <span>G: ${svc.priceBySize.grande.toLocaleString()}</span>
                        <span>XG: ${svc.priceBySize.extraGrande.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-black text-[#2e004e]">
                      ${svc.price.toLocaleString()} {currency}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#cfc2d2]/30 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleActive(svc.id)}
                  className="text-[11px] font-bold text-[#4b0878] hover:underline cursor-pointer"
                >
                  {svc.active ? 'Desactivar' : 'Activar'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(svc)}
                    className="p-1.5 rounded-lg text-[#2e004e] hover:bg-white transition-colors cursor-pointer"
                    title="Editar servicio"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(svc.id)}
                    className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-white transition-colors cursor-pointer"
                    title="Eliminar servicio"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
