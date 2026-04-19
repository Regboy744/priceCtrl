import { supabase } from './util/config.js'

// Predefined brands for retail chains
const brands = [{ name: 'SuperValu' }, { name: 'Centra' }]

const seedBrands = async () => {
 const { data, error } = await supabase.from('brands').insert(brands).select()

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log('Successfully inserted brands:', data?.length || brands.length)
 return data
}

// Export for use in other seed files
export const getBrands = async () => {
 const { data, error } = await supabase.from('brands').select('id, name')

 if (error) {
  console.error('Error fetching brands:', error)
  throw error
 }

 return data
}

await seedBrands()
