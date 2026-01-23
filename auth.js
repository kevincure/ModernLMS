/* ═══════════════════════════════════════════════════════════════════════════════
   Authentication Module for Campus LMS
   Google OAuth via Supabase Auth
═══════════════════════════════════════════════════════════════════════════════ */

import { showToast, setText, getInitials } from './ui_helpers.js';
import { loadDataFromSupabase, supabaseLoadUserGeminiKey } from './database_interactions.js';
import { DEFAULT_DATA } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let supabaseClient = null;
let appData = null;
let initAppCallback = null;
let renderAllCallback = null;
let navigateToCallback = null;
let populateCourseSelectorCallback = null;
let getUserCoursesCallback = null;

// Guard variables to prevent duplicate bootstrap
let bootstrappingUserId = null;
let bootstrappingPromise = null;

/**
 * Initialize the auth module with required dependencies
 */
export function initAuthModule(deps) {
  supabaseClient = deps.supabaseClient;
  appData = deps.appData;
  initAppCallback = deps.initApp;
  renderAllCallback = deps.renderAll;
  navigateToCallback = deps.navigateTo;
  populateCourseSelectorCallback = deps.populateCourseSelector;
  getUserCoursesCallback = deps.getUserCourses;
}

/**
 * Update the supabase client reference
 */
export function setSupabaseClient(client) {
  supabaseClient = client;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sign in with Google via Supabase Auth
 */
export async function signInWithGoogle() {
  if (!supabaseClient) {
    console.error('[Auth] Supabase not initialized');
    showLoginError('Supabase not configured. Please check config.js');
    return;
  }

  console.log('[Auth] Starting Google OAuth sign-in...');
  showLoginLoading(true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.SITE_URL || window.location.origin
      }
    });

    if (error) {
      console.error('[Auth] OAuth error:', error);
      showLoginError(error.message);
      showLoginLoading(false);
      return;
    }

    console.log('[Auth] OAuth initiated, redirecting to Google...');
    // The page will redirect to Google, then back to our app
  } catch (err) {
    console.error('[Auth] Sign-in error:', err);
    showLoginError('Failed to sign in. Please try again.');
    showLoginLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STATE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle auth state changes (called on page load and after OAuth redirect)
 */
export async function handleAuthStateChange(event, session) {
  console.log('[Auth] Auth state changed:', event, session?.user?.email);

  if (event === 'INITIAL_SESSION') {
    // This fires on page load - either user has session or not
    if (session?.user) {
      await handleSignedIn(session.user);
    } else {
      console.log('[Auth] No existing session on load');
      showLoginScreen();
    }
  } else if (event === 'SIGNED_IN' && session?.user) {
    // This fires after OAuth redirect or token refresh
    // The idempotent guard in handleSignedIn will prevent duplicate bootstraps
    await handleSignedIn(session.user);
  } else if (event === 'SIGNED_OUT') {
    handleSignedOut();
  }
}

/**
 * Handle successful sign-in
 */
export async function handleSignedIn(user) {
  // Prevent duplicate bootstraps (e.g., SIGNED_IN firing during token refresh)
  if (bootstrappingUserId === user.id && bootstrappingPromise) {
    console.log('[Auth] Bootstrap already in progress for user, waiting...');
    return await bootstrappingPromise;
  }

  console.log('[Auth] User signed in:', user.email);

  bootstrappingUserId = user.id;
  bootstrappingPromise = (async () => {
    // Map Supabase user to app user format
    appData.currentUser = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email.split('@')[0],
      avatar: getInitials(user.user_metadata?.full_name || user.email)
    };

    console.log('[Auth] Current user set:', appData.currentUser);

    // Load data from Supabase
    await loadDataFromSupabase();

    // Load user's Gemini key from Supabase profile
    const userGeminiKey = await supabaseLoadUserGeminiKey(user.id);
    if (userGeminiKey) {
      console.log('[Auth] Loaded Gemini key from user profile');
      appData.settings.geminiKey = userGeminiKey;
      // Set on window for immediate use (takes priority over config.js)
      window.GEMINI_API_KEY = userGeminiKey;
    }

    // Initialize the app UI
    if (initAppCallback) initAppCallback();
  })();

  try {
    await bootstrappingPromise;
  } finally {
    bootstrappingPromise = null;
  }
}

/**
 * Handle sign-out
 */
export function handleSignedOut() {
  console.log('[Auth] User signed out');
  appData.currentUser = null;
  // Reset app data to defaults
  Object.assign(appData, JSON.parse(JSON.stringify(DEFAULT_DATA)));
  showLoginScreen();
}

/**
 * Sign out the current user
 */
export async function logout() {
  console.log('[Auth] Logging out...');

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('[Auth] Logout error:', error);
    }
  }

  appData.currentUser = null;
  showLoginScreen();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK EXISTING SESSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for existing session on page load
 */
export async function checkExistingSession() {
  if (!supabaseClient) {
    console.log('[Auth] No Supabase client, showing login');
    showLoginScreen();
    return;
  }

  console.log('[Auth] Checking for existing session...');

  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('[Auth] Error getting session:', error);
    showLoginScreen();
    return;
  }

  if (session?.user) {
    console.log('[Auth] Found existing session for:', session.user.email);
    await handleSignedIn(session.user);
  } else {
    console.log('[Auth] No existing session');
    showLoginScreen();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show login screen
 */
export function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const appContainer = document.getElementById('appContainer');

  if (loginScreen) loginScreen.style.display = 'flex';
  if (appContainer) appContainer.setAttribute('aria-hidden', 'true');

  showLoginLoading(false);
  hideLoginError();
}

/**
 * Show/hide login loading state
 */
export function showLoginLoading(show) {
  const loadingEl = document.getElementById('loginLoading');
  const btnEl = document.getElementById('googleSignInBtn');
  if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
  if (btnEl) btnEl.disabled = show;
}

/**
 * Show login error message
 */
export function showLoginError(message) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = message;
  }
}

/**
 * Hide login error
 */
export function hideLoginError() {
  const errorEl = document.getElementById('loginError');
  if (errorEl) errorEl.style.display = 'none';
}

/**
 * Show configuration error on login screen
 */
export function showConfigError() {
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `
        <strong>Configuration Required</strong><br>
        Please update <code>config.js</code> with your Supabase credentials:<br>
        <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code>
      `;
    }
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) signInBtn.disabled = true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Debug function to verify auth state (call window.checkAuth() from console)
 */
export async function checkAuth() {
  console.log('=== Supabase Auth Debug ===');

  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return { authenticated: false, reason: 'client not initialized' };
  }

  try {
    // Check user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Error getting user:', userError);
      return { authenticated: false, reason: 'error', error: userError };
    }

    if (!user) {
      console.warn('NOT AUTHENTICATED - auth.uid() will return NULL');
      console.warn('All RLS policies requiring auth.uid() will FAIL');
      return { authenticated: false, reason: 'no user' };
    }

    // Check session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    console.log('User ID:', user.id);
    console.log('Email:', user.email);
    console.log('Provider:', user.app_metadata?.provider || 'unknown');
    console.log('Role:', user.role);

    if (session) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const minutesRemaining = Math.round((expiresAt - now) / 60000);
      console.log('Session expires:', expiresAt.toISOString(), `(${minutesRemaining} minutes remaining)`);
      console.log('Access token (first 50 chars):', session.access_token?.substring(0, 50) + '...');
    } else {
      console.warn('No session found');
    }

    // Check local app state
    console.log('---');
    console.log('App state user:', appData?.currentUser);

    // Verify IDs match
    if (appData?.currentUser && appData.currentUser.id !== user.id) {
      console.error('ID MISMATCH! App user ID:', appData.currentUser.id, '!== Supabase user ID:', user.id);
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      },
      session: session ? {
        expiresAt: new Date(session.expires_at * 1000).toISOString()
      } : null
    };
  } catch (err) {
    console.error('Exception checking auth:', err);
    return { authenticated: false, reason: 'exception', error: err.message };
  }
}
