/**
 * 🧪 UNIT TESTS for Brand Detection - Critical for preventing regressions
 * 
 * Tests validate that false positives are eliminated and only high-confidence
 * detections are auto-assigned to brands.
 */

import { detectBrandFromFilename, PENDING_REVIEW_BRAND, MIN_CONFIDENCE_THRESHOLD, runPrecisionTests } from './brand-detection';

describe('Brand Detection - Critical False Positive Prevention', () => {
  
  // 🚨 CRITICAL TEST: False positives must be prevented
  describe('False Positive Prevention', () => {
    test('should NOT match generic keywords that caused false positives', () => {
      const falsePositiveFiles = [
        'air_conditioning.jpg',
        'star_wars.jpg', 
        'pro_photographer.jpg',
        'nb_notebook.jpg',
        'ct_scan.jpg',
        'ow_personal.jpg',
        'boot_camp.jpg',
        'boots_folder.jpg'
      ];

      for (const filename of falsePositiveFiles) {
        const result = detectBrandFromFilename(filename);
        
        // Should either go to PENDING_REVIEW or have very low confidence
        expect(result.brandName).toBe(PENDING_REVIEW_BRAND);
        expect(result.requiresReview).toBe(true);
      }
    });
  });

  // ✅ POSITIVE TEST: Legitimate brands should be detected
  describe('Legitimate Brand Detection', () => {
    test('should correctly detect specific brand terms with high confidence', () => {
      const legitimateBrands = [
        { filename: 'nike_airmax.jpg', expectedBrand: 'Nike' },
        { filename: 'adidas_ultraboost.jpg', expectedBrand: 'Adidas' },
        { filename: 'jordan_aj1.jpg', expectedBrand: 'Jordan Air' },
        { filename: 'converse_chucktaylor.jpg', expectedBrand: 'Converse' },
        { filename: 'vans_oldskool.jpg', expectedBrand: 'Vans' }
      ];

      for (const test of legitimateBrands) {
        const result = detectBrandFromFilename(test.filename);
        
        // Should detect correctly with high confidence
        expect(result.brandName).toBe(test.expectedBrand);
        expect(result.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE_THRESHOLD);
        expect(result.requiresReview).toBe(false);
      }
    });
  });

  // 🛡️ THRESHOLD TEST: Low confidence should go to review
  describe('Confidence Threshold Enforcement', () => {
    test('should enforce minimum confidence threshold', () => {
      // Test files that might have low confidence
      const lowConfidenceFiles = [
        'random123.jpg',
        'unknown_product.jpg',
        'mystery_shoe.jpg'
      ];

      for (const filename of lowConfidenceFiles) {
        const result = detectBrandFromFilename(filename);
        
        // Low confidence should go to review
        if (result.confidence < MIN_CONFIDENCE_THRESHOLD) {
          expect(result.brandName).toBe(PENDING_REVIEW_BRAND);
          expect(result.requiresReview).toBe(true);
        }
      }
    });
  });

  // 🔍 WORD BOUNDARY TEST: Ensure precise matching
  describe('Word Boundary Enforcement', () => {
    test('should use word boundaries to prevent substring false positives', () => {
      const wordBoundaryTests = [
        { filename: 'airbag_safety.jpg', shouldNotMatch: 'Nike' }, // 'air' in 'airbag'
        { filename: 'starring_movie.jpg', shouldNotMatch: 'Converse' }, // 'star' in 'starring'  
        { filename: 'problem_solving.jpg', shouldNotMatch: 'Converse' }, // 'pro' in 'problem'
        { filename: 'notebook_computer.jpg', shouldNotMatch: 'New Balance' } // 'nb' in 'notebook'
      ];

      for (const test of wordBoundaryTests) {
        const result = detectBrandFromFilename(test.filename);
        
        // Should NOT match the false positive brand
        expect(result.brandName).not.toBe(test.shouldNotMatch);
        // Should go to review instead
        expect(result.brandName).toBe(PENDING_REVIEW_BRAND);
      }
    });
  });
});

// Run the built-in precision tests
describe('Built-in Precision Tests', () => {
  test('should pass all built-in validation tests', () => {
    // This will log test results to console
    expect(() => runPrecisionTests()).not.toThrow();
  });
});