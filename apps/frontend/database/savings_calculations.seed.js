import { supabase, faker } from './util/config.js'

const seedSavingsCalculations = async () => {
 const { data: orderItems, error: orderItemsError } = await supabase
  .from('order_items')
  .select(
   'id, unit_price, quantity, supplier_product_id, order_id, baseline_unit_price',
  )

 if (orderItemsError) {
  console.error('Error fetching order items:', orderItemsError)
  throw orderItemsError
 }
 if (!orderItems || orderItems.length === 0) {
  throw new Error('No order items found in DB. Seed order_items first.')
 }

 const { data: orders, error: ordersError } = await supabase
  .from('orders')
  .select('id, location_id')

 if (ordersError) {
  console.error('Error fetching orders:', ordersError)
  throw ordersError
 }
 if (!orders || orders.length === 0) {
  throw new Error('No orders found in DB. Seed orders first.')
 }

 const { data: locations, error: locationsError } = await supabase
  .from('locations')
  .select('id, company_id')

 if (locationsError) {
  console.error('Error fetching locations:', locationsError)
  throw locationsError
 }
 if (!locations || locations.length === 0) {
  throw new Error('No locations found in DB. Seed locations first.')
 }

 const { data: supplierProducts, error: supplierProductsError } = await supabase
  .from('supplier_products')
  .select('id, supplier_id, master_product_id, current_price')

 if (supplierProductsError) {
  console.error('Error fetching supplier products:', supplierProductsError)
  throw supplierProductsError
 }
 if (!supplierProducts || supplierProducts.length === 0) {
  throw new Error(
   'No supplier products found in DB. Seed supplier_products first.',
  )
 }

 const orderById = new Map(orders.map((order) => [order.id, order]))
 const locationById = new Map(
  locations.map((location) => [location.id, location]),
 )
 const supplierProductById = new Map(
  supplierProducts.map((product) => [product.id, product]),
 )
 const supplierProductsByMaster = new Map()

 for (const product of supplierProducts) {
  if (!supplierProductsByMaster.has(product.master_product_id)) {
   supplierProductsByMaster.set(product.master_product_id, [])
  }
  supplierProductsByMaster.get(product.master_product_id).push(product)
 }

 const calculations = []

 for (const item of orderItems) {
  if (item.baseline_unit_price === null || item.baseline_unit_price <= 0) {
   continue
  }

  const order = orderById.get(item.order_id)
  if (!order) continue

  const location = locationById.get(order.location_id)
  if (!location) continue

  const supplierProduct = supplierProductById.get(item.supplier_product_id)
  if (!supplierProduct) continue

  const productsForMaster =
   supplierProductsByMaster.get(supplierProduct.master_product_id) || []

  const baselinePrice = parseFloat(Number(item.baseline_unit_price).toFixed(4))
  const chosenPrice = parseFloat(Number(item.unit_price).toFixed(4))
  const quantity = Number(item.quantity ?? 1)

  let bestExternalSupplierId = null
  let bestExternalPrice = null

  if (productsForMaster.length > 0) {
   const bestCandidate = productsForMaster.reduce((best, candidate) => {
    if (!best) return candidate
    return Number(candidate.current_price) < Number(best.current_price)
     ? candidate
     : best
   }, null)

   if (bestCandidate) {
    bestExternalSupplierId = bestCandidate.supplier_id
    bestExternalPrice = parseFloat(
     Number(bestCandidate.current_price).toFixed(4),
    )
   }
  }

  const deltaVsBaseline = parseFloat(
   ((chosenPrice - baselinePrice) * quantity).toFixed(4),
  )

  const savingsFraction =
   baselinePrice === 0 ? 0 : (chosenPrice - baselinePrice) / baselinePrice
  const clampedFraction = Math.max(-0.9999, Math.min(0.9999, savingsFraction))
  const savingsPercentage = parseFloat(clampedFraction.toFixed(4))

  const calculationDate = faker.date.between({
   from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
   to: new Date(),
  })

  calculations.push({
   order_item_id: item.id,
   company_id: location.company_id,
   baseline_price: baselinePrice,
   chosen_supplier_id: supplierProduct.supplier_id,
   chosen_price: chosenPrice,
   best_external_supplier_id: bestExternalSupplierId,
   best_external_price: bestExternalPrice,
   delta_vs_baseline: deltaVsBaseline,
   savings_percentage: savingsPercentage,
   calculation_date: calculationDate.toISOString(),
  })
 }

 if (calculations.length === 0) {
  console.warn('No savings calculations generated. Skipping insert.')
  return
 }

 const { data, error } = await supabase
  .from('savings_calculations')
  .insert(calculations)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 const savingsCount = calculations.filter((c) => c.delta_vs_baseline < 0).length
 const overspendCount = calculations.filter(
  (c) => c.delta_vs_baseline > 0,
 ).length
 const neutralCount = calculations.filter(
  (c) => c.delta_vs_baseline === 0,
 ).length
 const totalSavings = calculations
  .filter((c) => c.delta_vs_baseline < 0)
  .reduce((sum, c) => sum + Math.abs(c.delta_vs_baseline), 0)
 const totalOverspend = calculations
  .filter((c) => c.delta_vs_baseline > 0)
  .reduce((sum, c) => sum + c.delta_vs_baseline, 0)

 console.log(
  'Successfully inserted savings calculations:',
  data?.length || calculations.length,
 )
 console.log(`- Savings (delta < 0): ${savingsCount}`)
 console.log(`- Overspend (delta > 0): ${overspendCount}`)
 console.log(`- Neutral (delta = 0): ${neutralCount}`)
 console.log(`- Total savings amount: €${totalSavings.toFixed(2)}`)
 console.log(`- Total overspend amount: €${totalOverspend.toFixed(2)}`)
 console.log(
  '- savings_percentage stored as fraction of 1 (e.g. 0.1234 = 12.34%)',
 )
}

await seedSavingsCalculations()
