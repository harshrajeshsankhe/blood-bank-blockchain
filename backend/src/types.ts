export type Role = "ADMIN" | "BLOOD_BANK" | "HOSPITAL" | "TRANSPORT" | "DONOR";
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
