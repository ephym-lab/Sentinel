import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// Helper to decode JWT without a library
function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Route guard component for platform administration console.
 * Gated exclusively to users with role = "super_admin".
 * Redirects unauthorized users back to their corresponding tenant dashboard
 * without raising a 404 or indicating the platform dashboard exists.
 */
export default function PlatformGuard() {
  const token = localStorage.getItem('token');
  const payload = parseJwt(token);

  const isSuperAdmin = payload && (payload.role === 'super_admin' || payload.is_super_admin === true);

  if (!isSuperAdmin) {
    // Redirect to the default tenant home page
    const tenantId = localStorage.getItem('tenant_id') || 'default';
    return <Navigate to={`/dashboard/${tenantId}`} replace />;
  }

  // Render sub-routes
  return <Outlet />;
}
