import React, { useState } from 'react';
import { MedicationProduct } from '../types';

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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('Gotas');
  const [purpose, setPurpose] = useState('');
  const [price, setPrice] = useState(3500);
  const [photoUrl, setPhotoUrl] = useState('');
  const [active, setActive] = useState(true);

  const resetForm = () => {
    setName('');
    setType('Gotas');
    setPurpose('');
    setPrice(3500);
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
    setType(p.type || 'Gotas');
    setPurpose(p.purpose || '');
    setPrice(p.price || 3500);
    setPhotoUrl(p.photoUrl || '');
    setActive(p.active ?? true);
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      onChangeProducts(
        products.map((p) =>
          p.id === editingId
            ? {
                ...p,
                name: name.trim(),
                type,
                purpose: purpose.trim(),
                price: Number(price),
                photoUrl: photoUrl.trim() || undefined,
                active
              }
            : p
        )
      );
    } else {
      const newProd: MedicationProduct = {
        id: 'med-' + Date.now(),
        name: name.trim(),
        type,
        purpose: purpose.trim(),
        price: Number(price),
        photoUrl: photoUrl.trim() || undefined,
        active
      };
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
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
              Medicamentos
            </h3>
            <p className="text-xs text-[#7e7482]">
              Configura los productos que tu peluquería puede aplicar o suministrar durante la sesión
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
            <span>+ Añadir medicamento</span>
          </button>
        )}
      </div>

      {/* Activation Checkbox / Toggle */}
      <div className="p-3.5 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/40 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#1a1a26] block">
            ¿Ofreces medicamentos o productos antiparasitarios?
          </span>
          <span className="text-[11px] text-[#7e7482] block">
            Habilita esta opción si administras pipetas, pastillas antiparasitarias o tratamientos dérmicos
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
          Esta función está desactivada. Actívala si tu negocio suministra o vende medicamentos o productos antiparasitarios.
        </div>
      ) : (
        <>
          {/* Add / Edit Form */}
          {isFormOpen && (
            <form onSubmit={handleSave} className="bg-[#fcf8ff] rounded-2xl p-4 sm:p-5 border border-[#4b0878]/30 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-[#cfc2d2]/30">
                <h4 className="font-extrabold text-sm text-[#2e004e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">
                    {editingId ? 'edit' : 'add_circle'}
                  </span>
                  <span>{editingId ? 'Editar medicamento o producto' : 'Nuevo medicamento o producto'}</span>
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
                {/* Nombre del producto */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Nombre del medicamento o producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Tratamiento antipulgas"
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                {/* Tipo de producto */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Tipo de producto *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none cursor-pointer"
                  >
                    <option value="Gotas">Gotas / Pipeta</option>
                    <option value="Pastilla">Pastilla / Comprimido</option>
                    <option value="Tratamiento tópico">Tratamiento tópico / Spray</option>
                    <option value="Jarabe">Jarabe</option>
                    <option value="Antiparasitario">Antiparasitario</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* ¿Para qué sirve? */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  ¿Para qué sirve? (Uso y descripción) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Ej: Tratamiento utilizado para ayudar a controlar pulgas y parásitos externos."
                  className="w-full bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Precio */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Precio ($ {currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                {/* Foto del producto */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Foto del producto (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="py-2 px-3 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 shadow-xs cursor-pointer flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">photo_camera</span>
                      <span>{photoUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="text-xs text-[#ba1a1a] hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1a1a26]">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 text-[#2e004e] rounded"
                  />
                  <span>Producto activo</span>
                </label>

                <div className="flex items-center gap-2">
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
                    {editingId ? 'Guardar cambios' : 'Añadir producto'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Configured Products List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {products.length === 0 ? (
              <div className="col-span-full py-8 text-center text-[#7e7482] text-xs bg-[#fcf8ff] rounded-2xl border border-dashed border-[#cfc2d2]">
                No tienes medicamentos o productos antiparasitarios configurados. Haz clic en "+ Añadir medicamento" para crear uno.
              </div>
            ) : (
              products.map((prod) => (
                <div
                  key={prod.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    prod.active
                      ? 'bg-[#fcf8ff] border-[#cfc2d2]/40 hover:border-[#2e004e]/60 shadow-xs'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-[#cfc2d2]/30 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {prod.photoUrl ? (
                        <img
                          src={prod.photoUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-[#7e7482]">
                          medication
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-extrabold text-sm text-[#1a1a26] leading-snug">
                          {prod.name}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            prod.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {prod.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#4b0878] font-bold">
                        Tipo: <span className="font-medium text-[#1a1a26]">{prod.type}</span>
                      </div>

                      <p className="text-xs text-[#4c4451] line-clamp-2 leading-relaxed">
                        {prod.purpose}
                      </p>

                      <div className="text-sm font-black text-[#2e004e] pt-1">
                        ${prod.price.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#cfc2d2]/30 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(prod.id)}
                      className="text-[11px] font-bold text-[#4b0878] hover:underline cursor-pointer"
                    >
                      {prod.active ? 'Desactivar' : 'Activar'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-1.5 rounded-lg text-[#2e004e] hover:bg-white transition-colors cursor-pointer"
                        title="Editar producto"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id)}
                        className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-white transition-colors cursor-pointer"
                        title="Eliminar producto"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
