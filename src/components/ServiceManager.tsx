import React, { useState } from 'react';
import { SalonService, ServicePricingBySize } from '../types';
import { compressImage } from '../utils/storage';

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
  const [formError, setFormError] = useState('');

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
    setFormError('');
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
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!name.trim()) {
      setFormError('Por favor ingresa un nombre para el servicio.');
      return;
    }

    const basePrice = pricingType === 'unico' ? singlePrice : sizePrices.mediano;

    if (editingServiceId) {
      onChangeServices(
        services.map((s) => {
          if (s.id !== editingServiceId) return s;
          const updated: SalonService = {
            ...s,
            name: name.trim(),
            desc: desc.trim(),
            durationMin: Number(durationMin) || 60,
            price: Number(basePrice) || 0,
            pricingType,
            active
          };
          if (pricingType === 'tamano' && sizePrices) {
            updated.priceBySize = sizePrices;
          } else {
            delete updated.priceBySize;
          }
          if (imageUrl && imageUrl.trim()) {
            updated.imageUrl = imageUrl.trim();
          } else {
            delete updated.imageUrl;
          }
          return updated;
        })
      );
    } else {
      const newSvc: SalonService = {
        id: 'svc-' + Date.now(),
        name: name.trim(),
        desc: desc.trim(),
        durationMin: Number(durationMin) || 60,
        price: Number(basePrice) || 0,
        pricingType,
        active,
        icon: 'content_cut',
        rating: 5.0,
        reviewCount: 0
      };
      if (pricingType === 'tamano' && sizePrices) {
        newSvc.priceBySize = sizePrices;
      }
      if (imageUrl && imageUrl.trim()) {
        newSvc.imageUrl = imageUrl.trim();
      }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 480, 0.76);
        setImageUrl(compressed);
      } catch (err) {
        console.warn('Error uploading service image:', err);
      }
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

      {/* Service Creation / Edit Form (Rendered as div to avoid nested form redirection bugs) */}
      {isFormOpen && (
        <div className="bg-[#fcf8ff] rounded-2xl p-4 sm:p-5 border border-[#4b0878]/30 space-y-4 animate-in fade-in duration-200">
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

          {formError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
              {formError}
            </div>
          )}

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
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Ej: Baño + Corte de Raza"
                className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
              />
            </div>

            {/* Duración */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Duración promedio (minutos) *
              </label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full bg-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none cursor-pointer"
              >
                <option value={20}>20 minutos (Corte de uñas / express)</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos (Baño estándar)</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={75}>75 minutos (Deslanado)</option>
                <option value={90}>90 minutos (1h 30m - Baño y corte)</option>
                <option value={120}>120 minutos (2 horas - Razas grandes o spa)</option>
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-[#4c4451] block mb-1">
              Descripción detallada
            </label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Detalla lo que incluye el servicio: corte higiénico, limpieza de oídos, champú especial, etc."
              className="w-full bg-white text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] resize-none"
            />
          </div>

          {/* Modelo de precios */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#4c4451] block">
              Modelo de precios
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPricingType('unico')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  pricingType === 'unico'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                }`}
              >
                Precio único
              </button>
              <button
                type="button"
                onClick={() => setPricingType('tamano')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  pricingType === 'tamano'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                }`}
              >
                Precio según tamaño de la mascota
              </button>
            </div>

            {pricingType === 'unico' ? (
              <div className="pt-1 max-w-xs">
                <label className="text-[11px] font-bold text-[#7e7482] block mb-1">
                  Precio ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={singlePrice}
                  onChange={(e) => setSinglePrice(Number(e.target.value))}
                  className="w-full bg-white text-xs font-bold px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Pequeño (&lt;8kg)
                  </label>
                  <input
                    type="number"
                    value={sizePrices.pequeno}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, pequeno: Number(e.target.value) })
                    }
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Mediano (8-18kg)
                  </label>
                  <input
                    type="number"
                    value={sizePrices.mediano}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, mediano: Number(e.target.value) })
                    }
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Grande (18-30kg)
                  </label>
                  <input
                    type="number"
                    value={sizePrices.grande}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, grande: Number(e.target.value) })
                    }
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Gigante (&gt;30kg)
                  </label>
                  <input
                    type="number"
                    value={sizePrices.extraGrande}
                    onChange={(e) =>
                      setSizePrices({ ...sizePrices, extraGrande: Number(e.target.value) })
                    }
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Foto del servicio */}
          <div>
            <label className="text-xs font-bold text-[#4c4451] block mb-1">
              Foto o imagen del servicio
            </label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-[#cfc2d2]/40 shrink-0">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#7e7482] border border-dashed border-[#cfc2d2] shrink-0">
                  <span className="material-symbols-outlined text-xl">content_cut</span>
                </div>
              )}

              <label className="py-2 px-3 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 cursor-pointer shadow-xs flex items-center gap-1.5 transition-all">
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                <span>{imageUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#cfc2d2]/30">
            <button
              type="button"
              onClick={resetForm}
              className="py-2 px-4 rounded-xl text-xs font-bold text-[#7e7482] hover:bg-gray-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-[#f9b900]">check_circle</span>
              <span>{editingServiceId ? 'Guardar cambios' : 'Crear servicio'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Services List */}
      {services.length === 0 ? (
        <div className="py-8 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs text-[#7e7482] text-center">
          No hay servicios configurados. Haz clic en "+ Añadir servicio" para registrar tu primer servicio.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((svc) => (
            <div
              key={svc.id}
              className={`bg-[#fcf8ff] rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                svc.active ? 'border-[#cfc2d2]/40' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#cfc2d2]/30 overflow-hidden shrink-0 flex items-center justify-center">
                  {svc.imageUrl ? (
                    <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-[#2e004e]">
                      {svc.icon || 'content_cut'}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-extrabold text-sm text-[#1a1a26] truncate">{svc.name}</h4>
                    <span className="font-black text-xs text-[#2e004e] shrink-0">
                      ${svc.price.toLocaleString()} {currency}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#7e7482]">
                    <span className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {svc.durationMin} min
                    </span>
                    {svc.pricingType === 'tamano' && (
                      <span className="px-1.5 py-0.2 rounded bg-[#f2daff] text-[#2e004e] font-bold text-[10px]">
                        Por tamaño
                      </span>
                    )}
                  </div>

                  {svc.desc && (
                    <p className="text-[11px] text-[#7e7482] line-clamp-2 mt-1 leading-tight">
                      {svc.desc}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#cfc2d2]/20 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleActive(svc.id)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                    svc.active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {svc.active ? '✓ Activo' : 'Pausado'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(svc)}
                    className="p-1 text-[#4b0878] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Editar servicio"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(svc.id)}
                    className="p-1 text-[#ba1a1a] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Eliminar servicio"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
