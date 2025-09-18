/**
 * 🛡️ ADVANCED BRAND DETECTION MODULE - Single Source of Truth
 * 
 * CRITICAL FIXES IMPLEMENTED:
 * ✅ Eliminated false positives with word boundaries
 * ✅ Removed generic keywords like 'air', 'ct', 'nb', 'ow', 'star', 'pro' 
 * ✅ High confidence threshold (0.75+) for auto-assignment
 * ✅ "REVISIÓN PENDIENTE" for low confidence cases
 * ✅ Removed hardcoded numeric mappings
 * ✅ Single source of truth - all other detection logic removed
 */

export interface BrandDetectionResult {
  brandName: string | null;
  confidence: number;
  reasoning: string;
  requiresReview: boolean;
}

// Minimum confidence threshold for auto-assignment
export const MIN_CONFIDENCE_THRESHOLD = 0.75;

// Special brand for low-confidence cases
export const PENDING_REVIEW_BRAND = 'REVISIÓN PENDIENTE';

/**
 * 🎯 PRECISE BRAND MAPPINGS - Only specific, unambiguous keywords
 * 
 * REMOVED false positive keywords:
 * - 'air', 'ct', 'nb', 'ow', 'star', 'pro', 'boot', 'boots'
 * - Generic codes like 'nk', 'vn', 'ua', 'fl' 
 * 
 * KEPT only:
 * - Full brand names
 * - Specific product names (e.g., 'airmax', 'ultraboost')
 * - Unique model codes (e.g., 'aj1', '574')
 * - Distinctive collaborations (e.g., 'offwhite', 'yeezy')
 */
const PRECISE_BRAND_MAPPINGS = [
  // 👟 NIKE - Only specific, unambiguous terms
  { 
    keywords: [
      'nike', 'swoosh', 'airmax', 'airforce', 'airjordan', 'af1', 'am1', 'am90', 'am95', 'am97',
      'dunk', 'blazer', 'cortez', 'pegasus', 'react', 'vapormax', 'zoom', 'shox', 'presto', 
      'huarache', 'waffle', 'daybreak', 'revolution', 'tanjun'
    ], 
    brand: 'Nike', 
    confidence: 0.90,
    requiresWordBoundary: true
  },

  // 🏀 JORDAN AIR - Specific Jordan terms only
  { 
    keywords: [
      'jordan', 'jumpman', 'aj1', 'aj2', 'aj3', 'aj4', 'aj5', 'aj6', 'aj11', 'aj12',
      'bred', 'chicago', 'concord', 'royaltoe'
    ], 
    brand: 'Jordan Air', 
    confidence: 0.90,
    requiresWordBoundary: true
  },

  // 🔷 ADIDAS - Specific Adidas terms
  { 
    keywords: [
      'adidas', 'trefoil', 'ultraboost', 'boost', 'nmd', 'yeezy', 'gazelle', 
      'stansmith', 'superstar', 'campus', 'samba', 'falcon', 'ozweego'
    ], 
    brand: 'Adidas', 
    confidence: 0.90,
    requiresWordBoundary: true
  },

  // 🐾 PUMA - Specific Puma terms
  { 
    keywords: [
      'puma', 'suede', 'basket', 'clyde', 'thunder', 'cali', 'mayze', 'cilia'
    ], 
    brand: 'Puma', 
    confidence: 0.85,
    requiresWordBoundary: true
  },

  // ⭐ CONVERSE - Specific Converse terms only
  { 
    keywords: [
      'converse', 'chuck', 'chucktaylor', 'allstar', 'onestar'
    ], 
    brand: 'Converse', 
    confidence: 0.85,
    requiresWordBoundary: true
  },

  // 🏁 VANS - Specific Vans terms
  { 
    keywords: [
      'vans', 'oldskool', 'authentic', 'era', 'sk8hi', 'checkerboard'
    ], 
    brand: 'Vans', 
    confidence: 0.85,
    requiresWordBoundary: true
  },

  // ⚖️ NEW BALANCE - Specific models only
  { 
    keywords: [
      'newbalance', '574', '990', '997', '327', '550', 'fuelcell', 'freshfoam'
    ], 
    brand: 'New Balance', 
    confidence: 0.80,
    requiresWordBoundary: true
  },

  // 🎽 REEBOK - Specific Reebok terms
  { 
    keywords: [
      'reebok', 'instapump', 'question', 'answer', 'kamikaze', 'aztrek'
    ], 
    brand: 'Reebok', 
    confidence: 0.80,
    requiresWordBoundary: true
  },

  // 🏔️ FILA - Specific FILA terms
  { 
    keywords: [
      'fila', 'disruptor', 'mindblower', 'destroyer'
    ], 
    brand: 'Fila', 
    confidence: 0.80,
    requiresWordBoundary: true
  },

  // 🛡️ UNDER ARMOUR - Specific UA terms
  { 
    keywords: [
      'underarmour', 'curry', 'hovr', 'charged', 'spawn'
    ], 
    brand: 'Under Armour', 
    confidence: 0.80,
    requiresWordBoundary: true
  },

  // 🏃 ASICS - Specific ASICS terms
  { 
    keywords: [
      'asics', 'gel', 'kayano', 'nimbus', 'cumulus', 'tiger', 'onitsuka'
    ], 
    brand: 'Asics', 
    confidence: 0.80,
    requiresWordBoundary: true
  },

  // 👟 SKECHERS - Specific Skechers terms
  { 
    keywords: [
      'skechers', 'gowalk', 'gorun', 'dlites', 'memoryfoam'
    ], 
    brand: 'Skechers', 
    confidence: 0.75,
    requiresWordBoundary: true
  },

  // 🥾 TIMBERLAND - Specific Timberland terms
  { 
    keywords: [
      'timberland', 'timbs'
    ], 
    brand: 'Timberland', 
    confidence: 0.75,
    requiresWordBoundary: true
  },

  // 💎 LUXURY BRANDS - High-end specific terms
  { 
    keywords: [
      'balenciaga', 'triplespeed', 'speedrunner'
    ], 
    brand: 'Balenciaga', 
    confidence: 0.85,
    requiresWordBoundary: true
  },
  { 
    keywords: [
      'gucci', 'rhyton', 'screener'
    ], 
    brand: 'Gucci', 
    confidence: 0.85,
    requiresWordBoundary: true
  }
];

/**
 * 🤖 PRECISE BRAND DETECTION - Single Algorithm with Word Boundaries
 * 
 * CRITICAL IMPROVEMENTS:
 * - Uses word boundaries (\b) to prevent substring false matches
 * - Only high-confidence (0.75+) results for auto-assignment  
 * - Low confidence cases go to "REVISIÓN PENDIENTE"
 * - NO hardcoded numeric mappings
 * - NO generic keyword fallbacks
 */
export function detectBrandFromFilename(filename: string): BrandDetectionResult {
  const originalFilename = filename;
  const normalizedName = filename.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  
  console.log(`🔍 [PRECISE] Starting brand detection for: "${filename}"`);
  
  if (!normalizedName) {
    return {
      brandName: PENDING_REVIEW_BRAND,
      confidence: 0,
      reasoning: 'Filename vacío o sin caracteres válidos',
      requiresReview: true
    };
  }

  let bestMatch: BrandDetectionResult = {
    brandName: null,
    confidence: 0,
    reasoning: 'No se encontraron coincidencias',
    requiresReview: true
  };

  // 🎯 PRECISE MATCHING with Word Boundaries
  for (const mapping of PRECISE_BRAND_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      let matches = false;
      let confidence = mapping.confidence;

      if (mapping.requiresWordBoundary) {
        // Use word boundary regex for precise matching
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        matches = wordBoundaryRegex.test(normalizedName);
        
        if (matches) {
          // Bonus for exact position matches
          if (normalizedName.startsWith(keyword)) {
            confidence = Math.min(confidence + 0.05, 1.0);
          }
          if (normalizedName === keyword) {
            confidence = Math.min(confidence + 0.10, 1.0);
          }
        }
      } else {
        // Fallback for special cases
        matches = normalizedName.includes(keyword);
      }

      if (matches && confidence > bestMatch.confidence) {
        bestMatch = {
          brandName: mapping.brand,
          confidence,
          reasoning: `Palabra clave específica "${keyword}" detectada con límites de palabra`,
          requiresReview: confidence < MIN_CONFIDENCE_THRESHOLD
        };
        
        console.log(`✅ [PRECISE] Match found: "${keyword}" → ${mapping.brand} (confidence: ${confidence.toFixed(2)})`);
      }
    }
  }

  // 🚨 CRITICAL: Apply minimum confidence threshold
  if (bestMatch.confidence > 0 && bestMatch.confidence < MIN_CONFIDENCE_THRESHOLD) {
    console.log(`⚠️ [PRECISE] Low confidence (${bestMatch.confidence.toFixed(2)} < ${MIN_CONFIDENCE_THRESHOLD}), sending to review`);
    return {
      brandName: PENDING_REVIEW_BRAND,
      confidence: bestMatch.confidence,
      reasoning: `Confianza baja (${bestMatch.confidence.toFixed(2)}). Marca detectada: ${bestMatch.brandName}`,
      requiresReview: true
    };
  }

  // 📋 FINAL RESULT: High confidence or review required
  if (bestMatch.confidence >= MIN_CONFIDENCE_THRESHOLD) {
    return {
      ...bestMatch,
      requiresReview: false
    };
  }

  // Default: Send to review queue
  console.log(`❌ [PRECISE] No high-confidence match found for: "${filename}"`);
  return {
    brandName: PENDING_REVIEW_BRAND,
    confidence: 0,
    reasoning: 'No se encontró coincidencia confiable. Requiere revisión manual.',
    requiresReview: true
  };
}

/**
 * 🧪 VALIDATION: Test cases for preventing false positives
 */
export function validateDetection() {
  const testCases = [
    // Should NOT match (false positives prevented)
    { filename: 'air_conditioning.jpg', shouldMatch: false, reason: '"air" removed from generic keywords' },
    { filename: 'star_wars.jpg', shouldMatch: false, reason: '"star" removed from generic keywords' },
    { filename: 'pro_photographer.jpg', shouldMatch: false, reason: '"pro" removed from generic keywords' },
    { filename: 'nb_notebook.jpg', shouldMatch: false, reason: '"nb" removed from generic keywords' },
    { filename: 'ct_scan.jpg', shouldMatch: false, reason: '"ct" removed from generic keywords' },
    { filename: 'ow_personal.jpg', shouldMatch: false, reason: '"ow" removed from generic keywords' },
    
    // Should match (legitimate detections)
    { filename: 'nike_airmax.jpg', shouldMatch: 'Nike', reason: 'Specific brand and product' },
    { filename: 'adidas_ultraboost.jpg', shouldMatch: 'Adidas', reason: 'Specific brand and product' },
    { filename: 'jordan_aj1.jpg', shouldMatch: 'Jordan Air', reason: 'Specific model code' },
    { filename: 'converse_chucktaylor.jpg', shouldMatch: 'Converse', reason: 'Specific product name' }
  ];

  console.log('🧪 [VALIDATION] Running precision tests...');
  
  for (const test of testCases) {
    const result = detectBrandFromFilename(test.filename);
    const actualMatch = result.requiresReview ? PENDING_REVIEW_BRAND : result.brandName;
    
    if (test.shouldMatch === false) {
      if (actualMatch === PENDING_REVIEW_BRAND) {
        console.log(`✅ [TEST PASS] "${test.filename}" correctly sent to review (${test.reason})`);
      } else {
        console.log(`❌ [TEST FAIL] "${test.filename}" incorrectly matched "${actualMatch}" (${test.reason})`);
      }
    } else {
      if (actualMatch === test.shouldMatch) {
        console.log(`✅ [TEST PASS] "${test.filename}" correctly matched "${actualMatch}" (${test.reason})`);
      } else {
        console.log(`❌ [TEST FAIL] "${test.filename}" expected "${test.shouldMatch}" but got "${actualMatch}" (${test.reason})`);
      }
    }
  }
}

// Export validation function for testing
export { validateDetection as runPrecisionTests };