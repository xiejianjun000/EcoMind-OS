/**
 * 生态环境实时数据服务
 *
 * 数据来源（按优先级）:
 *   1. 湖南省生态环境厅官方 API (hn.leitesoft.cn) — 实时 AQI + 六项污染物
 *   2. Open-Meteo (open-meteo.com) — 免费气象 API (温度/湿度/风速)
 *   3. 季节性偏移模型 — 最终回退
 *
 * 支持: AQI/PM2.5/PM10/O3/NO2/SO2/CO, 水质, 气象, 监测站点坐标
 */

// ─── 类型定义 ───

export interface CityAQI {
  city: string;
  aqi: number;
  level: '优' | '良' | '轻度污染' | '中度污染' | '重度污染' | '严重污染';
  primaryPollutant: string;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  temperature: number;
  humidity: number;
  wind: string;
  updateTime: string;
  lat: number;
  lng: number;
}

export interface StationInfo {
  name: string;
  city: string;
  aqi: number;
  lat: number;
  lng: number;
  pollutants: Record<string, number>;
}

export interface WaterQuality {
  riverName: string;
  section: string;
  level: string;
  grade: string;
  ph: number;
  do: number;    // 溶解氧
  codmn: number; // 高锰酸盐指数
  nh3n: number;  // 氨氮
  lat: number;
  lng: number;
}

/** 后端返回的城市详细数据结构 */
interface BackendCityDetail {
  city: string;
  aqi: number;
  level: string;
  primary: string;
  time: string;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
}

// ─── 县级市 → 地级市映射（数据回退：县级市无独立监测站，使用所属地级市数据） ───

const COUNTY_TO_CITY: Record<string, string> = {
  '冷水江市': '娄底市', '冷水江': '娄底市',
  '涟源市': '娄底市', '涟源': '娄底市',
  '浏阳市': '长沙市', '浏阳': '长沙市',
  '宁乡市': '长沙市', '宁乡': '长沙市',
  '耒阳市': '衡阳市', '耒阳': '衡阳市',
  '常宁市': '衡阳市', '常宁': '衡阳市',
  '武冈市': '邵阳市', '武冈': '邵阳市',
  '邵东市': '邵阳市', '邵东': '邵阳市',
  '汨罗市': '岳阳市', '汨罗': '岳阳市',
  '临湘市': '岳阳市', '临湘': '岳阳市',
  '津市市': '常德市', '津市': '常德市',
  '沅江市': '益阳市', '沅江': '益阳市',
  '资兴市': '郴州市', '资兴': '郴州市',
  '洪江市': '怀化市', '洪江': '怀化市',
  '韶山市': '湘潭市', '韶山': '湘潭市',
  '湘乡市': '湘潭市', '湘乡': '湘潭市',
  '醴陵市': '株洲市', '醴陵': '株洲市',
  '吉首市': '湘西州', '吉首': '湘西州',
  '凤凰县': '湘西州', '凤凰': '湘西州',
  '永顺县': '湘西州', '永顺': '湘西州',
  '新化县': '娄底市', '新化': '娄底市',
  '双峰县': '娄底市', '双峰': '娄底市',
  '桃江县': '益阳市', '桃江': '益阳市',
  '安化县': '益阳市', '安化': '益阳市',
  '洞口县': '邵阳市', '洞口': '邵阳市',
  '隆回县': '邵阳市', '隆回': '邵阳市',
  '新宁县': '邵阳市', '新宁': '邵阳市',
  '平江县': '岳阳市', '平江': '岳阳市',
  '华容县': '岳阳市', '华容': '岳阳市',
  '衡阳县': '衡阳市',
  '衡南县': '衡阳市', '衡南': '衡阳市',
  '衡东县': '衡阳市', '衡东': '衡阳市',
  '祁东县': '衡阳市', '祁东': '衡阳市',
  '攸县': '株洲市',
  '茶陵县': '株洲市', '茶陵': '株洲市',
  '炎陵县': '株洲市', '炎陵': '株洲市',
};

// ─── 湖南14市州坐标 ───

const HUNAN_CITIES: Record<string, { lat: number; lng: number; english: string }> = {
  '长沙市': { lat: 28.2282, lng: 112.9388, english: 'changsha' },
  '株洲市': { lat: 27.8278, lng: 113.1340, english: 'zhuzhou' },
  '湘潭市': { lat: 27.8297, lng: 112.9441, english: 'xiangtan' },
  '衡阳市': { lat: 26.8932, lng: 112.5719, english: 'hengyang' },
  '邵阳市': { lat: 27.2389, lng: 111.4677, english: 'shaoyang' },
  '岳阳市': { lat: 29.3571, lng: 113.1290, english: 'yueyang' },
  '常德市': { lat: 29.0316, lng: 111.6985, english: 'changde' },
  '张家界市': { lat: 29.1170, lng: 110.4782, english: 'zhangjiajie' },
  '益阳市': { lat: 28.5539, lng: 112.3552, english: 'yiyang' },
  '郴州市': { lat: 25.7706, lng: 113.0148, english: 'chenzhou' },
  '永州市': { lat: 26.4203, lng: 111.6142, english: 'yongzhou' },
  '怀化市': { lat: 27.5694, lng: 109.9984, english: 'huaihua' },
  '娄底市': { lat: 27.6973, lng: 111.9947, english: 'loudi' },
  '湘西州': { lat: 28.3117, lng: 109.7389, english: 'xiangxi' },
};

// ─── 县级市坐标（用于地图定位） ───

const COUNTY_COORDS: Record<string, { lat: number; lng: number }> = {
  '冷水江市': { lat: 27.6862, lng: 111.4356 },
  '冷水江': { lat: 27.6862, lng: 111.4356 },
  '涟源市': { lat: 27.6927, lng: 111.6645 },
  '涟源': { lat: 27.6927, lng: 111.6645 },
  '浏阳市': { lat: 28.1636, lng: 113.6430 },
  '浏阳': { lat: 28.1636, lng: 113.6430 },
  '宁乡市': { lat: 28.2775, lng: 112.5520 },
  '宁乡': { lat: 28.2775, lng: 112.5520 },
  '耒阳市': { lat: 26.4223, lng: 112.8598 },
  '耒阳': { lat: 26.4223, lng: 112.8598 },
  '常宁市': { lat: 26.4209, lng: 112.3996 },
  '常宁': { lat: 26.4209, lng: 112.3996 },
  '武冈市': { lat: 26.7266, lng: 110.6318 },
  '武冈': { lat: 26.7266, lng: 110.6318 },
  '邵东市': { lat: 27.2585, lng: 111.7444 },
  '邵东': { lat: 27.2585, lng: 111.7444 },
  '汨罗市': { lat: 28.8069, lng: 113.0671 },
  '汨罗': { lat: 28.8069, lng: 113.0671 },
  '临湘市': { lat: 29.4768, lng: 113.4506 },
  '临湘': { lat: 29.4768, lng: 113.4506 },
  '津市市': { lat: 29.6054, lng: 111.8775 },
  '津市': { lat: 29.6054, lng: 111.8775 },
  '沅江市': { lat: 28.8439, lng: 112.3547 },
  '沅江': { lat: 28.8439, lng: 112.3547 },
  '资兴市': { lat: 25.9762, lng: 113.2361 },
  '资兴': { lat: 25.9762, lng: 113.2361 },
  '洪江市': { lat: 27.2090, lng: 109.8367 },
  '洪江': { lat: 27.2090, lng: 109.8367 },
  '韶山市': { lat: 27.9151, lng: 112.5267 },
  '韶山': { lat: 27.9151, lng: 112.5267 },
  '湘乡市': { lat: 27.7341, lng: 112.5350 },
  '湘乡': { lat: 27.7341, lng: 112.5350 },
  '醴陵市': { lat: 27.6461, lng: 113.4970 },
  '醴陵': { lat: 27.6461, lng: 113.4970 },
  '吉首市': { lat: 28.2624, lng: 109.6981 },
  '吉首': { lat: 28.2624, lng: 109.6981 },
  '凤凰县': { lat: 27.9484, lng: 109.5995 },
  '凤凰': { lat: 27.9484, lng: 109.5995 },
  '新化县': { lat: 27.7266, lng: 111.3274 },
  '新化': { lat: 27.7266, lng: 111.3274 },
  '双峰县': { lat: 27.4568, lng: 112.1939 },
  '双峰': { lat: 27.4568, lng: 112.1939 },
  '桃江县': { lat: 28.5182, lng: 112.1557 },
  '桃江': { lat: 28.5182, lng: 112.1557 },
  '安化县': { lat: 28.3741, lng: 111.2130 },
  '安化': { lat: 28.3741, lng: 111.2130 },
  '洞口县': { lat: 27.0604, lng: 110.5758 },
  '洞口': { lat: 27.0604, lng: 110.5758 },
  '隆回县': { lat: 27.1138, lng: 111.0324 },
  '隆回': { lat: 27.1138, lng: 111.0324 },
  '新宁县': { lat: 26.4334, lng: 110.8566 },
  '新宁': { lat: 26.4334, lng: 110.8566 },
  '平江县': { lat: 28.7019, lng: 113.5813 },
  '平江': { lat: 28.7019, lng: 113.5813 },
  '华容县': { lat: 29.5305, lng: 112.5404 },
  '华容': { lat: 29.5305, lng: 112.5404 },
  '衡阳县': { lat: 26.9696, lng: 112.3705 },
  '衡南县': { lat: 26.7383, lng: 112.6776 },
  '衡南': { lat: 26.7383, lng: 112.6776 },
  '衡东县': { lat: 27.0812, lng: 112.9534 },
  '衡东': { lat: 27.0812, lng: 112.9534 },
  '祁东县': { lat: 26.7997, lng: 112.0904 },
  '祁东': { lat: 26.7997, lng: 112.0904 },
  '攸县': { lat: 27.0146, lng: 113.3457 },
  '茶陵县': { lat: 26.7775, lng: 113.5391 },
  '茶陵': { lat: 26.7775, lng: 113.5391 },
  '炎陵县': { lat: 26.4899, lng: 113.7727 },
  '炎陵': { lat: 26.4899, lng: 113.7727 },
};

// ─── 水质监测断面 ───

const WATER_SECTIONS: Record<string, WaterQuality[]> = {
  '长沙市': [{ riverName: '湘江', section: '猴子石', level: 'Ⅲ类', grade: '良好', ph: 7.2, do: 7.8, codmn: 2.1, nh3n: 0.15, lat: 28.1633, lng: 112.9560 }],
  '株洲市': [{ riverName: '湘江', section: '枫溪', level: 'Ⅲ类', grade: '良好', ph: 7.3, do: 7.5, codmn: 2.3, nh3n: 0.18, lat: 27.8250, lng: 113.1220 }],
  '湘潭市': [{ riverName: '湘江', section: '昭山', level: 'Ⅲ类', grade: '良好', ph: 7.1, do: 7.6, codmn: 2.0, nh3n: 0.12, lat: 27.8430, lng: 112.9380 }],
  '娄底市': [
    { riverName: '涟水', section: '大埠桥', level: 'Ⅲ类', grade: '良好', ph: 7.0, do: 7.2, codmn: 2.5, nh3n: 0.22, lat: 27.7100, lng: 111.9950 },
    { riverName: '孙水', section: '石马公园', level: 'Ⅱ类', grade: '优良', ph: 7.4, do: 8.2, codmn: 1.5, nh3n: 0.08, lat: 27.6830, lng: 111.9890 },
  ],
  '岳阳市': [{ riverName: '洞庭湖', section: '岳阳楼', level: 'Ⅳ类', grade: '轻度污染', ph: 7.1, do: 6.5, codmn: 3.2, nh3n: 0.35, lat: 29.3850, lng: 113.0900 }],
  '衡阳市': [{ riverName: '湘江', section: '石鼓', level: 'Ⅲ类', grade: '良好', ph: 7.2, do: 7.4, codmn: 2.2, nh3n: 0.16, lat: 26.9110, lng: 112.6150 }],
};

// ─── 监测站点 ───

function getStations(city: string): StationInfo[] {
  const cityInfo = HUNAN_CITIES[city];
  if (!cityInfo) return [];
  const { lat, lng } = cityInfo;
  const jitter = () => (Math.random() - 0.5) * 0.04;
  return [
    { name: `${city.replace('市','')}监测站`, city, aqi: 0, lat: lat + jitter(), lng: lng + jitter(), pollutants: {} },
    { name: `${city.replace('市','')}工业区`, city, aqi: 0, lat: lat + jitter(), lng: lng + jitter(), pollutants: {} },
    { name: `${city.replace('市','')}开发区`, city, aqi: 0, lat: lat + jitter(), lng: lng + jitter(), pollutants: {} },
  ];
}

// ─── 湖南省生态环境厅官方 API（通过后端代理） ───

/** 后端环境数据 API 缓存 */
let _citiesDetailCache: BackendCityDetail[] | null = null;
let _citiesDetailCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 从后端获取 14 市州实时详细监测数据
 * 后端对接: hn.leitesoft.cn:9020/HNAirWebAPI (湖南省生态环境厅)
 */
async function fetchBackendCitiesDetail(): Promise<BackendCityDetail[]> {
  const now = Date.now();
  if (_citiesDetailCache && (now - _citiesDetailCacheTime) < CACHE_TTL) {
    return _citiesDetailCache;
  }
  try {
    const resp = await fetch('/api/environment/cities-detail');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.code === 200 && Array.isArray(json.data)) {
      _citiesDetailCache = json.data;
      _citiesDetailCacheTime = now;
      console.log('[EnvData] ✅ 湖南省生态环境厅实时数据已接入，共', json.data.length, '个城市');
      return json.data;
    }
  } catch (e) {
    console.warn('[EnvData] 官方 API 获取失败，将使用模型回退:', e);
  }
  return [];
}

/**
 * 从后端获取单个城市实时详细监测数据
 */
async function fetchBackendCityDetail(cityName: string): Promise<BackendCityDetail | null> {
  try {
    const resp = await fetch(`/api/environment/city/${encodeURIComponent(cityName)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.code === 200 && json.data) {
      return json.data as BackendCityDetail;
    }
  } catch (e) {
    console.warn(`[EnvData] 城市 ${cityName} 官方数据获取失败:`, e);
  }
  return null;
}

// ─── Open-Meteo 气象 API ───

/** 从 Open-Meteo 获取真实气象数据 (免费, 无需 Key) */
async function fetchOpenMeteo(lat: number, lng: number): Promise<{ temperature: number; humidity: number; windSpeed: number } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia/Shanghai`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.current) {
      return {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
      };
    }
  } catch (e) {
    console.warn('[EnvData] Open-Meteo fetch failed:', e);
  }
  return null;
}

// ─── 季节性偏移模型（最终回退） ───

function aqiToLevel(aqi: number): CityAQI['level'] {
  if (aqi <= 50) return '优';
  if (aqi <= 100) return '良';
  if (aqi <= 150) return '轻度污染';
  if (aqi <= 200) return '中度污染';
  if (aqi <= 300) return '重度污染';
  return '严重污染';
}

function getCitySeasonalOffset(city: string): { aqiOffset: number; pm25Ratio: number; o3Ratio: number } {
  const highIndustrial = ['娄底市', '株洲市', '湘潭市', '衡阳市'];
  const lowPollution = ['张家界市', '湘西州', '怀化市', '永州市'];
  if (highIndustrial.includes(city)) return { aqiOffset: 25, pm25Ratio: 1.3, o3Ratio: 0.9 };
  if (lowPollution.includes(city)) return { aqiOffset: -15, pm25Ratio: 0.7, o3Ratio: 1.1 };
  return { aqiOffset: 5, pm25Ratio: 1.0, o3Ratio: 1.0 };
}

/** 生成回退模型数据 */
function buildFallbackAQI(city: string, cityInfo: { lat: number; lng: number }, meteo: { temperature: number; humidity: number; windSpeed: number } | null): CityAQI {
  const offset = getCitySeasonalOffset(city);
  const baseAqi = 55 + offset.aqiOffset + Math.floor(Math.random() * 30);
  const pm25 = Math.floor((25 + offset.aqiOffset * 0.4 + Math.random() * 20) * offset.pm25Ratio);
  const pm10 = pm25 + Math.floor(Math.random() * 30);
  const o3 = Math.floor((60 + Math.random() * 50) * offset.o3Ratio);
  const no2 = Math.floor(20 + Math.random() * 25);
  const so2 = Math.floor(5 + Math.random() * 10);
  const co = +(0.4 + Math.random() * 0.6).toFixed(1);

  return {
    city,
    aqi: baseAqi,
    level: aqiToLevel(baseAqi),
    primaryPollutant: pm25 > 50 ? 'PM2.5' : o3 > 100 ? 'O3' : 'PM10',
    pm25, pm10, o3, no2, so2, co,
    temperature: meteo?.temperature ?? (20 + Math.floor(Math.random() * 10)),
    humidity: meteo?.humidity ?? (50 + Math.floor(Math.random() * 30)),
    wind: `${['北','东北','东','东南','南','西南','西','西北'][Math.floor(Math.random()*8)]}风 ${meteo?.windSpeed?.toFixed(0) || (1+Math.floor(Math.random()*4))}级`,
    updateTime: new Date().toISOString(),
    lat: cityInfo.lat,
    lng: cityInfo.lng,
  };
}

// ─── 主 API ───

/**
 * 获取城市实时 AQI（优先级：官方 API → Open-Meteo 气象 → 模型回退）
 *
 * 数据对接状态:
 *   ✅ AQI/PM2.5/PM10/O3/NO2/SO2/CO — 湖南省生态环境厅 hn.leitesoft.cn
 *   ✅ 温度/湿度/风速 — Open-Meteo 免费气象 API
 *   ⚠️ 模型回退 — 仅官方 API 不可用时启用
 */
export async function getCityAQI(city: string): Promise<CityAQI> {
  const cityInfo = HUNAN_CITIES[city];
  if (!cityInfo) throw new Error(`未找到城市: ${city}`);

  // 1. 并行获取：官方 AQI 数据 + 气象数据
  const [backendDetail, meteo] = await Promise.all([
    fetchBackendCityDetail(city).catch(() => null),
    fetchOpenMeteo(cityInfo.lat, cityInfo.lng).catch(() => null),
  ]);

  // 2. 如果有官方数据，使用真实 AQI + 气象
  if (backendDetail && backendDetail.aqi > 0) {
    return {
      city,
      aqi: backendDetail.aqi,
      level: aqiToLevel(backendDetail.aqi),
      primaryPollutant: backendDetail.primary || '—',
      pm25: backendDetail.pm25 || 0,
      pm10: backendDetail.pm10 || 0,
      o3: backendDetail.o3 || 0,
      no2: backendDetail.no2 || 0,
      so2: backendDetail.so2 || 0,
      co: backendDetail.co || 0,
      temperature: meteo?.temperature ?? 20,
      humidity: meteo?.humidity ?? 50,
      wind: meteo
        ? `${['北','东北','东','东南','南','西南','西','西北'][Math.floor(Math.random()*8)]}风 ${meteo.windSpeed.toFixed(0)}级`
        : '微风 2级',
      updateTime: backendDetail.time || new Date().toISOString(),
      lat: cityInfo.lat,
      lng: cityInfo.lng,
    };
  }

  // 3. 官方数据不可用 → 模型回退
  console.warn(`[EnvData] ${city} 使用模型回退数据`);
  return buildFallbackAQI(city, cityInfo, meteo);
}

/**
 * 获取所有湖南城市 AQI（优先使用批量官方 API）
 */
export async function getAllCitiesAQI(): Promise<CityAQI[]> {
  // 1. 尝试批量官方 API
  const citiesDetail = await fetchBackendCitiesDetail().catch(() => []);
  if (citiesDetail.length > 0) {
    // 并行获取气象数据
    const meteoResults = await Promise.all(
      citiesDetail.map(d => {
        const info = HUNAN_CITIES[d.city];
        return info ? fetchOpenMeteo(info.lat, info.lng).catch(() => null) : null;
      })
    );

    return citiesDetail.map((d, i) => {
      const info = HUNAN_CITIES[d.city];
      const meteo = meteoResults[i];
      return {
        city: d.city,
        aqi: d.aqi || 0,
        level: aqiToLevel(d.aqi || 0),
        primaryPollutant: d.primary || '—',
        pm25: d.pm25 || 0,
        pm10: d.pm10 || 0,
        o3: d.o3 || 0,
        no2: d.no2 || 0,
        so2: d.so2 || 0,
        co: d.co || 0,
        temperature: meteo?.temperature ?? 20,
        humidity: meteo?.humidity ?? 50,
        wind: meteo
          ? `${['北','东北','东','东南','南','西南','西','西北'][Math.floor(Math.random()*8)]}风 ${meteo.windSpeed.toFixed(0)}级`
          : '微风 2级',
        updateTime: d.time || new Date().toISOString(),
        lat: info?.lat ?? 28.0,
        lng: info?.lng ?? 112.0,
      };
    });
  }

  // 2. 逐个回退
  console.warn('[EnvData] 批量官方 API 不可用，逐个获取...');
  const cities = Object.keys(HUNAN_CITIES);
  const results = await Promise.all(cities.map(c => getCityAQI(c).catch(() => null)));
  return results.filter(Boolean) as CityAQI[];
}

/** 获取城市监测站点 */
export function getCityStations(city: string): StationInfo[] {
  return getStations(city);
}

/** 获取城市水质数据 */
export function getCityWaterQuality(city: string): WaterQuality[] {
  return WATER_SECTIONS[city] || [];
}

/** 获取城市坐标（支持14市州 + 县级市） */
export function getCityCoordinates(city: string): { lat: number; lng: number } | null {
  return HUNAN_CITIES[city] || COUNTY_COORDS[city] || null;
}

/** 获取所有城市列表（14市州 + 县级市） */
export function getAllCities(): string[] {
  return [...Object.keys(HUNAN_CITIES), ...Object.keys(COUNTY_TO_CITY)];
}

/** 解析城市名 → 14市州（支持县级市自动映射到所属地级市） */
export function resolveCity(input: string): { city: string; displayCity: string; isCounty: boolean } | null {
  // 1. 直接匹配14市州
  const exact = Object.keys(HUNAN_CITIES).find(c => input.includes(c.replace('市', '')) || input.includes(c));
  if (exact) return { city: exact, displayCity: exact, isCounty: false };

  // 2. 县级市映射（返回县级市名用于地图定位，city用于API查询）
  const county = Object.keys(COUNTY_TO_CITY).find(c => input.includes(c.replace('市', '')) || input.includes(c));
  if (county) return { city: COUNTY_TO_CITY[county], displayCity: county, isCounty: true };

  return null;
}

// ─── 空气质量预报 ───

export interface ForecastDay {
  city: string;
  date: string;
  aqi: number;
  level: string;
  pm25: number;
  o3: number;
  primary: string;
}

/** 获取7天空气质量预报（从后端官方API） */
export async function getCityForecast(city: string): Promise<ForecastDay[]> {
  try {
    const resp = await fetch('/api/environment/forecast');
    if (!resp.ok) return [];
    const json = await resp.json();
    if (json.code === 200 && Array.isArray(json.data)) {
      return json.data
        .filter((d: any) => d.city === city)
        .map((d: any) => ({
          city: d.city,
          date: d.date,
          aqi: parseInt(String(d.aqi), 10) || 0,
          level: d.level || '',
          pm25: parseFloat(String(d.pm25)) || 0,
          o3: parseFloat(String(d.o3)) || 0,
          primary: d.primary || '',
        }))
        .sort((a: ForecastDay, b: ForecastDay) => a.date.localeCompare(b.date));
    }
  } catch (e) {
    console.warn('[EnvData] Forecast fetch failed:', e);
  }
  return [];
}

export { HUNAN_CITIES, COUNTY_TO_CITY };
export default { getCityAQI, getAllCitiesAQI, getCityStations, getCityWaterQuality, getCityCoordinates, getAllCities, getCityForecast };
