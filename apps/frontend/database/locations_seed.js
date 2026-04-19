import { supabase, faker } from './util/config.js'

// Irish cities for generating store names
const irishCities = [
 'Ballybrack',
 'Dublin',
 'Cork',
 'Galway',
 'Limerick',
 'Waterford',
 'Killarney',
 'Ennis',
 'Castlebar',
 'Letterkenny',
 'Thurles',
 'Naas',
 'Wexford',
 'Kilkenny',
 'Ballina',
 'Tralee',
 'Sligo',
 'Athlone',
 'Drogheda',
 'Dundalk',
]

const seedLocations = async () => {
 // First, fetch existing companies to get their IDs and brand names
 const { data: companies, error: companiesError } = await supabase
  .from('companies')
  .select('id, name, brand_id, brands(name)')

 if (companiesError) {
  console.error('Error fetching companies:', companiesError)
  throw companiesError
 }

 if (!companies || companies.length === 0) {
  throw new Error('No companies found. Please run companies seed first.')
 }

 const locations = []
 let locationNumber = 1

 // Create 20 stores distributed across companies
 for (let i = 0; i < 20; i++) {
  const company = faker.helpers.arrayElement(companies)
  const city = irishCities[i]

  // Generate store name like "Ballybrack Centra" or "Cork SuperValu"
  const brandName = company.brands?.name || 'Store'
  const storeName = `${city} ${brandName}`

  locations.push({
   company_id: company.id,
   name: storeName,
   location_number: locationNumber++,
   location_type: 'store',
  })
 }

 // Create 5 offices (one per company, using first 5 companies)
 const officeCompanies = companies.slice(0, 5)

 for (const company of officeCompanies) {
  locations.push({
   company_id: company.id,
   name: `${company.name} Head Office`,
   location_number: locationNumber++,
   location_type: 'office',
  })
 }

 const { data, error } = await supabase.from('locations').insert(locations)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log(
  'Successfully inserted locations:',
  data?.length || locations.length,
 )
 console.log(
  `- ${locations.filter((l) => l.location_type === 'store').length} stores`,
 )
 console.log(
  `- ${locations.filter((l) => l.location_type === 'office').length} offices`,
 )
}

await seedLocations()
