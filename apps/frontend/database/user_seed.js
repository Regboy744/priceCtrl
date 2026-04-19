const { supabase } = await import('./util/config.js')

// import { fileURLToPath } from 'url'
// import { dirname, join } from 'path'
// import { readFile } from 'fs/promises'

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = dirname(__filename)

// Load environment variables from .env file
// const loadEnvFile = async () => {
//  try {
//   const envPath = join(__dirname, '..', '.env')
//   const envContent = await readFile(envPath, 'utf8')

//   envContent.split('\n').forEach((line) => {
//    const trimmedLine = line.trim()
//    if (trimmedLine && !trimmedLine.startsWith('#')) {
//     const [key, ...valueParts] = trimmedLine.split('=')
//     if (key && valueParts.length > 0) {
//      const value = valueParts.join('=').trim()
//      process.env[key.trim()] = value
//     }
//    }
//   })

//   console.log('✓ Environment variables loaded from .env')
//  } catch (error) {
//   console.error('Error loading .env file:', error.message)
//   throw error
//  }
// }

const users = Array.from({ length: 30 }, (_, i) => ({
 email: `user${i + 1}@example.com`,
 password: `Password`,
}))

async function bulkSignup() {
 try {
  // Load environment variables from .env file
  // await loadEnvFile()

  // Import config after environment is loaded
  // const { supabase } = await import('./util/config.js')

  console.log(`Starting bulk signup for ${users.length} users...`)

  for (let i = 0; i < users.length; i++) {
   const user = users[i]

   try {
    // Using Supabase client from config.js for authentication signup
    const { data, error } = await supabase.auth.signUp({
     email: user.email,
     password: user.password,
     options: {
      emailRedirectTo: undefined, // Prevent email confirmation for seeding
     },
    })

    if (error) {
     console.error(`Error with user ${i + 1} (${user.email}):`, error.message)
    } else {
     console.log(
      `User ${i + 1} (${user.email}): Successfully created - ID: ${data.user?.id}`,
     )
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 25))
   } catch (error) {
    console.error(`Unexpected error with ${user.email}:`, error)
   }
  }

  console.log('Bulk signup completed!')
 } catch (error) {
  console.error('Error in bulk signup:', error.message)
 }
}

// Run the bulk signup
await bulkSignup()
