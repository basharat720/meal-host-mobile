export interface UserLocationResponse {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  address?: string;
  is_primary: boolean;
  created_at: string;
}

export interface ChefProfile {
  id?: number;
  kitchen_description?: string;
  specialties: string[];
  dietary_tags: string[];
  documents: string[];
  profile_picture_url?: string | null;
  default_prep_time_minutes?: number;
  rating_avg?: number;
  review_count?: number;
  status?: string;
  food_safety_badge?: string[];
  created_at?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_customer: boolean;
  is_chef: boolean;
  status: string;
  firebase_uid: string;
  created_at: string;
  locations: UserLocationResponse[];
  chef_profile?: ChefProfile;
}

export interface UserRegisterRequest {
  name: string;
  email: string;
  phone?: string;
  is_customer?: boolean;
  is_chef?: boolean;
  status?: string;
  firebase_uid?: string;
  chef_profile?: ChefProfile;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    is_primary?: boolean;
  };
}

export interface UserLocationInput {
  latitude: number;
  longitude: number;
  address?: string;
  is_primary?: boolean;
}


export interface UserUpdate {
  name?: string;
  email?: string;
  phone?: string;
  chef_profile?: Partial<ChefProfile>;
}

export interface DietaryTag {
  id: number;
  code: string;
  description?: string;
}

export interface FoodImage {
  id: number;
  image_url: string;
  is_primary: boolean;
  food_listing_id: number;
  created_at: string;
}

export interface FoodListing {
  id: number;
  title: string;
  description?: string;
  price: number;
  available_quantity: number;
  status: "ACTIVE" | "INACTIVE";
  pickup_location_id?: number;
  chef_id: string;
  chef_name?: string;
  chef_rating_avg?: number;
  chef_review_count?: number;
  preparation_time_minutes?: number;
  created_at: string;
  images: FoodImage[];
  dietary_tags: DietaryTag[];
}

export interface FoodListingCreate {
  title: string;
  description?: string;
  price: number;
  available_quantity: number;
  status: "ACTIVE" | "INACTIVE";
  pickup_location_id: number;
  dietary_tag_ids?: number[];
  image_url: string;
  preparation_time_minutes?: number;
}

export interface FoodListingUpdate {
  title?: string;
  description?: string;
  price?: number;
  available_quantity?: number;
  status?: "ACTIVE" | "INACTIVE";
  pickup_location_id?: number;
  dietary_tag_ids?: number[];
  preparation_time_minutes?: number;
}

export interface Order {
  id: number;
  quantity: number;
  total_amount: number;
  status: "PENDING" | "CONFIRMED" | "READY_FOR_PICKUP" | "DELIVERED" | "RECEIVED" | "COMPLETED" | "CANCELLED";
  customer_id: string; // Changed to string (firebase_uid)
  chef_id: string;     // Changed to string (firebase_uid)
  food_listing_id?: number;
  food_request_id?: number;
  created_at: string;
  delivery_address?: string;
  delivery_phone?: string;
  special_instructions?: string;
  tentative_eta_min_minutes?: number;
  tentative_eta_max_minutes?: number;
  confirmed_eta_at?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface OrderCreate {
  quantity: number;
  total_amount: number;
  status?: "PENDING";
  customer_id: string; // Changed to string (firebase_uid)
  chef_id: string;     // Changed to string (firebase_uid)
  food_listing_id?: number;
  food_request_id?: number;
  delivery_address?: string;
  delivery_phone?: string;
  special_instructions?: string;
}

export interface OrderUpdate {
  status: "PENDING" | "CONFIRMED" | "READY_FOR_PICKUP" | "DELIVERED" | "RECEIVED" | "COMPLETED" | "CANCELLED";
  confirmed_eta_minutes?: number;
}

export interface PaymentBase {
    method: "CASH" | "STRIPE";
    stripe_payment_intent_id?: string;
}

export interface Chef extends User {
    kitchen_description?: string;
    specialties: string[];
    dietary_tags: string[];
    documents: string[];
    minPrice?: number;
    maxPrice?: number;
}

export type RequestStatus = "OPEN" | "CLOSED";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface FoodRequest {
  id: number;
  customer_id: number;
  title: string;
  description?: string;
  event_time?: string;
  status: RequestStatus;
  preferred_location_id?: number;
  created_at: string;
  dietary_tags: DietaryTag[];
}

export interface FoodRequestCreate {
  customer_id: number;
  title: string;
  description?: string;
  event_time?: string;
  dietary_tag_ids: number[];
}

export interface Offer {
  id: number;
  food_request_id: number;
  chef_id: number;
  price: number;
  message?: string;
  status: OfferStatus;
  rejection_reason?: string;
  created_at: string;
}

export interface OfferCreate {
  price: number;
  message?: string;
}

export interface Review {
  id: number;
  order_id: number;
  chef_id: number;
  stars: number;
  comment?: string;
  customer_name?: string;
  created_at: string;
}

export interface AvailabilitySlot {
  day_of_week: number; // 0=Mon … 6=Sun
  open_time: string;   // "09:00"
  close_time: string;  // "21:00"
}

export interface PaymentIntentOut {
  payment_id: number;
  client_secret: string;
}
