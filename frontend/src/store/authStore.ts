import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Tenant {
  id: string;
  name: string;
  mode: "school" | "mall" | "supermarket";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "guard" | "teacher" | "super_admin";
}

interface AuthState {
  tenant: Tenant | null;
  user: User | null;
  token: string | null;
  setAuth: (tenant: Tenant, user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tenant: null,
      user: null,
      token: null,
      setAuth: (tenant, user, token) => set({ tenant, user, token }),
      clearAuth: () => set({ tenant: null, user: null, token: null }),
    }),
    {
      name: "auth-storage", // key in localStorage
    }
  )
);
