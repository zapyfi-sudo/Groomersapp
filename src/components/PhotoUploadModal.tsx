import React, { useState } from 'react';
import { HOTLINK_IMAGES } from '../mockData';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSelectPhoto: (url: string) => void;
  targetType: 'before' | 'after' | 'avatar';
}

const PRESET_PHOTOS = [
  {
    label: 'Antes (Manto enredado / húmedo)',
    url: HOTLINK_IMAGES.photoBefore
  },
  {
    label: 'Después (Corte impecable y brillante ✨)',
    url: HOTLINK_IMAGES.photoAfter
  },
  {
    label: 'Toby Retrato VIP',
    url: HOTLINK_IMAGES.toby
  },
  {
    label: 'Caniche baño spa',
    url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&auto=format&fit=crop&q=80'
  },
  {
    label: 'Bulldog recién bañado',
    url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80'
  }
];

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  title,
  onSelectPhoto,
  targetType
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(
    targetType === 'before' ? HOTLINK_IMAGES.photoBefore : HOTLINK_IMAGES.photoAfter
  );
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomFileUrl(event.target.result as string);
          setSelectedPreset(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    onSelectPhoto(selectedPreset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f9b900]">photo_camera</span>
            <h3 className="font-bold text-base">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white/80 hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* File Upload Area */}
          <div>
            <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-2">
              Subir desde dispositivo o cámara
            </label>
            <label className="border-2 border-dashed border-[#cfc2d2] hover:border-[#4b0878] rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition-all hover:bg-[#f5f2ff]">
              <span className="material-symbols-outlined text-3xl text-[#4b0878] mb-1">
                add_photo_alternate
              </span>
              <span className="text-sm font-bold text-[#1a1a26]">Toca para abrir cámara o galería</span>
              <span className="text-xs text-[#7e7482] mt-0.5">JPG, PNG hasta 10MB</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Current Selection Preview */}
          <div>
            <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-2">
              Vista previa seleccionada
            </label>
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#efecfd] border border-[#cfc2d2]/40 shadow-inner flex items-center justify-center">
              {selectedPreset ? (
                <img
                  src={selectedPreset}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <span className="material-symbols-outlined text-4xl text-[#7e7482]">pets</span>
                  <p className="text-xs text-[#7e7482] mt-1">Ninguna foto seleccionada</p>
                </div>
              )}
            </div>
          </div>

          {/* Presets Grid */}
          <div>
            <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-2">
              O selecciona una foto modelo del catálogo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_PHOTOS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPreset(item.url)}
                  className={`p-1.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                    selectedPreset === item.url
                      ? 'border-[#4b0878] ring-2 ring-[#4b0878] bg-[#f5f2ff]'
                      : 'border-[#cfc2d2]/40 bg-white hover:bg-[#f5f2ff]/60'
                  }`}
                >
                  <img
                    src={item.url}
                    alt={item.label}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <span className="text-[11px] font-semibold text-[#1a1a26] leading-tight line-clamp-1">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-[#cfc2d2]/40 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-semibold text-sm hover:bg-[#f5f2ff] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-bold text-sm shadow-md hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg">check</span>
            Confirmar Foto
          </button>
        </div>
      </div>
    </div>
  );
};
