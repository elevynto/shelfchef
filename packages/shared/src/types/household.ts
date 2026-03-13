export interface HouseholdMember {
  id: string;
  email: string;
}

export interface HouseholdResponse {
  id: string;
  name: string;
  members: HouseholdMember[];
}

export interface InviteResponse {
  code: string;
  expiresAt: string;
}
