export type AppLanguage = 'es-LA' | 'es-ES' | 'en' | 'pt';

export interface Translations {
  // Navigation
  agenda: string;
  clients: string;
  retention: string;
  settings: string;
  petProfile: string;

  // Header
  onlineSalon: string;
  openToday: string;
  closedToday: string;

  // Agenda
  todayAppointmentsTitle: string;
  todayAppointmentsCount: string;
  inSalon: string;
  pickupReady: string;
  newAppointment: string;
  shareLink: string;
  simultaneousCapacity: string;
  goodMorning: string;
  noAppointmentsToday: string;
  weekOf: string;
  clientsToReturnBanner: string;
  clientsNeedRebooking: string;

  // Retention / Por volver
  fidelizationModule: string;
  retentionTitle: string;
  retentionSubtitle: string;
  toContact: string;
  thisWeek: string;
  filterAll: string;
  filterUrgent: string;
  filterNextWeek: string;
  lastVisit: string;
  weeksAgo: string;
  recommendedTemplate: string;
  suggestedMessageTitle: string;
  copyMessage: string;
  messageCopied: string;
  sendWhatsApp: string;
  alreadyBooked: string;
  markBooked: string;
  noRetentionDue: string;

  // Clients
  petDirectory: string;
  activePetRecords: string;
  newPet: string;
  searchPetsPlaceholder: string;
  noPetsFound: string;
  noPetsRegistered: string;

  // Pet Profile
  tutorResponsible: string;
  habitualMood: string;
  calm: string;
  restless: string;
  difficult: string;
  sensitive: string;
  healthAllergies: string;
  handlingNotes: string;
  lastRegisteredVisit: string;
  registerVisit: string;
  editPetProfile: string;
  nextVisit: string;
  servicePhotos: string;
  beforePhoto: string;
  afterPhoto: string;
  takePhoto: string;
  gallery: string;
  uploadFile: string;
  petDeliveryToTutor: string;
  sendDeliveryReport: string;
  whenShouldReturn: string;
  returnRecommendationAdvice: string;
  weeks: string;
  customWeeks: string;
  saveReminder: string;
  saveVisit: string;
  savingVisit: string;

  // Settings
  settingsCenter: string;
  settingsTitle: string;
  businessConfig: string;
  ratings: string;
  myClients: string;
  shareAgendaSocial: string;
  backToSettings: string;

  // Business Config
  businessInfo: string;
  businessName: string;
  businessLogo: string;
  logoRecommendation: string;
  country: string;
  languageLabel: string;
  whatsappPhone: string;
  addressLabel: string;
  googleMapsLocation: string;
  businessHours: string;
  morningShift: string;
  afternoonShift: string;
  lunchBreak: string;
  simultaneousStaffCapacity: string;
  servicesTitle: string;
  addService: string;
  medicationsTitle: string;
  addMedication: string;
  saveAllChanges: string;
  changesSavedSuccess: string;
  currencyLabel: string;

  // Share link page
  shareLinkTitle: string;
  shareLinkSubtitle: string;
  online247: string;
  copyLink: string;
  linkCopied: string;
  testClientFlow: string;

  // Booking Flow
  bookAppointment: string;
  selectService: string;
  selectDateTime: string;
  tutorAndPetInfo: string;
  bookingConfirmation: string;
  tutorName: string;
  whatsappContact: string;
  petName: string;
  petBreed: string;
  petBehavior: string;
  confirmBooking: string;
  appointmentConfirmedSuccess: string;
  noServicesConfigured: string;
  noMedicationsConfigured: string;
  emptyField: string;
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  'es-LA': {
    agenda: 'Agenda',
    clients: 'Clientes',
    retention: 'Por volver',
    settings: 'Ajustes',
    petProfile: 'Ficha Mascota',

    onlineSalon: 'Salón canino abierto',
    openToday: 'Abierto hoy',
    closedToday: 'Cerrado hoy',

    todayAppointmentsTitle: 'Buenos días 👋',
    todayAppointmentsCount: 'citas hoy',
    inSalon: 'EN SALÓN',
    pickupReady: 'POR RETIRAR',
    newAppointment: 'Nueva cita',
    shareLink: 'Compartir enlace',
    simultaneousCapacity: 'Capacidad de estilistas',
    goodMorning: 'Buenos días 👋',
    noAppointmentsToday: 'No hay citas programadas para hoy.',
    weekOf: 'Semana de',
    clientsToReturnBanner: 'Clientes por volver',
    clientsNeedRebooking: 'mascotas necesitan una nueva cita de mantenimiento.',

    fidelizationModule: 'MÓDULO DE FIDELIZACIÓN',
    retentionTitle: 'Clientes por volver',
    retentionSubtitle: 'Estas mascotas están cerca de su próxima visita recomendada para mantener su manto saludable y libre de nudos.',
    toContact: 'por contactar',
    thisWeek: 'esta semana',
    filterAll: 'Todos',
    filterUrgent: 'Urgentes',
    filterNextWeek: 'Próxima semana',
    lastVisit: 'Última visita',
    weeksAgo: 'semanas',
    recommendedTemplate: 'Plantilla de fidelización',
    suggestedMessageTitle: 'Mensaje de inteligencia sugerido',
    copyMessage: 'Copiar mensaje',
    messageCopied: '¡Mensaje copiado al portapapeles!',
    sendWhatsApp: 'Enviar por WhatsApp',
    alreadyBooked: 'Reservado',
    markBooked: 'Marcar como agendado',
    noRetentionDue: 'No hay mascotas próximas a regresar.',

    petDirectory: 'Directorio de Mascotas',
    activePetRecords: 'fichas activas registradas',
    newPet: 'Nueva Mascota',
    searchPetsPlaceholder: 'Buscar por nombre, raza, tutor o ID...',
    noPetsFound: 'No se encontraron mascotas que coincidan con la búsqueda.',
    noPetsRegistered: 'Todavía no tienes mascotas registradas.',

    tutorResponsible: 'Tutor Responsable',
    habitualMood: 'Comportamiento Habitual',
    calm: 'Tranquilo',
    restless: 'Inquieto',
    difficult: 'Difícil',
    sensitive: 'Sensible',
    healthAllergies: 'Salud, Alergias y Piel Sensible',
    handlingNotes: 'Observaciones de Manejo',
    lastRegisteredVisit: 'Última Visita Registrada',
    registerVisit: 'Registrar Visita',
    editPetProfile: 'Editar Ficha',
    nextVisit: 'Próxima Visita',
    servicePhotos: 'Foto del servicio (Antes y Después)',
    beforePhoto: 'Foto Antes',
    afterPhoto: 'Foto Después ✨',
    takePhoto: 'Tomar Foto',
    gallery: 'Galería',
    uploadFile: 'Subir archivo',
    petDeliveryToTutor: 'Entrega de Mascota al Tutor',
    sendDeliveryReport: 'Enviar reporte por WhatsApp',
    whenShouldReturn: '¿Cuándo debería volver?',
    returnRecommendationAdvice: 'Recomendación periódica para el cuidado óptimo del manto.',
    weeks: 'semanas',
    customWeeks: 'Personalizado',
    saveReminder: 'Guardar Recordatorio',
    saveVisit: 'Guardar Visita',
    savingVisit: 'Guardando Visita...',

    settingsCenter: 'Centro de ajustes y administración',
    settingsTitle: 'Ajustes',
    businessConfig: 'Configuración del negocio',
    ratings: 'Calificaciones',
    myClients: 'Mis clientes',
    shareAgendaSocial: 'Comparte tu agenda para redes',
    backToSettings: 'Volver a Ajustes',

    businessInfo: 'Información del negocio',
    businessName: 'Nombre del negocio',
    businessLogo: 'Logo del negocio',
    logoRecommendation: 'Recomendado: imagen cuadrada de aproximadamente 400 × 400 px para una correcta visualización del logo.',
    country: 'País',
    languageLabel: 'Idioma',
    whatsappPhone: 'Teléfono de contacto / WhatsApp',
    addressLabel: 'Dirección del salón',
    googleMapsLocation: 'Ubicación en Google Maps',
    businessHours: 'Horarios de atención',
    morningShift: 'Turno Mañana',
    afternoonShift: 'Turno Tarde',
    lunchBreak: 'Pausa de almuerzo',
    simultaneousStaffCapacity: 'Capacidad y personal simultáneo',
    servicesTitle: 'Servicios',
    addService: '+ Añadir servicio',
    medicationsTitle: 'Medicamentos y Productos',
    addMedication: '+ Añadir nuevo medicamento',
    saveAllChanges: 'Guardar todos los cambios',
    changesSavedSuccess: '¡Todos los cambios fueron guardados exitosamente!',
    currencyLabel: 'Moneda del negocio',

    shareLinkTitle: 'Tu enlace directo de reservas',
    shareLinkSubtitle: 'Colócalo en la bio de Instagram, TikTok o compártelo por WhatsApp.',
    online247: 'ONLINE 24/7',
    copyLink: 'Copiar enlace',
    linkCopied: '¡Enlace de reservas copiado al portapapeles!',
    testClientFlow: 'Probar flujo como cliente online',

    bookAppointment: 'Reservar Cita Online',
    selectService: 'Selecciona el Servicio',
    selectDateTime: 'Fecha y Horario',
    tutorAndPetInfo: 'Datos del Tutor y Mascota',
    bookingConfirmation: 'Confirmación de Turno',
    tutorName: 'Nombre del tutor',
    whatsappContact: 'WhatsApp de contacto',
    petName: 'Nombre de la mascota',
    petBreed: 'Raza',
    petBehavior: 'Comportamiento de la mascota',
    confirmBooking: 'Confirmar Reserva',
    appointmentConfirmedSuccess: '¡Tu cita ha sido agendada con éxito!',
    noServicesConfigured: 'No hay servicios configurados.',
    noMedicationsConfigured: 'No hay medicamentos configurados.',
    emptyField: 'Campo requerido'
  },
  'es-ES': {
    agenda: 'Agenda',
    clients: 'Clientes',
    retention: 'Por volver',
    settings: 'Ajustes',
    petProfile: 'Ficha Mascota',

    onlineSalon: 'Peluquería canina abierta',
    openToday: 'Abierto hoy',
    closedToday: 'Cerrado hoy',

    todayAppointmentsTitle: 'Buenos días 👋',
    todayAppointmentsCount: 'citas hoy',
    inSalon: 'EN PELUQUERÍA',
    pickupReady: 'LISTO PARA RECOGER',
    newAppointment: 'Nueva cita',
    shareLink: 'Compartir enlace',
    simultaneousCapacity: 'Capacidad de peluqueros',
    goodMorning: 'Buenos días 👋',
    noAppointmentsToday: 'No hay citas programadas para hoy.',
    weekOf: 'Semana de',
    clientsToReturnBanner: 'Clientes por volver',
    clientsNeedRebooking: 'mascotas necesitan una nueva cita de mantenimiento.',

    fidelizationModule: 'MÓDULO DE FIDELIZACIÓN',
    retentionTitle: 'Clientes por volver',
    retentionSubtitle: 'Estas mascotas están cerca de su próxima visita recomendada para mantener su pelo sano y sin nudos.',
    toContact: 'por contactar',
    thisWeek: 'esta semana',
    filterAll: 'Todos',
    filterUrgent: 'Urgentes',
    filterNextWeek: 'Próxima semana',
    lastVisit: 'Última visita',
    weeksAgo: 'semanas',
    recommendedTemplate: 'Plantilla de fidelización',
    suggestedMessageTitle: 'Mensaje inteligente sugerido',
    copyMessage: 'Copiar mensaje',
    messageCopied: '¡Mensaje copiado al portapapeles!',
    sendWhatsApp: 'Enviar por WhatsApp',
    alreadyBooked: 'Reservado',
    markBooked: 'Marcar como reservado',
    noRetentionDue: 'No hay mascotas próximas a regresar.',

    petDirectory: 'Directorio de Mascotas',
    activePetRecords: 'fichas activas registradas',
    newPet: 'Nueva Mascota',
    searchPetsPlaceholder: 'Buscar por nombre, raza, dueño o ID...',
    noPetsFound: 'No se encontraron mascotas que coincidan con la búsqueda.',
    noPetsRegistered: 'Aún no tienes mascotas registradas.',

    tutorResponsible: 'Dueño Responsable',
    habitualMood: 'Comportamiento Habitual',
    calm: 'Tranquilo',
    restless: 'Inquieto',
    difficult: 'Difícil',
    sensitive: 'Sensible',
    healthAllergies: 'Salud, Alergias y Piel Sensible',
    handlingNotes: 'Observaciones de Manejo',
    lastRegisteredVisit: 'Última Visita Registrada',
    registerVisit: 'Registrar Visita',
    editPetProfile: 'Editar Ficha',
    nextVisit: 'Próxima Visita',
    servicePhotos: 'Foto del servicio (Antes y Después)',
    beforePhoto: 'Foto Antes',
    afterPhoto: 'Foto Después ✨',
    takePhoto: 'Hacer Foto',
    gallery: 'Galería',
    uploadFile: 'Subir archivo',
    petDeliveryToTutor: 'Entrega de Mascota al Dueño',
    sendDeliveryReport: 'Enviar informe por WhatsApp',
    whenShouldReturn: '¿Cuándo debería volver?',
    returnRecommendationAdvice: 'Recomendación periódica para el cuidado óptimo del pelo.',
    weeks: 'semanas',
    customWeeks: 'Personalizado',
    saveReminder: 'Guardar Recordatorio',
    saveVisit: 'Guardar Visita',
    savingVisit: 'Guardando Visita...',

    settingsCenter: 'Centro de ajustes y administración',
    settingsTitle: 'Ajustes',
    businessConfig: 'Configuración del negocio',
    ratings: 'Calificaciones',
    myClients: 'Mis clientes',
    shareAgendaSocial: 'Comparte tu agenda para redes',
    backToSettings: 'Volver a Ajustes',

    businessInfo: 'Información del negocio',
    businessName: 'Nombre del negocio',
    businessLogo: 'Logo del negocio',
    logoRecommendation: 'Recomendado: imagen cuadrada de aproximadamente 400 × 400 px para una correcta visualización del logo.',
    country: 'País',
    languageLabel: 'Idioma',
    whatsappPhone: 'Teléfono de contacto / WhatsApp',
    addressLabel: 'Dirección de la peluquería',
    googleMapsLocation: 'Ubicación en Google Maps',
    businessHours: 'Horarios de atención',
    morningShift: 'Turno Mañana',
    afternoonShift: 'Turno Tarde',
    lunchBreak: 'Pausa de comida',
    simultaneousStaffCapacity: 'Capacidad y personal simultáneo',
    servicesTitle: 'Servicios',
    addService: '+ Añadir servicio',
    medicationsTitle: 'Medicamentos y Productos',
    addMedication: '+ Añadir nuevo medicamento',
    saveAllChanges: 'Guardar todos los cambios',
    changesSavedSuccess: '¡Todos los cambios se han guardado con éxito!',
    currencyLabel: 'Moneda del negocio',

    shareLinkTitle: 'Tu enlace directo de reservas',
    shareLinkSubtitle: 'Colócalo en la bio de Instagram, TikTok o compártelo por WhatsApp.',
    online247: 'ONLINE 24/7',
    copyLink: 'Copiar enlace',
    linkCopied: '¡Enlace de reservas copiado al portapapeles!',
    testClientFlow: 'Probar flujo como cliente online',

    bookAppointment: 'Reservar Cita Online',
    selectService: 'Selecciona el Servicio',
    selectDateTime: 'Fecha y Horario',
    tutorAndPetInfo: 'Datos del Dueño y Mascota',
    bookingConfirmation: 'Confirmación de Cita',
    tutorName: 'Nombre del dueño',
    whatsappContact: 'WhatsApp de contacto',
    petName: 'Nombre de la mascota',
    petBreed: 'Raza',
    petBehavior: 'Comportamiento de la mascota',
    confirmBooking: 'Confirmar Reserva',
    appointmentConfirmedSuccess: '¡Tu cita se ha programado con éxito!',
    noServicesConfigured: 'No hay servicios configurados.',
    noMedicationsConfigured: 'No hay medicamentos configurados.',
    emptyField: 'Campo requerido'
  },
  'en': {
    agenda: 'Schedule',
    clients: 'Clients',
    retention: 'Due for Visit',
    settings: 'Settings',
    petProfile: 'Pet Profile',

    onlineSalon: 'Grooming Salon Open',
    openToday: 'Open Today',
    closedToday: 'Closed Today',

    todayAppointmentsTitle: 'Good morning 👋',
    todayAppointmentsCount: 'appointments today',
    inSalon: 'IN SALON',
    pickupReady: 'READY FOR PICKUP',
    newAppointment: 'New Appointment',
    shareLink: 'Share Link',
    simultaneousCapacity: 'Groomer Capacity',
    goodMorning: 'Good morning 👋',
    noAppointmentsToday: 'No appointments scheduled for today.',
    weekOf: 'Week of',
    clientsToReturnBanner: 'Clients Due for Visit',
    clientsNeedRebooking: 'pets need a maintenance appointment.',

    fidelizationModule: 'CLIENT FIDELITY MODULE',
    retentionTitle: 'Clients Due for Visit',
    retentionSubtitle: 'These pets are near their recommended return date to keep their coat healthy and tangle-free.',
    toContact: 'to contact',
    thisWeek: 'this week',
    filterAll: 'All',
    filterUrgent: 'Urgent',
    filterNextWeek: 'Next Week',
    lastVisit: 'Last visit',
    weeksAgo: 'weeks',
    recommendedTemplate: 'Fidelity Template',
    suggestedMessageTitle: 'Suggested smart reminder',
    copyMessage: 'Copy message',
    messageCopied: 'Message copied to clipboard!',
    sendWhatsApp: 'Send via WhatsApp',
    alreadyBooked: 'Booked',
    markBooked: 'Mark as booked',
    noRetentionDue: 'No pets currently due for a return visit.',

    petDirectory: 'Pet Directory',
    activePetRecords: 'active records registered',
    newPet: 'New Pet',
    searchPetsPlaceholder: 'Search by name, breed, tutor or ID...',
    noPetsFound: 'No pets match your search criteria.',
    noPetsRegistered: 'You do not have any pets registered yet.',

    tutorResponsible: 'Responsible Tutor',
    habitualMood: 'Usual Behavior',
    calm: 'Calm',
    restless: 'Restless',
    difficult: 'Difficult',
    sensitive: 'Sensitive',
    healthAllergies: 'Health, Allergies & Sensitive Skin',
    handlingNotes: 'Handling Observations',
    lastRegisteredVisit: 'Last Registered Visit',
    registerVisit: 'Register Visit',
    editPetProfile: 'Edit Profile',
    nextVisit: 'Next Visit',
    servicePhotos: 'Service Photos (Before & After)',
    beforePhoto: 'Before Photo',
    afterPhoto: 'After Photo ✨',
    takePhoto: 'Take Photo',
    gallery: 'Gallery',
    uploadFile: 'Upload File',
    petDeliveryToTutor: 'Pet Delivery to Tutor',
    sendDeliveryReport: 'Send report via WhatsApp',
    whenShouldReturn: 'When should this pet return?',
    returnRecommendationAdvice: 'Periodic recommendation for optimal coat care.',
    weeks: 'weeks',
    customWeeks: 'Custom',
    saveReminder: 'Save Reminder',
    saveVisit: 'Save Visit',
    savingVisit: 'Saving Visit...',

    settingsCenter: 'Settings & Business Administration',
    settingsTitle: 'Settings',
    businessConfig: 'Business Configuration',
    ratings: 'Reviews & Ratings',
    myClients: 'My Clients',
    shareAgendaSocial: 'Share your booking link for social media',
    backToSettings: 'Back to Settings',

    businessInfo: 'Business Information',
    businessName: 'Business Name',
    businessLogo: 'Business Logo',
    logoRecommendation: 'Recommended: square image around 400 × 400 px for optimal logo display.',
    country: 'Country',
    languageLabel: 'Language',
    whatsappPhone: 'Contact / WhatsApp Phone',
    addressLabel: 'Salon Address',
    googleMapsLocation: 'Google Maps Location',
    businessHours: 'Business Hours',
    morningShift: 'Morning Shift',
    afternoonShift: 'Afternoon Shift',
    lunchBreak: 'Lunch Break',
    simultaneousStaffCapacity: 'Staff & Simultaneous Capacity',
    servicesTitle: 'Services',
    addService: '+ Add service',
    medicationsTitle: 'Medications & Products',
    addMedication: '+ Add new medication',
    saveAllChanges: 'Save All Changes',
    changesSavedSuccess: 'All changes were successfully saved!',
    currencyLabel: 'Business Currency',

    shareLinkTitle: 'Your direct booking link',
    shareLinkSubtitle: 'Place it on your Instagram bio, TikTok, or share via WhatsApp.',
    online247: 'ONLINE 24/7',
    copyLink: 'Copy Link',
    linkCopied: 'Booking link copied to clipboard!',
    testClientFlow: 'Test online client booking flow',

    bookAppointment: 'Book Appointment Online',
    selectService: 'Select Service',
    selectDateTime: 'Date & Time',
    tutorAndPetInfo: 'Tutor & Pet Information',
    bookingConfirmation: 'Booking Confirmation',
    tutorName: 'Tutor Name',
    whatsappContact: 'WhatsApp Phone',
    petName: 'Pet Name',
    petBreed: 'Breed',
    petBehavior: 'Pet Behavior',
    confirmBooking: 'Confirm Booking',
    appointmentConfirmedSuccess: 'Your appointment has been successfully booked!',
    noServicesConfigured: 'No services configured.',
    noMedicationsConfigured: 'No medications configured.',
    emptyField: 'Required field'
  },
  'pt': {
    agenda: 'Agenda',
    clients: 'Clientes',
    retention: 'A Retornar',
    settings: 'Ajustes',
    petProfile: 'Ficha do Pet',

    onlineSalon: 'Pet Shop Aberto',
    openToday: 'Aberto hoje',
    closedToday: 'Fechado hoje',

    todayAppointmentsTitle: 'Bom dia 👋',
    todayAppointmentsCount: 'agendamentos hoje',
    inSalon: 'NO SALÃO',
    pickupReady: 'PRONTO P/ RETIRAR',
    newAppointment: 'Novo agendamento',
    shareLink: 'Compartilhar link',
    simultaneousCapacity: 'Capacidade de tosadores',
    goodMorning: 'Bom dia 👋',
    noAppointmentsToday: 'Não há agendamentos para hoje.',
    weekOf: 'Semana de',
    clientsToReturnBanner: 'Clientes a retornar',
    clientsNeedRebooking: 'pets precisam de um novo agendamento de manutenção.',

    fidelizationModule: 'MÓDULO DE FIDELIZAÇÃO',
    retentionTitle: 'Clientes a retornar',
    retentionSubtitle: 'Estes pets estão próximos da data recomendada para manter a pelagem saudável e sem nós.',
    toContact: 'para contatar',
    thisWeek: 'esta semana',
    filterAll: 'Todos',
    filterUrgent: 'Urgentes',
    filterNextWeek: 'Próxima semana',
    lastVisit: 'Última visita',
    weeksAgo: 'semanas',
    recommendedTemplate: 'Modelo de fidelização',
    suggestedMessageTitle: 'Mensagem inteligente sugerida',
    copyMessage: 'Copiar mensagem',
    messageCopied: 'Mensagem copiada para a área de transferência!',
    sendWhatsApp: 'Enviar por WhatsApp',
    alreadyBooked: 'Agendado',
    markBooked: 'Marcar como agendado',
    noRetentionDue: 'Não há pets próximos da data de retorno.',

    petDirectory: 'Diretório de Pets',
    activePetRecords: 'fichas ativas cadastradas',
    newPet: 'Novo Pet',
    searchPetsPlaceholder: 'Buscar por nome, raça, tutor ou ID...',
    noPetsFound: 'Nenhum pet encontrado para esta busca.',
    noPetsRegistered: 'Você ainda não possui pets cadastrados.',

    tutorResponsible: 'Tutor Responsável',
    habitualMood: 'Comportamento Habitual',
    calm: 'Tranquilo',
    restless: 'Agitado',
    difficult: 'Difícil',
    sensitive: 'Sensível',
    healthAllergies: 'Saúde, Alergias e Pele Sensível',
    handlingNotes: 'Observações de Manejo',
    lastRegisteredVisit: 'Última Visita Registrada',
    registerVisit: 'Registrar Visita',
    editPetProfile: 'Editar Ficha',
    nextVisit: 'Próxima Visita',
    servicePhotos: 'Fotos do serviço (Antes e Depois)',
    beforePhoto: 'Foto Antes',
    afterPhoto: 'Foto Depois ✨',
    takePhoto: 'Tirar Foto',
    gallery: 'Galeria',
    uploadFile: 'Enviar arquivo',
    petDeliveryToTutor: 'Entrega do Pet ao Tutor',
    sendDeliveryReport: 'Enviar relatório por WhatsApp',
    whenShouldReturn: 'Quando o pet deve retornar?',
    returnRecommendationAdvice: 'Recomendação periódica para o cuidado ideal da pelagem.',
    weeks: 'semanas',
    customWeeks: 'Personalizado',
    saveReminder: 'Salvar Lembrete',
    saveVisit: 'Salvar Visita',
    savingVisit: 'Salvando Visita...',

    settingsCenter: 'Centro de ajustes e administração',
    settingsTitle: 'Ajustes',
    businessConfig: 'Configuração do negócio',
    ratings: 'Avaliações',
    myClients: 'Meus clientes',
    shareAgendaSocial: 'Compartilhe sua agenda nas redes sociais',
    backToSettings: 'Voltar aos Ajustes',

    businessInfo: 'Informações do negócio',
    businessName: 'Nome do negócio',
    businessLogo: 'Logo do negócio',
    logoRecommendation: 'Recomendado: imagem quadrada de aproximadamente 400 × 400 px para visualização correta do logo.',
    country: 'País',
    languageLabel: 'Idioma',
    whatsappPhone: 'Telefone de contato / WhatsApp',
    addressLabel: 'Endereço do salão',
    googleMapsLocation: 'Localização no Google Maps',
    businessHours: 'Horários de atendimento',
    morningShift: 'Turno Manhã',
    afternoonShift: 'Turno Tarde',
    lunchBreak: 'Pausa para almoço',
    simultaneousStaffCapacity: 'Capacidade e equipe simultânea',
    servicesTitle: 'Serviços',
    addService: '+ Adicionar serviço',
    medicationsTitle: 'Medicamentos e Produtos',
    addMedication: '+ Adicionar novo medicamento',
    saveAllChanges: 'Salvar todas as alterações',
    changesSavedSuccess: 'Todas as alterações foram salvas com sucesso!',
    currencyLabel: 'Moeda do negócio',

    shareLinkTitle: 'Seu link direto de agendamentos',
    shareLinkSubtitle: 'Adicione na bio do Instagram, TikTok ou compartilhe pelo WhatsApp.',
    online247: 'ONLINE 24/7',
    copyLink: 'Copiar link',
    linkCopied: 'Link de agendamentos copiado com sucesso!',
    testClientFlow: 'Testar fluxo como cliente online',

    bookAppointment: 'Agendar Horário Online',
    selectService: 'Selecione o Serviço',
    selectDateTime: 'Data e Horário',
    tutorAndPetInfo: 'Dados do Tutor e do Pet',
    bookingConfirmation: 'Confirmação do Agendamento',
    tutorName: 'Nome do tutor',
    whatsappContact: 'WhatsApp de contato',
    petName: 'Nome do pet',
    petBreed: 'Raça',
    petBehavior: 'Comportamiento do pet',
    confirmBooking: 'Confirmar Agendamento',
    appointmentConfirmedSuccess: 'Seu agendamento foi confirmado com sucesso!',
    noServicesConfigured: 'Nenhum serviço configurado.',
    noMedicationsConfigured: 'Nenhum medicamento configurado.',
    emptyField: 'Campo obrigatório'
  }
};
