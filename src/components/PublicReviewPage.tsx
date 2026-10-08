import React, { useState, useEffect } from 'react';
import { SalonConfig, ClientReview } from '../types';
import { fetchBusinessProfile, submitPublicReview } from '../utils/api';
import { HOTLINK_IMAGES } from '../mockData';

interface PublicReviewPageProps {
  businessIdOrSlug: string;
  onReviewSubmitted?: (review: ClientReview) => void;
}

export const PublicReviewPage: React.FC<PublicReviewPageProps> = ({
  businessIdOrSlug,
  onReviewSubmitted
}) => {
  const [config, setConfig] = useState<SalonConfig | null>(null);
  const [businessId, setBusinessId] = useState<string>(businessIdOrSlug);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [clientName, setClientName] = useState<string>('');
  const [stars, setStars] = useState<number>(5);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    fetchBusinessProfile(businessIdOrSlug)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.config) {
          setConfig(res.config);
          setBusinessId(res.businessId);
        } else {
          setLoadError('No pudimos encontrar este negocio. Por favor verifica el enlace.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading business for rating:', err);
        setLoadError('Hubo un error al cargar la información del negocio.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessIdOrSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = clientName.trim();
    if (!trimmedName) {
      setSubmitError('Por favor escribe tu nombre para enviar la calificación.');
      return;
    }

    if (stars < 1 || stars > 5) {
      setSubmitError('Por favor selecciona una puntuación de 1 a 5 estrellas.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reviewPayload: ClientReview = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        businessId: businessId || businessIdOrSlug,
        clientName: trimmedName,
        stars,
        comment: comment.trim(),
        date: new Date().toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        createdAt: new Date().toISOString(),
        verified: true
      };

      const result = await submitPublicReview(businessId || businessIdOrSlug, reviewPayload);

      if (result.success && result.review) {
        setSubmittedSuccessfully(true);
        if (onReviewSubmitted) {
          onReviewSubmitted(result.review);
        }
      } else {
        throw new Error('No se pudo registrar la calificación.');
      }
    } catch (err) {
      console.error('Review submit error:', err);
      setSubmitError('Ocurrió un error al guardar tu calificación. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcf8ff] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#2e004e] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-[#2e004e]">Cargando información del negocio...</p>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="min-h-screen bg-[#fcf8ff] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-md border border-[#cfc2d2]/40 space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-3xl">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <h1 className="text-xl font-black text-[#1a1a26]">Negocio no encontrado</h1>
          <p className="text-xs text-[#7e7482]">{loadError || 'Este enlace no es válido.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1a1a26] flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-[#f9b900] selection:text-[#261900]">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg border border-[#cfc2d2]/40 overflow-hidden">
        {/* Header with Business identity */}
        <div className="bg-gradient-to-r from-[#2e004e] via-[#3b0361] to-[#4b0878] text-white p-6 sm:p-8 text-center relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1 bg-white shadow-xl mx-auto mb-3.5 flex items-center justify-center overflow-hidden border-2 border-[#f9b900]">
            <img
              src={config.logoUrl || HOTLINK_IMAGES.logo}
              alt={config.name}
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                e.currentTarget.src = HOTLINK_IMAGES.logo;
              }}
            />
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1">
            {config.name}
          </h1>

          {([config.city?.trim(), config.country?.trim()].filter(Boolean).length > 0 || config.address) && (
            <p className="text-xs text-[#e3e0f1] flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-xs text-[#f9b900]">location_on</span>
              <span>
                {[config.city?.trim(), config.country?.trim()].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {submittedSuccessfully ? (
            /* Confirmation Screen */
            <div className="text-center space-y-4 py-4 animate-in fade-in duration-300">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-4xl shadow-xs">
                <span className="material-symbols-outlined text-5xl">check_circle</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-[#1a1a26]">¡Gracias por tu opinión!</h2>
                <p className="text-xs sm:text-sm text-[#4c4451] max-w-sm mx-auto leading-relaxed">
                  Tu calificación se ha registrado correctamente. Gracias por ayudarnos a mejorar y ofrecer un mejor servicio.
                </p>
              </div>

              <div className="bg-[#f5f2ff] rounded-2xl p-4 border border-[#cfc2d2]/40 max-w-sm mx-auto text-left space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1a1a26]">{clientName}</span>
                  <div className="text-[#f9b900] text-sm">
                    {Array.from({ length: stars }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                </div>
                {comment.trim() && (
                  <p className="text-xs text-[#7e7482] italic">"{comment.trim()}"</p>
                )}
              </div>
            </div>
          ) : (
            /* Rating Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center space-y-1.5 pb-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#2e004e] flex items-center justify-center gap-1.5">
                  <span>¡Tu opinión nos importa!</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#7e7482] leading-relaxed max-w-md mx-auto">
                  Cuéntanos cómo fue tu experiencia con nuestro negocio. Tu opinión nos ayuda a mejorar y a ofrecer un mejor servicio a nuestros clientes.
                </p>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{submitError}</span>
                </div>
              )}

              {/* Nombre Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1a1a26]">
                  Escribe tu nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full bg-[#fcf8ff] border border-[#cfc2d2]/60 focus:border-[#4b0878] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[#1a1a26] outline-none focus:ring-2 focus:ring-[#4b0878]/30 transition-all font-sans"
                />
              </div>

              {/* Star Rating Selector */}
              <div className="space-y-2 text-center bg-[#fcf8ff] rounded-2xl p-4 border border-[#cfc2d2]/40">
                <label className="block text-xs font-bold text-[#1a1a26]">
                  ¿Cómo calificarías tu experiencia? <span className="text-red-500">*</span>
                </label>

                <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isFilled = hoveredStar !== null ? starVal <= hoveredStar : starVal <= stars;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setStars(starVal)}
                        onMouseEnter={() => setHoveredStar(starVal)}
                        onMouseLeave={() => setHoveredStar(null)}
                        className="text-3xl sm:text-4xl transition-transform active:scale-90 cursor-pointer focus:outline-none p-1"
                        title={`${starVal} de 5 estrellas`}
                      >
                        <span
                          className={`transition-colors ${
                            isFilled ? 'text-[#f9b900]' : 'text-gray-300'
                          }`}
                        >
                          ★
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs font-bold text-[#2e004e]">
                  {stars === 5 && '★★★★★ Excelente (5/5)'}
                  {stars === 4 && '★★★★☆ Muy buena (4/5)'}
                  {stars === 3 && '★★★☆☆ Buena (3/5)'}
                  {stars === 2 && '★★☆☆☆ Regular (2/5)'}
                  {stars === 1 && '★☆☆☆☆ A mejorar (1/5)'}
                </div>
              </div>

              {/* Optional Comment Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#1a1a26]">
                    Cuéntanos cómo fue tu experiencia
                  </label>
                  <span className="text-[11px] text-[#7e7482]">Opcional</span>
                </div>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escribe tu opinión o sugerencia sobre nuestro servicio..."
                  className="w-full bg-[#fcf8ff] border border-[#cfc2d2]/60 focus:border-[#4b0878] rounded-2xl p-3.5 text-xs sm:text-sm text-[#1a1a26] outline-none focus:ring-2 focus:ring-[#4b0878]/30 transition-all font-sans resize-y"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm sm:text-base shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined font-black ${isSubmitting ? 'animate-spin' : ''}`}>
                  {isSubmitting ? 'progress_activity' : 'send'}
                </span>
                <span>{isSubmitting ? 'Enviando calificación...' : 'Enviar calificación'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
