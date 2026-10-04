import React, { useState } from 'react';
import { Pet } from '../types';

interface PetListViewProps {
  pets: Pet[];
  selectedPetId: string;
  onSelectPet: (pet: Pet) => void;
  onAddNewPet: () => void;
}

export const PetListView: React.FC<PetListViewProps> = ({
  pets,
  selectedPetId,
  onSelectPet,
  onAddNewPet
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPets = pets.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.breed.toLowerCase().includes(q) ||
      p.tutor.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col w-full pb-20 px-4 pt-4 space-y-4">
      {/* Header & New Pet Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a26]">Directorio de Mascotas</h2>
          <p className="text-xs text-[#4c4451]">{pets.length} fichas activas registradas</p>
        </div>
        <button
          type="button"
          onClick={onAddNewPet}
          className="py-2 px-3 rounded-xl bg-[#f9b900] text-[#261900] text-xs font-bold shadow-sm hover:bg-[#ffdea1] active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Nueva Mascota
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center bg-white rounded-xl px-3 py-2.5 shadow-xs border border-[#cfc2d2]/40">
        <span className="material-symbols-outlined text-[#7e7482] text-lg mr-2">search</span>
        <input
          type="text"
          placeholder="Buscar por nombre, raza, tutor o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-[#1a1a26] outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-[#7e7482] hover:text-[#1a1a26] text-xs"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Pet Cards List */}
      <div className="space-y-3">
        {filteredPets.map((pet) => {
          const isSelected = pet.id === selectedPetId;

          return (
            <div
              key={pet.id}
              onClick={() => onSelectPet(pet)}
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all cursor-pointer flex flex-col gap-3 ${
                isSelected
                  ? 'border-[#4b0878] ring-2 ring-[#4b0878]/30 shadow-md'
                  : 'border-[#cfc2d2]/30 hover:border-[#4b0878]/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-[#efecfd] shrink-0 border border-[#cfc2d2]/30">
                  <img
                    src={pet.photoUrl}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                  {pet.isVip && (
                    <span className="absolute bottom-0 right-0 bg-[#f9b900] text-[#261900] text-[8px] font-bold px-1 rounded-tl">
                      VIP
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-base text-[#1a1a26] truncate">{pet.name}</h3>
                      <span className="text-[10px] text-[#7e7482] bg-[#f5f2ff] px-1.5 py-0.5 rounded font-mono">
                        {pet.id}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        pet.habitualMood === 'tranquilo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pet.habitualMood === 'inquieto'
                          ? 'bg-[#ffdea1] text-[#684c00]'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {pet.habitualMood}
                    </span>
                  </div>

                  <p className="text-xs text-[#4c4451] truncate mt-0.5">
                    {pet.breed} • {pet.age} • {pet.weightKg} kg
                  </p>

                  <div className="flex items-center justify-between mt-1 text-xs text-[#7e7482]">
                    <span>Tutor: <strong className="text-[#1a1a26]">{pet.tutor.name}</strong></span>
                    <span className="text-[#4b0878] font-bold flex items-center gap-0.5">
                      Ver Ficha
                      <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Health Alert snippet if present */}
              {pet.healthAllergies && (
                <div className="bg-[#f5f2ff] rounded-xl px-2.5 py-1.5 text-[11px] text-[#ba1a1a] flex items-center gap-1.5 border border-[#cfc2d2]/20">
                  <span className="material-symbols-outlined text-xs shrink-0">medical_services</span>
                  <span className="truncate">{pet.healthAllergies}</span>
                </div>
              )}
            </div>
          );
        })}

        {filteredPets.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#cfc2d2] p-6">
            <span className="material-symbols-outlined text-4xl text-[#7e7482]">pets</span>
            <h4 className="text-sm font-bold text-[#1a1a26] mt-2">No se encontraron mascotas</h4>
            <p className="text-xs text-[#7e7482] mt-1">Prueba con otro término de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
};
