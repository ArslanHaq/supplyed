export type ProfileCompletionItem = {
  id:
    | "profile"
    | "image"
    | "certificate"
    | "phone"
    | "roleVerification"
    | "stripe";
  label: string;
  weight: number;
  complete: boolean;
  href: string;
};

export type ProfileCompletion = {
  role: "INSTRUCTOR" | "INSTITUTION";
  percentage: number;
  completedWeight: number;
  totalWeight: 100;
  complete: boolean;
  canPostJobs: boolean;
  calculatedAt: string;
  items: ProfileCompletionItem[];
};
