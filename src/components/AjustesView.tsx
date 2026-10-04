import React, { useState, useMemo } from 'react';
import {
  SalonConfig,
  StaffMember,
  Appointment,
  ClientReview,
  SalonService,
  MedicationProduct,
  StaffScheduleConfig
} from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { GoogleMapsLocationPicker } from './GoogleMapsLocationPicker';
import { ServiceManager } from './ServiceManager';
import { MedicationManager } from './MedicationManager';
import { StaffShiftScheduleManager } from './StaffShiftScheduleManager';

interface AjustesViewProps {
  config: SalonConfig;
  onUpdateConfig: (updated: SalonConfig) => void;
  onPreviewClientFlow: () => void;
  appointments?: Appointment[];
  onAddNewReview?: (review: ClientReview) => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  config,
  onUpdateConfig,
  onPreviewClientFlow,
  appointments = []
}) => {
  // Navigation: null shows the simplified vertical menu; or 'negocio' | 'calificaciones' | 'clientes'
  const [selectedSection, setSelectedSection] = useState<'negocio' | 'calificaciones' | 'clientes' | null>(null);

  // Excel & Client History Filters
  const [clientPeriodFilter, setClientPeriodFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('mes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Brand data
  const [logoUrl, setLogoUrl] = useState<string>(config.logoUrl || HOTLINK_IMAGES.logo);
  const [businessName, setBusinessName] = useState<string>(config.name || 'Peluquería Canina Luna');
  const [language, setLanguage] = useState<string>('es-LA');
  const [countryCurrency, setCountryCurrency] = useState<string>('AR-ARS');

  // Contact & Location
  const [phonePrefix, setPhonePrefix] = useState<string>(config.phonePrefix || '+54');
  const [phoneNumber, setPhoneNumber] = useState<string>(config.phone || '11 5489 3210');
  const [address, setAddress] = useState<string>(config.address || 'Av. Corrientes 4520, Almagro, CABA');
  const [coords, setCoords] = useState<string>(config.coordinates || '-34.603722, -58.423145');

  // Schedule & Double Shift
  const [activeDays, setActiveDays] = useState<string[]>(config.activeDays || ['L', 'M', 'X', 'J', 'V']);
  const [hasDoubleShift, setHasDoubleShift] = useState<boolean>(config.hasDoubleShift ?? true);
  const [morningOpen, setMorningOpen] = useState<string>(config.morningOpen || '08:00');
  const [morningClose, setMorningClose] = useState<string>(config.morningClose || '12:30');
  const [lunchText] = useState<string>('12:30 PM a 02:00 PM (1h 30m)');
  const [afternoonOpen, setAfternoonOpen] = useState<string>(config.afternoonOpen || '14:00');
  const [afternoonClose, setAfternoonClose] = useState<string>(config.afternoonClose || '19:30');

  // Staff Schedules (Turnos del personal)
  const [staffScheduleConfig, setStaffScheduleConfig] = useState<StaffScheduleConfig>(
    config.staffScheduleConfig || {
      allDay: { start: '08:00', end: '18:00' },
      morning: { start: '08:00', end: '13:00' },
      afternoon: { start: '14:00', end: '19:30' }
    }
  );

  // Staff & Simultaneous Capacity Configuration
  const [allowSimultaneousStaff, setAllowSimultaneousStaff] = useState<boolean>(
    config.allowSimultaneousStaff ?? true
  );
  const [simultaneousCapacity, setSimultaneousCapacity] = useState<number>(
    config.simultaneousCapacity || 2
  );
  const [staffList, setStaffList] = useState<StaffMember[]>(
    config.staffMembers || [
      { id: 'st-1', name: 'Carlos Morales', role: 'Estilista Principal (Corte & Spa)', active: true, shiftAvailability: 'todo_el_dia' },
      { id: 'st-2', name: 'Mariana V.', role: 'Especialista en Baño y Deslanado', active: true, shiftAvailability: 'todo_el_dia' },
      { id: 'st-3', name: 'Roberto Díaz', role: 'Ayudante y Secado', active: true, shiftAvailability: 'solo_tarde' }
    ]
  );
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<string>('Estilista de corte');
  const [newStaffShift, setNewStaffShift] = useState<'todo_el_dia' | 'solo_manana' | 'solo_tarde'>('todo_el_dia');

  // Services Configuration
  const [servicesList, setServicesList] = useState<SalonService[]>(
    config.services || [
      {
        id: 's-1',
        name: 'Baño + corte',
        durationMin: 90,
        price: 25000,
        pricingType: 'tamano',
        priceBySize: {
          pequeno: 20000,
          mediano: 25000,
          grande: 30000,
          extraGrande: 35000
        },
        desc: 'Corte higiénico, estética de raza, corte de uñas y limpieza de oídos.',
        active: true,
        icon: 'content_cut'
      },
      {
        id: 's-2',
        name: 'Baño completo',
        durationMin: 45,
        price: 18000,
        pricingType: 'unico',
        desc: 'Higiene profunda con champú hipoalergénico, secado y perfume.',
        active: true,
        icon: 'bathtub'
      },
      {
        id: 's-3',
        name: 'Deslanado premium',
        durationMin: 75,
        price: 22000,
        pricingType: 'unico',
        desc: 'Eliminación exhaustiva de manto muerto con cardina y cepillado profundo.',
        active: true,
        icon: 'pets'
      }
    ]
  );

  // Medications & Antiparasitic Products Configuration
  const [hasMedicationProductsEnabled, setHasMedicationProductsEnabled] = useState<boolean>(
    config.hasMedicationProductsEnabled ?? true
  );
  const [medicationProducts, setMedicationProducts] = useState<MedicationProduct[]>(
    config.medicationProducts || [
      {
        id: 'med-1',
        name: 'Tratamiento antipulgas y garrapatas',
        type: 'Gotas',
        purpose: 'Pipeta tópica para control y eliminación de pulgas y garrapatas externas.',
        price: 4500,
        photoUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
        active: true
      },
      {
        id: 'med-2',
        name: 'Antiparasitario interno en comprimido',
        type: 'Pastilla',
        purpose: 'Comprimido masticable con premio para desparasitación gastrointestinal completa.',
        price: 3500,
        photoUrl: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80',
        active: true
      }
    ]
  );

  // Online booking link
  const clientBookingSlug = config.bookingSlug || 'agendacan.app/peluquerialuna';

  // Reviews from config
  const reviewsList: ClientReview[] = useMemo(() => {
    return (
      config.reviews || [
        {
          id: 'rev-1',
          clientName: 'Ana Gómez',
          petName: 'Toby',
          serviceName: 'Baño + corte',
          stars: 5,
          comment: '¡Increíble atención! Toby quedó súper suave y con un aroma riquísimo. Súper pacientes con su carácter inquieto.',
          date: '14 Octubre 2024',
          verified: true
        },
        {
          id: 'rev-2',
          clientName: 'Carlos Benítez',
          petName: 'Luna',
          serviceName: 'Baño completo',
          stars: 5,
          comment: 'Mariana es un amor. Luna nunca se deja cortar las uñas pero con ella estuvo tranquila. 100% recomendado.',
          date: '12 Octubre 2024',
          verified: true
        },
        {
          id: 'rev-3',
          clientName: 'Lucía Fernández',
          petName: 'Rocky',
          serviceName: 'Deslanado premium',
          stars: 5,
          comment: 'Le sacaron una cantidad impresionante de pelo muerto a Rocky. Muy profesionales y puntuales.',
          date: '10 Octubre 2024',
          verified: true
        },
        {
          id: 'rev-4',
          clientName: 'Martín Peralta',
          petName: 'Milo',
          serviceName: 'Baño + corte',
          stars: 4,
          comment: 'Muy buen corte y rápido. La reserva online por WhatsApp fue súper cómoda.',
          date: '08 Octubre 2024',
          verified: true
        }
      ]
    );
  }, [config.reviews]);

  // UI state
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const daysList = [
    { label: 'L', key: 'L' },
    { label: 'M', key: 'M' },
    { label: 'X', key: 'X' },
    { label: 'J', key: 'J' },
    { label: 'V', key: 'V' },
    { label: 'S', key: 'S' },
    { label: 'D', key: 'D' }
  ];

  const toggleDay = (key: string) => {
    if (activeDays.includes(key)) {
      setActiveDays(activeDays.filter((d) => d !== key));
    } else {
      setActiveDays([...activeDays, key]);
    }
  };

  const handleSelectWeekdays = () => {
    setActiveDays(['L', 'M', 'X', 'J', 'V']);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${clientBookingSlug}`);
    setIsCopied(true);
    setSavedToast('¡Enlace de reservas copiado al portapapeles!');
    setTimeout(() => {
      setIsCopied(false);
      setSavedToast(null);
    }, 2500);
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    const newMember: StaffMember = {
      id: 'st-' + Date.now(),
      name: newStaffName.trim(),
      role: newStaffRole,
      active: true,
      shiftAvailability: newStaffShift
    };
    setStaffList((prev) => [...prev, newMember]);
    setNewStaffName('');
  };

  const toggleStaffActive = (id: string) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleUpdateStaffShift = (id: string, shift: 'todo_el_dia' | 'solo_manana' | 'solo_tarde') => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, shiftAvailability: shift } : s))
    );
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  };

  // Filtered Appointments for the Excel / History view
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (clientPeriodFilter === 'hoy') {
        const isToday = apt.date?.includes('15 de Octubre') || apt.time.includes('09:00 AM');
        if (!isToday) return false;
      } else if (clientPeriodFilter === 'semana') {
        const isThisWeek = apt.date?.includes('Octubre');
        if (!isThisWeek) return false;
      }
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPet = apt.petName.toLowerCase().includes(q);
        const matchesTutor = apt.tutorName.toLowerCase().includes(q);
        const matchesBreed = apt.breed.toLowerCase().includes(q);
        const matchesPhone = apt.tutorPhone?.toLowerCase().includes(q);
        const matchesService = apt.serviceName.toLowerCase().includes(q);
        if (!matchesPet && !matchesTutor && !matchesBreed && !matchesPhone && !matchesService) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, clientPeriodFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredAppointments.length;
    const totalRevenue = filteredAppointments.reduce((acc, curr) => acc + (curr.price || 0), 0);
    const completedCount = filteredAppointments.filter((a) => a.status === 'completado').length;
    return {
      totalCount,
      totalRevenue,
      completedCount,
      avgRating: 4.9
    };
  }, [filteredAppointments]);

  // Export to Excel / CSV function
  const handleExportExcel = () => {
    const headers = [
      'ID Cita',
      'Fecha',
      'Horario',
      'Mascota',
      'Raza',
      'Tutor Responsable',
      'Teléfono WhatsApp',
      'Servicio',
      'Estilista a Cargo',
      'Precio ($)',
      'Moneda',
      'Estado Cobro',
      'Calificación Estrellas',
      'Observaciones'
    ];

    const rows = filteredAppointments.map((apt) => [
      `"${apt.id}"`,
      `"${apt.date || '15 de Octubre 2024'}"`,
      `"${apt.time}"`,
      `"${apt.petName}"`,
      `"${apt.breed}"`,
      `"${apt.tutorName}"`,
      `"${apt.tutorPhone || '+54 9 11 4455-6677'}"`,
      `"${apt.serviceName}"`,
      `"${apt.groomer}"`,
      apt.price,
      `"${apt.currency}"`,
      `"${apt.paymentStatusLabel}"`,
      `"${apt.rating ? apt.rating + ' estrellas' : '5 estrellas'}"`,
      `"${(apt.notes || apt.reviewComment || 'Atención satisfactoria').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const periodLabel = clientPeriodFilter === 'hoy' ? 'Hoy' : clientPeriodFilter === 'semana' ? 'EstaSemana' : 'Mes_Octubre';
    link.setAttribute('href', url);
    link.setAttribute('download', `AgendaCan_Clientes_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSavedToast('¡Planilla de clientes descargada exitosamente!');
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedConfig: SalonConfig = {
      ...config,
      name: businessName,
      logoUrl,
      phonePrefix,
      phone: phoneNumber,
      address,
      coordinates: coords,
      googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(coords)}`,
      googleMapsPlaceName: `${businessName} - ${address}`,
      allowSimultaneousStaff,
      maxSimultaneousAppointments: simultaneousCapacity,
      currency: countryCurrency.includes('ARS') ? 'ARS' : 'USD',
      simultaneousCapacity,
      staffMembers: staffList,
      staffScheduleConfig,
      services: servicesList,
      hasMedicationProductsEnabled,
      medicationProducts,
      reviews: reviewsList,
      hasDoubleShift,
      morningOpen,
      morningClose,
      afternoonOpen,
      afternoonClose,
      activeDays
    };

    onUpdateConfig(updatedConfig);

    setTimeout(() => {
      setIsSaving(false);
      setSavedToast('¡Todos los cambios fueron guardados exitosamente!');
      setTimeout(() => setSavedToast(null), 3000);
    }, 600);
  };

  return (
    <div className="flex flex-col w-full pb-32 px-4 sm:px-6 lg:px-8 pt-4 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{savedToast}</span>
        </div>
      )}

      {/* VISTA 1: PANTALLA PRINCIPAL DE AJUSTES EN ESPAÑOL
          Muestra ÚNICAMENTE [Ícono] + [Nombre de la sección]:
          1. Configuración del negocio
          2. Calificaciones
          3. Mis clientes
          Sin descripciones secundarias, sin 'Opción 1/2/3', nombres completos sin truncar. */}
      {selectedSection === null && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="pb-2 border-b border-[#cfc2d2]/40">
            <div className="flex items-center gap-1.5 text-[#7a5900] text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-base text-[#f9b900]">tune</span>
              <span>Centro de ajustes y administración</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a26] tracking-tight">
              Ajustes
            </h1>
          </div>

          {/* Menú de opciones vertical hacia abajo */}
          <div className="flex flex-col space-y-4 max-w-4xl">
            {/* 1. Configuración del negocio */}
            <div
              onClick={() => setSelectedSection('negocio')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#f5f2ff] text-[#2e004e] group-hover:bg-[#2e004e] group-hover:text-[#f9b900] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">storefront</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  Configuración del negocio
                </h2>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 2. Calificaciones */}
            <div
              onClick={() => setSelectedSection('calificaciones')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#fff8e1] text-[#7a5900] group-hover:bg-[#f9b900] group-hover:text-[#261900] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="text-2xl">★</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  Calificaciones
                </h2>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 3. Mis clientes */}
            <div
              onClick={() => setSelectedSection('clientes')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#e8f5e9] text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">table_view</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  Mis clientes
                </h2>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: SUB-PÁGINAS SIN NAVEGACIÓN DUPLICADA EN LA PARTE SUPERIOR */}
      {selectedSection !== null && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Barra superior con botón volver */}
          <div className="flex items-center justify-between pb-3 border-b border-[#cfc2d2]/40">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className="py-2 px-3.5 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-black text-xs shadow-xs border border-[#cfc2d2]/40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>Volver a Ajustes</span>
              </button>

              <div className="text-xs text-[#7e7482]">
                <span>Ajustes &gt; </span>
                <strong className="text-[#1a1a26]">
                  {selectedSection === 'negocio' && 'Configuración del negocio'}
                  {selectedSection === 'calificaciones' && 'Calificaciones'}
                  {selectedSection === 'clientes' && 'Mis clientes'}
                </strong>
              </div>
            </div>
          </div>

          {/* SUB-SECCIÓN 1: CONFIGURACIÓN DEL NEGOCIO */}
          {selectedSection === 'negocio' && (
            <form onSubmit={handleSaveAll} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Información del salón, dirección, Google Maps y horarios */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Card 1: Datos de la Peluquería */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[#efecfd]">
                      <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                        <span className="material-symbols-outlined text-xl">storefront</span>
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#1a1a26]">Información del negocio</h2>
                        <p className="text-xs text-[#7e7482]">Identidad visible en la agenda y portal online</p>
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="bg-[#f5f2ff] rounded-2xl p-4 flex items-center gap-4 border border-[#cfc2d2]/30">
                      <div className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-xs border border-[#cfc2d2]/30 shrink-0 overflow-hidden">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo del salón"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-[#7e7482]">storefront</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#1a1a26] block">Logo del salón</span>
                        <span className="text-[11px] text-[#7e7482] block">JPG o PNG de máx. 5 MB</span>

                        <div className="flex items-center gap-2 mt-2">
                          <label className="py-1.5 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                            <span>Subir logo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoUpload}
                            />
                          </label>

                          {logoUrl && (
                            <button
                              type="button"
                              onClick={() => setLogoUrl('')}
                              className="py-1.5 px-2.5 rounded-xl text-xs font-bold text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white transition-colors"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nombre Comercial */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">Nombre del negocio</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <span className="material-symbols-outlined text-[#4b0878] text-base mr-2">storefront</span>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Moneda e Idioma */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#4c4451] block mb-1">País</label>
                        <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                          <select
                            value={countryCurrency}
                            onChange={(e) => setCountryCurrency(e.target.value)}
                            className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                          >
                            <option value="AR-ARS">Argentina — ARS ($)</option>
                            <option value="US-USD">Estados Unidos — USD (US$)</option>
                            <option value="MX-MXN">México — MXN ($)</option>
                            <option value="CO-COP">Colombia — COP ($)</option>
                            <option value="CL-CLP">Chile — CLP ($)</option>
                            <option value="UY-UYU">Uruguay — UYU ($)</option>
                          </select>
                          <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                            expand_more
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#4c4451] block mb-1">Idioma</label>
                        <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                          >
                            <option value="es-LA">Español (Latinoamérica)</option>
                            <option value="en-US">English</option>
                            <option value="pt-BR">Português</option>
                          </select>
                          <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Contacto, Dirección y Google Maps */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[#efecfd]">
                      <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                        <span className="material-symbols-outlined text-xl">location_on</span>
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#1a1a26]">WhatsApp / contacto y dirección</h2>
                        <p className="text-xs text-[#7e7482]">Canales donde los clientes reciben confirmaciones</p>
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">WhatsApp / contacto</label>
                      <div className="flex items-center bg-[#f5f2ff] rounded-xl p-1 border border-[#cfc2d2]/30">
                        <div className="relative w-24 shrink-0">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="w-full bg-white text-xs font-bold text-[#2e004e] px-2.5 py-2 rounded-lg shadow-xs outline-none cursor-pointer appearance-none"
                          >
                            <option value="+54">AR +54</option>
                            <option value="+1">US +1</option>
                            <option value="+52">MX +52</option>
                            <option value="+57">CO +57</option>
                            <option value="+56">CL +56</option>
                            <option value="+598">UY +598</option>
                          </select>
                          <span className="material-symbols-outlined text-[#7e7482] text-xs pointer-events-none absolute right-2 top-2.5">
                            expand_more
                          </span>
                        </div>
                        <input
                          type="text"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] px-3 py-2 outline-none"
                          placeholder="11 5489 3210"
                        />
                      </div>
                    </div>

                    {/* Dirección del salón */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">Dirección del salón</label>
                      <div className="flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <span className="material-symbols-outlined text-[#7e7482] text-base mr-2">pin_drop</span>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] outline-none"
                          placeholder="Ej: Av. Corrientes 4520, Almagro, CABA"
                        />
                      </div>
                    </div>

                    {/* Ubicación en Google Maps (directamente debajo de dirección del salón) */}
                    <GoogleMapsLocationPicker
                      initialAddress={address}
                      initialCoords={coords}
                      onLocationSaved={(newAddress, newCoords) => {
                        setAddress(newAddress);
                        setCoords(newCoords);
                        setSavedToast('¡Ubicación de Google Maps guardada correctamente!');
                        setTimeout(() => setSavedToast(null), 3000);
                      }}
                    />
                  </div>

                  {/* Card 3: Horarios de atención */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">schedule</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">Horarios de atención</h2>
                          <p className="text-xs text-[#7e7482]">Define los días y franjas habituales de apertura</p>
                        </div>
                      </div>
                      <span className="bg-[#f2daff] text-[#2e004e] text-[11px] font-bold px-2.5 py-1 rounded-full">
                        Flexible
                      </span>
                    </div>

                    {/* Días row */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#7e7482] mb-1.5">
                        <span>Días de atención en la semana:</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekdays}
                          className="text-[#4b0878] font-bold hover:underline cursor-pointer"
                        >
                          Seleccionar L-V
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {daysList.map((d) => {
                          const isActive = activeDays.includes(d.key);
                          return (
                            <button
                              key={d.key}
                              type="button"
                              onClick={() => toggleDay(d.key)}
                              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[#2e004e] text-white shadow-sm'
                                  : 'bg-[#f5f2ff] text-[#7e7482] hover:bg-[#efecfd]'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Shifts pickers */}
                    <div className="space-y-3 pt-1">
                      <div className="bg-[#f5f2ff] rounded-2xl p-3.5 space-y-2 border border-[#cfc2d2]/30">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-[#7a5900]">
                            <span>☀️</span> Turno Mañana
                          </span>
                          <span className="text-[11px] text-[#7e7482]">08:00 - 12:30</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                            <span className="text-[#7e7482]">Desde:</span>
                            <input
                              type="text"
                              value={morningOpen}
                              onChange={(e) => setMorningOpen(e.target.value)}
                              className="w-16 outline-none font-bold text-[#1a1a26]"
                            />
                          </div>
                          <span className="text-sm font-bold text-[#7e7482]">➔</span>
                          <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                            <span className="text-[#7e7482]">Hasta:</span>
                            <input
                              type="text"
                              value={morningClose}
                              onChange={(e) => setMorningClose(e.target.value)}
                              className="w-16 outline-none font-bold text-[#1a1a26]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Lunch break */}
                      <div className="flex items-center justify-between py-1 px-1">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1">
                            <span>🍔</span> Pausa de almuerzo (Corte al mediodía)
                          </span>
                          <span className="text-[11px] text-[#7e7482] block">{lunchText}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasDoubleShift}
                            onChange={(e) => setHasDoubleShift(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-[#cfc2d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e004e]"></div>
                        </label>
                      </div>

                      {/* Afternoon shift */}
                      {hasDoubleShift && (
                        <div className="bg-[#f5f2ff] rounded-2xl p-3.5 space-y-2 border border-[#cfc2d2]/30">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-[#4b0878]">
                              <span>🌙</span> Turno Tarde
                            </span>
                            <span className="text-[11px] text-[#7e7482]">14:00 - 19:30</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                              <span className="text-[#7e7482]">Desde:</span>
                              <input
                                type="text"
                                value={afternoonOpen}
                                onChange={(e) => setAfternoonOpen(e.target.value)}
                                className="w-16 outline-none font-bold text-[#1a1a26]"
                              />
                            </div>
                            <span className="text-sm font-bold text-[#7e7482]">➔</span>
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                              <span className="text-[#7e7482]">Hasta:</span>
                              <input
                                type="text"
                                value={afternoonClose}
                                onChange={(e) => setAfternoonClose(e.target.value)}
                                className="w-16 outline-none font-bold text-[#1a1a26]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Capacidad, Personal, Turnos, Servicios y Medicamentos */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Card 4: Capacidad y personal simultáneo */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">groups</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">
                            Capacidad y personal simultáneo
                          </h2>
                          <p className="text-xs text-[#7e7482]">
                            Control de servicios que pueden ocurrir a la vez
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f2daff] text-[#2e004e] font-black text-xs">
                        {simultaneousCapacity} a la vez
                      </span>
                    </div>

                    {/* Toggle de atención simultánea */}
                    <div className="p-3.5 bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-[#1a1a26] block">
                          Atención simultánea de estilistas
                        </span>
                        <span className="text-[11px] text-[#7e7482] block leading-tight">
                          Permite que varios estilistas atiendan citas al mismo horario
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={allowSimultaneousStaff}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setAllowSimultaneousStaff(val);
                            if (!val) {
                              setSimultaneousCapacity(1);
                            } else {
                              setSimultaneousCapacity(2);
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#cfc2d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e004e]"></div>
                      </label>
                    </div>

                    {/* Selector de puestos simultáneos */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#4c4451]">
                        <span>Capacidad simultánea máxima:</span>
                        <span className="text-[#2e004e] font-black">
                          {allowSimultaneousStaff ? `${simultaneousCapacity} mascotas a la vez` : '1 mascota (trabajo individual)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSimultaneousCapacity(1);
                            setAllowSimultaneousStaff(false);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            simultaneousCapacity === 1 && !allowSimultaneousStaff
                              ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 bg-[#f5f2ff]'
                              : 'border-[#cfc2d2]/40 bg-white hover:bg-[#f5f2ff]/60'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-[#1a1a26] block">1 Estilista</span>
                            <p className="text-[10px] text-[#7e7482] mt-0.5 leading-tight">
                              1 mascota por turno.
                            </p>
                          </div>
                          <span className="text-[9px] font-bold text-[#4b0878] mt-2 block">
                            Individual
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSimultaneousCapacity(2);
                            setAllowSimultaneousStaff(true);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            simultaneousCapacity === 2 && allowSimultaneousStaff
                              ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 bg-[#f5f2ff]'
                              : 'border-[#cfc2d2]/40 bg-white hover:bg-[#f5f2ff]/60'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-[#1a1a26] block">2 Estilistas</span>
                            <p className="text-[10px] text-[#7e7482] mt-0.5 leading-tight">
                              2 turnos simultáneos.
                            </p>
                          </div>
                          <span className="text-[9px] font-bold text-[#2e004e] mt-2 block">
                            Recomendado
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSimultaneousCapacity(3);
                            setAllowSimultaneousStaff(true);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            simultaneousCapacity >= 3 && allowSimultaneousStaff
                              ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 bg-[#f5f2ff]'
                              : 'border-[#cfc2d2]/40 bg-white hover:bg-[#f5f2ff]/60'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-[#1a1a26] block">3+ Estilistas</span>
                            <p className="text-[10px] text-[#7e7482] mt-0.5 leading-tight">
                              Equipo grande.
                            </p>
                          </div>
                          <span className="text-[9px] font-bold text-[#4b0878] mt-2 block">
                            Múltiple
                          </span>
                        </button>
                      </div>

                      {/* Contador de puestos */}
                      <div className="bg-[#f5f2ff] rounded-2xl p-3 border border-[#cfc2d2]/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] block">
                            Puestos simultáneos configurados: {simultaneousCapacity}
                          </span>
                          <span className="text-[11px] text-[#7e7482]">
                            Límite de turnos a la misma hora en la agenda
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(1, simultaneousCapacity - 1);
                              setSimultaneousCapacity(next);
                              if (next === 1) setAllowSimultaneousStaff(false);
                            }}
                            className="w-8 h-8 rounded-xl bg-white text-[#2e004e] font-bold flex items-center justify-center shadow-xs border border-[#cfc2d2]/40 hover:bg-[#efecfd] active:scale-95 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black text-sm text-[#1a1a26]">
                            {simultaneousCapacity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(6, simultaneousCapacity + 1);
                              setSimultaneousCapacity(next);
                              setAllowSimultaneousStaff(true);
                            }}
                            className="w-8 h-8 rounded-xl bg-white text-[#2e004e] font-bold flex items-center justify-center shadow-xs border border-[#cfc2d2]/40 hover:bg-[#efecfd] active:scale-95 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Ejemplo claro de cálculo */}
                      <div className="bg-[#fff8e1] border border-[#f9b900]/40 rounded-2xl p-3.5 space-y-1 text-xs">
                        <span className="font-extrabold text-[#7a5900] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">info</span>
                          <span>Cálculo de disponibilidad de turnos</span>
                        </span>
                        <p className="text-[#4c4451] leading-relaxed">
                          <strong>Ejemplo:</strong> Si el salón tiene <strong>3 estilistas</strong> y a las <strong>9:00 AM</strong> el Estilista 1 ya está ocupado realizando un servicio, el Estilista 2 y Estilista 3 siguen disponibles. Por lo tanto, otro cliente aún puede agendar su cita a las 9:00 AM a través del enlace público. El sistema <strong>no bloquea</strong> la franja horaria completa mientras queden estilistas libres.
                        </p>
                      </div>

                      {/* Turnos de Trabajo del Personal (Configuración de horarios) */}
                      <StaffShiftScheduleManager
                        schedule={staffScheduleConfig}
                        onChangeSchedule={setStaffScheduleConfig}
                      />

                      {/* Personal / Estilistas */}
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#4c4451]">
                            Personal ({staffList.length})
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {staffList.filter((s) => s.active).length} activos
                          </span>
                        </div>

                        <div className="space-y-2">
                          {staffList.map((st) => (
                            <div
                              key={st.id}
                              className="bg-[#f5f2ff] rounded-2xl p-3 flex flex-col gap-2 border border-[#cfc2d2]/30 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleStaffActive(st.id)}
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                                      st.active ? 'bg-[#2e004e] text-white' : 'bg-[#cfc2d2] text-white'
                                    }`}
                                    title={st.active ? 'Estilista activo' : 'Estilista inactivo'}
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      {st.active ? 'check' : 'remove'}
                                    </span>
                                  </button>
                                  <div className="min-w-0">
                                    <span className="font-bold text-[#1a1a26] truncate block">{st.name}</span>
                                    <span className="text-[10px] text-[#7e7482] truncate block">{st.role}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(st.id)}
                                  className="w-7 h-7 rounded-lg text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
                                  title="Eliminar del equipo"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>

                              {/* Asignación de Turno del personal */}
                              <div className="flex items-center justify-between pt-1 border-t border-[#cfc2d2]/20 text-[11px]">
                                <span className="text-[#7e7482] font-semibold">Turno asignado:</span>
                                <select
                                  value={st.shiftAvailability || 'todo_el_dia'}
                                  onChange={(e) =>
                                    handleUpdateStaffShift(
                                      st.id,
                                      e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                    )
                                  }
                                  className="bg-white rounded-lg px-2 py-1 font-bold text-[#2e004e] border border-[#cfc2d2]/40 outline-none cursor-pointer"
                                >
                                  <option value="todo_el_dia">☀️🌙 Todo el día</option>
                                  <option value="solo_manana">☀️ Solo mañana</option>
                                  <option value="solo_tarde">🌙 Solo en la tarde</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Agregar miembro del personal */}
                        <div className="bg-[#fcf8ff] rounded-2xl p-3 border border-[#cfc2d2]/40 space-y-2 mt-2">
                          <span className="text-[11px] font-bold text-[#2e004e] block">
                            + Añadir nuevo miembro al personal
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Nombre del estilista"
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                              className="bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                            />
                            <select
                              value={newStaffRole}
                              onChange={(e) => setNewStaffRole(e.target.value)}
                              className="bg-white text-xs px-2 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none cursor-pointer"
                            >
                              <option value="Estilista de corte">Corte y Estética</option>
                              <option value="Especialista en baño">Baño y Deslanado</option>
                              <option value="Asistente general">Asistente y Secado</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#7e7482]">
                              <span>Turno:</span>
                              <select
                                value={newStaffShift}
                                onChange={(e) =>
                                  setNewStaffShift(
                                    e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                  )
                                }
                                className="bg-white text-xs px-2 py-1 rounded-lg border border-[#cfc2d2]/30 outline-none cursor-pointer"
                              >
                                <option value="todo_el_dia">Todo el día</option>
                                <option value="solo_manana">Solo mañana</option>
                                <option value="solo_tarde">Solo en la tarde</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddStaff}
                              className="px-3 py-2 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              + Añadir personal
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Enlace Online para Redes */}
                  <div className="bg-[#2e004e] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#f9b900] tracking-wider uppercase">
                        <span className="material-symbols-outlined text-sm">public</span>
                        <span>ENLACE PARA REDES SOCIALES</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-[#1a1a26] text-[10px] font-black">
                        ONLINE 24/7
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-white">Tu enlace directo de reservas</h3>
                      <p className="text-xs text-[#e3e0f1] mt-0.5 leading-snug">
                        Colócalo en tu bio de Instagram, TikTok o comparte por WhatsApp:
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-black/30 rounded-2xl p-1.5 pl-3 border border-white/10">
                      <div className="flex items-center gap-2 min-w-0 text-xs font-mono text-white/90">
                        <span className="material-symbols-outlined text-sm text-[#f9b900]">link</span>
                        <span className="truncate">{clientBookingSlug}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <span className="material-symbols-outlined text-xs font-bold">
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onPreviewClientFlow}
                        className="w-full py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm text-[#f9b900]">open_in_new</span>
                        <span>Probar flujo como cliente online</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN SERVICIOS: Claramente visible con "+ Añadir servicio" */}
              <ServiceManager
                services={servicesList}
                onChangeServices={setServicesList}
                currency={countryCurrency.includes('ARS') ? 'ARS' : 'USD'}
              />

              {/* SECCIÓN MEDICAMENTOS Y PRODUCTOS ANTIPARASITARIOS */}
              <MedicationManager
                enabled={hasMedicationProductsEnabled}
                onToggleEnabled={setHasMedicationProductsEnabled}
                products={medicationProducts}
                onChangeProducts={setMedicationProducts}
                currency={countryCurrency.includes('ARS') ? 'ARS' : 'USD'}
              />

              {/* Botón Guardar Todos los Cambios */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 px-6 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-base shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined font-black ${isSaving ? 'animate-spin' : ''}`}>
                    {isSaving ? 'progress_activity' : 'check_circle'}
                  </span>
                  <span>{isSaving ? 'Guardando cambios...' : 'Guardar todos los cambios'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SUB-SECCIÓN 2: CALIFICACIONES (100% en español) */}
          {selectedSection === 'calificaciones' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-gradient-to-br from-[#2e004e] to-[#4b0878] text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#f9b900] uppercase tracking-wider block">
                    Reputación y valoraciones de clientes
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Calificaciones
                  </h2>
                  <p className="text-xs sm:text-sm text-[#e3e0f1] max-w-xl">
                    Cada vez que un tutor reserva su cita a través del enlace online o finaliza el servicio, puede calificar la experiencia con estrellas y comentarios para tu salón.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/20 shrink-0 self-start sm:self-auto">
                  <div className="text-center">
                    <span className="text-4xl sm:text-5xl font-black text-[#f9b900] block leading-none">
                      4.9
                    </span>
                    <div className="flex items-center justify-center text-[#f9b900] text-sm mt-1">
                      <span>★</span>
                      <span>★</span>
                      <span>★</span>
                      <span>★</span>
                      <span>★</span>
                    </div>
                  </div>
                  <div className="border-l border-white/20 pl-4 text-left">
                    <span className="text-xs font-bold block text-white">Excelente</span>
                    <span className="text-[11px] text-[#e3e0f1] block">
                      Basado en {reviewsList.length + 128} opiniones
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">
                      ✓ 98% satisfacción
                    </span>
                  </div>
                </div>
              </div>

              {/* Desglose por servicio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#7e7482] block">Baño + corte</span>
                    <span className="text-lg font-black text-[#1a1a26]">5.0 ★</span>
                    <span className="text-[10px] text-[#7e7482] block">64 valoraciones</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#fff8e1] text-[#7a5900] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">content_cut</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#7e7482] block">Baño completo</span>
                    <span className="text-lg font-black text-[#1a1a26]">4.9 ★</span>
                    <span className="text-[10px] text-[#7e7482] block">42 valoraciones</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">bathtub</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#7e7482] block">Deslanado premium</span>
                    <span className="text-lg font-black text-[#1a1a26]">4.9 ★</span>
                    <span className="text-[10px] text-[#7e7482] block">28 valoraciones</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#f2daff] text-[#2e004e] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">pets</span>
                  </div>
                </div>
              </div>

              {/* Lista de reseñas */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#efecfd]">
                  <div>
                    <h3 className="font-extrabold text-base text-[#1a1a26]">
                      Últimas valoraciones de clientes ({reviewsList.length})
                    </h3>
                    <p className="text-xs text-[#7e7482]">
                      Opiniones verificadas dejadas por tutores al agendar en la plataforma
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#2e004e] bg-[#f5f2ff] px-3 py-1 rounded-full">
                    Actualizado hoy
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewsList.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-[#fcf8ff] rounded-2xl p-4 border border-[#cfc2d2]/30 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#2e004e] text-white flex items-center justify-center text-xs font-black">
                              {rev.clientName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-[#1a1a26] block">
                                {rev.clientName}
                              </span>
                              <span className="text-[10px] text-[#7e7482] block">
                                Tutor de {rev.petName} · {rev.serviceName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center text-[#f9b900] text-sm">
                            {Array.from({ length: rev.stars }).map((_, i) => (
                              <span key={i}>★</span>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-[#4c4451] italic mt-2 leading-relaxed">
                          "{rev.comment}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#cfc2d2]/20 text-[10px] text-[#7e7482]">
                        <span>{rev.date}</span>
                        {rev.verified && (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            <span>Cliente verificado</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SUB-SECCIÓN 3: MIS CLIENTES (100% en español) */}
          {selectedSection === 'clientes' && (
            <div className="space-y-6">
              {/* Header and Excel Download Banner */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#cfc2d2]/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2e004e] text-2xl">table_view</span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#1a1a26]">
                      Mis clientes
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-[#4c4451]">
                    Reporte detallado de turnos atendidos, tutores, números de WhatsApp, montos cobrados y calificaciones.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    <span>Descargar Excel (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs">
                  <span className="text-xs font-bold text-[#7e7482] block">Clientes Filtrados</span>
                  <span className="text-xl sm:text-2xl font-black text-[#1a1a26] mt-0.5 block">
                    {stats.totalCount}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                    {clientPeriodFilter === 'hoy' ? 'Turnos de Hoy' : clientPeriodFilter === 'semana' ? 'Esta Semana' : 'Octubre 2024'}
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs">
                  <span className="text-xs font-bold text-[#7e7482] block">Facturación</span>
                  <span className="text-xl sm:text-2xl font-black text-[#2e004e] mt-0.5 block">
                    ${stats.totalRevenue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#7e7482] block mt-1">ARS Total</span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs">
                  <span className="text-xs font-bold text-[#7e7482] block">Servicios Listos</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 block">
                    {stats.completedCount}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold block mt-1">Completados</span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs">
                  <span className="text-xs font-bold text-[#7e7482] block">Satisfacción</span>
                  <span className="text-xl sm:text-2xl font-black text-[#7a5900] mt-0.5 block">
                    ★ {stats.avgRating}
                  </span>
                  <span className="text-[10px] text-[#7a5900] font-bold block mt-1">Promedio clientes</span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#cfc2d2]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                {/* Period Pills */}
                <div className="flex items-center gap-1.5 bg-[#f5f2ff] p-1 rounded-xl self-start sm:self-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setClientPeriodFilter('hoy')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      clientPeriodFilter === 'hoy'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:text-[#1a1a26]'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientPeriodFilter('semana')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      clientPeriodFilter === 'semana'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:text-[#1a1a26]'
                    }`}
                  >
                    Esta Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientPeriodFilter('mes')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      clientPeriodFilter === 'mes'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:text-[#1a1a26]'
                    }`}
                  >
                    Este Mes (Octubre)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientPeriodFilter('todos')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      clientPeriodFilter === 'todos'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:text-[#1a1a26]'
                    }`}
                  >
                    Todos
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <span className="material-symbols-outlined text-[#7e7482] text-sm absolute left-3 top-2.5">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por tutor, mascota, teléfono..."
                    className="w-full bg-[#f5f2ff] text-xs pl-8 pr-3 py-2 rounded-xl border border-[#cfc2d2]/30 outline-none focus:border-[#2e004e]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-[#7e7482] hover:text-[#1a1a26] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-3xl shadow-sm border border-[#cfc2d2]/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f5f2ff] text-[#4c4451] font-bold border-b border-[#cfc2d2]/30">
                        <th className="py-3.5 px-4">Fecha & Horario</th>
                        <th className="py-3.5 px-4">Mascota & Raza</th>
                        <th className="py-3.5 px-4">Tutor & WhatsApp</th>
                        <th className="py-3.5 px-4">Servicio</th>
                        <th className="py-3.5 px-4">Estilista</th>
                        <th className="py-3.5 px-4">Precio</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4">Calificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efecfd]">
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-[#7e7482]">
                            <span className="material-symbols-outlined text-3xl text-[#cfc2d2] block mb-1">
                              inbox
                            </span>
                            No se encontraron clientes para el filtro seleccionado.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((apt) => (
                          <tr key={apt.id} className="hover:bg-[#fcf8ff] transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#1a1a26] block">
                                {apt.time}
                              </span>
                              <span className="text-[10px] text-[#7e7482]">
                                {apt.date || '15 de Octubre'}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#f2daff] text-[#2e004e] flex items-center justify-center font-black text-xs shrink-0">
                                  {apt.petName.slice(0, 1)}
                                </div>
                                <div>
                                  <span className="font-extrabold text-[#1a1a26] block">
                                    {apt.petName}
                                  </span>
                                  <span className="text-[10px] text-[#7e7482] block truncate max-w-[120px]">
                                    {apt.breed}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-bold text-[#1a1a26] block">
                                {apt.tutorName}
                              </span>
                              <span className="text-[10px] text-[#4b0878] font-mono flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">chat</span>
                                {apt.tutorPhone || '+54 9 11 4455-6677'}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-semibold text-[#1a1a26] block">
                                {apt.serviceName}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-[#4c4451] font-medium">
                              {apt.groomer}
                            </td>

                            <td className="py-3 px-4 font-black text-[#2e004e]">
                              ${apt.price.toLocaleString()} {apt.currency}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  apt.paymentStatus === 'cobrado'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : apt.paymentStatus === 'en_proceso'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {apt.paymentStatusLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1 text-[#f9b900] font-black">
                                <span>★</span>
                                <span className="text-[#1a1a26] text-xs">{apt.rating || 5}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#f5f2ff]/60 px-4 py-3 border-t border-[#cfc2d2]/30 flex items-center justify-between text-xs text-[#7e7482]">
                  <span>Mostrando {filteredAppointments.length} registros</span>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="text-[#2e004e] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Descargar archivo compatible con Excel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
