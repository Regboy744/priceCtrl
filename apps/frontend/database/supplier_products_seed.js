import { supabase, faker } from './util/config.js'

const statusWeights = [
 { weight: 7, value: 'available' },
 { weight: 2, value: 'out_of_stock' },
 { weight: 1, value: 'discontinued' },
]

const supplierCounts = [
 { weight: 5, value: 3 },
 { weight: 3, value: 4 },
 { weight: 2, value: 5 },
]

const seedSupplierProducts = async () => {
 const { data: suppliers, error: supplierError } = await supabase
  .from('suppliers')
  .select('id, is_active')

 if (supplierError) {
  console.error('Error fetching suppliers:', supplierError)
  throw supplierError
 }
 if (!suppliers || suppliers.length === 0) {
  throw new Error('No suppliers found in DB. Seed suppliers first.')
 }

 const activeSuppliers = suppliers.filter((s) => s.is_active)

 if (activeSuppliers.length < 3) {
  throw new Error(
   'At least 3 active suppliers are required to create alternative pricing options.',
  )
 }

 const { data: masterProducts, error: masterError } = await supabase
  .from('master_products')
  .select('id')

 if (masterError) {
  console.error('Error fetching master products:', masterError)
  throw masterError
 }
 if (!masterProducts || masterProducts.length === 0) {
  throw new Error('No master products found in DB. Seed master_products first.')
 }

 const activeSupplierIds = activeSuppliers.map((s) => s.id)
 const supplierProducts = []
 const productSupplierCounts = []

 for (const masterProduct of masterProducts) {
  const desiredCount = faker.helpers.weightedArrayElement(supplierCounts)
  const actualCount = Math.min(desiredCount, activeSupplierIds.length)
  const chosenSuppliers = faker.helpers
   .shuffle([...activeSupplierIds])
   .slice(0, actualCount)

  const basePrice = faker.number.float({
   min: 1.5,
   max: 120,
   precision: 0.01,
  })

  chosenSuppliers.forEach((supplierId, index) => {
   const variance = faker.number.float({
    min: 0.88,
    max: 1.18,
    precision: 0.0001,
   })

   const currentPrice = parseFloat((basePrice * variance).toFixed(2))

   supplierProducts.push({
    supplier_id: supplierId,
    master_product_id: masterProduct.id,
    supplier_product_code: faker.string.alphanumeric({
     length: 8,
     casing: 'upper',
    }),
    internal_product_id: faker.string.numeric(8),
    current_price: currentPrice,
    vat_rate: faker.helpers.arrayElement([0.0, 0.09, 0.135, 0.23]),
    availability_status:
     index === 0
      ? 'available'
      : faker.helpers.weightedArrayElement(statusWeights),
   })
  })

  productSupplierCounts.push(actualCount)
 }

 const { data, error } = await supabase
  .from('supplier_products')
  .insert(supplierProducts)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 const totalInserted = data?.length || supplierProducts.length
 const availableCount = supplierProducts.filter(
  (sp) => sp.availability_status === 'available',
 ).length
 const averageSuppliers = (
  supplierProducts.length / Math.max(1, masterProducts.length)
 ).toFixed(2)
 const minSuppliers = Math.min(...productSupplierCounts)
 const maxSuppliers = Math.max(...productSupplierCounts)

 console.log('Successfully inserted supplier products:', totalInserted)
 console.log(`- Products marked available: ${availableCount}`)
 console.log(`- Master products covered: ${masterProducts.length}`)
 console.log(`- Avg suppliers per product: ${averageSuppliers}`)
 console.log(`- Min suppliers per product: ${minSuppliers}`)
 console.log(`- Max suppliers per product: ${maxSuppliers}`)
 console.log('- Pricing varies ±12% around base')
}

await seedSupplierProducts()
