"use client";

import { useEffect, useState } from "react";
import { useEmployeeIdentityStore } from "@/lib/store/employee-identity";
import type { Employee } from "@/lib/types";

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/employees")
      .then((r) => {
        if (!r.ok) throw new Error(`加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setEmployees(data.employees ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("员工数据加载失败,请刷新页面重试");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, loading, error };
}

/** The globally selected "simulated logged-in employee" identity, auto-defaulting to the first employee. */
export function useCurrentEmployee() {
  const { employees, loading, error } = useEmployees();
  const employeeId = useEmployeeIdentityStore((s) => s.employeeId);
  const setEmployeeId = useEmployeeIdentityStore((s) => s.setEmployeeId);

  useEffect(() => {
    if (!loading && !employeeId && employees.length > 0) {
      setEmployeeId(employees[0].id);
    }
  }, [loading, employeeId, employees, setEmployeeId]);

  const employee = employees.find((e) => e.id === employeeId) ?? null;
  return { employee, employees, loading, error, setEmployeeId };
}
