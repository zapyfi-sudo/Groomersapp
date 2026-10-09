import React, { useState } from 'react';
import { Pet, BehaviorMood } from '../types';

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
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed);
  const [age, setAge] = useState(pet.age);
  const [gender, setGender] = useState(pet.gender);
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRawPhone = tutorPhone.replace(/[^0-9]/g, '');
    onSavePet({
      ...pet,
      name,
      breed,
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
      careRecommendations: careRecommendations.trim() || undefined
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
            <h3 className="font-bold text-base">Editar Ficha de {pet.name}</h3>
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
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Raza</label>
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
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Edad</label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="ej. 3 años"
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Sexo</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Macho' | 'Hembra')}
                className="w-full bg-white text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              >
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Peso (kg)</label>
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
              <span className="bg-[#f9b900] text-[#261900] text-[10px] font-bold px-1.5 py-0.2 rounded-full">VIP</span>
              Cliente Preferencial / Frecuente
            </label>
          </div>

          {/* Tutor Info */}
          <div className="bg-white p-3 rounded-2xl border border-[#cfc2d2]/30 space-y-3">
            <h4 className="text-xs font-bold text-[#4b0878] uppercase tracking-wider">
              Tutor Responsable
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#7e7482] mb-1">Nombre del Tutor</label>
                <input
                  type="text"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  className="w-full bg-[#fcf8ff] text-[#1a1a26] text-sm px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#7e7482] mb-1">Teléfono / WhatsApp</label>
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
              Comportamiento Habitual
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
                <span>Tranquilo</span>
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
                <span>Inquieto</span>
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
                <span>Difícil</span>
              </button>
            </div>
          </div>

          {/* Health & Allergies */}
          <div>
            <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">medical_services</span>
              Salud, Alergias y Piel Sensible
            </label>
            <textarea
              rows={2}
              value={healthAllergies}
              onChange={(e) => setHealthAllergies(e.target.value)}
              className="w-full bg-white text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder="Detalla alergias, afecciones de piel, heridas previas..."
            />
          </div>

          {/* Handling Observations */}
          <div>
            <label className="block text-xs font-bold text-[#7a5900] uppercase tracking-wider mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">pan_tool</span>
              Observaciones de Manejo
            </label>
            <textarea
              rows={2}
              value={handlingObservations}
              onChange={(e) => setHandlingObservations(e.target.value)}
              className="w-full bg-white text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder="Detalla qué le molesta, cuidados con secador, tijeras o extremidades..."
            />
          </div>

          {/* Care Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#2e004e] uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#7a5900]">tips_and_updates</span>
                Recomendaciones de Cuidado
              </label>
              <span className="text-[10px] text-[#7e7482]">Visible en Ficha PDF y WhatsApp</span>
            </div>
            <textarea
              rows={2}
              value={careRecommendations}
              onChange={(e) => setCareRecommendations(e.target.value)}
              className="w-full bg-[#fcf8ff] text-[#1a1a26] text-xs p-3 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              placeholder="Recomendaciones personalizadas del groomer para el tutor (manto, cepillado, productos)..."
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-semibold text-sm hover:bg-[#f5f2ff]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-[#4b0878] text-white font-bold text-sm shadow-md hover:bg-[#2e004e] active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
