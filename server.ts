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
    .replace(/[^a-z0-9]/g, '');
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

// Find business by exact businessId, config.id, bookingSlug, or name
function findBusiness(idOrSlug: string, db: Record<string, StoredBusiness>): StoredBusiness | null {
  if (!idOrSlug) return null;
  const targetClean = cleanString(idOrSlug);

  // 1. Direct ID match
  if (db[idOrSlug]) {
    return db[idOrSlug];
  }

  const all = Object.values(db);

  // 2. Check businessId or config.id exact match
  const matchId = all.find(
    (b) => b.businessId === idOrSlug || b.config?.id === idOrSlug
  );
  if (matchId) return matchId;

  // 3. Check bookingSlug
  const matchSlug = all.find((b) => {
    const slug = cleanString(b.config?.bookingSlug);
    return slug && (slug === targetClean || targetClean.endsWith(slug) || slug.endsWith(targetClean));
  });
  if (matchSlug) return matchSlug;

  // 4. Check name match
  const matchName = all.find((b) => {
    const nameClean = cleanString(b.config?.name);
    return nameClean && (nameClean === targetClean || targetClean.includes(nameClean) || nameClean.includes(targetClean));
  });
  if (matchName) return matchName;

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

  if (!business) {
    res.status(404).json({
      error: 'No encontramos este negocio',
      message: 'Este enlace de reservas no es válido o ya no está disponible.'
    });
    return;
  }

  // Return public business profile with its own services and appointments for capacity calculation
  const publicConfig = {
    ...business.config,
    id: business.businessId,
    services: (business.config?.services || []).filter((s: any) => s.active !== false)
  };

  res.json({
    businessId: business.businessId,
    config: publicConfig,
    services: publicConfig.services,
    appointments: business.appointments || []
  });
});

app.post('/api/businesses', (req, res) => {
  const { businessId, config, pets, appointments, bookedRetentions } = req.body;
  const id = businessId || config?.id || `biz_${Date.now()}`;

  if (!config) {
    res.status(400).json({ error: 'Config object is required' });
    return;
  }

  const db = readDb();
  const existing = db[id] || {};

  db[id] = {
    businessId: id,
    config: {
      ...config,
      id
    },
    pets: pets || existing.pets || [],
    appointments: appointments || existing.appointments || [],
    bookedRetentions: bookedRetentions || existing.bookedRetentions || [],
    updatedAt: new Date().toISOString()
  };

  writeDb(db);
  res.json({ success: true, businessId: id });
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
  apts.unshift(appointment);
  business.appointments = apts;

  if (petData && petData.name) {
    const pets = business.pets || [];
    const exists = pets.some((p: any) => p.name?.toLowerCase() === petData.name?.toLowerCase());
    if (!exists) {
      pets.push({
        id: appointment.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
        name: petData.name,
        breed: petData.breed || 'Mestizo',
        gender: petData.gender || 'Macho',
        weightKg: petData.weightKg || 10,
        age: '1 año',
        isVip: false,
        photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
        tutor: {
          name: appointment.tutorName || 'Cliente Online',
          phone: appointment.tutorPhone || '',
          rawPhone: appointment.tutorPhone || ''
        },
        habitualMood: petData.habitualMood || 'tranquilo',
        healthAllergies: petData.healthAllergies || '',
        handlingObservations: petData.handlingObservations || '',
        lastVisit: {
          id: `v_${Date.now()}`,
          date: appointment.date || 'Hoy',
          serviceName: appointment.serviceName,
          price: appointment.price,
          currency: appointment.currency,
          mood: 'tranquilo',
          paid: false,
          photos: {}
        },
        visitHistory: [],
        recommendedIntervalWeeks: 4
      });
      business.pets = pets;
    }
  }

  business.updatedAt = new Date().toISOString();
  db[business.businessId] = business;
  writeDb(db);

  res.status(201).json({ success: true, appointment });
});

app.get('/api/businesses/:idOrSlug/appointments', (req, res) => {
  const { idOrSlug } = req.params;
  const db = readDb();
  const business = findBusiness(idOrSlug, db);

  if (!business) {
    res.status(404).json({ error: 'Business not found' });
    return;
  }

  res.json({ appointments: business.appointments || [] });
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
