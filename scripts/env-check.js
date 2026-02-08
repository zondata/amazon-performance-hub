require('dotenv').config({ path: '.env.local' });
console.log(!!process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);
