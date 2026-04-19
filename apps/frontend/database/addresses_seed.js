import { supabase, faker } from './util/config.js'

const irishCounties = [
 'Dublin',
 'Cork',
 'Galway',
 'Limerick',
 'Waterford',
 'Kerry',
 'Clare',
 'Mayo',
 'Donegal',
 'Tipperary',
 'Kildare',
 'Wexford',
 'Kilkenny',
]

const eircodeRouting = {
 Dublin: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08'],
 Cork: ['T12', 'T23', 'T45'],
 Galway: ['H91', 'H53', 'H62'],
 Limerick: ['V94', 'V95'],
 Waterford: ['X91'],
 Kerry: ['V92', 'V93'],
 Clare: ['V14', 'V15'],
 Mayo: ['F23', 'F26'],
 Donegal: ['F92', 'F93'],
 Tipperary: ['E25', 'E32'],
 Kildare: ['W23', 'W91'],
 Wexford: ['Y21', 'Y25'],
 Kilkenny: ['R95'],
}

const storeAddresses = [
 { street: 'Main Street', city: 'Ballybrack', county: 'Dublin' },
 { street: 'Grafton Street', city: 'Dublin', county: 'Dublin' },
 { street: 'Patrick Street', city: 'Cork', county: 'Cork' },
 { street: 'Shop Street', city: 'Galway', county: 'Galway' },
 { street: "O'Connell Street", city: 'Limerick', county: 'Limerick' },
 { street: 'The Quay', city: 'Waterford', county: 'Waterford' },
 { street: 'Main Street', city: 'Killarney', county: 'Kerry' },
 { street: "O'Connell Street", city: 'Ennis', county: 'Clare' },
 { street: 'Bridge Street', city: 'Castlebar', county: 'Mayo' },
 { street: 'Main Street', city: 'Letterkenny', county: 'Donegal' },
 { street: 'Liberty Square', city: 'Thurles', county: 'Tipperary' },
 { street: 'Main Street', city: 'Naas', county: 'Kildare' },
 { street: 'Main Street', city: 'Wexford', county: 'Wexford' },
 { street: 'High Street', city: 'Kilkenny', county: 'Kilkenny' },
 { street: 'Pearse Street', city: 'Ballina', county: 'Mayo' },
 { street: 'Main Street', city: 'Tralee', county: 'Kerry' },
 { street: 'Grand Parade', city: 'Cork', county: 'Cork' },
 { street: 'Eyre Square', city: 'Galway', county: 'Galway' },
 { street: 'Henry Street', city: 'Dublin', county: 'Dublin' },
 { street: 'William Street', city: 'Limerick', county: 'Limerick' },
]

const seedAddresses = async () => {
 const { data: companies, error: companiesError } = await supabase
  .from('companies')
  .select('id, brand')

 if (companiesError) {
  console.error('Error fetching companies:', companiesError)
  throw companiesError
 }

 if (!companies || companies.length === 0) {
  throw new Error('No companies found. Please run companies seed first.')
 }

 const { data: locations, error: locationsError } = await supabase
  .from('locations')
  .select('id, location_type')

 if (locationsError) {
  console.error('Error fetching locations:', locationsError)
  throw locationsError
 }

 if (!locations || locations.length === 0) {
  throw new Error('No locations found. Please run locations seed first.')
 }

 const addresses = []

 // One primary address per company
 for (const company of companies) {
  const county = faker.helpers.arrayElement(irishCounties)
  const routingKey = faker.helpers.arrayElement(eircodeRouting[county])

  addresses.push({
   company_id: company.id,
   location_id: null,
   street_address: faker.location.streetAddress(),
   address_line2: null,
   city: faker.location.city(),
   county,
   eircode: `${routingKey} ${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
   country: 'Ireland',
   address_type: 'primary',
   is_active: true,
  })
 }

 // One primary address per location
 for (let i = 0; i < locations.length; i++) {
  const location = locations[i]
  const address = storeAddresses[i % storeAddresses.length]
  const routingKey = faker.helpers.arrayElement(eircodeRouting[address.county])

  addresses.push({
   company_id: null,
   location_id: location.id,
   street_address: address.street,
   address_line2: null,
   city: address.city,
   county: address.county,
   eircode: `${routingKey} ${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
   country: 'Ireland',
   address_type: 'primary',
   is_active: true,
  })
 }

 const { data, error } = await supabase.from('addresses').insert(addresses)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log(
  'Successfully inserted addresses:',
  data?.length || addresses.length,
 )
 console.log(
  `- Company addresses: ${addresses.filter((a) => a.company_id).length}`,
 )
 console.log(
  `- Location addresses: ${addresses.filter((a) => a.location_id).length}`,
 )
}

await seedAddresses()
