import { supabase, faker } from './util/config.js'

// NOTE: Company addresses are now stored in the dedicated 'addresses' table
// Run addresses_seed.js after this seed to populate company addresses
// NOTE: Run brands_seed.js before this seed to ensure brands exist

// Fetch existing brands to use their IDs
const getBrands = async () => {
 const { data, error } = await supabase.from('brands').select('id, name')

 if (error) {
  console.error('Error fetching brands:', error)
  throw error
 }

 return data
}

const seedCompanies = async (numEntries) => {
 const brands = await getBrands()

 if (!brands || brands.length === 0) {
  console.error('No brands found. Please run brands_seed.js first.')
  return
 }

 const companies = []

 for (let i = 0; i < numEntries; i++) {
  const randomBrand = faker.helpers.arrayElement(brands)
  companies.push({
   name: faker.company.name(),
   email: faker.internet.email(),
   phone: `+353 ${faker.helpers.arrayElement(['1', '21', '61', '91'])} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`,
   brand_id: randomBrand.id,
   subscription_tier: faker.helpers.arrayElement([
    'essential',
    'advanced',
    'custom',
   ]),
  })
 }

 const { data, error } = await supabase.from('companies').insert(companies)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log(
  'Successfully inserted companies:',
  data?.length || companies.length,
 )
}

await seedCompanies(5)
