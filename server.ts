import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// Persistent server-side data directory
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'businesses.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface StoredBusiness {
  businessId: string;
  config: any;
  pets?: any[];
  appointments?: any[];
  bookedRetentions?: string[];
  updatedAt: string;
}

function cleanString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, ''); // Preserve alphanumeric, hyphens and underscores
}

function readDb(): Record<string, StoredBusiness> {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.error('Error reading businesses.json:', err);
  }
  return {};
}

function writeDb(data: Record<string, StoredBusiness>): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing businesses.json:', err);
  }
}

function extractSlug(str?: string): string {
  if (!str) return '';
  const clean = str.trim().split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

// Find business by exact businessId, config.id, bookingSlug, or name
function findBusiness(idOrSlug: string, db: Record<string, StoredBusiness>): StoredBusiness | null {
  if (!idOrSlug) return null;
  const raw = idOrSlug.trim();
  const rawClean = cleanString(raw);
  const extracted = extractSlug(raw);
  const targetClean = cleanString(extracted) || rawClean;

  // 1. Direct ID match
  if (db[raw]) return db[raw];
  if (db[rawClean]) return db[rawClean];
  if (db[targetClean]) return db[targetClean];

  const all = Object.values(db);

  // 2. Check businessId or config.id exact match
  const matchId = all.find(
    (b) =>
      b.businessId === raw ||
      b.config?.id === raw ||
      cleanString(b.businessId) === rawClean ||
      cleanString(b.config?.id) === rawClean ||
      cleanString(b.businessId) === targetClean
  );
  if (matchId) return matchId;

  // 3. Check bookingSlug (matching raw or extracted slug)
  const matchSlug = all.find((b) => {
    const rawSlug = b.config?.bookingSlug;
    if (!rawSlug) return false;
    const cleanRawSlug = cleanString(rawSlug);
    const cleanExtracted = cleanString(extractSlug(rawSlug));
    return (
      rawSlug === raw ||
      rawSlug === extracted ||
      cleanRawSlug === rawClean ||
      cleanRawSlug === targetClean ||
      cleanExtracted === rawClean ||
      cleanExtracted === targetClean
    );
  });
  if (matchSlug) return matchSlug;

  // 4. Exact clean name match (exact match only, never loose substring)
  const matchName = all.find((b) => {
    const nameClean = cleanString(b.config?.name);
    return (
      nameClean &&
      (nameClean === rawClean ||
        nameClean === targetClean ||
        nameClean.replace(/[-_]/g, '') === rawClean.replace(/[-_]/g, ''))
    );
  });
  if (matchName) return matchName;

  // 5. If generic parameter requested or single business exists
  if (all.length > 0) {
    const stripped = targetClean.replace(/[-_]/g, '');
    const isGenericTarget =
      !targetClean ||
      stripped === 'reservas' ||
      stripped === 'reservar' ||
      stripped === 'online' ||
      stripped === 'book' ||
      stripped === 'booking' ||
      stripped === 'bizmain' ||
      stripped === 'notspecifiedbusiness' ||
      stripped === 'default' ||
      stripped === 'main';

    if (isGenericTarget) {
      return db['biz_main'] || all[0];
    }

    if (all.length === 1) {
      return all[0];
    }
  }

  return null;
}

// API Routes
app.get('/api/businesses', (_req, res) => {
  const db = readDb();
  const list = Object.values(db).map((b) => ({
    businessId: b.businessId,
    name: b.config?.name,
    address: b.config?.address,
    slug: b.config?.bookingSlug,
    updatedAt: b.updatedAt
  }));
  res.json({ businesses: list });
});

app.get('/api/businesses/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  const normalized = cleanString(extractSlug(idOrSlug));
  console.log(`[PUBLIC BOOKING DEBUG]
slug received: ${idOrSlug}
normalized slug: ${normalized}
business lookup: searching across ${Object.keys(db).length} businesses
business found: ${business ? 'YES (' + (business.config?.name || business.businessId) + ')' : 'NO'}
businessId: ${business ? business.businessId : 'null'}`);

  if (!business) {
    res.status(404).json({
      error: 'No encontramos este negocio',
      message: 'Este enlace de reservas no es válido o ya no está disponible.'
    });
    return;
  }

  // Return public business profile with its own services, appointments, and pets
  const publicConfig = {
    ...business.config,
    id: business.businessId,
    services: (business.config?.services || []).filter((s: any) => s.active !== false)
  };

  res.json({
    businessId: business.businessId,
    config: publicConfig,
    services: publicConfig.services,
    appointments: business.appointments || [],
    pets: business.pets || []
  });
});

app.post('/api/businesses', (req, res) => {
  const { businessId, config, pets, appointments, bookedRetentions } = req.body;
  const id = businessId || config?.id || 'biz_main';

  if (!config) {
    res.status(400).json({ error: 'Config object is required' });
    return;
  }

  const db = readDb();
  const existing = db[id] || {};

  const cleanSlug = extractSlug(config.bookingSlug) || cleanString(config.name);
  const cleanConfig = {
    ...config,
    id,
    bookingSlug: cleanSlug
  };

  db[id] = {
    businessId: id,
    config: {
      ...(existing.config || {}),
      ...cleanConfig
    },
    pets: pets || existing.pets || [],
    appointments: appointments || existing.appointments || [],
    bookedRetentions: bookedRetentions || existing.bookedRetentions || [],
    updatedAt: new Date().toISOString()
  };

  writeDb(db);

  console.log(`[BUSINESS PERSISTENCE DEBUG]
businessId: ${id}
businessName: ${cleanConfig.name}
bookingSlug: ${cleanSlug}
successfully persisted to db`);

  res.json({ success: true, businessId: id, slug: cleanSlug });
});

app.post('/api/businesses/:idOrSlug/appointments', (req, res) => {
  const { idOrSlug } = req.params;
  const { appointment, petData } = req.body;

  if (!appointment) {
    res.status(400).json({ error: 'Appointment data required' });
    return;
  }

  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({
      error: 'No encontramos este negocio',
      message: 'Este enlace de reservas no es válido o ya no está disponible.'
    });
    return;
  }

  const apts = business.appointments || [];
  const existingAptIdx = apts.findIndex((a: any) => a.id === appointment.id);
  if (existingAptIdx >= 0) {
    apts[existingAptIdx] = { ...apts[existingAptIdx], ...appointment };
  } else {
    apts.unshift(appointment);
  }
  business.appointments = apts;

  if (petData && petData.name) {
    const pets = business.pets || [];
    const existingPetIdx = pets.findIndex(
      (p: any) =>
        p.id === appointment.petId ||
        p.name?.toLowerCase() === petData.name?.toLowerCase()
    );

    const incomingPhoto = appointment.beforePhotoUrl || petData.photoUrl || undefined;

    const visitEntry = {
      id: `v_${Date.now()}`,
      date: appointment.date || 'Hoy',
      serviceName: appointment.serviceName,
      price: appointment.price,
      currency: appointment.currency,
      mood: petData.habitualMood || 'tranquilo',
      paid: appointment.paymentStatus === 'cobrado',
      photos: {
        beforeUrl: incomingPhoto
      }
    };

    if (existingPetIdx >= 0) {
      const p = pets[existingPetIdx];
      p.age = petData.age || p.age || '1 año';
      p.gender = petData.gender || p.gender || 'Macho';
      p.weightKg = Number(petData.weightKg) || p.weightKg || 10;
      if (incomingPhoto) {
        p.photoUrl = incomingPhoto;
      }
      p.tutor = {
        name: appointment.tutorName || p.tutor?.name || 'Cliente Online',
        phone: appointment.tutorPhone || p.tutor?.phone || '',
        rawPhone: appointment.tutorPhone || p.tutor?.rawPhone || ''
      };
      p.lastVisit = visitEntry;
      p.visitHistory = [visitEntry, ...(p.visitHistory || [])];
      pets[existingPetIdx] = p;
    } else {
      pets.push({
        id: appointment.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
        name: petData.name,
        breed: petData.breed || 'Mestizo',
        gender: petData.gender || 'Macho',
        weightKg: Number(petData.weightKg) || 10,
        age: petData.age || '1 año',
        isVip: false,
        photoUrl: incomingPhoto || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
        tutor: {
          name: appointment.tutorName || 'Cliente Online',
          phone: appointment.tutorPhone || '',
          rawPhone: appointment.tutorPhone || ''
        },
        habitualMood: petData.habitualMood || 'tranquilo',
        healthAllergies: petData.healthAllergies || '',
        handlingObservations: petData.handlingObservations || '',
        lastVisit: visitEntry,
        visitHistory: [visitEntry],
        recommendedIntervalWeeks: 4
      });
    }
    business.pets = pets;
  }

  business.updatedAt = new Date().toISOString();
  db[business.businessId] = business;
  writeDb(db);

  res.status(201).json({ success: true, appointment });
});

// Reviews API
app.get('/api/businesses/:idOrSlug/reviews', (req, res) => {
  const { idOrSlug } = req.params;
  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  const reviews = business.config?.reviews || [];
  res.json({ reviews });
});

app.post('/api/businesses/:idOrSlug/reviews', (req, res) => {
  const { idOrSlug } = req.params;
  const { review } = req.body;

  if (!review || !review.clientName || !review.stars) {
    res.status(400).json({ error: 'Invalid review payload' });
    return;
  }

  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  const cleanReview = {
    ...review,
    id: review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId: business.businessId,
    stars: Math.min(5, Math.max(1, Number(review.stars) || 5)),
    clientName: String(review.clientName).trim(),
    comment: review.comment ? String(review.comment).trim() : '',
    date: review.date || new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    createdAt: review.createdAt || new Date().toISOString()
  };

  const existingReviews = business.config?.reviews || [];
  const updatedReviews = [cleanReview, ...existingReviews.filter((r: any) => r.id !== cleanReview.id)];

  business.config = {
    ...business.config,
    reviews: updatedReviews
  };
  business.updatedAt = new Date().toISOString();
  db[business.businessId] = business;
  writeDb(db);

  console.log(`[REVIEW SAVED ON SERVER] Business: ${business.businessId}, From: ${cleanReview.clientName}, Stars: ${cleanReview.stars}`);
  res.status(201).json({ success: true, review: cleanReview });
});

app.get('/api/businesses/:idOrSlug/appointments', (req, res) => {
  const { idOrSlug } = req.params;
  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  res.json({
    appointments: business.appointments || [],
    pets: business.pets || []
  });
});

app.patch('/api/businesses/:idOrSlug/appointments/:appointmentId', (req, res) => {
  const { idOrSlug, appointmentId } = req.params;
  const patchData = req.body;

  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  const apts = business.appointments || [];
  const idx = apts.findIndex((a: any) => a.id === appointmentId);

  if (idx === -1) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }

  apts[idx] = {
    ...apts[idx],
    ...patchData,
    updatedAt: new Date().toISOString()
  };

  business.appointments = apts;
  business.updatedAt = new Date().toISOString();
  db[business.businessId] = business;
  writeDb(db);

  console.log(`[APPOINTMENT UPDATE] Appointment ${appointmentId} updated:`, patchData);
  res.json({ success: true, appointment: apts[idx] });
});

app.delete('/api/businesses/:idOrSlug/appointments/:appointmentId', (req, res) => {
  const { idOrSlug, appointmentId } = req.params;

  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  const apts = business.appointments || [];
  business.appointments = apts.filter((a: any) => a.id !== appointmentId);
  business.updatedAt = new Date().toISOString();
  db[business.businessId] = business;
  writeDb(db);

  res.json({ success: true, message: 'Appointment deleted' });
});

// Full-stack Vite / Static integration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgendaCan server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
