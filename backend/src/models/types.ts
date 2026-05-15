// GeoJSON Point
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Customer Position (Collection A)
export interface CustomerPosition {
  customerId: string;
  tabId: string;
  position: GeoJSONPoint;
  timestamp: Date;
}

// Customer Activity
export interface CustomerActivity {
  profile: string;
  recentViews: string[];
  recentPurchases: string[];
  cartItems: string[];
}

// Weather Info
export interface WeatherInfo {
  condition: string;
  temperature: number;
  label: string;
}

// Event Info
export interface EventInfo {
  type: string;
  label: string;
  description: string;
}

// Customer Context (Collection B)
export interface CustomerContext {
  customerId: string;
  customerActivity: CustomerActivity;
  weather: WeatherInfo;
  event: EventInfo;
  timestamp: Date;
}

// Store
export interface Store {
  storeId: string;
  name: string;
  position: GeoJSONPoint;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

// Product Inventory Item
export interface InventoryItem {
  storeId: string;
  quantity: number;
}

// Product
export interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inventory: InventoryItem[];
}

// Product with search score (from vector search)
export interface ProductWithScore extends Product {
  searchableText: string;
  score: number;
}

// API Request: Submit Context
export interface SubmitContextRequest {
  customerId: string;
  tabId: string;
  position: GeoJSONPoint;
  weather: WeatherInfo;
  event: EventInfo;
  customerActivity: CustomerActivity;
}

// Queue Items
export interface ProximityQueueItem {
  customerId: string;
  storeId: string;
  tabId: string;
}

export interface NotificationQueueItem {
  customerId: string;
  tabId: string;
  type: 'recommendation' | 'no_recommendation';
  product?: ProductWithScore;
  store?: Store;
  message: string;
  score?: number;
}
