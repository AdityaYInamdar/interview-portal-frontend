/**
 * Token Debugger
 * 
 * Run this in your browser console to debug authentication issues.
 * 
 * Usage:
 * 1. Open browser DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this entire file
 * 4. Press Enter
 */

console.log('🔍 TOKEN DEBUGGER STARTED\n');

// Check localStorage
const authStorage = localStorage.getItem('auth-storage');
console.log('📦 LocalStorage auth-storage exists:', !!authStorage);

if (authStorage) {
  try {
    const parsed = JSON.parse(authStorage);
    console.log('📦 Parsed auth storage:', {
      hasState: !!parsed.state,
      hasToken: !!parsed.state?.token,
      hasRefreshToken: !!parsed.state?.refreshToken,
      hasUser: !!parsed.state?.user,
      isAuthenticated: parsed.state?.isAuthenticated
    });
    
    if (parsed.state?.token) {
      const token = parsed.state.token;
      console.log('\n🔑 TOKEN DETAILS:');
      console.log('  Length:', token.length);
      console.log('  First 50 chars:', token.substring(0, 50));
      console.log('  Starts with:', token.substring(0, 10));
      
      // Try to decode JWT (without verification)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('\n📋 TOKEN PAYLOAD:');
          console.log('  Subject (user_id):', payload.sub);
          console.log('  Email:', payload.email);
          console.log('  Role:', payload.role);
          console.log('  Company ID:', payload.company_id);
          console.log('  Type:', payload.type);
          console.log('  Issued at:', new Date(payload.iat * 1000).toLocaleString());
          console.log('  Expires at:', new Date(payload.exp * 1000).toLocaleString());
          
          const now = Date.now() / 1000;
          const isExpired = payload.exp < now;
          const timeLeft = payload.exp - now;
          
          console.log('\n⏰ EXPIRATION STATUS:');
          console.log('  Is Expired:', isExpired ? '❌ YES' : '✅ NO');
          if (!isExpired) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            console.log(`  Time remaining: ${minutes}m ${seconds}s`);
          }
        } else {
          console.error('❌ Token does not have 3 parts (header.payload.signature)');
        }
      } catch (e) {
        console.error('❌ Failed to decode token payload:', e.message);
      }
    } else {
      console.warn('⚠️ No token found in auth storage');
    }
    
    if (parsed.state?.user) {
      console.log('\n👤 USER INFO:');
      console.log('  ID:', parsed.state.user.id);
      console.log('  Email:', parsed.state.user.email);
      console.log('  Role:', parsed.state.user.role);
      console.log('  Name:', parsed.state.user.full_name);
      console.log('  Status:', parsed.state.user.status);
    }
  } catch (e) {
    console.error('❌ Error parsing auth storage:', e);
  }
} else {
  console.warn('⚠️ No auth-storage found in localStorage');
  console.log('  This means you are NOT logged in');
}

// Test API call
console.log('\n🌐 TESTING API CALLS...');

async function testAPICall() {
  try {
    const response = await fetch('http://localhost:8000/api/v1/auth/test-token', {
      headers: {
        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth-storage')).state.token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful!');
      console.log('  Response:', data);
    } else {
      console.error('❌ API call failed with status:', response.status);
      const errorData = await response.json().catch(() => null);
      if (errorData) {
        console.error('  Error:', errorData);
      }
    }
  } catch (error) {
    console.error('❌ API call error:', error.message);
  }
}

if (authStorage && JSON.parse(authStorage).state?.token) {
  testAPICall();
} else {
  console.warn('⚠️ Skipping API test - no token available');
}

console.log('\n✅ TOKEN DEBUGGER COMPLETE\n');
console.log('💡 TIP: If token is expired or invalid, run: localStorage.clear() then log in again');
