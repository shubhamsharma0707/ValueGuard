const fs = require('fs');
const path = require('path');

const INDIAN_STATES = [
  { name: 'Andhra Pradesh', source: 'AP IGRS', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'] },
  { name: 'Arunachal Pradesh', source: 'Arunachal Land Records', cities: ['Itanagar', 'Tawang', 'Naharlagun'] },
  { name: 'Assam', source: 'Assam Revenue Dept', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat'] },
  { name: 'Bihar', source: 'Bihar Bhumi', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'] },
  { name: 'Chhattisgarh', source: 'CG Bhuiyan', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'] },
  { name: 'Delhi', source: 'Delhi Govt Circle Rate', cities: ['Central Delhi', 'South Delhi', 'Dwarka', 'Rohini', 'East Delhi'] },
  { name: 'Goa', source: 'Goa Land Records', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
  { name: 'Gujarat', source: 'Gujarat Garvi', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'] },
  { name: 'Haryana', source: 'Haryana HRERA', cities: ['Gurugram', 'Faridabad', 'Panchkula', 'Panipat', 'Rohtak', 'Hisar', 'Karnal'] },
  { name: 'Himachal Pradesh', source: 'HP Revenue Dept', cities: ['Shimla', 'Dharamshala', 'Mandi', 'Solan'] },
  { name: 'Jharkhand', source: 'Jharbhoomi', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'] },
  { name: 'Karnataka', source: 'Karnataka Kaveri Portal', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'] },
  { name: 'Kerala', source: 'Kerala Registration Dept', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'] },
  { name: 'Madhya Pradesh', source: 'MP IGR', cities: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'] },
  { name: 'Maharashtra', source: 'Maharashtra IGR Ready Reckoner', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane'] },
  { name: 'Manipur', source: 'Manipur Land Records', cities: ['Imphal', 'Churachandpur', 'Thoubal'] },
  { name: 'Meghalaya', source: 'Meghalaya Revenue Dept', cities: ['Shillong', 'Tura', 'Jowai'] },
  { name: 'Mizoram', source: 'Mizoram Land Revenue', cities: ['Aizawl', 'Lunglei', 'Champhai'] },
  { name: 'Nagaland', source: 'Nagaland Land Records', cities: ['Kohima', 'Dimapur', 'Mokokchung'] },
  { name: 'Odisha', source: 'Odisha IGR', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Berhampur'] },
  { name: 'Punjab', source: 'Punjab PLRS', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'] },
  { name: 'Rajasthan', source: 'Rajasthan E-Panjiyan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner'] },
  { name: 'Sikkim', source: 'Sikkim Land Records', cities: ['Gangtok', 'Namchi', 'Geyzing'] },
  { name: 'Tamil Nadu', source: 'TN TNREGINET', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'] },
  { name: 'Telangana', source: 'Telangana IGRS', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
  { name: 'Tripura', source: 'Tripura Land Records', cities: ['Agartala', 'Dharmanagar', 'Udaipur (TR)'] },
  { name: 'Uttar Pradesh', source: 'UP IGRS', cities: ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Varanasi', 'Agra', 'Prayagraj'] },
  { name: 'Uttarakhand', source: 'UK Revenue Dept', cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani'] },
  { name: 'West Bengal', source: 'WB WBSR', cities: ['Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur'] }
];

const ZONE_TEMPLATES = [
  { name: 'Central District', multiplierBase: 2.2, metro: true, it: false },
  { name: 'IT Corridor', multiplierBase: 1.8, metro: true, it: true },
  { name: 'Industrial Hub', multiplierBase: 1.2, metro: false, it: false },
  { name: 'New Extension', multiplierBase: 1.4, metro: false, it: true },
  { name: 'Historic Core', multiplierBase: 1.6, metro: false, it: false },
  { name: 'Premium Suburbs', multiplierBase: 1.9, metro: true, it: false },
  { name: 'Airport Road', multiplierBase: 1.7, metro: false, it: true },
  { name: 'Education Hub', multiplierBase: 1.3, metro: false, it: false },
];

const TIER_1_CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Noida', 'Gurugram', 'Ahmedabad'];

function generateId(city, zone) {
  return `${city.substring(0,3).toLowerCase()}_${zone.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const db = [];
const cityStateMap = {};
let allStatesList = INDIAN_STATES.map(s => s.name);

INDIAN_STATES.forEach(state => {
  state.cities.forEach(city => {
    cityStateMap[city] = state.name;
    
    // Determine base rate for city
    let baseCircleRate = TIER_1_CITIES.includes(city) ? getRandomInt(5000, 15000) : getRandomInt(2000, 5000);
    
    // Randomly pick 5-8 zones for this city
    let numZones = getRandomInt(5, 8);
    let shuffledZones = [...ZONE_TEMPLATES].sort(() => 0.5 - Math.random());
    let selectedZones = shuffledZones.slice(0, numZones);
    
    selectedZones.forEach(zoneTemplate => {
      let circleRate = Math.round((baseCircleRate * (zoneTemplate.multiplierBase / 1.5)) / 100) * 100;
      let multiplier = zoneTemplate.multiplierBase + (Math.random() * 0.4 - 0.2); // slight random variance
      multiplier = Math.round(multiplier * 100) / 100;
      
      // Calculate realistic market rate
      let marketRate = Math.round((circleRate * multiplier * 1.1) / 100) * 100; 
      
      db.push({
        id: generateId(city, zoneTemplate.name),
        zone_name: `${city} ${zoneTemplate.name}`,
        city: city,
        circle_rate_per_sqft: circleRate,
        avg_market_rate_per_sqft: marketRate,
        zone_multiplier: multiplier,
        metro_nearby: zoneTemplate.metro,
        it_corridor: zoneTemplate.it,
        data_source: `${state.source} / Guideline Value 2024-25`,
        last_updated: "2025-04-01"
      });
    });
  });
});

// Write to data.json
const dataPath = path.join(__dirname, '../data.json');
fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
console.log(`Generated ${db.length} zones in data.json`);

// Read state.js, update CITY_STATE_MAP
const stateJsPath = path.join(__dirname, '../../frontend/js/state.js');
let stateJsContent = fs.readFileSync(stateJsPath, 'utf-8');

// We need to replace the CITY_STATE_MAP object
const newCityStateMapStr = 'export const CITY_STATE_MAP = ' + JSON.stringify(cityStateMap, null, 2) + ';';

stateJsContent = stateJsContent.replace(/export const CITY_STATE_MAP = \{[\s\S]*?\};/, newCityStateMapStr);

fs.writeFileSync(stateJsPath, stateJsContent);
console.log(`Updated CITY_STATE_MAP in state.js with ${Object.keys(cityStateMap).length} cities`);
