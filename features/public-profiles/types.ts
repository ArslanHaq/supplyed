export type InstructorPublicProfile = {
  bio: string | null;
  city: string | null;
  county: string | null;
  currency: string | null;
  dailyRate: number | null;
  dbsVerified: boolean;
  experience: number | null;
  fullName: string;
  hourlyRate: number | null;
  id: string;
  imageUrl: string | null;
  keyStages: string[];
  memberSince: string | null;
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type InstitutionPublicProfile = {
  address: string;
  city: string;
  county: string | null;
  coverTypes: string[];
  id: string;
  imageUrl: string | null;
  institutionType: "MAT_SCHOOL" | "SINGLE_SCHOOL";
  memberSince: string | null;
  name: string;
  postalCode: string | null;
  staffingNeeds: string | null;
  trust: { name: string } | null;
  typicalPupilCount: number | null;
  verified: boolean;
};
