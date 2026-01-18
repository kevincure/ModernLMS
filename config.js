/* ═══════════════════════════════════════════════════════════════════════════════
   Campus LMS - Configuration

   INSTRUCTIONS:
   1. Copy this file to config.local.js (which is gitignored)
   2. Fill in your Supabase credentials from your Supabase project settings
   3. Add your Gemini API key from Google AI Studio

   For Supabase credentials:
   - Go to your Supabase project dashboard
   - Click "Settings" (gear icon) → "API"
   - Copy the "Project URL" and "anon public" key

   For Google OAuth (optional):
   - Set up in Supabase Auth settings → Providers → Google
═══════════════════════════════════════════════════════════════════════════════ */

// Supabase Configuration
window.SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL'; // e.g., https://xxxxx.supabase.co
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // The "anon" "public" key

// Gemini API Key (for AI features)
window.GEMINI_API_KEY = ''; // Get from https://aistudio.google.com/

// Site URL for redirects (change for production)
window.SITE_URL = window.location.origin; // Auto-detect: http://localhost:8000 or production URL
