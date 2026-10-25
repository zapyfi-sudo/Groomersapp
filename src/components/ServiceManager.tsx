import React, { useState } from 'react';
import { SalonService, ServicePricingBySize } from '../types';
import { compressImage } from '../utils/storage';
import { formatPrice } from '../utils/priceUtils';
import { PriceInput } from './PriceInput';

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

  const isZeroDecimal = currency === 'CLP' || currency === 'COP' || currency === 'ARS';
  const defaultBasePrice = isZeroDecimal ? 25000 : 25;

  // Form fields
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [pricingType, setPricingType] = useState<'unico' | 'tamano'>('unico');
  const [singlePrice, setSinglePrice] = useState(defaultBasePrice);
  const [sizePrices, setSizePrices] = useState<ServicePricingBySize>({
    pequeno: isZeroDecimal ? 20000 : 20,
    mediano: isZeroDecimal ? 25000 : 25,
    grande: isZeroDecimal ? 30000 : 30,
    extraGrande: isZeroDecimal ? 35000 : 35
  });
  const [imageUrl, setImageUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setName('');
    setDesc('');
    setDurationMin(60);
    setPricingType('unico');
    setSinglePrice(defaultBasePrice);
    setSizePrices({
      pequeno: isZeroDecimal ? 20000 : 20,
      mediano: isZeroDecimal ? 25000 : 25,
      grande: isZeroDecimal ? 30000 : 30,
      extraGrande: isZeroDecimal ? 35000 : 35
    });
    setImageUrl('');
    setGalleryUrls([]);
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
    setSinglePrice(svc.price ?? defaultBasePrice);
    if (svc.priceBySize) {
      setSizePrices(svc.priceBySize);
    } else {
      const base = svc.price || defaultBasePrice;
      setSizePrices({
        pequeno: Math.round(base * 0.8 * 100) / 100,
        mediano: base,
        grande: Math.round(base * 1.2 * 100) / 100,
        extraGrande: Math.round(base * 1.4 * 100) / 100
      });
    }
    setImageUrl(svc.imageUrl || '');
    setGalleryUrls(Array.isArray(svc.galleryUrls) ? [...svc.galleryUrls].slice(0, 4) : []);
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
    const validGallery = galleryUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 4);

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
          if (validGallery.length > 0) {
            updated.galleryUrls = validGallery;
          } else {
            delete updated.galleryUrls;
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
      if (validGallery.length > 0) {
        newSvc.galleryUrls = validGallery;
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
        const compressed = await compressImage(file, 480, 0.70);
        setImageUrl(compressed);
      } catch (err) {
        console.warn('Error uploading service image:', err);
      }
    }
  };

  const handleAdditionalImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 4 - galleryUrls.length;
    if (remainingSlots <= 0) return;

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    try {
      const compressedList = await Promise.all(
        filesToProcess.map((file) => compressImage(file, 480, 0.70))
      );
      setGalleryUrls((prev) => [...prev, ...compressedList].slice(0, 4));
    } catch (err) {
      console.warn('Error uploading additional images:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleReplaceAdditionalPhoto = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 480, 0.70);
      setGalleryUrls((prev) => {
        const next = [...prev];
        next[index] = compressed;
        return next;
      });
    } catch (err) {
      console.warn('Error replacing additional image:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveAdditionalPhoto = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
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
                <PriceInput
                  value={singlePrice}
                  onChange={setSinglePrice}
                  currency={currency}
                  className="w-full bg-white text-xs font-bold px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Pequeño (&lt;8kg)
                  </label>
                  <PriceInput
                    value={sizePrices.pequeno}
                    onChange={(val) =>
                      setSizePrices({ ...sizePrices, pequeno: val })
                    }
                    currency={currency}
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Mediano (8-18kg)
                  </label>
                  <PriceInput
                    value={sizePrices.mediano}
                    onChange={(val) =>
                      setSizePrices({ ...sizePrices, mediano: val })
                    }
                    currency={currency}
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Grande (18-30kg)
                  </label>
                  <PriceInput
                    value={sizePrices.grande}
                    onChange={(val) =>
                      setSizePrices({ ...sizePrices, grande: val })
                    }
                    currency={currency}
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7482] block mb-0.5">
                    Gigante (&gt;30kg)
                  </label>
                  <PriceInput
                    value={sizePrices.extraGrande}
                    onChange={(val) =>
                      setSizePrices({ ...sizePrices, extraGrande: val })
                    }
                    currency={currency}
                    className="w-full bg-white text-xs font-bold p-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. Foto o imagen del servicio */}
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

          {/* 7. Fotos adicionales (hasta 4 adicionales) */}
          <div className="pt-3 border-t border-[#efecfd] space-y-2.5">
            <div>
              <label className="text-xs font-black text-[#1a1a26] block">
                Fotos adicionales
              </label>
              <p className="text-[11px] text-[#7e7482] mt-0.5">
                Puedes subir hasta 4 fotos adicionales para mostrar más detalles de este servicio a tus clientes.
              </p>
            </div>

            {/* Listado de miniaturas de fotos adicionales */}
            {galleryUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {galleryUrls.map((photoUrl, index) => (
                  <div
                    key={index}
                    className="relative group bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/40 overflow-hidden aspect-square flex flex-col items-center justify-center shadow-2xs"
                  >
                    <img
                      src={photoUrl}
                      alt={`Foto adicional ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Badge indicador */}
                    <span className="absolute top-1.5 left-1.5 bg-black/60 text-white font-black text-[10px] px-1.5 py-0.5 rounded-md pointer-events-none">
                      #{index + 1}
                    </span>

                    {/* Acciones para reemplazar o eliminar */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1.5">
                      <label
                        className="w-8 h-8 rounded-xl bg-white text-[#2e004e] hover:bg-[#f9b900] flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                        title="Reemplazar foto"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">cached</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleReplaceAdditionalPhoto(index, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalPhoto(index)}
                        className="w-8 h-8 rounded-xl bg-white text-rose-600 hover:bg-rose-50 flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                        title="Eliminar foto"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">delete</span>
                      </button>
                    </div>

                    {/* Acciones visibles en móviles */}
                    <div className="sm:hidden absolute bottom-0 inset-x-0 bg-black/75 flex items-center justify-between px-2 py-1 text-white">
                      <label className="text-[10px] font-bold flex items-center gap-0.5 cursor-pointer">
                        <span className="material-symbols-outlined text-xs">cached</span>
                        <span>Cambiar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleReplaceAdditionalPhoto(index, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalPhoto(index)}
                        className="text-[10px] text-rose-300 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>Quitar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botón Subir foto o aviso de límite alcanzado */}
            <div>
              {galleryUrls.length >= 4 ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200/70 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-600 shrink-0">info</span>
                  <span>Has alcanzado el límite de 4 fotos adicionales.</span>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 cursor-pointer shadow-xs transition-all active:scale-95">
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  <span>Subir foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAdditionalImagesUpload}
                    className="hidden"
                  />
                </label>
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
                      {formatPrice(svc.price, currency, { includeCode: true })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#7e7482] flex-wrap">
                    <span className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {svc.durationMin} min
                    </span>
                    {svc.pricingType === 'tamano' && (
                      <span className="px-1.5 py-0.2 rounded bg-[#f2daff] text-[#2e004e] font-bold text-[10px]">
                        Por tamaño
                      </span>
                    )}
                    {svc.galleryUrls && svc.galleryUrls.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-bold text-[10px] flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">photo_library</span>
                        +{svc.galleryUrls.length} {svc.galleryUrls.length === 1 ? 'foto' : 'fotos'}
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
