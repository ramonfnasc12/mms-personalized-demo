export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface WeatherOption {
  value: string;
  label: string;
  temp: number;
  condition: string;
}

export interface EventOption {
  value: string;
  label: string;
  description: string;
}

export interface PositionOption {
  value: string;
  label: string;
  lat: number;
  lon: number;
  nearStore: string | null;
}

export interface ActivityProfile {
  value: string;
  label: string;
  recentViews: string[];
  recentPurchases: string[];
  cartItems: string[];
}

export interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface Store {
  storeId: string;
  name: string;
}

export interface Recommendation {
  type: 'recommendation';
  product: Product;
  store: Store;
  message: string;
  score: number;
}

export interface NoRecommendation {
  type: 'no_recommendation';
  message: string;
}

export type NotificationData = Recommendation | NoRecommendation;
