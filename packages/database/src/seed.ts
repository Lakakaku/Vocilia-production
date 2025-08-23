import { createSupabaseServiceClient } from './index';

type UUID = string;

interface SeedBusinessInput {
  id: UUID;
  name: string;
  org_number: string;
  email: string;
  phone?: string;
  address?: Record<string, unknown>;
  status?: string;
}

interface SeedLocationInput {
  id: UUID;
  business_id: UUID;
  name: string;
  address?: string;
  qr_code_url?: string;
}

interface SeedSessionInput {
  business_id: UUID;
  location_id: UUID;
  customer_hash: string;
  qr_token: string; // unique
  status?: string;
  quality_score?: number;
  reward_amount?: number;
  feedback_categories?: string[];
  transcript?: string;
  created_at?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function upsertBusinesses(client: ReturnType<typeof createSupabaseServiceClient>) {
  const businesses: SeedBusinessInput[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Cafe Aurora',
      org_number: '559012-3456',
      email: 'owner@cafearora.se',
      phone: '+46 70 123 45 67',
      address: { city: 'Stockholm', street: 'Sveavägen 10', postal_code: '111 57' },
      status: 'active'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'NordMart Grocery',
      org_number: '556123-7890',
      email: 'it@nordmart.se',
      phone: '+46 31 234 56 78',
      address: { city: 'Göteborg', street: 'Avenyn 5', postal_code: '411 36' },
      status: 'active'
    }
  ];

  // Upsert on unique org_number
  const { data, error } = await client
    .from('businesses')
    .upsert(
      businesses.map((b) => ({
        id: b.id,
        name: b.name,
        org_number: b.org_number,
        email: b.email,
        phone: b.phone ?? null,
        address: b.address ?? null,
        status: b.status ?? 'pending'
      })),
      { onConflict: 'org_number' }
    )
    .select();

  if (error) throw error;
  return data!;
}

async function upsertLocations(client: ReturnType<typeof createSupabaseServiceClient>, businesses: { id: UUID }[]) {
  const locations: SeedLocationInput[] = [
    {
      id: 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      business_id: '11111111-1111-1111-1111-111111111111',
      name: 'City Center',
      address: 'Sveavägen 10, Stockholm',
      qr_code_url: 'https://example.com/qr/cafearora-city'
    },
    {
      id: 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      business_id: '11111111-1111-1111-1111-111111111111',
      name: 'Waterfront',
      address: 'Strandvägen 2, Stockholm',
      qr_code_url: 'https://example.com/qr/cafearora-waterfront'
    },
    {
      id: 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      business_id: '22222222-2222-2222-2222-222222222222',
      name: 'Downtown',
      address: 'Avenyn 5, Göteborg',
      qr_code_url: 'https://example.com/qr/nordmart-downtown'
    },
    {
      id: 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      business_id: '22222222-2222-2222-2222-222222222222',
      name: 'Backaplan',
      address: 'Backaplan 12, Göteborg',
      qr_code_url: 'https://example.com/qr/nordmart-backaplan'
    }
  ];

  // Ensure referenced businesses exist
  const businessIds = new Set(businesses.map((b) => b.id));
  for (const loc of locations) {
    if (!businessIds.has(loc.business_id)) {
      throw new Error(`Missing business for location: ${loc.name}`);
    }
  }

  const { data, error } = await client
    .from('business_locations')
    .upsert(
      locations.map((l) => ({
        id: l.id,
        business_id: l.business_id,
        name: l.name,
        address: l.address ?? null,
        qr_code_url: l.qr_code_url ?? null
      })),
      { onConflict: 'id' }
    )
    .select();

  if (error) throw error;
  return data!;
}

async function upsertSessions(client: ReturnType<typeof createSupabaseServiceClient>) {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  const sessions: SeedSessionInput[] = [
    {
      business_id: '11111111-1111-1111-1111-111111111111',
      location_id: 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      customer_hash: 'devhash:cafearora:001',
      qr_token: 'seed-qr-token-cafearora-1',
      status: 'completed',
      quality_score: 82,
      reward_amount: 12.5,
      feedback_categories: ['service', 'coffee'],
      transcript: 'Bra service och kaffet smakade riktigt gott.',
      created_at: daysAgo(2)
    },
    {
      business_id: '22222222-2222-2222-2222-222222222222',
      location_id: 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      customer_hash: 'devhash:nordmart:001',
      qr_token: 'seed-qr-token-nordmart-1',
      status: 'completed',
      quality_score: 68,
      reward_amount: 5.0,
      feedback_categories: ['kassa', 'varuplacering'],
      transcript: 'Svårt att hitta glutenfria alternativ, men personalen var hjälpsam.',
      created_at: daysAgo(1)
    }
  ];

  const { data, error } = await client
    .from('feedback_sessions')
    .upsert(
      sessions.map((s) => ({
        business_id: s.business_id,
        location_id: s.location_id,
        customer_hash: s.customer_hash,
        qr_token: s.qr_token,
        status: s.status ?? 'completed',
        quality_score: s.quality_score ?? null,
        reward_amount: s.reward_amount ?? null,
        feedback_categories: s.feedback_categories ?? null,
        transcript: s.transcript ?? null,
        created_at: s.created_at ?? undefined
      })),
      { onConflict: 'qr_token' }
    )
    .select('id, qr_token');

  if (error) throw error;
  return data!;
}

async function main() {
  // Validate env first for a friendlier error
  requireEnv('SUPABASE_URL');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const client = createSupabaseServiceClient();

  console.log('Seeding: businesses…');
  const businesses = await upsertBusinesses(client);
  console.log(`OK: ${businesses.length} businesses`);

  console.log('Seeding: locations…');
  const locations = await upsertLocations(client, businesses as { id: UUID }[]);
  console.log(`OK: ${locations.length} locations`);

  console.log('Seeding: feedback sessions…');
  const sessions = await upsertSessions(client);
  console.log(`OK: ${sessions.length} sessions`);
}

main()
  .then(() => {
    console.log('Seed completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  });


