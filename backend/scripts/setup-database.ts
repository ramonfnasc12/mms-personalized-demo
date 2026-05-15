import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'mms_demo';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  console.error('Please create a .env file in the backend directory with:');
  console.error('MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/');
  process.exit(1);
}

const storesData = [
  {
    storeId: 'berlin_alexanderplatz',
    name: 'MediaMarkt Berlin Alexanderplatz',
    position: { type: 'Point', coordinates: [13.4132, 52.5219] },
    address: { street: 'Alexanderplatz 9', city: 'Berlin', postalCode: '10178', country: 'Germany' }
  },
  {
    storeId: 'berlin_mall_of_berlin',
    name: 'MediaMarkt Berlin Mall of Berlin',
    position: { type: 'Point', coordinates: [13.3833, 52.5097] },
    address: { street: 'Leipziger Platz 12', city: 'Berlin', postalCode: '10117', country: 'Germany' }
  },
  {
    storeId: 'munich_center',
    name: 'MediaMarkt München Hauptbahnhof',
    position: { type: 'Point', coordinates: [11.5755, 48.1374] },
    address: { street: 'Bahnhofplatz 7', city: 'München', postalCode: '80335', country: 'Germany' }
  },
  {
    storeId: 'munich_pasing',
    name: 'MediaMarkt München Pasing',
    position: { type: 'Point', coordinates: [11.4614, 48.1500] },
    address: { street: 'Landsberger Straße 439', city: 'München', postalCode: '81241', country: 'Germany' }
  },
  {
    storeId: 'hamburg',
    name: 'MediaMarkt Hamburg Mönckebergstraße',
    position: { type: 'Point', coordinates: [10.0014, 53.5511] },
    address: { street: 'Mönckebergstraße 1', city: 'Hamburg', postalCode: '20095', country: 'Germany' }
  },
  {
    storeId: 'frankfurt',
    name: 'MediaMarkt Frankfurt Zeil',
    position: { type: 'Point', coordinates: [8.6833, 50.1155] },
    address: { street: 'Zeil 127-135', city: 'Frankfurt', postalCode: '60313', country: 'Germany' }
  },
  {
    storeId: 'cologne',
    name: 'MediaMarkt Köln Hohe Straße',
    position: { type: 'Point', coordinates: [6.9472, 50.9364] },
    address: { street: 'Hohe Straße 39-49', city: 'Köln', postalCode: '50667', country: 'Germany' }
  },
  {
    storeId: 'stuttgart',
    name: 'MediaMarkt Stuttgart Königstraße',
    position: { type: 'Point', coordinates: [9.1800, 48.7758] },
    address: { street: 'Königstraße 6', city: 'Stuttgart', postalCode: '70173', country: 'Germany' }
  },
  {
    storeId: 'dusseldorf',
    name: 'MediaMarkt Düsseldorf Schadowstraße',
    position: { type: 'Point', coordinates: [6.7833, 51.2277] },
    address: { street: 'Schadowstraße 11', city: 'Düsseldorf', postalCode: '40212', country: 'Germany' }
  }
];

const productsDataBase = [
  // Hot Weather Products
  {
    productId: 'fan_tower_001',
    name: 'Dyson Cool Tower Fan',
    description: 'Powerful tower fan with air multiplier technology, perfect for hot summer days. Bladeless design, oscillation, remote control.',
    price: 349.99,
    category: 'cooling',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 5 }))
  },
  {
    productId: 'ac_portable_001',
    name: 'De\'Longhi Portable Air Conditioner',
    description: 'Mobile air conditioning unit with 12000 BTU cooling power. Ideal for rooms up to 35m². Easy installation, energy efficient.',
    price: 499.99,
    category: 'cooling',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 3 }))
  },
  {
    productId: 'cooler_electric_001',
    name: 'Dometic Electric Cooler Box',
    description: 'Portable electric cooler for keeping drinks and food cold. 40L capacity, 12V/230V operation, perfect for hot days.',
    price: 279.99,
    category: 'cooling',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 4 }))
  },
  {
    productId: 'fan_desk_001',
    name: 'Honeywell Desk Fan',
    description: 'Compact desk fan with adjustable speed settings. Quiet operation, ideal for offices and small spaces during heat.',
    price: 39.99,
    category: 'cooling',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 20) + 10 }))
  },
  {
    productId: 'mist_fan_001',
    name: 'Personal Misting Fan',
    description: 'Handheld battery-powered fan with water mist function. Perfect for outdoor activities in extreme heat.',
    price: 24.99,
    category: 'cooling',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 25) + 15 }))
  },

  // Cold Weather Products
  {
    productId: 'heater_oil_001',
    name: 'De\'Longhi Oil-Filled Radiator',
    description: 'Energy-efficient oil-filled radiator heater. Silent operation, thermostat control, perfect for cold winter days.',
    price: 149.99,
    category: 'heating',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 5 }))
  },
  {
    productId: 'heater_ceramic_001',
    name: 'Rowenta Ceramic Heater',
    description: 'Compact ceramic space heater with adjustable thermostat. Fast heating, safety tip-over switch, ideal for cold rooms.',
    price: 79.99,
    category: 'heating',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'blanket_electric_001',
    name: 'Beurer Electric Blanket',
    description: 'Cozy electric heated blanket with 6 temperature settings. Machine washable, overheating protection for cold nights.',
    price: 59.99,
    category: 'heating',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 18) + 10 }))
  },
  {
    productId: 'weather_station_001',
    name: 'Netatmo Weather Station',
    description: 'Smart home weather station tracking indoor and outdoor temperature, humidity, air quality. Perfect for weather monitoring.',
    price: 179.99,
    category: 'weather_monitoring',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },

  // Rainy Weather Products
  {
    productId: 'speaker_waterproof_001',
    name: 'JBL Flip 6 Waterproof Speaker',
    description: 'Portable Bluetooth speaker with IP67 waterproof rating. 12-hour battery life, powerful sound for any weather.',
    price: 129.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 20) + 10 }))
  },
  {
    productId: 'umbrella_smart_001',
    name: 'Smart Connected Umbrella',
    description: 'High-tech umbrella with weather alerts via smartphone app. LED handle, wind-resistant design for rainy days.',
    price: 49.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'projector_home_001',
    name: 'Epson Home Cinema Projector',
    description: 'Full HD home projector for indoor entertainment. Perfect for movie nights during rainy weather. 3500 lumens brightness.',
    price: 799.99,
    category: 'entertainment',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 6) + 2 }))
  },
  {
    productId: 'console_nintendo_001',
    name: 'Nintendo Switch OLED',
    description: 'Gaming console with vibrant OLED screen. Perfect indoor entertainment for rainy days with family and friends.',
    price: 349.99,
    category: 'gaming',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 5 }))
  },

  // Sports Event Products (Football, Euro, World Cup)
  {
    productId: 'tv_65_oled_001',
    name: 'LG 65" OLED evo C4',
    description: 'Premium 65-inch OLED TV with 4K resolution. Perfect for watching football matches with stunning picture quality and sports mode.',
    price: 1899.99,
    category: 'tv',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  },
  {
    productId: 'tv_55_qled_001',
    name: 'Samsung 55" QLED 4K TV',
    description: 'QLED TV with quantum dot technology. Excellent for sports viewing with motion enhancement and vibrant colors.',
    price: 899.99,
    category: 'tv',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 5 }))
  },
  {
    productId: 'soundbar_atmos_001',
    name: 'Sonos Arc Soundbar',
    description: 'Premium soundbar with Dolby Atmos. Immersive audio for sports broadcasts, bringing stadium atmosphere home.',
    price: 899.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'soundbar_samsung_001',
    name: 'Samsung HW-Q700C Soundbar',
    description: '3.1.2ch soundbar with wireless subwoofer. Enhanced sports audio mode for exciting match viewing experience.',
    price: 449.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'speaker_party_001',
    name: 'JBL PartyBox 310',
    description: 'Powerful portable party speaker with 240W output. Perfect for football watch parties with friends. Built-in light show.',
    price: 499.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  },

  // Music Festival Products
  {
    productId: 'powerbank_large_001',
    name: 'Anker PowerCore 26800mAh',
    description: 'High-capacity portable charger. Multiple charges for smartphone at festivals. Fast charging, dual USB ports.',
    price: 79.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 20) + 12 }))
  },
  {
    productId: 'camera_action_001',
    name: 'GoPro HERO12 Black',
    description: 'Waterproof action camera for capturing festival memories. 5.3K video, image stabilization, rugged design.',
    price: 449.99,
    category: 'cameras',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'headphones_noise_cancel_001',
    name: 'Sony WH-1000XM5',
    description: 'Premium noise-cancelling headphones. Ideal for traveling to festivals or enjoying music with exceptional sound quality.',
    price: 399.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'earbuds_wireless_001',
    name: 'Apple AirPods Pro (2nd Gen)',
    description: 'True wireless earbuds with active noise cancellation. Perfect for festivals, compact and comfortable fit.',
    price: 279.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 18) + 10 }))
  },

  // Camping/Outdoor Products
  {
    productId: 'speaker_outdoor_001',
    name: 'Ultimate Ears BOOM 3',
    description: 'Rugged waterproof Bluetooth speaker for outdoor adventures. 15-hour battery, 360-degree sound, perfect for camping.',
    price: 149.99,
    category: 'audio',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'powerbank_solar_001',
    name: 'Solar Power Bank 30000mAh',
    description: 'Solar-powered portable charger with LED flashlight. Essential for camping trips and outdoor activities.',
    price: 59.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 6 }))
  },
  {
    productId: 'light_camping_001',
    name: 'LED Camping Lantern',
    description: 'Rechargeable LED lantern with power bank function. 1000 lumens brightness, perfect for camping and emergencies.',
    price: 39.99,
    category: 'outdoor',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 20) + 10 }))
  },
  {
    productId: 'gps_outdoor_001',
    name: 'Garmin GPS Outdoor Navigator',
    description: 'Rugged handheld GPS with topographic maps. Perfect for hiking and outdoor navigation during camping season.',
    price: 349.99,
    category: 'outdoor',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  },

  // Christmas Market Products
  {
    productId: 'lights_smart_001',
    name: 'Philips Hue Smart Light Starter Kit',
    description: 'Smart LED lighting system with app control. Create festive Christmas atmosphere at home with customizable colors.',
    price: 199.99,
    category: 'smart_home',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'assistant_alexa_001',
    name: 'Amazon Echo Dot (5th Gen)',
    description: 'Smart speaker with Alexa voice assistant. Play Christmas music, control smart home devices, perfect gift idea.',
    price: 59.99,
    category: 'smart_home',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 25) + 15 }))
  },
  {
    productId: 'camera_instant_001',
    name: 'Fujifilm Instax Mini 12',
    description: 'Instant camera for capturing Christmas market memories. Fun gift idea, prints photos instantly.',
    price: 79.99,
    category: 'cameras',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 18) + 10 }))
  },

  // General Tech Products
  {
    productId: 'phone_iphone_001',
    name: 'Apple iPhone 15 Pro',
    description: 'Latest iPhone with A17 Pro chip, titanium design, advanced camera system. Premium smartphone experience.',
    price: 1199.99,
    category: 'smartphones',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 5 }))
  },
  {
    productId: 'phone_samsung_001',
    name: 'Samsung Galaxy S24',
    description: 'Flagship Android phone with AI features, stunning AMOLED display, and excellent camera performance.',
    price: 899.99,
    category: 'smartphones',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'laptop_macbook_001',
    name: 'Apple MacBook Air M3',
    description: '13-inch laptop with M3 chip. Perfect for work and entertainment, exceptional battery life and performance.',
    price: 1299.99,
    category: 'laptops',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  },
  {
    productId: 'laptop_dell_001',
    name: 'Dell XPS 13 Plus',
    description: 'Premium Windows laptop with Intel Core i7, 13.4" display. Sleek design for productivity and portability.',
    price: 1499.99,
    category: 'laptops',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'tablet_ipad_001',
    name: 'Apple iPad Air (6th Gen)',
    description: '11-inch tablet with M2 chip. Versatile device for work, entertainment, and creativity.',
    price: 599.99,
    category: 'tablets',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'watch_smart_001',
    name: 'Apple Watch Series 10',
    description: 'Advanced smartwatch with health monitoring, fitness tracking, and seamless iPhone integration.',
    price: 449.99,
    category: 'wearables',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 18) + 10 }))
  },
  {
    productId: 'watch_garmin_001',
    name: 'Garmin Fenix 7 Pro',
    description: 'Rugged GPS smartwatch for outdoor enthusiasts. Advanced fitness features, long battery life.',
    price: 699.99,
    category: 'wearables',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'router_wifi_001',
    name: 'ASUS RT-AX86U WiFi 6 Router',
    description: 'High-performance WiFi 6 router for home networking. Fast speeds, excellent coverage, gaming optimization.',
    price: 249.99,
    category: 'networking',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 6 }))
  },
  {
    productId: 'thermostat_smart_001',
    name: 'Nest Learning Thermostat',
    description: 'Smart thermostat that learns your schedule. Energy-efficient climate control for home comfort.',
    price: 249.99,
    category: 'smart_home',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 5 }))
  },
  {
    productId: 'camera_security_001',
    name: 'Ring Video Doorbell Pro 2',
    description: 'Smart video doorbell with HD+ video, 3D motion detection. Enhanced home security with smartphone alerts.',
    price: 279.99,
    category: 'smart_home',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'vacuum_robot_001',
    name: 'iRobot Roomba j7+',
    description: 'Smart robot vacuum with self-emptying base. AI-powered obstacle avoidance, perfect for automated cleaning.',
    price: 799.99,
    category: 'appliances',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  },
  {
    productId: 'coffee_maker_001',
    name: 'De\'Longhi Magnifica S',
    description: 'Automatic bean-to-cup coffee machine. Perfect espresso and cappuccino at home with adjustable settings.',
    price: 449.99,
    category: 'appliances',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'keyboard_mech_001',
    name: 'Logitech MX Mechanical',
    description: 'Premium mechanical keyboard with smart backlighting. Comfortable typing for work and productivity.',
    price: 169.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'mouse_wireless_001',
    name: 'Logitech MX Master 3S',
    description: 'Ergonomic wireless mouse with precision tracking. Perfect for productivity and comfortable extended use.',
    price: 109.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 20) + 12 }))
  },
  {
    productId: 'monitor_4k_001',
    name: 'Dell UltraSharp 27" 4K Monitor',
    description: 'Professional 4K monitor with IPS panel. Excellent color accuracy for work and entertainment.',
    price: 599.99,
    category: 'monitors',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 10) + 4 }))
  },
  {
    productId: 'webcam_4k_001',
    name: 'Logitech Brio 4K Webcam',
    description: 'Professional 4K webcam with HDR and autofocus. Perfect for video calls and streaming.',
    price: 199.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'microphone_usb_001',
    name: 'Blue Yeti USB Microphone',
    description: 'Professional USB microphone for streaming, podcasting, and video calls. Studio-quality sound.',
    price: 129.99,
    category: 'accessories',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 12) + 6 }))
  },
  {
    productId: 'drone_001',
    name: 'DJI Mini 3 Pro',
    description: 'Compact drone with 4K camera and obstacle avoidance. Perfect for aerial photography and outdoor adventures.',
    price: 759.99,
    category: 'cameras',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 6) + 2 }))
  },
  {
    productId: 'ereader_001',
    name: 'Amazon Kindle Paperwhite',
    description: 'E-reader with glare-free display and weeks of battery life. Perfect for indoor reading on rainy days.',
    price: 149.99,
    category: 'entertainment',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 15) + 8 }))
  },
  {
    productId: 'vr_headset_001',
    name: 'Meta Quest 3',
    description: 'Advanced VR headset with mixed reality. Immersive gaming and entertainment experience.',
    price: 549.99,
    category: 'gaming',
    inventory: storesData.map(s => ({ storeId: s.storeId, quantity: Math.floor(Math.random() * 8) + 3 }))
  }
];

async function setupDatabase() {
  const client = new MongoClient(MONGODB_URI!);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db: Db = client.db(MONGODB_DATABASE);

    console.log(`\nSetting up database: ${MONGODB_DATABASE}`);
    console.log('─'.repeat(50));

    // Drop existing collections
    console.log('\n1. Cleaning up existing collections...');
    const existingCollections = await db.listCollections().toArray();
    const collectionNames = existingCollections.map(c => c.name);

    for (const collName of ['customerPosition', 'customerContext', 'stores', 'products']) {
      if (collectionNames.includes(collName)) {
        await db.collection(collName).drop();
        console.log(`  ✓ Dropped collection: ${collName}`);
      }
    }

    // Create collections
    console.log('\n2. Creating collections...');
    await db.createCollection('customerPosition');
    console.log('  ✓ Created customerPosition');

    await db.createCollection('customerContext');
    console.log('  ✓ Created customerContext');

    await db.createCollection('stores');
    console.log('  ✓ Created stores');

    await db.createCollection('products');
    console.log('  ✓ Created products');

    // Create indexes
    console.log('\n3. Creating indexes...');

    // 2dsphere index on stores.position
    await db.collection('stores').createIndex({ position: '2dsphere' });
    console.log('  ✓ Created 2dsphere index on stores.position');

    // Index on customerContext.customerId
    await db.collection('customerContext').createIndex({ customerId: 1 });
    console.log('  ✓ Created index on customerContext.customerId');

    // Seed stores
    console.log('\n4. Seeding stores data...');
    const storesResult = await db.collection('stores').insertMany(storesData);
    console.log(`  ✓ Inserted ${storesResult.insertedCount} stores`);

    // Seed products
    console.log('\n5. Seeding products data...');
    const productsResult = await db.collection('products').insertMany(productsDataBase);
    console.log(`  ✓ Inserted ${productsResult.insertedCount} products`);

    // Create view for products_searchable
    console.log('\n6. Creating products_searchable view...');
    await db.createCollection('products_searchable', {
      viewOn: 'products',
      pipeline: [
        {
          $set: {
            searchableText: {
              $concat: ['$name', ' - ', '$description']
            }
          }
        }
      ]
    });
    console.log('  ✓ Created products_searchable view');

    // Print summary
    console.log('\n' + '─'.repeat(50));
    console.log('✅ Database setup completed successfully!');
    console.log('─'.repeat(50));
    console.log('\nSummary:');
    console.log(`  Database: ${MONGODB_DATABASE}`);
    console.log(`  Collections: 4 (customerPosition, customerContext, stores, products)`);
    console.log(`  Stores: ${storesData.length}`);
    console.log(`  Products: ${productsDataBase.length}`);
    console.log(`  Indexes: 2 (stores.position 2dsphere, customerContext.customerId)`);

    console.log('\n📝 Next Steps:');
    console.log('  1. Create vector search index on products_searchable view via Atlas UI:');
    console.log('     - Go to Atlas → Database → Search → Create Search Index');
    console.log('     - Choose "JSON Editor"');
    console.log('     - Database: mms_demo');
    console.log('     - Collection/View: products_searchable');
    console.log('     - Index Name: products_vector_index');
    console.log('     - Use this definition:');
    console.log(`
     {
       "fields": [
         {
           "type": "autoEmbed",
           "modality": "text",
           "path": "searchableText",
           "model": "voyage-4"
         }
       ]
     }
    `);
    console.log('\n  2. Test the setup by running queries from the backend');

  } catch (error) {
    console.error('\n❌ Error during database setup:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Closed MongoDB connection');
  }
}

setupDatabase();
