import { supabase, faker } from './util/config.js'

const seedUserProfiles = async (numEntries) => {
 // First, fetch existing companies, locations, and auth users to reference
 const { data: companies, error: companiesError } = await supabase
  .from('companies')
  .select('id')

 if (companiesError) {
  console.error('Error fetching companies:', companiesError)
  throw companiesError
 }

 const { data: locations, error: locationsError } = await supabase
  .from('locations')
  .select('id, company_id')

 if (locationsError) {
  console.error('Error fetching locations:', locationsError)
  throw locationsError
 }

 const {
  data: { users: authUsers },
  error: authUsersError,
 } = await supabase.auth.admin.listUsers()

 if (authUsersError) {
  console.error('Error fetching auth users:', authUsersError)
  throw authUsersError
 }

 if (!companies.length || !locations.length || !authUsers.length) {
  throw new Error(
   'No companies, locations, or auth users found. Please run companies, locations, and users seeds first.',
  )
 }

 const userProfiles = []

 // Irish first names for more realistic data
 const irishFirstNames = [
  'Aoife',
  'Caoimhe',
  'Ciara',
  'Eimear',
  'Niamh',
  'Aisling',
  'Sinead',
  'Orla',
  'Mairead',
  'Siobhan',
  'Sean',
  'Conor',
  'Cian',
  'Oisin',
  'Darragh',
  'Padraig',
  'Eoin',
  'Ruairi',
  'Tadhg',
  'Colm',
  'Sarah',
  'Emma',
  'Lisa',
  'Rachel',
  'Karen',
  'Michelle',
  'Jennifer',
  'Amanda',
  'Claire',
  'Louise',
  'David',
  'John',
  'Michael',
  'Paul',
  'Mark',
  'Stephen',
  'Robert',
  'James',
  'Daniel',
  'Brian',
 ]

 const irishSurnames = [
  "O'Brien",
  "O'Sullivan",
  'Murphy',
  'Kelly',
  'McCarthy',
  "O'Connor",
  'Walsh',
  'Ryan',
  'Byrne',
  "O'Neill",
  'Doyle',
  'Gallagher',
  'Kennedy',
  'Lynch',
  'Murray',
  'Quinn',
  'Moore',
  'McLoughlin',
  "O'Carroll",
  'Connolly',
  'Daly',
  "O'Connell",
  'Wilson',
  'Dunne',
  'Griffin',
  'Doolan',
  'Power',
  'Whelan',
  'Hayes',
  "O'Shea",
 ]

 const roles = ['master', 'admin', 'manager']

 for (let i = 0; i < numEntries && i < authUsers.length; i++) {
  const location = faker.helpers.arrayElement(locations)
  const authUser = authUsers[i]

  const firstName =
   authUser.user_metadata?.first_name ||
   authUser.raw_user_meta_data?.first_name ||
   faker.helpers.arrayElement(irishFirstNames)

  const lastName =
   authUser.user_metadata?.last_name ||
   authUser.raw_user_meta_data?.last_name ||
   faker.helpers.arrayElement(irishSurnames)

  userProfiles.push({
   id: authUser.id,
   company_id: location.company_id,
   location_id: location.id,
   role: faker.helpers.arrayElement(roles),
   first_name: firstName,
   last_name: lastName,
   theme_mode: faker.helpers.arrayElement(['light', 'dark']),
   avatar_url: faker.helpers.maybe(() => faker.image.avatar(), {
    probability: 0.3,
   }),
  })
 }

 const { data, error } = await supabase
  .from('user_profiles')
  .insert(userProfiles)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log(
  'Successfully inserted user profiles:',
  data?.length || userProfiles.length,
 )
}

await seedUserProfiles(60)
