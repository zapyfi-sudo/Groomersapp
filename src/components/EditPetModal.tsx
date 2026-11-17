import React, { useState } from 'react';
import { Pet, BehaviorMood } from '../types';
import { useTranslation } from '../utils/i18n/I18nContext';

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet;
  onSavePet: (updated: Pet) => void;
}

export const EditPetModal: React.FC<EditPetModalProps> = ({
  isOpen,
  onClose,
  pet,
  onSavePet
}) => {
  const { t } = useTranslation();
  const mt = t.modals;
  const pt = t.petProfile;
  const ct = t.common;
  const st = t.statuses;

  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed);
  const [age, setAge] = useState(pet.age);
  const [gender, setGender] = useState(pet.gender);
  const [size, setSize] = useState<'pequeno' | 'mediano' | 'grande' | string>(pet.size || 'mediano');
  const [weightKg, setWeightKg] = useState(pet.weightKg);
  const [isVip, setIsVip] = useState(pet.isVip);
  const [tutorName, setTutorName] = useState(pet.tutor.name);
  const [tutorPhone, setTutorPhone] = useState(pet.tutor.phone);
  const [habitualMood, setHabitualMood] = useState<BehaviorMood>(pet.habitualMood);
  const [healthAllergies, setHealthAllergies] = useState(pet.healthAllergies);
  const [handlingObservations, setHandlingObservations] = useState(pet.handlingObservations);
  const [careRecommendations, setCareRecommendations] = useState(
    pet.careRecommendations || pet.lastVisit?.careRecommendations || ''
  );

  // New Delivery Fields (Persona a cargo, Fecha de entrega, Hora de entrega en 12h AM/PM)
  const [serviceResponsible, setServiceResponsible] = useState<string>(
    pet.serviceResponsible || pet.lastVisit?.serviceResponsible || ''
  );

  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    if (pet.deliveryDate) return pet.deliveryDate;
    if (pet.lastVisit?.deliveryDate) return pet.lastVisit.deliveryDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Helper to parse 12-hour format string e.g. "4:30 PM" or "09:15 AM"
  const parse12HourTime = (raw?: string) => {
    if (!raw) return { hour: '4', min: '30', period: 'PM' as const };
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      return {
        hour: String(parseInt(match[1], 10)),
        min: match[2],
        period: match[3].toUpperCase() as 'AM' | 'PM'
      };
    }
    return { hour: '4', min: '30', period: 'PM' as const };
  };

  const initialTime = parse12HourTime(pet.deliveryTime || pet.lastVisit?.deliveryTime || '4:30 PM');
  const [deliveryHour, setDeliveryHour] = useState<string>(initialTime.hour);
  const [deliveryMinute, setDeliveryMinute] = useState<string>(initialTime.min);
  const [deliveryPeriod, setDeliveryPeriod] = useState<'AM' | 'PM'>(initialTime.period);

  const formattedDeliveryTime = `${deliveryHour}:${deliveryMinute} ${deliveryPeriod}`;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRawPhone = tutorPhone.replace(/[^0-9]/g, '');
    const cleanResponsible = serviceResponsible.trim() || undefined;
    const cleanDeliveryDate = deliveryDate ? deliveryDate : undefined;
    const cleanDeliveryTime = formattedDeliveryTime;

    onSavePet({
      ...pet,
      name,
      breed,
      size,
      age,
      gender,
      weightKg: Number(weightKg) || pet.weightKg,
      isVip,
      tutor: {
        name: tutorName,
        phone: tutorPhone,
        rawPhone: cleanRawPhone || pet.tutor.rawPhone
      },
      habitualMood,
      healthAllergies,
      handlingObservations,
      careRecommendations: careRecommendations.trim() || undefined,
      serviceResponsible: cleanResponsible,
      deliveryDate: cleanDeliveryDate,
      deliveryTime: cleanDeliveryTime,
      ...(pet.lastVisit
        ? {
            lastVisit: {
              ...pet.lastVisit,
              careRecommendations: careRecommendations.trim() || pet.lastVisit.careRecommendations,
              serviceResponsible: cleanResponsible || pet.lastVisit.serviceResponsible,
              deliveryDate: cleanDeliveryDate || pet.lastVisit.deliveryDate,
              deliveryTime: cleanDeliveryTime || pet.lastVisit.deliveryTime
            }
          }
        : {})
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f9b900]">edit_note</span>
            <h3 className="font-bold text-base">{mt.editPetTitle} — {pet.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{ct.pet}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{t.settings.csvColBreed}</label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{pt.ageLabel}</label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={mt.agePlaceholder}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{pt.sizeLabel}</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              >
                <option value="pequeno">{ct.small}</option>
                <option value="mediano">{ct.medium}</option>
                <option value="grande">{ct.large}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{pt.genderLabel}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Macho' | 'Hembra')}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              >
                <option value="Macho">{ct.male}</option>
                <option value="Hembra">{ct.female}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">{pt.weightLabel} (kg)</label>
              <input
                type="number"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              />
            </div>
          </div>

          {/* VIP Checkbox */}
          <div className="flex items-center gap-2 bg-[#f5f2ff] p-3 rounded-xl border border-[#cfc2d2]/30">
            <input
              type="checkbox"
              id="vipCheck"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="w-4 h-4 accent-[#4b0878] rounded cursor-pointer"
            />
            <label htmlFor="vipCheck" className="text-xs font-bold text-[#1a1a26] cursor-pointer flex items-center gap-1">
              <span className="bg-[#f9b900] text-[#261900] text-[10px] font-bold px-1.5 py-0.2 rounded-full">{ct.vip}</span>
              {mt.isVipLabel}
            </label>
          </div>

          {/* Tutor Info */}
          <div className="bg-white p-3 rounded-2xl border border-[#cfc2d2]/30 space-y-3">
            <h4 className="text-xs font-bold text-[#4b0878] uppercase tracking-wider">
              {pt.tutorResponsible}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#7e7482] mb-1">{ct.tutor}</label>
                <input
                  type="text"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  className="w-full bg-[#fcf8ff] text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#7e7482] mb-1">{ct.phone} / WhatsApp</label>
                <input
                  type="text"
                  value={tutorPhone}
                  onChange={(e) => setTutorPhone(e.target.value)}
                  className="w-full bg-[#fcf8ff] text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Habitual Behavior */}
          <div>
            <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1.5">
              {pt.habitualMood}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setHabitualMood('tranquilo')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  habitualMood === 'tranquilo'
                    ? 'bg-emerald-100 text-emerald-900 border-2 border-emerald-500 shadow-sm'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40'
                }`}
              >
                <span>🟢</span>
                <span>{st.moodCalm}</span>
              </button>
              <button
                type="button"
                onClick={() => setHabitualMood('inquieto')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  habitualMood === 'inquieto'
                    ? 'bg-[#f9b900] text-[#261900] border-2 border-[#7a5900] shadow-sm'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40'
                }`}
              >
                <span>🟡</span>
                <span>{st.moodRestless}</span>
              </button>
              <button
                type="button"
                onClick={() => setHabitualMood('dificil')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  habitualMood === 'dificil'
                    ? 'bg-rose-100 text-rose-900 border-2 border-rose-500 shadow-sm'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40'
                }`}
              >
                <span>🔴</span>
                <span>{st.moodDifficult}</span>
              </button>
            </div>
          </div>

          {/* Health & Allergies */}
          <div>
            <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">medical_services</span>
              {pt.healthAllergies}
            </label>
            <textarea
              rows={2}
              value={healthAllergies}
              onChange={(e) => setHealthAllergies(e.target.value)}
              className="w-full bg-white text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder={mt.healthAllergiesPlaceholder}
            />
          </div>

          {/* Handling Observations */}
          <div>
            <label className="block text-xs font-bold text-[#7a5900] uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">pan_tool</span>
              {pt.handlingNotes}
            </label>
            <textarea
              rows={2}
              value={handlingObservations}
              onChange={(e) => setHandlingObservations(e.target.value)}
              className="w-full bg-white text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder={mt.handlingObsPlaceholder}
            />
          </div>

          {/* Care Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#2e004e] uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#7a5900]">tips_and_updates</span>
                {pt.careRecommendationsLabel}
              </label>
              <span className="text-[10px] text-[#7e7482]">{mt.visibleInPdfAndWa}</span>
            </div>
            <textarea
              rows={2}
              value={careRecommendations}
              onChange={(e) => setCareRecommendations(e.target.value)}
              className="w-full bg-[#fcf8ff] text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder={mt.careRecsPlaceholder}
            />
          </div>

          {/* 1. Persona a cargo del servicio */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfc2d2]/30 space-y-2">
            <label className="text-xs font-bold text-[#2e004e] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#4b0878]">badge</span>
              <span>{mt.serviceResponsibleLabel}</span>
            </label>
            <p className="text-[11px] text-[#7e7482]">
              {mt.responsibleHelper}
            </p>
            <input
              type="text"
              value={serviceResponsible}
              onChange={(e) => setServiceResponsible(e.target.value)}
              placeholder={mt.serviceResponsiblePlaceholder}
              className="w-full bg-[#fcf8ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
            />
          </div>

          {/* 2 & 3. Fecha y Hora de Entrega (Formato 12 horas AM / PM) */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfc2d2]/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#2e004e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#7a5900]">event_available</span>
                <span>{mt.deliveryHeader}</span>
              </h4>
              <span className="text-[10px] text-[#7e7482]">{mt.visibleInDeliverySheet}</span>
            </div>

            {/* Fecha de entrega */}
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">
                {mt.deliveryDateLabel}
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-[#fcf8ff] text-[#1a1a26] text-sm px-3.5 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              />
            </div>

            {/* Hora de entrega */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#4c4451]">
                  {mt.deliveryTimeLabel}
                </label>
                <span className="text-xs font-black text-[#2e004e] bg-[#f5f2ff] px-2.5 py-0.5 rounded-lg border border-[#cfc2d2]/40">
                  {formattedDeliveryTime}
                </span>
              </div>

              {/* Selector de Hora, Minutos y AM/PM */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#7e7482] font-semibold block mb-0.5">{mt.hourLabel}</label>
                  <select
                    value={deliveryHour}
                    onChange={(e) => setDeliveryHour(e.target.value)}
                    className="w-full bg-[#fcf8ff] text-[#1a1a26] text-xs font-bold px-2 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  >
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#7e7482] font-semibold block mb-0.5">{mt.minuteLabel}</label>
                  <select
                    value={deliveryMinute}
                    onChange={(e) => setDeliveryMinute(e.target.value)}
                    className="w-full bg-[#fcf8ff] text-[#1a1a26] text-xs font-bold px-2 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#7e7482] font-semibold block mb-0.5">{mt.periodLabel}</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setDeliveryPeriod('AM')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        deliveryPeriod === 'AM'
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-[#fcf8ff] text-[#7e7482] border border-[#cfc2d2]/40'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryPeriod('PM')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        deliveryPeriod === 'PM'
                          ? 'bg-[#2e004e] text-[#f9b900] shadow-xs'
                          : 'bg-[#fcf8ff] text-[#7e7482] border border-[#cfc2d2]/40'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Botones rápidos de hora recomendada */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-[10px] text-[#7e7482] font-semibold mr-1">{mt.deliveryQuickLabel}</span>
                {['9:00 AM', '9:15 AM', '3:00 PM', '4:30 PM', '7:00 PM'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const match = preset.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                      if (match) {
                        setDeliveryHour(match[1]);
                        setDeliveryMinute(match[2]);
                        setDeliveryPeriod(match[3].toUpperCase() as 'AM' | 'PM');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      formattedDeliveryTime === preset
                        ? 'bg-[#f9b900] text-[#261900] shadow-xs font-black'
                        : 'bg-[#f5f2ff] text-[#4b0878] hover:bg-[#efecfd]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-semibold text-sm hover:bg-[#f5f2ff]"
            >
              {ct.cancel}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-[#4b0878] text-white font-bold text-sm shadow-md hover:bg-[#2e004e] active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {mt.savePetChanges}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
