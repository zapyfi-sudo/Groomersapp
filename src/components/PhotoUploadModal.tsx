import React, { useState, useRef } from 'react';
import { compressImage } from '../utils/storage';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSelectPhoto: (url: string) => void;
  targetType: 'before' | 'after' | 'avatar';
  currentPhotoUrl?: string;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  title,
  onSelectPhoto,
  targetType,
  currentPhotoUrl
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Compress image for optimal persistence, fast transfer, and zero loss
      const compressed = await compressImage(file, 900, 0.85);
      setSelectedPhoto(compressed);
    } catch (err) {
      console.error('Error procesando fotografía:', err);
      setErrorMessage('No se pudo procesar la imagen seleccionada. Por favor, intenta con otra.');
    } finally {
      setIsProcessing(false);
      // Reset input values so same file can be re-selected if desired
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    if (selectedPhoto) {
      onSelectPhoto(selectedPhoto);
      setSelectedPhoto(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedPhoto(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f9b900]">photo_camera</span>
            <h3 className="font-bold text-base">{title}</h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white/80 hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hidden file inputs */}
          {/* 1. Camera Input (forces camera on mobile devices) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 2. Gallery / File picker input (opens gallery, photos, or file browser) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* If an image is selected, show only the real preview */}
          {selectedPhoto ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1a1a26]">Fotografía seleccionada</span>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Lista para guardar
                </span>
              </div>

              {/* Preview container */}
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#2e004e]/5 border-2 border-[#4b0878]/30 shadow-sm flex items-center justify-center">
                <img
                  src={selectedPhoto}
                  alt="Vista previa"
                  className="w-full h-full object-contain bg-black/5"
                />
              </div>

              {/* Action to switch photo */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessing}
                  className="py-2.5 px-3 bg-[#f5f2ff] hover:bg-[#efecfd] text-[#2e004e] rounded-xl text-xs font-bold transition-all border border-[#cfc2d2]/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  <span>Repetir foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessing}
                  className="py-2.5 px-3 bg-[#f5f2ff] hover:bg-[#efecfd] text-[#2e004e] rounded-xl text-xs font-bold transition-all border border-[#cfc2d2]/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">photo_library</span>
                  <span>Elegir otra</span>
                </button>
              </div>
            </div>
          ) : (
            /* No photo selected yet: Show Camera & Gallery buttons */
            <div className="space-y-3">
              <p className="text-xs text-[#7e7482] leading-relaxed">
                Selecciona la fotografía real de la mascota. Puedes tomar una foto ahora mismo o buscarla en la galería de tu dispositivo.
              </p>

              {/* Two clear options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option A: Camera */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-4 bg-white hover:bg-[#f5f2ff] border-2 border-dashed border-[#cfc2d2] hover:border-[#4b0878] rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group active:scale-98"
                >
                  <div className="w-12 h-12 rounded-full bg-[#efecfd] group-hover:bg-[#4b0878] text-[#4b0878] group-hover:text-white flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-2xl">photo_camera</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#1a1a26]">Tomar fotografía</span>
                    <span className="block text-[11px] text-[#7e7482] mt-0.5">Abrir cámara</span>
                  </div>
                </button>

                {/* Option B: Gallery */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-4 bg-white hover:bg-[#f5f2ff] border-2 border-dashed border-[#cfc2d2] hover:border-[#4b0878] rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group active:scale-98"
                >
                  <div className="w-12 h-12 rounded-full bg-[#ffdea1]/50 group-hover:bg-[#f9b900] text-[#7a5900] group-hover:text-[#261900] flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-2xl">photo_library</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#1a1a26]">Elegir de galería</span>
                    <span className="block text-[11px] text-[#7e7482] mt-0.5">Archivos o fotos</span>
                  </div>
                </button>
              </div>

              {/* Current photo hint if available */}
              {currentPhotoUrl && (
                <div className="pt-2 border-t border-[#cfc2d2]/20">
                  <span className="text-[11px] text-[#7e7482] block mb-1.5 font-semibold">
                    Fotografía guardada actualmente:
                  </span>
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#cfc2d2]/40 bg-gray-50">
                    <img src={currentPhotoUrl} alt="Foto actual" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="py-2 text-center text-xs font-bold text-[#4b0878] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              <span>Procesando imagen...</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 text-xs font-bold text-[#7e7482] hover:text-[#1a1a26] hover:bg-gray-200/50 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPhoto || isProcessing}
            className="px-5 py-2.5 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            <span>Confirmar foto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
