export type ProfileReview = {
  bookingId?: string | null;
  comment?: string | null;
  createdAt?: string | null;
  id: string;
  jobTitle?: string | null;
  rating: number;
  reviewerName?: string | null;
  reviewerType?: "INSTITUTION" | "INSTRUCTOR" | string | null;
  updatedAt?: string | null;
};

export type ProfileReviews = {
  averageRating: number | null;
  reviews: ProfileReview[];
  total: number;
};
