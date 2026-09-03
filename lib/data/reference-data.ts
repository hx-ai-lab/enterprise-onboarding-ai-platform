import { readCollection } from "@/lib/data/json-store";
import type {
  Contact,
  Employee,
  OnboardingTask,
  Policy,
  Training,
} from "@/lib/types";

export function getEmployees(): Promise<Employee[]> {
  return readCollection<Employee>("employees.json");
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const employees = await getEmployees();
  return employees.find((e) => e.id === id) ?? null;
}

export function getOnboardingTasks(): Promise<OnboardingTask[]> {
  return readCollection<OnboardingTask>("onboarding_tasks.json");
}

export function getContacts(): Promise<Contact[]> {
  return readCollection<Contact>("contacts.json");
}

export function getPolicies(): Promise<Policy[]> {
  return readCollection<Policy>("policies.json");
}

export function getTrainings(): Promise<Training[]> {
  return readCollection<Training>("trainings.json");
}
