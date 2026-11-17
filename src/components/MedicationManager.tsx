import React, { useState } from 'react';
import { MedicationProduct } from '../types';
import { compressImage } from '../utils/storage';
import { formatPrice } from '../utils/priceUtils';
import { PriceInput } from './PriceInput';
import { useTranslation } from '../utils/i18n/I18nContext';

interface MedicationManagerProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  products: MedicationProduct[];
  onChangeProducts: (updated: MedicationProduct[]) => void;
  currency?: string;
}

export const MedicationManager: React.FC<MedicationManagerProps> = ({
  enabled,
  onToggleEnabled,
  products,
  onChangeProducts,
  currency = 'ARS'
}) => {
  const { t } = useTranslation();
  const mt = t.managers;
  const st = t.settings;
  const ct = t.common;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isZeroDecimal = currency === 'CLP' || currency === 'COP' || currency === 'ARS';
  const defaultMedPrice = isZeroDecimal ? 3500 : 5;

  // Form fields - strictly Name, Purpose, Price, Photo
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [price, setPrice] = useState(defaultMedPrice);
  const [photoUrl, setPhotoUrl] = useState('');
  const [active, setActive] = useState(true);

  const resetForm = () => {
    setName('');
    setPurpose('');
    setPrice(defaultMedPrice);
    setPhotoUrl('');
    setActive(true);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: MedicationProduct) => {
    setEditingId(p.id);
    setName(p.name);
    setPurpose(p.purpose || '');
    setPrice(p.price ?? defaultMedPrice);
    setPhotoUrl(p.photoUrl || '');
    setActive(p.active ?? true);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;

    if (editingId) {
      onChangeProducts(
        products.map((p) => {
          if (p.id !== editingId) return p;
          const updated: MedicationProduct = {
            ...p,
            name: name.trim(),
            type: 'Medicamento',
            purpose: purpose.trim(),
            price: Number(price) || 0,
            active
          };
          if (photoUrl && photoUrl.trim()) {
            updated.photoUrl = photoUrl.trim();
          } else {
            delete updated.photoUrl;
          }
          return updated;
        })
      );
    } else {
      const newProd: MedicationProduct = {
        id: 'med-' + Date.now(),
        name: name.trim(),
        type: 'Medicamento',
        purpose: purpose.trim(),
        price: Number(price) || 0,
        active
      };
      if (photoUrl && photoUrl.trim()) {
        newProd.photoUrl = photoUrl.trim();
      }
      onChangeProducts([...products, newProd]);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    onChangeProducts(products.filter((p) => p.id !== id));
  };

  const handleToggleActive = (id: string) => {
    onChangeProducts(
      products.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 600, 0.8);
        setPhotoUrl(compressed);
      } catch (err) {
        console.warn('Error uploading photo:', err);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
      {/* Header and Enable Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#efecfd]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
            <span className="material-symbols-outlined text-2xl">medication</span>
          </div>
          <div>
            <h3 className="text-base font-black text-[#1a1a26]">
              {st.medicationsTitle}
            </h3>
            <p className="text-xs text-[#7e7482]">
              {mt.medicationsSubtitle}
            </p>
          </div>
        </div>

        {enabled && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="py-2.5 px-4 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-base text-[#f9b900]">add</span>
            <span>{st.addMedication}</span>
          </button>
        )}
      </div>

      {/* Activation Checkbox / Toggle */}
      <div className="p-3.5 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/40 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#1a1a26] block">
            {mt.offerMedicationsQuestion}
          </span>
          <span className="text-[11px] text-[#7e7482] block">
            {mt.offerMedicationsHint}
          </span>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[#cfc2d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e004e]"></div>
        </label>
      </div>

      {!enabled ? (
        <div className="py-4 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs text-[#7e7482] text-center">
          {mt.medicationsDisabledNotice}
        </div>
      ) : (
        <>
          {/* Add / Edit Form */}
          {isFormOpen && (
            <div className="bg-[#fcf8ff] rounded-2xl p-4 sm:p-5 border border-[#4b0878]/30 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-[#cfc2d2]/30">
                <h4 className="font-extrabold text-sm text-[#2e004e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">
                    {editingId ? 'edit' : 'add_circle'}
                  </span>
                  <span>{editingId ? mt.editMedicationTitle : mt.newMedicationTitle}</span>
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[#7e7482] hover:text-[#1a1a26] text-xs font-bold cursor-pointer"
                >
                  ✕ {ct.cancel}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nombre del producto */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {mt.medicationName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={mt.medicationNamePlaceholder}
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                {/* Precio */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {mt.medicationPrice} ({currency}) *
                  </label>
                  <PriceInput
                    value={price}
                    onChange={setPrice}
                    currency={currency}
                    required
                    className="w-full bg-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              {/* ¿Para qué sirve? (Propósito) */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  {mt.medicationPurpose} *
                </label>
                <textarea
                  rows={2}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={mt.medicationPurposePlaceholder}
                  className="w-full bg-white text-xs font-medium p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] resize-none"
                />
              </div>

              {/* Foto del medicamento */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  {mt.medicationPhotoLabel}
                </label>
                <div className="flex items-center gap-3">
                  {photoUrl ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-[#cfc2d2]/40 shrink-0">
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#7e7482] border border-dashed border-[#cfc2d2] shrink-0">
                      <span className="material-symbols-outlined text-xl">medication</span>
                    </div>
                  )}

                  <label className="py-2 px-3 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 cursor-pointer shadow-xs flex items-center gap-1.5 transition-all">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    <span>{photoUrl ? ct.changePhoto : ct.uploadPhoto}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      {ct.removePhoto}
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
                  {ct.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="py-2.5 px-5 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-[#f9b900]">save</span>
                  <span>{editingId ? mt.saveChangesBtn : mt.addMedicationBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Products */}
          {products.length === 0 ? (
            <div className="py-6 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs text-[#7e7482] text-center">
              {mt.noMedicationsHint}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`bg-[#fcf8ff] rounded-2xl p-3.5 border transition-all flex flex-col justify-between gap-2.5 ${
                    p.active ? 'border-[#cfc2d2]/40' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-[#cfc2d2]/30 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-xl text-[#7e7482]">medication</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-extrabold text-xs text-[#1a1a26] truncate">{p.name}</h4>
                        <span className="font-black text-xs text-[#2e004e] shrink-0">
                          {formatPrice(p.price, currency, { includeCode: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7e7482] line-clamp-2 mt-0.5 leading-tight">
                        {p.purpose || mt.medicationNoDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#cfc2d2]/20 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p.id)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                        p.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {p.active ? mt.medicationActiveBadge : ct.paused}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 text-[#4b0878] hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title={ct.edit}
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-[#ba1a1a] hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title={ct.delete}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
