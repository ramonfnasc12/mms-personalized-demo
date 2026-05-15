import type { WeatherOption, EventOption, PositionOption, ActivityProfile } from '../types/index.js';

export const weatherOptions: WeatherOption[] = [
  { value: 'hot_sunny', label: '☀️ Hot & Sunny (35°C)', temp: 35, condition: 'sunny' },
  { value: 'cold_winter', label: '❄️ Cold Winter (-5°C)', temp: -5, condition: 'snowing' },
  { value: 'rainy', label: '🌧️ Rainy (15°C)', temp: 15, condition: 'rainy' },
  { value: 'mild_cloudy', label: '☁️ Mild & Cloudy (18°C)', temp: 18, condition: 'cloudy' },
  { value: 'storm', label: '⛈️ Thunderstorm (22°C)', temp: 22, condition: 'stormy' },
  { value: 'heatwave', label: '🔥 Extreme Heat (40°C)', temp: 40, condition: 'extreme_heat' }
];

export const eventOptions: EventOption[] = [
  { value: 'none', label: 'No special events', description: 'Regular day' },
  { value: 'football_match', label: '⚽ Major Football Match', description: 'Bayern Munich vs. Borussia Dortmund today' },
  { value: 'music_festival', label: '🎵 Music Festival', description: 'Rock am Ring this weekend' },
  { value: 'christmas_market', label: '🎄 Christmas Market', description: 'Local Weihnachtsmarkt open' },
  { value: 'oktoberfest', label: '🍺 Oktoberfest', description: 'Munich beer festival ongoing' },
  { value: 'euro_championship', label: '🏆 UEFA Euro 2026', description: 'Germany hosting matches' },
  { value: 'fifa_world_cup', label: '⚽ FIFA World Cup 2026', description: 'World Cup tournament ongoing' },
  { value: 'heatwave_warning', label: '🌡️ Heatwave Alert', description: 'Official heat warning issued' },
  { value: 'camping_season', label: '🏕️ Summer Holiday Season', description: 'Peak camping/outdoor season' }
];

export const positionOptions: PositionOption[] = [
  { value: 'near_berlin_alex', label: '📍 Near MediaMarkt Berlin Alexanderplatz', lat: 52.5219, lon: 13.4132, nearStore: 'berlin_alexanderplatz' },
  { value: 'near_berlin_mall', label: '📍 Near MediaMarkt Berlin Mall', lat: 52.5097, lon: 13.3833, nearStore: 'berlin_mall_of_berlin' },
  { value: 'near_munich_center', label: '📍 Near MediaMarkt Munich Center', lat: 48.1374, lon: 11.5755, nearStore: 'munich_center' },
  { value: 'near_munich_pasing', label: '📍 Near MediaMarkt Munich Pasing', lat: 48.1500, lon: 11.4614, nearStore: 'munich_pasing' },
  { value: 'near_hamburg', label: '📍 Near MediaMarkt Hamburg', lat: 53.5511, lon: 10.0014, nearStore: 'hamburg' },
  { value: 'near_frankfurt', label: '📍 Near MediaMarkt Frankfurt', lat: 50.1155, lon: 8.6833, nearStore: 'frankfurt' },
  { value: 'near_cologne', label: '📍 Near MediaMarkt Cologne', lat: 50.9364, lon: 6.9472, nearStore: 'cologne' },
  { value: 'near_stuttgart', label: '📍 Near MediaMarkt Stuttgart', lat: 48.7758, lon: 9.1800, nearStore: 'stuttgart' },
  { value: 'near_dusseldorf', label: '📍 Near MediaMarkt Düsseldorf', lat: 51.2277, lon: 6.7833, nearStore: 'dusseldorf' },
  { value: 'rural_bavaria', label: '🏞️ Rural Bavaria (no nearby stores)', lat: 47.8513, lon: 11.1236, nearStore: null },
  { value: 'far_from_all', label: '🚗 Driving between cities', lat: 50.1109, lon: 8.6821, nearStore: null }
];

export const activityProfiles: ActivityProfile[] = [
  {
    value: 'tech_enthusiast',
    label: '💻 Tech Enthusiast',
    recentViews: ['iPhone 15 Pro', 'MacBook Pro', 'AirPods Pro'],
    recentPurchases: ['USB-C Cable', 'Phone Case'],
    cartItems: ['iPad Air']
  },
  {
    value: 'home_entertainment',
    label: '📺 Home Entertainment Seeker',
    recentViews: ['65" OLED TV', 'Soundbar', 'Gaming Console'],
    recentPurchases: ['HDMI Cable'],
    cartItems: ['Universal Remote']
  },
  {
    value: 'outdoor_adventurer',
    label: '🏕️ Outdoor Adventurer',
    recentViews: ['Portable Speaker', 'Power Bank', 'Action Camera'],
    recentPurchases: ['Waterproof Phone Case'],
    cartItems: []
  },
  {
    value: 'smart_home',
    label: '🏠 Smart Home Builder',
    recentViews: ['Smart Thermostat', 'Security Camera', 'Smart Lights'],
    recentPurchases: ['Smart Plug'],
    cartItems: ['Voice Assistant']
  },
  {
    value: 'first_time_buyer',
    label: '🆕 First Time Visitor',
    recentViews: [],
    recentPurchases: [],
    cartItems: []
  }
];
