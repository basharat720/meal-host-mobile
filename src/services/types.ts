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
  /** Public-facing kitchen name. Falls back to the chef's own name server-side. */
  kitchen_name?: string;
  kitchen_description?: string;
  specialties: string[];
  dietary_tags: string[];
  documents: string[];
  profile_picture_url?: string | null;
  default_prep_time_minutes?: number;
  years_of_experience?: number | null;
  delivery_radius_km?: number | null;
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
  city?: string | null;
  zip_code?: string | null;
  delivery_instructions?: string | null;
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
  /**
   * Whether the chef ticked the Partner Agreement box at signup, and when.
   * Sent at the top level; the backend moves both onto the chef record and
   * ignores them for customer-only signups.
   */
  terms_accepted?: boolean;
  /** ISO 8601 timestamp. */
  terms_accepted_at?: string;
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
  city?: string | null;
  zip_code?: string | null;
  delivery_instructions?: string | null;
  chef_profile?: Partial<ChefProfile>;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    is_primary?: boolean;
  };
}

export interface DietaryTag {
  id: number;
  code: string;
  description?: string;
}

export interface CuisineType {
  id: number;
  code: string;
  name: string;
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
  cuisine_types?: CuisineType[];
  chef_is_available?: boolean;
}

export interface FoodListingCreate {
  title: string;
  description?: string;
  price: number;
  available_quantity: number;
  status: "ACTIVE" | "INACTIVE";
  pickup_location_id: number;
  dietary_tag_ids?: number[];
  cuisine_type_ids?: number[];
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
  cuisine_type_ids?: number[];
  preparation_time_minutes?: number;
}

/** One dish line on an order. Title and price are snapshotted server-side. */
export interface OrderItem {
  food_listing_id: number;
  item_title: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  /** Total portions across every line. */
  quantity: number;
  /** One entry per distinct dish. Empty for orders created from an offer. */
  items: OrderItem[];
  total_amount: number;
  status: "PENDING" | "CONFIRMED" | "READY_FOR_PICKUP" | "DELIVERED" | "RECEIVED" | "COMPLETED" | "CANCELLED";
  customer_id: string; // Changed to string (firebase_uid)
  chef_id: string;     // Changed to string (firebase_uid)
  /** The kitchen's name — who the customer is talking to in the order chat. */
  chef_name?: string;
  food_listing_id?: number;
  food_request_id?: number;
  created_at: string;
  delivery_type?: "pickup" | "delivery";
  delivery_address?: string;
  delivery_phone?: string;
  special_instructions?: string;
  order_notes?: string;          // Notes from chef to customer
  cancellation_reason?: string;  // If cancelled, why?
  tentative_eta_min_minutes?: number;
  tentative_eta_max_minutes?: number;
  confirmed_eta_at?: string;
  customer_name?: string;
  customer_phone?: string;
  /** Unread chat messages on this order, for the signed-in user. */
  unread_message_count?: number;
  /** True once the chef has confirmed — the chat exists from then on. */
  chat_available?: boolean;
  /** False once the chat has been closed for more than 24 hours. */
  chat_can_send?: boolean;
}

/** A requested dish line. The server resolves its price and title. */
export interface OrderItemCreate {
  food_listing_id: number;
  quantity: number;
}

export interface OrderCreate {
  quantity: number;
  total_amount: number;
  status?: "PENDING";
  customer_id: string; // Changed to string (firebase_uid)
  chef_id: string;     // Changed to string (firebase_uid)
  /**
   * The whole basket, one entry per distinct dish — a cart is one order.
   * `food_listing_id` below is the legacy single-dish form, still accepted.
   */
  items?: OrderItemCreate[];
  food_listing_id?: number;
  food_request_id?: number;
  delivery_type?: "pickup" | "delivery";
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
    /** Resolved display name from the chefs endpoint (kitchen name, or the chef's name). */
    kitchen_name?: string;
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
  preferred_location_id?: number;
  dietary_tag_ids: number[];
  chef_id?: number;
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

export interface ChefAvailabilityStatus {
  has_schedule: boolean;
  is_open: boolean;
  next_open_day: number | null;        // 0=Mon … 6=Sun
  next_open_day_label: string | null;  // e.g. "Saturday"
  next_open_time: string | null;       // "HH:MM"
}

/** Summary shape returned by the optimized GET /chefs list endpoint. */
/** A dish that caused its chef to match the search term on the Find Chefs page. */
export interface MatchedDish {
  id: number;
  title: string;
  price: number;
  image_url?: string | null;
}

export interface ChefListItem {
  id: number;
  firebase_uid: string;
  name: string;
  /** Public display name resolved by the backend (kitchen name, else the chef's name). */
  kitchen_name?: string;
  email: string;
  chef_profile?: {
    profile_picture_url?: string | null;
    kitchen_name?: string | null;
    rating_avg?: number;
    review_count?: number;
    specialties?: string[];
    dietary_tags?: string[];
    status?: string;
  };
  locations?: {
    id: number;
    address: string;
    latitude: number;
    longitude: number;
    is_primary: boolean;
  }[];
  min_price?: number | null;
  max_price?: number | null;
  active_listings_count?: number;
  is_available?: boolean;
  /** Dishes that matched the search term; empty when the kitchen itself matched. */
  matched_dishes?: MatchedDish[];
  /** Distance from the customer, present only when the search sent lat/lon. */
  distance_km?: number | null;
}

/** Query parameters accepted by the Find Chefs search endpoint. */
export interface ChefSearchParams {
  query?: string;
  cuisine_type_codes?: string[];
  dietary_tag_codes?: string[];
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  available_only?: boolean;
  /**
   * Whatever is chosen, chefs nearest the supplied lat/lon lead the results —
   * there is deliberately no "nearest" option (web 5b58190, backend 62dd409).
   */
  sort?: "relevance" | "topRated" | "priceLow" | "priceHigh";
  lat?: number;
  lon?: number;
  radius_km?: number;
  skip?: number;
  limit?: number;
}

export interface ChefSearchResult {
  chefs: ChefListItem[];
  total: number;
}

export interface PaymentIntentOut {
  payment_id: number;
  client_secret: string;
}
