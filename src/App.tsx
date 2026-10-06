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
import {
  syncBusinessToServer,
  fetchBusinessProfile,
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  updateAppointmentStatusOnServer,
  fetchLatestAppointmentsAndPets
} from './utils/api';
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

  // Real-time notification for incoming public bookings
  const [newBookingNotification, setNewBookingNotification] = useState<string | null>(null);

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

        // Fetch from persistent cloud database (Firestore / Server API) to ensure latest slug, appointments, and pets
        const bizId = res.activeData.config?.id || res.activeData.businessId || 'biz_main';
        fetchBusinessProfile(bizId)
          .then((profile) => {
            if (profile && profile.config) {
              setSalonConfig((prev) => ({
                ...prev,
                ...profile.config,
                bookingSlug: profile.config.bookingSlug || prev.bookingSlug
              }));

              if (profile.appointments && profile.appointments.length > 0) {
                setAppointments((prev) => {
                  const map = new Map<string, Appointment>();
                  for (const a of prev) if (a?.id) map.set(a.id, a);

                  for (const incoming of profile.appointments) {
                    if (!incoming?.id) continue;
                    const existing = map.get(incoming.id);
                    if (!existing) {
                      map.set(incoming.id, incoming);
                    } else {
                      // Confirmed status must ALWAYS take precedence and never revert to pending
                      const isConfirmed =
                        existing.status === 'confirmada' ||
                        (existing.status as any) === 'confirmed' ||
                        incoming.status === 'confirmada' ||
                        (incoming.status as any) === 'confirmed';
                      const isCompleted =
                        existing.status === 'completado' ||
                        (existing.status as any) === 'completed' ||
                        incoming.status === 'completado' ||
                        (incoming.status as any) === 'completed';
                      const isInSalon =
                        existing.status === 'en_salon' ||
                        existing.status === 'en_corte' ||
                        incoming.status === 'en_salon' ||
                        incoming.status === 'en_corte';
                      const isCancelled =
                        existing.status === 'cancelada' ||
                        incoming.status === 'cancelada';

                      const resolvedStatus = isConfirmed
                        ? 'confirmada'
                        : isCompleted
                        ? 'completado'
                        : isInSalon
                        ? 'en_salon'
                        : isCancelled
                        ? 'cancelada'
                        : (incoming.status || existing.status || 'pendiente');

                      const resolvedLabel = resolvedStatus === 'confirmada'
                        ? 'CONFIRMADA'
                        : resolvedStatus === 'completado'
                        ? 'COMPLETADO'
                        : resolvedStatus === 'en_salon'
                        ? 'EN SALÓN'
                        : resolvedStatus === 'cancelada'
                        ? 'CANCELADA'
                        : (incoming.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

                      map.set(incoming.id, {
                        ...incoming,
                        ...existing,
                        status: resolvedStatus,
                        statusLabel: resolvedLabel
                      });
                    }
                  }

                  const merged = Array.from(map.values());
                  merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
                  persistActiveAppointments(merged);
                  return merged;
                });
              }

              if (profile.pets && profile.pets.length > 0) {
                setPets((prev) => {
                  const map = new Map<string, Pet>();
                  for (const p of prev) if (p?.id) map.set(p.id, p);
                  for (const p of profile.pets!) if (p?.id) map.set(p.id, p);
                  const merged = Array.from(map.values());
                  persistActivePets(merged);
                  return merged;
                });
              }
            }
          })
          .catch((err) => {
            console.warn('Initial cloud sync warning:', err);
          });
      }
    }).catch((err) => {
      console.warn('initSaasDatabase warning:', err);
    });
  }, []);

  // Real-time synchronization of public appointments & pets from Cloud Firestore + Server Polling
  useEffect(() => {
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';
    if (!currentBizId) return;

    // 1. Subscribe to real-time incoming public appointments via Firestore
    const unsubApts = subscribeToBusinessAppointments(currentBizId, (incomingApts) => {
      if (!incomingApts) return;

      setAppointments((prev) => {
        const prevIds = new Set(prev.map((a) => a.id));
        const brandNew = incomingApts.filter(
          (a) => !prevIds.has(a.id) && (a.status === 'pendiente' || a.statusLabel === 'POR CONFIRMAR')
        );

        if (brandNew.length > 0) {
          const latest = brandNew[0];
          setNewBookingNotification(
            `¡Nueva reserva online de ${latest.tutorName} para ${latest.petName} (${latest.serviceName})!`
          );
          setTimeout(() => setNewBookingNotification(null), 8000);
        }

        const map = new Map<string, Appointment>();
        for (const a of prev) if (a?.id) map.set(a.id, a);

        for (const incoming of incomingApts) {
          if (!incoming?.id) continue;
          const existing = map.get(incoming.id);
          if (!existing) {
            map.set(incoming.id, incoming);
          } else {
            // Never overwrite a confirmed or completed appointment back to pending!
            const isConfirmed =
              existing.status === 'confirmada' ||
              (existing.status as any) === 'confirmed' ||
              incoming.status === 'confirmada' ||
              (incoming.status as any) === 'confirmed';
            const isCompleted =
              existing.status === 'completado' ||
              (existing.status as any) === 'completed' ||
              incoming.status === 'completado' ||
              (incoming.status as any) === 'completed';
            const isInSalon =
              existing.status === 'en_salon' ||
              existing.status === 'en_corte' ||
              incoming.status === 'en_salon' ||
              incoming.status === 'en_corte';
            const isCancelled =
              existing.status === 'cancelada' ||
              incoming.status === 'cancelada';

            const resolvedStatus = isConfirmed
              ? 'confirmada'
              : isCompleted
              ? 'completado'
              : isInSalon
              ? 'en_salon'
              : isCancelled
              ? 'cancelada'
              : (incoming.status || existing.status || 'pendiente');

            const resolvedLabel = resolvedStatus === 'confirmada'
              ? 'CONFIRMADA'
              : resolvedStatus === 'completado'
              ? 'COMPLETADO'
              : resolvedStatus === 'en_salon'
              ? 'EN SALÓN'
              : resolvedStatus === 'cancelada'
              ? 'CANCELADA'
              : (incoming.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

            map.set(incoming.id, {
              ...incoming,
              ...existing,
              status: resolvedStatus,
              statusLabel: resolvedLabel
            });
          }
        }

        const merged = Array.from(map.values());
        merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
        persistActiveAppointments(merged);
        return merged;
      });
    });

    // 2. Subscribe to real-time incoming pets via Firestore
    const unsubPets = subscribeToBusinessPets(currentBizId, (incomingPets) => {
      if (!incomingPets) return;

      setPets((prev) => {
        const map = new Map<string, Pet>();
        for (const p of prev) if (p?.id) map.set(p.id, p);
        for (const p of incomingPets) if (p?.id) map.set(p.id, p);
        const merged = Array.from(map.values());
        persistActivePets(merged);
        return merged;
      });
    });

    // 3. Periodic server polling (every 8 seconds + window focus) to ensure zero desync across all environments
    const pollServerSync = async () => {
      try {
        const latest = await fetchLatestAppointmentsAndPets(currentBizId);
        if (latest) {
          if (latest.appointments && latest.appointments.length > 0) {
            setAppointments((prev) => {
              const prevMap = new Map<string, Appointment>();
              for (const a of prev) if (a?.id) prevMap.set(a.id, a);

              const brandNew = latest.appointments.filter(
                (a) => !prevMap.has(a.id) && (a.status === 'pendiente' || a.statusLabel === 'POR CONFIRMAR')
              );

              if (brandNew.length > 0) {
                const newest = brandNew[0];
                setNewBookingNotification(
                  `¡Nueva reserva online de ${newest.tutorName} para ${newest.petName} (${newest.serviceName})!`
                );
                setTimeout(() => setNewBookingNotification(null), 8000);
              }

              for (const a of latest.appointments) {
                if (a?.id) {
                  const existing = prevMap.get(a.id);
                  if (!existing) {
                    prevMap.set(a.id, a);
                  } else {
                    // Confirmed status must ALWAYS take precedence and never revert to pending
                    const isConfirmed =
                      existing.status === 'confirmada' ||
                      (existing.status as any) === 'confirmed' ||
                      a.status === 'confirmada' ||
                      (a.status as any) === 'confirmed';
                    const isCompleted =
                      existing.status === 'completado' ||
                      (existing.status as any) === 'completed' ||
                      a.status === 'completado' ||
                      (a.status as any) === 'completed';
                    const isInSalon =
                      existing.status === 'en_salon' ||
                      existing.status === 'en_corte' ||
                      a.status === 'en_salon' ||
                      a.status === 'en_corte';
                    const isCancelled =
                      existing.status === 'cancelada' ||
                      a.status === 'cancelada';

                    const resolvedStatus = isConfirmed
                      ? 'confirmada'
                      : isCompleted
                      ? 'completado'
                      : isInSalon
                      ? 'en_salon'
                      : isCancelled
                      ? 'cancelada'
                      : (a.status || existing.status || 'pendiente');

                    const resolvedLabel = resolvedStatus === 'confirmada'
                      ? 'CONFIRMADA'
                      : resolvedStatus === 'completado'
                      ? 'COMPLETADO'
                      : resolvedStatus === 'en_salon'
                      ? 'EN SALÓN'
                      : resolvedStatus === 'cancelada'
                      ? 'CANCELADA'
                      : (a.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

                    prevMap.set(a.id, {
                      ...a,
                      ...existing,
                      status: resolvedStatus,
                      statusLabel: resolvedLabel
                    });
                  }
                }
              }

              const merged = Array.from(prevMap.values());
              merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
              persistActiveAppointments(merged);
              return merged;
            });
          }

          if (latest.pets && latest.pets.length > 0) {
            setPets((prev) => {
              const map = new Map<string, Pet>();
              for (const p of prev) if (p?.id) map.set(p.id, p);
              for (const p of latest.pets) if (p?.id && !map.has(p.id)) map.set(p.id, p);
              const merged = Array.from(map.values());
              persistActivePets(merged);
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Background server polling error:', err);
      }
    };

    pollServerSync();
    const pollInterval = setInterval(pollServerSync, 8000);

    const onFocus = () => pollServerSync();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      unsubApts();
      unsubPets();
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [activeAccount?.businessId, salonConfig?.id]);

  // Immediate Persistent Auto-Save to IndexedDB, Mirror, and Server API
  useEffect(() => {
    if (salonConfig) {
      persistActiveConfig(salonConfig);
    }
  }, [salonConfig]);

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

  const handleUpdateAppointmentStatus = async (
    appointmentId: string,
    status: string,
    statusLabel: string,
    extraPatch?: Partial<Appointment>
  ): Promise<boolean> => {
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';

    let updatedList: Appointment[] = [];
    setAppointments((prev) => {
      updatedList = prev.map((a) =>
        a.id === appointmentId ? { ...a, status: status as any, statusLabel, ...(extraPatch || {}) } : a
      );
      return updatedList;
    });

    // 1. Guarantee persistence in local IndexedDB & localStorage cache first
    if (updatedList.length > 0) {
      await persistActiveAppointments(updatedList);
    }

    // 2. Guarantee persistence in Backend Server API & Cloud Firestore
    try {
      await updateAppointmentStatusOnServer(currentBizId, appointmentId, status, statusLabel, extraPatch);
    } catch (err) {
      console.warn('Error syncing appointment status update:', err);
    }

    return true;
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

      {/* Floating Real-Time New Booking Notification Banner */}
      {newBookingNotification && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300 max-w-lg mx-4">
          <div className="w-8 h-8 rounded-full bg-[#f9b900] text-[#261900] flex items-center justify-center shrink-0 font-bold">
            <span className="material-symbols-outlined text-lg">notifications_active</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-[#f9b900]">¡Nueva Solicitud de Cita Online!</p>
            <p className="text-xs text-white truncate">{newBookingNotification}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentTab('agenda');
              setNewBookingNotification(null);
            }}
            className="px-3 py-1 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            Ver en Agenda
          </button>
          <button
            type="button"
            onClick={() => setNewBookingNotification(null)}
            className="text-white/60 hover:text-white cursor-pointer ml-1"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

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
