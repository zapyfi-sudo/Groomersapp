import React, { useState, useEffect, useMemo } from 'react';
import { Pet, SalonConfig, Appointment, RetentionPet, ClientReview, UserAccount, BusinessAccountData } from './types';
import {
  deriveRetentionPets,
  loadLanguage,
  saveLanguage
} from './utils/storage';
import {
  initSaasDatabase,
  getSyncActiveData,
  getSyncActiveAccount,
  getSyncAccountsList,
  persistActiveConfig,
  persistActivePets,
  persistActiveAppointments,
  persistActiveBookedRetentions
} from './utils/saasDb';
import { syncBusinessToServer } from './utils/api';
import { AppLanguage } from './utils/translations';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { RetentionView } from './components/RetentionView';
import { PetProfileView } from './components/PetProfileView';
import { AjustesView } from './components/AjustesView';
import { AgendaView } from './components/AgendaView';
import { PetListView } from './components/PetListView';
import { AccountAuthModal } from './components/AccountAuthModal';
import { LoginScreen } from './components/LoginScreen';
import { PublicBookingPage } from './components/PublicBookingPage';

import { decodePublicProfileToken, extractSlugOnly } from './utils/slugUtils';

function getPublicBookingIdentifierFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Path routing: /reservas/:idOrSlug, /book/:idOrSlug, /booking/:idOrSlug, /reservar/:idOrSlug
  const path = window.location.pathname;
  const pathMatch = path.match(/^\/(?:book|booking|reservar|reservas)\/([^\/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    return extractSlugOnly(decodeURIComponent(pathMatch[1]));
  }

  // 2. Query params: businessId, bid, slug, or embedded token p
  const searchParams = new URLSearchParams(window.location.search);
  const explicitBiz = searchParams.get('businessId') || searchParams.get('bid') || searchParams.get('slug');
  if (explicitBiz) {
    return extractSlugOnly(explicitBiz) || explicitBiz;
  }

  const token = searchParams.get('p') || searchParams.get('token');
  if (token) {
    const decoded = decodePublicProfileToken(token);
    if (decoded && decoded.businessId) {
      return decoded.businessId;
    }
  }

  // 3. Hash routing: #reservas/:idOrSlug, #reservar/:idOrSlug or #book/:idOrSlug
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#(?:book|booking|reservar|reservas)(?:\/([^\/?#]+))?/i);
  if (hashMatch && hashMatch[1]) {
    return extractSlugOnly(decodeURIComponent(hashMatch[1]));
  }

  // 4. ?book=online parameter without explicit id -> invalid identifier to show clean error
  if (searchParams.get('book') === 'online' || hash === '#reservar' || hash === '#reservas' || path === '/reservas' || path === '/book') {
    return explicitBiz || 'not_specified_business';
  }

  return null;
}

export default function App() {
  // Check if current URL is a public booking page request
  const [urlBookingId, setUrlBookingId] = useState<string | null>(() => getPublicBookingIdentifierFromUrl());
  const [previewBookingId, setPreviewBookingId] = useState<string | null>(null);

  useEffect(() => {
    const handleUrlChange = () => {
      setUrlBookingId(getPublicBookingIdentifierFromUrl());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Synchronous initial state from local persistent cache (zero flicker / immediate render)
  const initialData = useMemo(() => getSyncActiveData(), []);
  const initialAccount = useMemo(() => getSyncActiveAccount(), []);
  const initialAccountsList = useMemo(() => getSyncAccountsList(), []);

  // Multi-User SaaS Account State
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(initialAccount);
  const [accountsList, setAccountsList] = useState<UserAccount[]>(initialAccountsList);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // Business Data State
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(initialData.config);
  const [pets, setPets] = useState<Pet[]>(initialData.pets);
  const [appointments, setAppointments] = useState<Appointment[]>(initialData.appointments);
  const [currentLanguage, setCurrentLanguage] = useState<AppLanguage>(() => loadLanguage());
  const [bookedRetentions, setBookedRetentions] = useState<string[]>(initialData.bookedRetentions || []);

  // Selected pet for profile view
  const [selectedPetId, setSelectedPetId] = useState<string>(() => {
    return initialData.pets[0]?.id || '#PET-2849';
  });

  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<'retencion' | 'ficha' | 'onboarding' | 'agenda' | 'mascotas'>('agenda');

  // Initialize IndexedDB & multi-account database on startup (with automatic migration of legacy data)
  useEffect(() => {
    initSaasDatabase().then((res) => {
      if (res.activeAccount) {
        setActiveAccount(res.activeAccount);
      }
      if (res.accounts && res.accounts.length > 0) {
        setAccountsList(res.accounts);
      }
      if (res.activeData) {
        setSalonConfig(res.activeData.config);
        setPets(res.activeData.pets);
        setAppointments(res.activeData.appointments);
        setBookedRetentions(res.activeData.bookedRetentions || []);
        if (res.activeData.pets.length > 0) {
          setSelectedPetId(res.activeData.pets[0].id);
        }

        // Fetch from persistent server database to ensure latest slug and public appointments
        const bizId = res.activeData.config?.id || res.activeData.businessId || 'biz_main';
        fetch(`/api/businesses/${encodeURIComponent(bizId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((serverData) => {
            if (serverData && serverData.config) {
              setSalonConfig((prev) => ({
                ...prev,
                ...serverData.config,
                bookingSlug: serverData.config.bookingSlug || prev.bookingSlug
              }));
              if (serverData.appointments && serverData.appointments.length > 0) {
                setAppointments(serverData.appointments);
              }
            }
          })
          .catch(() => {});
      }
    }).catch((err) => {
      console.warn('initSaasDatabase warning:', err);
    });
  }, []);

  // Immediate Persistent Auto-Save to IndexedDB, Mirror, and Server API
  useEffect(() => {
    if (salonConfig) {
      persistActiveConfig(salonConfig);
      syncBusinessToServer(salonConfig.id || 'biz_main', salonConfig, pets, appointments, bookedRetentions);
    }
  }, [salonConfig, pets, appointments, bookedRetentions]);

  useEffect(() => {
    persistActivePets(pets);
  }, [pets]);

  useEffect(() => {
    persistActiveAppointments(appointments);
  }, [appointments]);

  useEffect(() => {
    saveLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    persistActiveBookedRetentions(bookedRetentions);
  }, [bookedRetentions]);

  // Derived dynamic Retention Pets directly from real Pet state
  const retentionPets: RetentionPet[] = useMemo(() => {
    return deriveRetentionPets(pets, salonConfig.name, bookedRetentions);
  }, [pets, salonConfig.name, bookedRetentions]);

  // Active selected pet (fallback to first pet or clean default)
  const currentPet: Pet = useMemo(() => {
    return pets.find((p) => p.id === selectedPetId) || pets[0] || {
      id: '#PET-1000',
      name: 'Sin Mascota',
      breed: 'Mestizo',
      age: '1 año',
      gender: 'Macho',
      weightKg: 10,
      isVip: false,
      photoUrl: '',
      tutor: { name: 'Tutor', phone: '', rawPhone: '' },
      habitualMood: 'tranquilo',
      healthAllergies: '',
      handlingObservations: '',
      lastVisit: {
        id: 'v-0',
        date: 'Hoy',
        serviceName: 'Baño',
        price: 20,
        currency: salonConfig.currency,
        mood: 'tranquilo',
        paid: true,
        photos: {}
      },
      visitHistory: [],
      recommendedIntervalWeeks: 6
    };
  }, [pets, selectedPetId, salonConfig.currency]);

  // Account switching / login handler
  const handleAccountChanged = (newData: BusinessAccountData, newAccount: UserAccount) => {
    setActiveAccount(newAccount);
    setSalonConfig(newData.config);
    setPets(newData.pets);
    setAppointments(newData.appointments);
    setBookedRetentions(newData.bookedRetentions || []);
    if (newData.pets.length > 0) {
      setSelectedPetId(newData.pets[0].id);
    }

    setAccountsList((prev) => {
      const exists = prev.some((a) => a.id === newAccount.id);
      if (!exists) return [...prev, newAccount];
      return prev.map((a) => (a.id === newAccount.id ? newAccount : a));
    });
  };

  // Logout handler (keeps data safely stored in IndexedDB without deleting it)
  const handleLoggedOut = () => {
    setActiveAccount(null);
  };

  const handleUpdatePet = (updated: Pet) => {
    setPets((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (exists) {
        return prev.map((p) => (p.id === updated.id ? updated : p));
      }
      return [updated, ...prev];
    });
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
    const cleanPetId = retId.replace('ret-', '').replace('#', '');
    const matchedPet = pets.find((p) => p.id.replace('#', '') === cleanPetId);
    const petKey = matchedPet ? matchedPet.id : retId;

    setBookedRetentions((prev) => {
      if (prev.includes(petKey)) {
        return prev.filter((id) => id !== petKey);
      }
      return [...prev, petKey];
    });
  };

  const handleOpenWhatsApp = (retPet: RetentionPet) => {
    const textEncoded = encodeURIComponent(retPet.suggestedMessage);
    const cleanPhone = retPet.rawPhone || retPet.tutorPhone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${textEncoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddNewPet = () => {
    const newId = `#PET-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPet: Pet = {
      id: newId,
      name: 'Nueva Mascota',
      breed: 'Mestizo',
      age: '2 años',
      gender: 'Macho',
      weightKg: 10,
      isVip: false,
      photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: 'Tutor Responsable',
        phone: `${salonConfig.phonePrefix} 11 0000-0000`,
        rawPhone: `${salonConfig.phonePrefix.replace('+', '')}1100000000`
      },
      habitualMood: 'tranquilo',
      healthAllergies: 'Sin afecciones registradas.',
      handlingObservations: 'Manejo habitual sin restricciones.',
      lastVisit: {
        id: 'v-' + Date.now(),
        date: 'Hoy',
        serviceName: salonConfig.services[0]?.name || 'Baño + corte',
        price: salonConfig.services[0]?.price || 25,
        currency: salonConfig.currency,
        mood: 'tranquilo',
        paid: true,
        photos: {}
      },
      visitHistory: [],
      recommendedIntervalWeeks: 6
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

  // Cross-Module Automation: When an appointment is created, automatically add/update Pet & Tutor
  const handleAddNewAppointment = (newApt: Appointment, newPetData?: Partial<Pet>) => {
    setAppointments((prev) => [newApt, ...prev]);

    // Check if pet already exists in pets by ID or name
    setPets((prevPets) => {
      const existing = prevPets.find(
        (p) => p.id === newApt.petId || (p.name.toLowerCase() === newApt.petName.toLowerCase() && p.tutor.name.toLowerCase() === newApt.tutorName.toLowerCase())
      );

      if (existing) {
        return prevPets.map((p) => {
          if (p.id === existing.id) {
            return {
              ...p,
              tutor: {
                ...p.tutor,
                phone: newApt.tutorPhone || p.tutor.phone
              },
              lastVisit: {
                id: `v-${Date.now()}`,
                date: newApt.date || 'Hoy',
                serviceName: newApt.serviceName,
                price: newApt.price,
                currency: newApt.currency,
                mood: 'tranquilo',
                paid: newApt.paymentStatus === 'cobrado',
                photos: {}
              }
            };
          }
          return p;
        });
      }

      // Create new Pet record from appointment data
      const createdPet: Pet = {
        id: newApt.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newApt.petName,
        breed: newApt.breed || 'Mestizo',
        age: '1 año',
        gender: newPetData?.gender || 'Macho',
        weightKg: newPetData?.weightKg || 10,
        isVip: false,
        photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
        tutor: {
          name: newApt.tutorName,
          phone: newApt.tutorPhone || `${salonConfig.phonePrefix} 11 0000-0000`,
          rawPhone: (newApt.tutorPhone || '').replace(/\D/g, '')
        },
        habitualMood: newPetData?.habitualMood || 'tranquilo',
        healthAllergies: newPetData?.healthAllergies || 'Ninguna registrada.',
        handlingObservations: newPetData?.handlingObservations || 'Manejo habitual.',
        lastVisit: {
          id: `v-${Date.now()}`,
          date: newApt.date || 'Hoy',
          serviceName: newApt.serviceName,
          price: newApt.price,
          currency: newApt.currency,
          mood: 'tranquilo',
          paid: newApt.paymentStatus === 'cobrado',
          photos: {}
        },
        visitHistory: [],
        recommendedIntervalWeeks: 4
      };

      return [createdPet, ...prevPets];
    });
  };

  const handleUpdateAppointmentStatus = (appointmentId: string, status: string, statusLabel: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: status as any, statusLabel } : a))
    );
  };

  const urgentCount = useMemo(() => {
    return retentionPets.filter((p) => (p.urgency === 'esta_semana' || p.urgency === 'urgente') && !p.alreadyBooked).length;
  }, [retentionPets]);

  // 1. PUBLIC BOOKING LINK FLOW (Requirement #10: COMPLETELY SEPARATE FROM THE ADMIN APP)
  // When a customer visits via a shared booking link, ONLY show the Public Customer Booking page
  if (urlBookingId) {
    return (
      <PublicBookingPage
        businessIdOrSlug={urlBookingId}
        isPreviewMode={false}
        onAppointmentCreated={(newApt, newPetData) => {
          handleAddNewAppointment(newApt, newPetData);
        }}
      />
    );
  }

  // 2. ADMIN PREVIEW FLOW ("Probar flujo como cliente" inside Ajustes)
  if (previewBookingId) {
    return (
      <PublicBookingPage
        businessIdOrSlug={previewBookingId}
        isPreviewMode={true}
        onClosePreview={() => setPreviewBookingId(null)}
        onAppointmentCreated={(newApt, newPetData) => {
          handleAddNewAppointment(newApt, newPetData);
        }}
      />
    );
  }

  // 3. LOGGED-OUT SCREEN: Multi-account login / creation
  if (!activeAccount) {
    return (
      <LoginScreen
        accountsList={accountsList}
        onLoginSuccess={handleAccountChanged}
      />
    );
  }

  // 4. ADMIN SALON DASHBOARD
  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1a1a26] flex flex-col font-sans selection:bg-[#f9b900] selection:text-[#261900]">
      {/* Top Application Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        salonName={salonConfig.name}
        logoUrl={salonConfig.logoUrl}
        urgentCount={urgentCount}
        currentLanguage={currentLanguage}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
      />

      {/* Screen Mode Layout Container */}
      <div className="flex-1 w-full flex justify-center md:pt-16">
        <main className="w-full bg-[#fcf8ff] min-h-screen transition-all shadow-sm">
          {/* Screen: Agenda del Día */}
          {currentTab === 'agenda' && (
            <AgendaView
              appointments={appointments}
              pets={pets}
              onSelectPet={handleSelectPetFromList}
              onNavigateToRetention={() => setCurrentTab('retencion')}
              onAddNewAppointment={handleAddNewAppointment}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              salonConfig={salonConfig}
              urgentRetentionCount={urgentCount}
              totalRetentionCount={retentionPets.filter((p) => !p.alreadyBooked).length}
              currentLanguage={currentLanguage}
            />
          )}

          {/* Screen: Ajustes y Negocio */}
          {currentTab === 'onboarding' && (
            <AjustesView
              config={salonConfig}
              onUpdateConfig={(updated) => {
                setSalonConfig(updated);
                syncBusinessToServer(updated.id || 'biz_main', updated, pets, appointments, bookedRetentions);
              }}
              onPreviewClientFlow={() => {
                setPreviewBookingId(salonConfig.id || salonConfig.bookingSlug || 'biz_main');
              }}
              appointments={appointments}
              onAddNewReview={handleAddNewReview}
              currentLanguage={currentLanguage}
              onUpdateLanguage={setCurrentLanguage}
              activeAccount={activeAccount}
              onOpenAccountModal={() => setIsAccountModalOpen(true)}
            />
          )}

          {/* Screen: Por Volver (Módulo de Fidelización derivado directamente de Clientes) */}
          {currentTab === 'retencion' && (
            <RetentionView
              retentionPets={retentionPets}
              onSelectPetForProfile={handleSelectPetForProfile}
              onMarkAsBooked={handleMarkAsBooked}
              onOpenWhatsApp={handleOpenWhatsApp}
              currentLanguage={currentLanguage}
            />
          )}

          {/* Screen: Ficha Mascota */}
          {currentTab === 'ficha' && (
            <PetProfileView
              pet={currentPet}
              onUpdatePet={handleUpdatePet}
              onNavigateOnboarding={() => setCurrentTab('onboarding')}
              salonConfig={salonConfig}
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

      {/* Account Switcher & SaaS Management Modal */}
      <AccountAuthModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        activeAccount={activeAccount}
        accountsList={accountsList}
        onAccountChanged={handleAccountChanged}
        onLoggedOut={handleLoggedOut}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        urgentCount={urgentCount}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
