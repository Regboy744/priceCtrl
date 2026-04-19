import { supabase, faker } from './util/config.js'

const seedOrderItems = async (numEntriesPerOrder) => {
 const { data: orders, error: ordersError } = await supabase
  .from('orders')
  .select('id')

 if (ordersError) {
  console.error('Error fetching orders:', ordersError)
  throw ordersError
 }
 if (!orders || orders.length === 0) {
  throw new Error('No orders found in DB. Seed orders first.')
 }

 const { data: supplierProducts, error: supplierError } = await supabase
  .from('supplier_products')
  .select('id, master_product_id, current_price')

 if (supplierError) {
  console.error('Error fetching supplier products:', supplierError)
  throw supplierError
 }
 if (!supplierProducts || supplierProducts.length === 0) {
  throw new Error(
   'No supplier products found in DB. Seed supplier_products first.',
  )
 }

 const orderItems = []

 for (const order of orders) {
  const itemCount = faker.number.int({ min: 1, max: numEntriesPerOrder })

  for (let index = 0; index < itemCount; index++) {
   const supplierProduct = faker.helpers.arrayElement(supplierProducts)

   const quantity = faker.number.int({ min: 1, max: 120 })
   const unitPrice = parseFloat(
    (
     supplierProduct.current_price *
     faker.number.float({
      min: 0.92,
      max: 1.12,
      precision: 0.0001,
     })
    ).toFixed(4),
   )
   const totalPrice = parseFloat((quantity * unitPrice).toFixed(4))

   let baselineUnitPrice = null
   let overrideReason = null

   if (faker.datatype.boolean({ probability: 0.7 })) {
    const baselineMultiplier = faker.number.float({
     min: 0.9,
     max: 1.2,
     precision: 0.0001,
    })
    baselineUnitPrice = parseFloat(
     (supplierProduct.current_price * baselineMultiplier).toFixed(4),
    )

    if (baselineUnitPrice > unitPrice) {
     overrideReason = faker.helpers.arrayElement([
      'Supplier promotion applied',
      'Negotiated seasonal discount',
      'Matched competitor pricing',
     ])
    } else if (baselineUnitPrice < unitPrice) {
     overrideReason = faker.helpers.arrayElement([
      'Expedited order premium',
      'Limited stock surcharge',
     ])
    }
   }

   orderItems.push({
    order_id: order.id,
    master_product_id: supplierProduct.master_product_id,
    supplier_product_id: supplierProduct.id,
    quantity: quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    baseline_unit_price: baselineUnitPrice,
    override_reason: overrideReason,
   })
  }
 }

 const { data, error } = await supabase.from('order_items').insert(orderItems)

 if (error) {
  console.error('Insert error:', error)
  throw error
 }

 console.log(
  'Successfully inserted order items:',
  data?.length || orderItems.length,
 )

 const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0)
 const totalValue = orderItems.reduce((sum, item) => sum + item.total_price, 0)
 const avgQuantity = totalQuantity / orderItems.length
 const avgPrice = totalValue / orderItems.length

 console.log(`- Orders seeded: ${orders.length}`)
 console.log(`- Total Items: ${orderItems.length}`)
 console.log(`- Total Quantity: ${totalQuantity}`)
 console.log(`- Total Value: €${totalValue.toFixed(2)}`)
 console.log(`- Average Quantity per Item: ${avgQuantity.toFixed(2)}`)
 console.log(`- Average Price per Item: €${avgPrice.toFixed(2)}`)
}

await seedOrderItems(5)
