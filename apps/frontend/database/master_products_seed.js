import { supabase, faker } from './util/config.js'

// NOTE: Run brands_seed.js before this seed to ensure brands exist

const groceryAccounts = [
 'DAIRY_PRODUCTS',
 'FRESH_MEAT',
 'FROZEN_FOODS',
 'BAKERY_ITEMS',
 'BEVERAGES',
 'SNACKS_CHIPS',
 'CANNED_GOODS',
 'CEREALS_GRAINS',
 'FRESH_PRODUCE',
 'CLEANING_SUPPLIES',
 'PERSONAL_CARE',
 'BABY_PRODUCTS',
 'PET_SUPPLIES',
 'HEALTH_WELLNESS',
 'CONDIMENTS_SAUCES',
 'BREAKFAST_ITEMS',
 'DELI_PREPARED',
 'ALCOHOL_BEER',
 'PAPER_PRODUCTS',
 'HOUSEHOLD_ITEMS',
]

// Fetch existing brands to use their IDs
const getBrands = async () => {
 const { data, error } = await supabase.from('brands').select('id, name')

 if (error) {
  console.error('Error fetching brands:', error)
  throw error
 }

 return data
}

const generateArticleCode = () => {
 return faker.string.numeric(10)
}

const generateEanCode = () => {
 const length = faker.number.int({ min: 5, max: 13 })
 return faker.string.numeric(length)
}

const generateProductDescription = () => {
 const productTypes = [
  'Premium Organic',
  'Fresh',
  'Imported',
  'Local',
  'Artisan',
  'Classic',
  'Natural',
  'Whole',
  'Extra Virgin',
  'Free Range',
 ]
 const products = [
  'Milk',
  'Bread',
  'Cheese',
  'Yogurt',
  'Butter',
  'Eggs',
  'Chicken',
  'Beef',
  'Salmon',
  'Apples',
  'Bananas',
  'Tomatoes',
  'Potatoes',
  'Rice',
  'Pasta',
  'Olive Oil',
  'Orange Juice',
  'Coffee',
  'Tea',
 ]

 const type = faker.helpers.arrayElement(productTypes)
 const product = faker.helpers.arrayElement(products)
 return `${type} ${product}`
}

const generateUnitSize = () => {
 const units = [
  '500g',
  '1kg',
  '2kg',
  '250ml',
  '500ml',
  '1L',
  '2L',
  '100g',
  '200g',
  '750ml',
  '330ml',
  '1.5L',
  '12 pack',
  '6 pack',
  '24 pack',
  '400g',
  '800g',
  '1.2L',
  '3L',
 ]
 return faker.helpers.arrayElement(units)
}

const seedMasterProduct = async (numEntriesPerBrand) => {
 const brands = await getBrands()

 if (!brands || brands.length === 0) {
  console.error('No brands found. Please run brands_seed.js first.')
  return
 }

 // Create products for each brand
 for (const brand of brands) {
  const masterProducts = []

  for (let i = 0; i < numEntriesPerBrand; i++) {
   masterProducts.push({
    brand_id: brand.id,
    article_code: generateArticleCode(),
    ean_code: generateEanCode(),
    ean_history: [],
    description: generateProductDescription(),
    unit_size: generateUnitSize(),
    account: faker.helpers.arrayElement(groceryAccounts),
   })
  }

  const { error } = await supabase
   .from('master_products')
   .insert(masterProducts)

  if (error) {
   console.error(`Insert error for brand ${brand.name}:`, error)
   throw error
  }

  console.log(
   `Successfully inserted ${masterProducts.length} master products for brand: ${brand.name}`,
  )
 }
}

// 500 products per brand (2 brands = 1000 total)
await seedMasterProduct(500)
