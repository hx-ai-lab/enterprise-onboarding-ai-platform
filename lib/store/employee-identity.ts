"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type EmployeeIdentityState = {
  employeeId: string | null;
  setEmployeeId: (id: string) => void;
};

/** The currently selected "simulated logged-in employee" — persisted per browser for demo continuity. */
export const useEmployeeIdentityStore = create<EmployeeIdentityState>()(
  persist(
    (set) => ({
      employeeId: null,
      setEmployeeId: (id) => set({ employeeId: id }),
    }),
    { name: "onboardops-employee-identity" },
  ),
);
