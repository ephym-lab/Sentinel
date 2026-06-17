import { create } from "zustand";

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

export const useAuthStore = create<AuthState>((set) => ({
  // Initialize with a default mock tenant and user for ease of local development
  tenant: {
    id: "d3b07384-d113-4ec6-a558-7ced2c45e54d",
    name: "Sentinel Academy",
    mode: "school",
  },
  user: {
    id: "user-123",
    name: "Alex Mercer",
    email: "alex@sentinel.io",
    role: "admin",
  },
  token: "mock-jwt-token",
  setAuth: (tenant, user, token) => set({ tenant, user, token }),
  clearAuth: () => set({ tenant: null, user: null, token: null }),
}));
