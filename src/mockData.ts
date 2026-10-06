import { Pet, SalonConfig, Appointment } from './types';

export const HOTLINK_IMAGES = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgNdH5Hthy5Yi-fglcEX4qyy4-SEvVu9xcHv_WWfZ35c1EUd2VD0DrJuG9wAleNXW-bzR2vh9V6ET_9gV6vu71YIH_hwdXOlNwRfXAQXgczXcJRVANXrqeuHKQ6kIkUDcUVxkayIIwkFSpKTw3x6CPOgteHP_fPA2WtPu2oCARFuOhxuBRVEstwPARhMQCimBPElnj6HqxDzP1F4o_YHz7YSdnDgJk6MmbEmeSZykQaKqRT0Pv5BvxHQ',
  profileAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeXYF_ymm744fCXd9NWiu7zQyq8DPt8R6i7aetU_ewyN2Ru6NFw7Df1OvPZTxBgsD5mfZHG-PUnKbTke_w4Mt4b8t1pCIBx-_LboeCaLbH0JW8SZ4Tooih21H1Sc3Dsoz3V80DZsqttuIIO7ZhFSAYr_Iojolbi7wU2LeabXQeGseJb3cYRNcwFoVyP8DkYU3qSn4VKL7NWVfdxCzF1uuGSXj84DGtJqTY7P3AR1c3zKyHJw0l9BX26w',
  toby: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbPwXivES3s1XXu5GJ8HPkkjvMRgpkyZYV140yOb0oqYSoSw4b3n1xHVJcaCbW41QYIAH53sPPNRqYbwkPf2U6vWEn96Caom9nhpLAmrFzcY0mWkTQqkYy1_kgSf7oA01ienp5hL6u-rlxIMp8FdYqTDJ-tCVJtbcRfUcKTtgs2O4xQ1iVThHgTYW6SoMAk9GYSmgG4sYpj2MnVz_eJNLzE2n5FgsWqA4xzYjM6ranHW49Iwrx7LHD2Q',
  photoBefore: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2SmMdNV1jhnTOt269pMt1DuiDf2BDM_QWlRAr6f8YJYHcAgHzUjemSsf-1SteykfCO9Q6Ijl7nht-5Y3TuC4VlfBuIIzawKyMv-cvBXUwvasnRS1fieVOvfDK9L-WQN7exnrH_pWyXPm8J-ZT0et-OEvDrurb9XdDpiLXfWUAkMtOkKXoQ5M8zvUnR1fDrfPeLYeOuOUO7ow7dW46Z1J6UCD66_IaAFrNZYNkDXwxtT4_7-8Xowa2tw',
  photoAfter: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDyj5Inla6NWud3DifwfKG8-kGus7JBUWu2vM0UsrCJ0hwJN57NF7H0Lk4MKPYcDXVlyo6h8lDrSGESVYakH1ETd1exUmquXAJtZJphfsF_5aEiYCQblc1WoRe18hAAZmXR9cyuqg_Esj97bgTXb4-7I1ulUjTo7Sga5ugAUXkj8HA7q2jRuapakr2NtH8E1RA2qicdWByAG7dKU1n1iLepqUDkCiVjzbEZV2UWNqUK8t001ZmWEinWQ'
};

export const INITIAL_PET: Pet = {
  id: '#PET-2849',
  name: 'Toby',
  breed: 'Golden Retriever',
  age: '3 años',
  gender: 'Macho',
  weightKg: 28,
  isVip: true,
  photoUrl: HOTLINK_IMAGES.toby,
  tutor: {
    name: 'Ana Gómez',
    phone: '+54 9 11 5566-7788',
    rawPhone: '5491155667788'
  },
  habitualMood: 'inquieto',
  healthAllergies: 'Piel atópica / sensible en el lomo. Usar champú hipoalergénico de avena. Sin alergias conocidas a alimentos.',
  handlingObservations: 'No le gusta el secador cerca de la cara (secreción lagrimal). Usar toalla primero y velocidad baja. Precaución con pata trasera izquierda (leve molestia al estirar).',
  lastVisit: {
    id: 'v-15-sep',
    date: '15 de Septiembre',
    serviceName: 'Baño completo + Corte higiénico',
    price: 25,
    currency: 'USD',
    mood: 'inquieto',
    paid: true,
    photos: {
      beforeUrl: HOTLINK_IMAGES.photoBefore,
      afterUrl: HOTLINK_IMAGES.photoAfter
    },
    nextRecommendedWeeks: 6
  },
  visitHistory: [
    {
      id: 'v-15-sep',
      date: '15 de Septiembre',
      serviceName: 'Baño completo + Corte higiénico',
      price: 25,
      currency: 'USD',
      mood: 'inquieto',
      paid: true,
      notes: 'Excelente sesión. Toby estuvo tranquilo durante el corte y se le premió con snack hipoalergénico.',
      photos: {
        beforeUrl: HOTLINK_IMAGES.photoBefore,
        afterUrl: HOTLINK_IMAGES.photoAfter
      },
      nextRecommendedWeeks: 6
    },
    {
      id: 'v-02-ago',
      date: '2 de Agosto',
      serviceName: 'Baño medicado + Cepillado',
      price: 22,
      currency: 'USD',
      mood: 'tranquilo',
      paid: true,
      photos: {
        beforeUrl: HOTLINK_IMAGES.photoBefore,
        afterUrl: HOTLINK_IMAGES.photoAfter
      },
      nextRecommendedWeeks: 6
    }
  ],
  recommendedIntervalWeeks: 6
};

export const INITIAL_PETS: Pet[] = [
  INITIAL_PET,
  {
    id: '#PET-1920',
    name: 'Luna',
    breed: 'Caniche Toy',
    age: '2 años',
    gender: 'Hembra',
    weightKg: 4.5,
    isVip: false,
    photoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80',
    tutor: {
      name: 'Carlos Benítez',
      phone: '+54 9 11 3344-9988',
      rawPhone: '5491133449988'
    },
    habitualMood: 'tranquilo',
    healthAllergies: 'Piel normal. Alergia leve a pulguicidas convencionales, usar pipeta natural.',
    handlingObservations: 'Muy dócil. Disfruta el masaje capilar y el secado tibio.',
    lastVisit: {
      id: 'v-10-sep',
      date: '10 de Septiembre',
      serviceName: 'Corte asiático + Baño de seda',
      price: 28,
      currency: 'USD',
      mood: 'tranquilo',
      paid: true,
      photos: {},
      nextRecommendedWeeks: 4
    },
    visitHistory: [],
    recommendedIntervalWeeks: 4
  },
  {
    id: '#PET-3012',
    name: 'Rocky',
    breed: 'Bulldog Francés',
    age: '4 años',
    gender: 'Macho',
    weightKg: 13,
    isVip: true,
    photoUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80',
    tutor: {
      name: 'Mariana Silva',
      phone: '+54 9 11 4455-6677',
      rawPhone: '5491144556677'
    },
    habitualMood: 'dificil',
    healthAllergies: 'Pliegues faciales con tendencia a hongos. Limpieza con clorhexidina al 2%.',
    handlingObservations: 'Respiración braquicéfala; no agitar ni exponer a calor excesivo. Cuidar ojos.',
    lastVisit: {
      id: 'v-01-sep',
      date: '1 de Septiembre',
      serviceName: 'Baño dérmico + Limpieza de pliegues',
      price: 24,
      currency: 'USD',
      mood: 'dificil',
      paid: true,
      photos: {},
      nextRecommendedWeeks: 3
    },
    visitHistory: [],
    recommendedIntervalWeeks: 3
  }
];

export const INITIAL_SALON_CONFIG: SalonConfig = {
  name: 'Peluquería Canina Luna',
  logoUrl: HOTLINK_IMAGES.logo,
  country: 'Argentina',
  city: 'Buenos Aires',
  phonePrefix: '+54',
  phone: '11 5489 3210',
  address: 'Av. Corrientes 4520, Almagro, CABA',
  googleMapsPlaceName: 'Peluquería Canina Luna - Almagro, CABA',
  googleMapsUrl: 'https://maps.google.com/?q=-34.603722,-58.423145',
  coordinates: '-34.603722, -58.423145',
  allowSimultaneousStaff: true,
  maxSimultaneousAppointments: 2,
  workingDays: 'Lunes a Sábado',
  openTime: '08:00 hs',
  closeTime: '19:30 hs',
  currency: 'ARS',
  simultaneousCapacity: 2, // 2 simultaneous groomers by default (Carlos Morales and Mariana V.)
  staffMembers: [
    { id: 'st-1', name: 'Carlos Morales', role: 'Estilista Principal (Corte & Spa)', active: true, shiftAvailability: 'todo_el_dia' },
    { id: 'st-2', name: 'Mariana V.', role: 'Especialista en Baño y Deslanado', active: true, shiftAvailability: 'todo_el_dia' },
    { id: 'st-3', name: 'Roberto Díaz', role: 'Ayudante y Secado', active: true, shiftAvailability: 'solo_tarde' }
  ],
  morningOpen: '08:00',
  morningClose: '12:30',
  afternoonOpen: '14:00',
  afternoonClose: '19:30',
  hasDoubleShift: true,
  bookingSlug: 'agendacan.app/peluquerialuna',
  activeDays: ['L', 'M', 'X', 'J', 'V'],
  staffScheduleConfig: {
    allDay: { start: '08:00', end: '18:00' },
    morning: { start: '08:00', end: '13:00' },
    afternoon: { start: '14:00', end: '19:30' }
  },
  hasMedicationProductsEnabled: true,
  medicationProducts: [
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
    },
    {
      id: 'med-3',
      name: 'Loción dérmica calmante / antialérgica',
      type: 'Tratamiento tópico',
      purpose: 'Spray hidratante con aloe y avena para aliviar picazón y dermatitis tras el baño.',
      price: 2800,
      photoUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300&auto=format&fit=crop&q=80',
      active: true
    }
  ],
  medicationFee: 3500,
  reviews: [
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
  ],
  services: [
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
      badge: 'Popular',
      icon: 'content_cut',
      active: true,
      rating: 5.0,
      reviewCount: 64
    },
    {
      id: 's-2',
      name: 'Baño completo',
      durationMin: 45,
      price: 18000,
      pricingType: 'unico',
      desc: 'Higiene profunda con champú hipoalergénico, secado y perfume.',
      icon: 'bathtub',
      active: true,
      rating: 4.9,
      reviewCount: 42
    },
    {
      id: 's-3',
      name: 'Deslanado premium',
      durationMin: 75,
      price: 22000,
      pricingType: 'unico',
      desc: 'Eliminación exhaustiva de manto muerto con cardina y cepillado profundo.',
      icon: 'pets',
      active: true,
      rating: 4.9,
      reviewCount: 28
    },
    {
      id: 's-4',
      name: 'Corte de uñas y almohadillas',
      durationMin: 20,
      price: 8000,
      pricingType: 'unico',
      desc: 'Corte y limado de uñas, despeje de pelo interdigital.',
      icon: 'spa',
      active: true,
      rating: 4.8,
      reviewCount: 19
    }
  ]
};

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    petId: '#PET-2849',
    petName: 'Toby',
    breed: 'Golden Retriever',
    tutorName: 'Ana Gómez',
    tutorPhone: '+54 9 11 4455-6677',
    serviceName: 'Baño + corte',
    time: '09:00 AM',
    date: '15 de Octubre 2024',
    status: 'completado',
    statusLabel: 'COMPLETADO',
    groomer: 'Carlos Morales',
    price: 25000,
    currency: 'ARS',
    paymentStatus: 'cobrado',
    paymentStatusLabel: 'Cobrado',
    subStatus: 'Finalizó 10:20',
    subStatusType: 'time',
    hasMedication: true,
    rating: 5,
    reviewComment: 'Excelente trato con el secador'
  },
  {
    id: 'apt-2',
    petId: '#PET-1920',
    petName: 'Luna',
    breed: 'Poodle Toy',
    tutorName: 'Carlos Benítez',
    tutorPhone: '+54 9 11 5566-7788',
    serviceName: 'Baño completo',
    time: '11:00 AM',
    date: '15 de Octubre 2024',
    status: 'en_salon',
    statusLabel: 'EN SALÓN',
    groomer: 'Mariana V.',
    price: 18000,
    currency: 'ARS',
    paymentStatus: 'en_proceso',
    paymentStatusLabel: 'En proceso',
    subStatus: 'En secado',
    subStatusType: 'action_pill',
    hasMedication: false
  },
  {
    id: 'apt-3',
    petId: '#PET-4421',
    petName: 'Max',
    breed: 'Maltés',
    tutorName: 'Daniela Rojas',
    tutorPhone: '+54 9 11 3322-1144',
    serviceName: 'Corte higiénico',
    time: '13:30 PM',
    date: '15 de Octubre 2024',
    status: 'en_salon',
    statusLabel: 'EN SALÓN',
    groomer: 'Mariana V.',
    price: 22000,
    currency: 'ARS',
    paymentStatus: 'por_cobrar',
    paymentStatusLabel: 'Por cobrar',
    subStatus: 'En espera',
    subStatusType: 'warning',
    hasMedication: false
  },
  {
    id: 'apt-4',
    petId: '#PET-7712',
    petName: 'Rocky',
    breed: 'Pastor Alemán',
    tutorName: 'Lucía Fernández',
    tutorPhone: '+54 9 11 9988-7766',
    serviceName: 'Deslanado premium',
    time: '15:30 PM',
    date: '15 de Octubre 2024',
    status: 'confirmada',
    statusLabel: 'CONFIRMADA',
    groomer: 'Carlos Morales',
    price: 22000,
    currency: 'ARS',
    paymentStatus: 'por_cobrar',
    paymentStatusLabel: 'Por cobrar',
    subStatus: 'Cliente recurrente',
    subStatusType: 'tag',
    hasMedication: false
  },
  {
    id: 'apt-5',
    petId: '#PET-5531',
    petName: 'Milo',
    breed: 'Beagle',
    tutorName: 'Martín Peralta',
    tutorPhone: '+54 9 11 6655-4433',
    serviceName: 'Baño + corte',
    time: '17:00 PM',
    date: '14 de Octubre 2024',
    status: 'completado',
    statusLabel: 'COMPLETADO',
    groomer: 'Carlos Morales',
    price: 25000,
    currency: 'ARS',
    paymentStatus: 'cobrado',
    paymentStatusLabel: 'Cobrado',
    subStatus: 'Calificado 5 estrellas',
    subStatusType: 'time',
    hasMedication: true,
    rating: 5,
    reviewComment: 'Excelente corte a tijera'
  },
  {
    id: 'apt-6',
    petId: '#PET-8824',
    petName: 'Simba',
    breed: 'Shih Tzu',
    tutorName: 'Florencia Romero',
    tutorPhone: '+54 9 11 2233-4455',
    serviceName: 'Baño completo',
    time: '10:00 AM',
    date: '14 de Octubre 2024',
    status: 'completado',
    statusLabel: 'COMPLETADO',
    groomer: 'Mariana V.',
    price: 18000,
    currency: 'ARS',
    paymentStatus: 'cobrado',
    paymentStatusLabel: 'Cobrado',
    subStatus: 'Calificado 5 estrellas',
    subStatusType: 'time',
    hasMedication: false,
    rating: 5
  },
  {
    id: 'apt-7',
    petId: '#PET-3390',
    petName: 'Bella',
    breed: 'Yorkshire Terrier',
    tutorName: 'Patricia Morales',
    tutorPhone: '+54 9 11 7766-5544',
    serviceName: 'Baño + corte',
    time: '16:00 PM',
    date: '11 de Octubre 2024',
    status: 'completado',
    statusLabel: 'COMPLETADO',
    groomer: 'Carlos Morales',
    price: 25000,
    currency: 'ARS',
    paymentStatus: 'cobrado',
    paymentStatusLabel: 'Cobrado',
    subStatus: 'Calificado 5 estrellas',
    subStatusType: 'time',
    hasMedication: false,
    rating: 5
  }
];

export const INITIAL_RETENTION_PETS: import('./types').RetentionPet[] = [
  {
    id: 'ret-1',
    petId: '#PET-2849',
    name: 'Toby',
    breed: 'Golden Retriever',
    tutorName: 'Ana Gómez',
    tutorPhone: '+54 9 11 5566-7788',
    rawPhone: '5491155667788',
    photoUrl: HOTLINK_IMAGES.photoAfter,
    isVip: true,
    lastVisitDate: '15 de sept.',
    weeksSinceLastVisit: 6,
    recommendedWeeks: 6,
    urgency: 'esta_semana',
    urgencyLabel: '! Esta semana',
    suggestedMessage: '“Hola Ana 👋 Ya han pasado aproximadamente 6 semanas desde la última sesión de Toby en Luna Peluquería. ¿Quieres reservar su próxima cita para mantener su pelaje impecable?”',
    templateName: 'Plantilla Spa Premium',
    alreadyBooked: false
  },
  {
    id: 'ret-2',
    petId: '#PET-1920',
    name: 'Luna',
    breed: 'Caniche Toy',
    tutorName: 'Carlos Benítez',
    tutorPhone: '+54 9 11 3344-9988',
    rawPhone: '5491133449988',
    photoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80',
    isVip: false,
    lastVisitDate: '5 de sept.',
    weeksSinceLastVisit: 5,
    recommendedWeeks: 4,
    urgency: 'urgente',
    urgencyLabel: '! Urgente (Vencido)',
    suggestedMessage: '“Hola Carlos 👋 El manto rizado de Luna cumplió 5 semanas y requiere recorte y baño para prevenir nudos. ¿Te reservamos un turno para estos días?”',
    templateName: 'Manto Rizado & Nudos',
    alreadyBooked: false
  },
  {
    id: 'ret-3',
    petId: '#PET-3012',
    name: 'Rocky',
    breed: 'Bulldog Francés',
    tutorName: 'Mariana Silva',
    tutorPhone: '+54 9 11 4455-6677',
    rawPhone: '5491144556677',
    photoUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80',
    isVip: true,
    lastVisitDate: '10 de sept.',
    weeksSinceLastVisit: 3,
    recommendedWeeks: 3,
    urgency: 'esta_semana',
    urgencyLabel: '! Esta semana',
    suggestedMessage: '“Hola Mariana 👋 Toca la sesión de higiene de pliegues faciales y baño terapéutico para Rocky. ¿Coordinamos horario para esta semana?”',
    templateName: 'Cuidado Dérmico',
    alreadyBooked: false
  },
  {
    id: 'ret-4',
    petId: '#PET-4421',
    name: 'Coco',
    breed: 'Shih Tzu',
    tutorName: 'Laura Díaz',
    tutorPhone: '+54 9 11 8877-6655',
    rawPhone: '5491188776655',
    photoUrl: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&auto=format&fit=crop&q=80',
    isVip: false,
    lastVisitDate: '1 de sept.',
    weeksSinceLastVisit: 4,
    recommendedWeeks: 5,
    urgency: 'proxima_semana',
    urgencyLabel: 'Próxima semana',
    suggestedMessage: '“Hola Laura 👋 La próxima semana se cumplen las 5 semanas recomendadas para el cepillado y baño de Coco. ¿Quieres asegurar su turno con anticipación?”',
    templateName: 'Mantenimiento Preventivo',
    alreadyBooked: false
  },
  {
    id: 'ret-5',
    petId: '#PET-5509',
    name: 'Milo',
    breed: 'Golden Doodle',
    tutorName: 'Esteban Rossi',
    tutorPhone: '+54 9 11 2233-1122',
    rawPhone: '5491122331122',
    photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&auto=format&fit=crop&q=80',
    isVip: false,
    lastVisitDate: '28 de ago.',
    weeksSinceLastVisit: 5,
    recommendedWeeks: 6,
    urgency: 'proxima_semana',
    urgencyLabel: 'Próxima semana',
    suggestedMessage: '“Hola Esteban 👋 Para que el manto de Milo se mantenga sedoso y sin motas, sugerimos agendar su sesión para la próxima semana. ¿Qué día te queda cómodo?”',
    templateName: 'Plantilla Spa Premium',
    alreadyBooked: false
  }
];
