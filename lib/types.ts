export interface Waypoint {
  id?: string                  // scenic_node UUID – required for ratings
  external_id?: string         // Wikidata Q-ID (e.g. Q153426)
  name: string
  node_type?: string | null    // category from osm_tags
  lat: number
  lon: number
  sqi_total: number
  volata_score?: number | null  // community avg (1–5 ★)
  rating_count?: number         // number of ratings
  elevation_m?: number | null
  wikipedia_title?: string | null
  wikipedia_url?: string | null  // admin-set override URL
  wikiPhoto?: string | null
}

export interface Airport {
  icao_code: string
  name: string
  lat: number
  lon: number
  elevation_msl_ft?: number | null
  airport_type?: string | null
}

export interface RouteVariant {
  variant_index: number
  nodes: Waypoint[]
  total_distance_nm: number
  sqi_aggregate: number
  fpl_xml?: string
}

export interface RouteResult {
  waypoints: Waypoint[]           // variant 0 nodes (primary)
  variants: RouteVariant[]        // all variants from API
  total_distance_nm: number
  departure_airport: Airport
  aircraft_type: string
  block_time_min: number
  sqi_avg?: number
  cached?: boolean
  generated_at?: string
  fn_version?: string             // actual deployed function version from API
  warnings?: string[]             // user-facing warnings from edge function (e.g. block time too short)
}

export interface Aircraft {
  id: string        // UUID – matches aircraft_profiles.id in DB
  name: string
  cruise_kt: number
}

// IDs from aircraft_profiles table in Supabase – sorted by cruise speed ascending
export const AIRCRAFT_LIST: Aircraft[] = [
  { id: '17b596ff-5c5e-473c-ade6-7b315e2c83b9', name: 'Cessna 152',              cruise_kt: 95  },
  { id: '18c1a7b2-0cf7-444c-9cc6-4558a4764a0e', name: 'Cessna 172S',             cruise_kt: 110 },
  { id: 'a96c3803-3c8d-4abf-901f-365244a5b756', name: 'Piper PA-28 Archer II',   cruise_kt: 120 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000006', name: 'Robin DR400',              cruise_kt: 120 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000001', name: 'Cessna 182 Skylane',       cruise_kt: 130 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000008', name: 'Piper PA-28R Arrow',       cruise_kt: 130 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000004', name: 'Diamond DA40',             cruise_kt: 140 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000002', name: 'Cirrus SR20',              cruise_kt: 155 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000010', name: 'Socata TB20 Trinidad',     cruise_kt: 155 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000009', name: 'Mooney M20J',              cruise_kt: 160 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000007', name: 'Beechcraft Bonanza A36',   cruise_kt: 165 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000005', name: 'Diamond DA42 Twin Star',   cruise_kt: 170 },
  { id: 'b1a2c3d4-0001-4000-a000-000000000003', name: 'Cirrus SR22',              cruise_kt: 175 },
]
