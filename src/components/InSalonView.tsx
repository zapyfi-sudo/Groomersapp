import React, { useState } from 'react';
import { Appointment, Pet, SalonConfig } from '../types';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';

interface InSalonViewProps {
  appointments: Appointment[];
  pets: Pet[];
  salonConfig: SalonConfig;
  currentLanguage?: AppLanguage;
  onUpdateAppointmentStatus: (appointmentId: string, status: any, statusLabel: string) => Promise<boolean | void> | void;
  onSelectPetForProfile: (petId: string) => void;
  onNavigateToAgenda: () => void;
  onCompleteAndRegisterVisit?: (appointment: Appointment, pet: Pet) => void;
}

export const InSalonView: React.FC<InSalonViewProps> = ({
  appointments,
  pets,
  salonConfig,
  currentLanguage = 'es-LA',
  onUpdateAppointmentStatus,
  onSelectPetForProfile,
  onNavigateToAgenda,
  onCompleteAndRegisterVisit
}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];
  const [filterState, setFilterState] = useState<'todos' | 'en_servicio' | 'por_retirar'>('todos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active appointments in salon (in service OR ready for pickup)
  const inSalonAppointments = appointments.filter((a) => {
    return (
      a.status === 'en_salon' ||
      a.status === 'en_corte' ||
      a.status === 'por_retirar' ||
      a.statusLabel === 'EN SALÓN' ||
      a.statusLabel === 'EN CORTE' ||
      a.statusLabel === 'POR RETIRAR' ||
      a.statusLabel === 'LISTO PARA RETIRAR' ||
      (a.subStatus && a.subStatus.toLowerCase().includes('retirar'))
    );
  });

  const inServiceAppointments = inSalonAppointments.filter(
    (a) => a.status === 'en_salon' || a.status === 'en_corte' || a.statusLabel === 'EN SALÓN' || a.statusLabel === 'EN CORTE'
  );

  const readyForPickupAppointments = inSalonAppointments.filter(
    (a) =>
      a.status === 'por_retirar' ||
      a.statusLabel === 'POR RETIRAR' ||
      a.statusLabel === 'LISTO PARA RETIRAR' ||
      (a.subStatus && a.subStatus.toLowerCase().includes('retirar'))
  );

  const displayedAppointments = inSalonAppointments.filter((a) => {
    if (filterState === 'en_servicio') {
      return inServiceAppointments.includes(a);
    }
    if (filterState === 'por_retirar') {
      return readyForPickupAppointments.includes(a);
    }
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const findMatchedPet = (apt: Appointment): Pet | undefined => {
    const cleanId = (apt.petId || '').replace('#', '').trim().toLowerCase();
    return pets.find((p) => {
      const pCleanId = (p.id || '').replace('#', '').trim().toLowerCase();
      if (cleanId && pCleanId === cleanId) return true;
      return p.name.trim().toLowerCase() === apt.petName.trim().toLowerCase();
    });
  };

  // Mark pet as finished and ready for pickup
  const handleMarkReadyForPickup = async (apt: Appointment) => {
    await onUpdateAppointmentStatus(apt.id, 'por_retirar', 'LISTO PARA RETIRAR');
    showToast(`¡${apt.petName} marcado como "Listo para retirar"!`);
  };

  // Notify tutor via WhatsApp that pet is ready for pickup
  const handleNotifyTutorReady = (apt: Appointment) => {
    const pet = findMatchedPet(apt);
    const phone = pet?.tutor?.rawPhone || apt.tutorPhone || pet?.tutor?.phone || '';
    const cleanPhone = phone.replace(/\D/g, '');

    const msg = `¡Hola ${apt.tutorName}! 🐾 Te avisamos de *${salonConfig.name}* que *${apt.petName}* ya terminó su servicio de ${apt.serviceName} y quedó hermoso(a) ✨. Ya puedes pasar a retirarlo(a). ¡Te esperamos!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`Abriendo WhatsApp para notificar al tutor de ${apt.petName}`);
  };

  // Deliver pet and complete service (transitioning into Clientes / Visita registration)
  const handleDeliverPet = async (apt: Appointment) => {
    const pet = findMatchedPet(apt);
    await onUpdateAppointmentStatus(apt.id, 'completado', 'COMPLETADO');
    showToast(`¡Servicio de ${apt.petName} completado y entregado con éxito!`);

    if (onCompleteAndRegisterVisit && pet) {
      onCompleteAndRegisterVisit(apt, pet);
    } else if (pet) {
      onSelectPetForProfile(pet.id);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 px-4 sm:px-6 pt-3 space-y-4 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner: En Salón */}
      <div className="bg-gradient-to-br from-[#2e004e] via-[#35045c] to-[#4b0878] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold backdrop-blur-xs text-[#f9b900]">
              <span className="w-2 h-2 rounded-full bg-[#f9b900] animate-pulse"></span>
              <span>OPERACIONES EN TIEMPO REAL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Mascotas en Salón
            </h2>
            <p className="text-xs text-[#e3e0f1] max-w-lg">
              Visualiza y gestiona las mascotas que se encuentran en el establecimiento recibiendo servicio o esperando ser retiradas.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2.5">
            <div className="bg-[#3e066a] border border-white/10 rounded-2xl px-4 py-2.5 text-center shrink-0">
              <div className="text-2xl font-black text-[#f9b900]">{inServiceAppointments.length}</div>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">En servicio</div>
            </div>

            <div className="bg-[#3e066a] border border-white/10 rounded-2xl px-4 py-2.5 text-center shrink-0">
              <div className="text-2xl font-black text-emerald-400">{readyForPickupAppointments.length}</div>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Por retirar</div>
            </div>

            <div className="bg-[#3e066a] border border-white/10 rounded-2xl px-4 py-2.5 text-center shrink-0">
              <div className="text-2xl font-black text-white">{inSalonAppointments.length}</div>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Total en salón</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterState('todos')}
            className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              filterState === 'todos'
                ? 'bg-[#2e004e] text-white shadow-sm'
                : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
            }`}
          >
            <span>Todos en salón</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                filterState === 'todos' ? 'bg-[#f9b900] text-[#261900]' : 'bg-white/60 text-[#4c4451]'
              }`}
            >
              {inSalonAppointments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterState('en_servicio')}
            className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              filterState === 'en_servicio'
                ? 'bg-[#2e004e] text-white shadow-sm'
                : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
            <span>En servicio ({inServiceAppointments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterState('por_retirar')}
            className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              filterState === 'por_retirar'
                ? 'bg-[#2e004e] text-white shadow-sm'
                : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Por retirar ({readyForPickupAppointments.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onNavigateToAgenda}
          className="text-xs font-bold text-[#4b0878] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">calendar_month</span>
          <span>Ver Agenda</span>
        </button>
      </div>

      {/* Main List */}
      {displayedAppointments.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-300 space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#f5f2ff] text-[#4b0878] flex items-center justify-center mx-auto text-3xl font-bold">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <h3 className="text-base font-bold text-[#1a1a26]">
            {filterState === 'todos'
              ? 'No hay mascotas en el salón en este momento'
              : filterState === 'en_servicio'
              ? 'No hay mascotas en servicio actualmente'
              : 'No hay mascotas pendientes por retirar'}
          </h3>
          <p className="text-xs text-[#7e7482] max-w-md mx-auto leading-relaxed">
            Cuando recibas a una mascota con cita confirmada en la <strong>Agenda</strong> y pulses{' '}
            <strong className="text-[#2e004e]">«Comenzar servicio»</strong>, aparecerá automáticamente aquí para gestionar su atención paso a paso.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToAgenda}
              className="py-2.5 px-5 bg-[#2e004e] hover:bg-[#4b0878] text-[#f9b900] text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Ir a la Agenda de hoy</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedAppointments.map((apt) => {
            const pet = findMatchedPet(apt);
            const isReadyForPickup =
              apt.status === 'por_retirar' ||
              apt.statusLabel === 'POR RETIRAR' ||
              apt.statusLabel === 'LISTO PARA RETIRAR' ||
              (apt.subStatus && apt.subStatus.toLowerCase().includes('retirar'));

            return (
              <div
                key={apt.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border transition-all flex flex-col justify-between gap-4 ${
                  isReadyForPickup
                    ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                    : 'border-[#f9b900]/40 ring-1 ring-[#f9b900]/30'
                }`}
              >
                {/* Header Information */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Pet Photo */}
                      <div
                        onClick={() => pet && onSelectPetForProfile(pet.id)}
                        className="w-16 h-16 rounded-2xl overflow-hidden bg-[#f5f2ff] shrink-0 border border-[#cfc2d2]/40 shadow-2xs cursor-pointer group"
                        title="Ver ficha de la mascota"
                      >
                        {pet?.photoUrl || apt.beforePhotoUrl ? (
                          <img
                            src={pet?.photoUrl || apt.beforePhotoUrl}
                            alt={apt.petName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🐶
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4
                            onClick={() => pet && onSelectPetForProfile(pet.id)}
                            className="font-black text-lg text-[#1a1a26] hover:text-[#2e004e] cursor-pointer truncate leading-tight"
                          >
                            {apt.petName}
                          </h4>
                          {pet?.isVip && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[#f9b900] text-[#261900] text-[10px] font-black uppercase">
                              VIP
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#7e7482] font-medium mt-0.5 truncate">
                          {apt.breed || pet?.breed || 'Mestizo'}
                          {pet?.size ? ` • ${pet.size}` : ''}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="inline-flex items-center gap-1 font-bold text-[#2e004e]">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            <span>{apt.time}</span>
                          </span>
                          {apt.groomer && (
                            <span className="text-[#7e7482]">
                              • Estilista: <strong className="text-[#1a1a26]">{apt.groomer}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isReadyForPickup
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-[#f9b900] text-[#261900] shadow-xs'
                        }`}
                      >
                        {isReadyForPickup ? 'LISTO PARA RETIRAR' : 'EN SERVICIO'}
                      </span>
                    </div>
                  </div>

                  {/* Service & Price Badge */}
                  <div className="bg-[#f5f2ff] rounded-xl p-3 border border-[#cfc2d2]/30 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[#7e7482] block text-[11px]">Servicio en curso:</span>
                      <strong className="text-[#1a1a26] font-bold text-xs truncate block">
                        {apt.serviceName}
                      </strong>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[#7e7482] block text-[11px]">Importe:</span>
                      <strong className="text-[#2e004e] font-extrabold text-sm">
                        ${apt.price.toLocaleString()} {apt.currency || salonConfig.currency}
                      </strong>
                    </div>
                  </div>

                  {/* Tutor Contact & Observations */}
                  <div className="space-y-1.5 text-xs text-[#5c5462]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-[15px] text-[#7e7482] shrink-0">
                          person
                        </span>
                        <span>
                          Tutor: <strong className="text-[#1a1a26]">{apt.tutorName}</strong>
                        </span>
                      </div>

                      {apt.tutorPhone && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-xs font-semibold text-[#1a1a26]">
                            {apt.tutorPhone}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes / Special observations */}
                    {(apt.notes || pet?.handlingObservations || pet?.healthAllergies) && (
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2 text-[11px] text-amber-950 flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-xs text-amber-700 shrink-0 mt-0.5">
                          info
                        </span>
                        <div className="min-w-0 leading-tight">
                          {apt.notes && <span>{apt.notes} </span>}
                          {pet?.healthAllergies && (
                            <span className="font-semibold text-rose-800">
                              • Alergia: {pet.healthAllergies}{' '}
                            </span>
                          )}
                          {pet?.handlingObservations && (
                            <span>• Manejo: {pet.handlingObservations}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operational Actions Flow */}
                <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                  {!isReadyForPickup ? (
                    // Step A: When in service -> "Listo para retirar"
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleMarkReadyForPickup(apt)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        title="Marcar servicio como finalizado y listo para retirar"
                      >
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        <span>Listo para retirar</span>
                      </button>

                      {pet && (
                        <button
                          type="button"
                          onClick={() => onSelectPetForProfile(pet.id)}
                          className="py-2.5 px-3 rounded-xl bg-[#f5f2ff] hover:bg-[#ece6fb] text-[#2e004e] font-semibold text-xs border border-[#cfc2d2]/40 flex items-center justify-center gap-1 transition-all cursor-pointer"
                          title="Ver ficha técnica de la mascota"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          <span>Ficha</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    // Step B: When ready for pickup -> Notify WhatsApp & Complete/Deliver
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {/* Notify Tutor via WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleNotifyTutorReady(apt)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          title="Enviar mensaje por WhatsApp avisando que la mascota está lista para retirar"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                          <span>Avisar por WhatsApp</span>
                        </button>

                        {/* Deliver & Complete Visit */}
                        <button
                          type="button"
                          onClick={() => handleDeliverPet(apt)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-[#f9b900] font-black text-xs shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          title="Entregar la mascota al tutor y registrar la visita completada"
                        >
                          <span className="material-symbols-outlined text-base">task_alt</span>
                          <span>Entregar y completar</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-[#7e7482] text-center leading-snug">
                        Al pulsar «Entregar y completar», podrás registrar la visita y su recomendación de retorno para que se sincronice en Por volver.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
