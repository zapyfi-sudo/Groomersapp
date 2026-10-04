import React, { useState } from 'react';
import { Pet, SalonConfig, Appointment, RetentionPet, ClientReview } from './types';
import {
  INITIAL_PETS,
  INITIAL_SALON_CONFIG,
  INITIAL_APPOINTMENTS,
  INITIAL_RETENTION_PETS
} from './mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { RetentionView } from './components/RetentionView';
import { PetProfileView } from './components/PetProfileView';
import { AjustesView } from './components/AjustesView';
import { AgendaView } from './components/AgendaView';
import { PetListView } from './components/PetListView';
import { NewAppointmentView } from './components/NewAppointmentView';

export default function App() {
  const [pets, setPets] = useState<Pet[]>(INITIAL_PETS);
  const [selectedPetId, setSelectedPetId] = useState<string>('#PET-2849');
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(INITIAL_SALON_CONFIG);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [retentionPets, setRetentionPets] = useState<RetentionPet[]>(INITIAL_RETENTION_PETS);
  
  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<'retencion' | 'ficha' | 'onboarding' | 'agenda' | 'mascotas'>('agenda');
  const [showClientFlowModal, setShowClientFlowModal] = useState<boolean>(false);

  // Active selected pet (defaults to Toby)
  const currentPet = pets.find((p) => p.id === selectedPetId) || pets[0];

  const handleUpdatePet = (updated: Pet) => {
    setPets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleSelectPetForProfile = (petId: string) => {
    setSelectedPetId(petId);
    setCurrentTab('ficha');
  };

  const handleSelectPetFromList = (pet: Pet) => {
    setSelectedPetId(pet.id);
    setCurrentTab('ficha');
  };

  const handleMarkAsBooked = (retId: string) => {
    setRetentionPets((prev) =>
      prev.map((item) =>
        item.id === retId ? { ...item, alreadyBooked: !item.alreadyBooked } : item
      )
    );
  };

  const handleOpenWhatsApp = (retPet: RetentionPet) => {
    const textEncoded = encodeURIComponent(retPet.suggestedMessage);
    const waUrl = `https://wa.me/${retPet.rawPhone}?text=${textEncoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddNewPet = () => {
    const newId = `#PET-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPet: Pet = {
      id: newId,
      name: 'Nueva Mascota',
      breed: 'Mestizo',
      age: '1 año',
      gender: 'Macho',
      weightKg: 10,
      isVip: false,
      photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: 'Tutor Responsable',
        phone: '+54 9 11 0000-0000',
        rawPhone: '5491100000000'
      },
      habitualMood: 'tranquilo',
      healthAllergies: 'Sin afecciones registradas.',
      handlingObservations: 'Manejo habitual sin restricciones.',
      lastVisit: {
        id: 'v-new',
        date: 'Hoy',
        serviceName: 'Baño de inicio',
        price: 20000,
        currency: salonConfig.currency,
        mood: 'tranquilo',
        paid: true,
        photos: {}
      },
      visitHistory: [],
      recommendedIntervalWeeks: 4
    };

    setPets((prev) => [newPet, ...prev]);
    setSelectedPetId(newId);
    setCurrentTab('ficha');
  };

  const handleAddNewReview = (review: ClientReview) => {
    setSalonConfig((prev) => ({
      ...prev,
      reviews: [review, ...(prev.reviews || [])]
    }));
  };

  const urgentCount = retentionPets.filter(
    (p) => !p.alreadyBooked && (p.urgency === 'esta_semana' || p.urgency === 'urgente')
  ).length;

  return (
    <div className="min-h-screen bg-[#f3f0f7] text-[#1a1a26] flex flex-col font-sans">
      {/* Top Header (Clean desktop navbar; hidden on mobile to avoid frozen bar) */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        salonName={salonConfig.name}
      />

      {/* Screen Mode Layout Container (Full Width Responsive for Desktop PC, Tablet & Mobile Phone) */}
      <div className="flex-1 w-full flex justify-center md:pt-16">
        <main className="w-full bg-[#fcf8ff] min-h-screen transition-all shadow-sm">
          {/* Screen: Agenda del Día (Turnos de Hoy + Mini Calendario + Capacidad) */}
          {currentTab === 'agenda' && (
            <AgendaView
              appointments={appointments}
              pets={pets}
              onSelectPet={handleSelectPetFromList}
              onNavigateToRetention={() => setCurrentTab('retencion')}
              onAddNewAppointment={(newApt) => setAppointments((prev) => [newApt, ...prev])}
              salonName={salonConfig.name}
              salonAddress={salonConfig.address}
              salonPhone={salonConfig.phone}
              bookingSlug={salonConfig.bookingSlug}
              simultaneousCapacity={salonConfig.allowSimultaneousStaff === false ? 1 : salonConfig.simultaneousCapacity}
            />
          )}

          {/* Screen: Ajustes y Negocio (Historial Clientes Excel + Configuración + Calificaciones) */}
          {currentTab === 'onboarding' && (
            <AjustesView
              config={salonConfig}
              onUpdateConfig={setSalonConfig}
              onPreviewClientFlow={() => setShowClientFlowModal(true)}
              appointments={appointments}
              onAddNewReview={handleAddNewReview}
            />
          )}

          {/* Screen: Por Volver (Módulo de Fidelización / Clientes por volver) */}
          {currentTab === 'retencion' && (
            <RetentionView
              retentionPets={retentionPets}
              onSelectPetForProfile={handleSelectPetForProfile}
              onMarkAsBooked={handleMarkAsBooked}
              onOpenWhatsApp={handleOpenWhatsApp}
            />
          )}

          {/* Screen: Ficha Mascota (Toby / Perfil completo con Fotos Antes/Después y Visita) */}
          {currentTab === 'ficha' && (
            <PetProfileView
              pet={currentPet}
              onUpdatePet={handleUpdatePet}
              onNavigateOnboarding={() => setCurrentTab('onboarding')}
            />
          )}

          {/* Screen: Directorio de Mascotas / Clientes */}
          {currentTab === 'mascotas' && (
            <PetListView
              pets={pets}
              selectedPetId={selectedPetId}
              onSelectPet={handleSelectPetFromList}
              onAddNewPet={handleAddNewPet}
            />
          )}
        </main>
      </div>

      {/* Modal: Client Booking Flow when clicking "Probar flujo como cliente" or from Shared Link */}
      {showClientFlowModal && (
        <NewAppointmentView
          onClose={() => setShowClientFlowModal(false)}
          onAppointmentCreated={(newApt) => {
            setAppointments((prev) => [newApt, ...prev]);
            setShowClientFlowModal(false);
          }}
          salonName={salonConfig.name}
          salonAddress={salonConfig.address}
          salonPhone={salonConfig.phone}
          simultaneousCapacity={salonConfig.allowSimultaneousStaff === false ? 1 : salonConfig.simultaneousCapacity}
          existingAppointments={appointments}
          isOnlineClientPortal={true}
          salonConfig={salonConfig}
          onAddReview={handleAddNewReview}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        urgentCount={urgentCount}
      />
    </div>
  );
}
