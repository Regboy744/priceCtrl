import { supabase } from './util/config.js'

const seedSuppliers = async () => {
 const suppliers = [
  { name: 'Musgrave Marketplace', contact_info: {}, is_active: true },
  { name: 'Savage & Whitten', contact_info: {}, is_active: true },
  { name: 'Barry Group', contact_info: {}, is_active: true },
  { name: "O'Reillys Wholesale", contact_info: {}, is_active: true },
  { name: 'Value Centre', contact_info: {}, is_active: true },
 ]

 const { data, error } = await supabase.from('suppliers').insert(suppliers)

 if (error) {
  console.error('Insert error: ', error)
  throw error
 }

 console.log(
  'Successfully inserted suppliers:',
  data?.length || suppliers.length,
 )
 console.log('Suppliers added:')
 suppliers.forEach((s) => console.log(`  - ${s.name}`))
}

await seedSuppliers()
