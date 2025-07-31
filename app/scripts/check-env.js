#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Environment Variable Check\n');

console.log('Google OAuth Configuration:');
console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '***' + process.env.GOOGLE_CLIENT_SECRET.slice(-4) : 'NOT SET');
console.log('REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

console.log('\nExpected vs Actual:');
console.log('Expected Client ID ending: -82ddljmfu21bu7u54nfakqdcq0frm3fa');
console.log('Actual Client ID ending:', process.env.GOOGLE_CLIENT_ID?.split('-').pop());

console.log('\nOther Settings:');
console.log('CORS_ALLOWED_ORIGIN:', process.env.CORS_ALLOWED_ORIGIN);
console.log('NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);