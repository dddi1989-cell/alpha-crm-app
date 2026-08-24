/**
 * Korean Standard Lunar-Solar Calendar Conversion Algorithm (1900 - 2100)
 * Provides accurate Lunar <-> Solar date conversions and birthday calculations.
 */

// Lunar Calendar Bitmask Data (1900 - 2100)
// Each entry encodes: 
// - lower 12 bits: month days (0 = 29 days, 1 = 30 days)
// - upper 4 bits: leap month number (0 = no leap month)
// - additional bit for leap month days (29 or 30)
const LUNAR_DATA = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0, // 2050-2059
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520 // 2100
];

// Helper functions for Lunar bitmask
function getLunarYearDays(year) {
  let sum = 348;
  const data = LUNAR_DATA[year - 1900];
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (data & i) ? 1 : 0;
  }
  return sum + getLeapMonthDays(year);
}

function getLeapMonth(year) {
  return LUNAR_DATA[year - 1900] & 0xf;
}

function getLeapMonthDays(year) {
  if (getLeapMonth(year)) {
    return (LUNAR_DATA[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function getLunarMonthDays(year, month) {
  return (LUNAR_DATA[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

/**
 * Convert Lunar date to Solar (Gregorian) date
 * @param {number} lYear - Lunar year (e.g. 2026)
 * @param {number} lMonth - Lunar month (1 - 12)
 * @param {number} lDay - Lunar day (1 - 30)
 * @param {boolean} isLeap - Is leap month
 * @returns {{ year: number, month: number, day: number }} Solar date (month is 1-12)
 */
export function lunarToSolar(lYear, lMonth, lDay, isLeap = false) {
  if (lYear < 1900 || lYear > 2100) {
    return { year: lYear, month: lMonth, day: lDay };
  }

  // Base date: 1900-01-31 is Lunar 1900-01-01
  let offset = 0;

  for (let i = 1900; i < lYear; i++) {
    offset += getLunarYearDays(i);
  }

  const leap = getLeapMonth(lYear);
  let isLeapMonthPassed = false;

  for (let m = 1; m < lMonth; m++) {
    offset += getLunarMonthDays(lYear, m);
    if (m === leap) {
      offset += getLeapMonthDays(lYear);
      isLeapMonthPassed = true;
    }
  }

  if (isLeap && leap === lMonth) {
    offset += getLunarMonthDays(lYear, lMonth);
  }

  offset += (lDay - 1);

  // Base date UTC calculation
  const baseDate = new Date(Date.UTC(1900, 0, 31));
  baseDate.setUTCDate(baseDate.getUTCDate() + offset);

  return {
    year: baseDate.getUTCFullYear(),
    month: baseDate.getUTCMonth() + 1,
    day: baseDate.getUTCDate()
  };
}

/**
 * Parses customer birth date and returns this year's Solar birthday info
 * @param {object} customer 
 * @param {number} targetYear 
 * @returns {{ year: number, month: number, day: number, isLunar: boolean, originalStr: string } | null}
 * Note: month is 0-indexed (0 = Jan, 11 = Dec) to match JavaScript Date object
 */
export function getSolarBirthdayInYear(customer, targetYear = new Date().getFullYear()) {
  if (!customer || !customer.birth_date) return null;

  const raw = String(customer.birth_date).trim();
  const parts = raw.split('-');
  if (parts.length < 3) return null;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10); // 1-12
  const birthDay = parseInt(parts[2], 10);   // 1-31

  if (isNaN(birthMonth) || isNaN(birthDay)) return null;

  const isLunar = customer.birth_type === 'lunar';

  if (!isLunar) {
    // Standard Solar Birthday
    return {
      year: targetYear,
      month: birthMonth - 1, // 0-indexed
      day: birthDay,
      isLunar: false,
      originalStr: `${birthMonth}월 ${birthDay}일`
    };
  }

  // Lunar Birthday: Convert this targetYear's lunar (birthMonth, birthDay) into Solar
  try {
    const solarRes = lunarToSolar(targetYear, birthMonth, birthDay, false);
    return {
      year: solarRes.year,
      month: solarRes.month - 1, // 0-indexed
      day: solarRes.day,
      isLunar: true,
      originalStr: `음력 ${birthMonth}월 ${birthDay}일 (양력 ${solarRes.month}월 ${solarRes.day}일)`
    };
  } catch (err) {
    // Fallback to solar
    return {
      year: targetYear,
      month: birthMonth - 1,
      day: birthDay,
      isLunar: true,
      originalStr: `음력 ${birthMonth}월 ${birthDay}일`
    };
  }
}

/**
 * Check if the given Solar date (year, month: 0-indexed, day) is customer's birthday
 */
export function isCustomerBirthdayOnDate(customer, year, month0Indexed, day) {
  const bday = getSolarBirthdayInYear(customer, year);
  if (!bday) return false;
  return bday.month === month0Indexed && bday.day === day;
}
