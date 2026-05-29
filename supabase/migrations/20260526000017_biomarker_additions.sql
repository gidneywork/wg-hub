-- HE-002 c1: 12 new biomarker_definitions from Thriva panel (sample 27 May 2026).
-- Reference ranges are from the Thriva PDF verbatim.
-- FAI: 'between' not 'qualitative' — CHECK constraint enforces 'qualitative → both null',
--      so 'between' is the only way to preserve the Thriva reference range.
--      Prior 'qualitative' ratification overridden per HE-002 audit ratification.
-- personal_target_* left NULL across all 12 markers (v2.3 §05 design).
-- FLAG: apply manually to Supabase, then run the verification SELECT before data entry.

INSERT INTO biomarker_definitions
  (key, name, section, sub_group, target_direction, target_min, target_max, unit,
   explanation, protocol_notes, default_cadence_months, display_order)
VALUES

( 'albumin',
  'Albumin',
  'quarterly', 'body', 'between', 35.0, 50.0, 'g/L',
  'Major protein synthesised by the liver. Below-range values indicate impaired liver synthetic function or low protein intake; a reliable marker of overall nutritional status and liver health.',
  NULL,
  12, 17 ),

( 'alkaline_phosphatase',
  'Alkaline phosphatase',
  'quarterly', 'body', 'between', 30.0, 130.0, 'U/L',
  'Enzyme present in liver, bone, and bile ducts. Elevated readings may indicate bile duct obstruction, liver disease, or increased bone turnover. Interpret alongside other liver markers.',
  NULL,
  12, 18 ),

( 'alanine_transferase',
  'Alanine transferase (ALT)',
  'quarterly', 'body', 'between', 0.0, 45.0, 'U/L',
  'Liver-specific enzyme released when liver cells are damaged. The primary blood marker for non-alcoholic fatty liver disease, alcohol-related liver stress, and medication-induced hepatitis.',
  'A sustained reduction in alcohol, fructose, and ultra-processed food typically lowers ALT within 8–12 weeks. Weight loss has a strong independent effect on ALT in NAFLD.',
  12, 19 ),

( 'apolipoprotein_a1',
  'Apolipoprotein A1',
  'quarterly', 'diet', 'above', 1.250, NULL, 'g/L',
  'Main structural protein of HDL particles. Higher levels are associated with lower cardiovascular risk. Works alongside ApoB — the ApoB:ApoA1 ratio provides a stronger cardiovascular risk signal than either alone.',
  'Same dietary levers as ApoB: shift toward unsaturated fats (olive oil, avocado), add soluble fibre (oats, lentils). Regular aerobic exercise raises ApoA1 independently of diet.',
  6, 20 ),

( 'bilirubin',
  'Bilirubin',
  'quarterly', 'body', 'between', 0.0, 20.9999, 'µmol/L',
  'Breakdown product of red blood cell destruction, processed by the liver. Elevated values may indicate haemolysis, liver dysfunction, or bile duct obstruction. Mildly elevated readings in isolation are common and often benign (Gilbert''s syndrome).',
  NULL,
  12, 21 ),

( 'total_chol_hdl_ratio',
  'Total cholesterol/HDL ratio',
  'quarterly', 'diet', 'between', 0.0, 4.0, 'ratio',
  'Combined cardiovascular risk marker. A lower ratio indicates a more favourable balance of total cholesterol to protective HDL. More clinically useful than total cholesterol alone.',
  'Same dietary levers as ApoB. Regular aerobic exercise raises HDL and improves the ratio independently of dietary fat changes.',
  6, 22 ),

( 'free_androgen_index',
  'Free Androgen Index',
  'quarterly', 'body', 'between', 35.0, 92.6, '%',
  'Calculated ratio of total testosterone to SHBG, estimating biologically available androgen. A low FAI with normal total testosterone indicates high SHBG binding, reducing androgen activity at the cell level. Evidence base is weaker than for total testosterone; interpret in context.',
  'Dietary fat above 60 g/day supports testosterone production. Zinc, vitamin D, and managing excess body fat each reduce SHBG. Ashwagandha at 300 mg/day (cycled monthly) may modestly lower SHBG.',
  6, 23 ),

( 'free_thyroxine',
  'Free thyroxine (FT4)',
  'quarterly', 'body', 'between', 12.0, 22.0, 'pmol/L',
  'Active thyroid hormone governing metabolic rate, temperature regulation, and energy availability. Low FT4 with elevated TSH indicates hypothyroidism; elevated FT4 with suppressed TSH indicates hyperthyroidism.',
  'If out of range, assess selenium status (required for T4→T3 conversion), iodine intake, and consider thyroid antibody testing (TPO-Ab, TG-Ab).',
  6, 24 ),

( 'gamma_gt',
  'Gamma-GT',
  'quarterly', 'body', 'between', 0.0, 54.9999, 'U/L',
  'Sensitive early marker of liver stress, particularly from alcohol consumption, non-alcoholic fatty liver disease, and certain medications. Often elevated before ALT and ALP in the setting of regular alcohol use.',
  'Primary lever is alcohol reduction. Responds well to weight loss and dietary improvements targeting liver fat.',
  12, 25 ),

( 'globulin',
  'Globulin',
  'quarterly', 'body', 'between', 19.0, 35.0, 'g/L',
  'Group of proteins including immunoglobulins (antibodies) and transport proteins. Derived as total protein minus albumin. Elevated globulin may indicate chronic infection, inflammation, or liver disease; low globulin is uncommon.',
  NULL,
  12, 26 ),

( 'active_b12',
  'Active B12',
  'quarterly', 'body', 'above', 70.0, NULL, 'pmol/L',
  'Holotranscobalamin — the biologically active fraction of B12 that cells can take up. More sensitive early marker of deficiency than total serum B12. Target: above 70 pmol/L. Thriva assay ceiling is 150 pmol/L; results at or above the ceiling are recorded as >150.',
  'Methylcobalamin supplementation preferred over cyanocobalamin for absorption; sublingual 1000 µg improves uptake. MTHFR variants require methylcobalamin specifically.',
  3, 27 ),

( 'apob_apoa1_ratio',
  'ApoB:ApoA1 ratio',
  'quarterly', 'diet', 'below', NULL, 0.8, 'ratio',
  'Ratio of ApoB (atherogenic particle count) to ApoA1 (HDL particles). A stronger predictor of cardiovascular risk than either ApoB or ApoA1 alone. Target: below 0.80.',
  'Same dietary levers as ApoB. ApoA1 is raised by regular aerobic exercise; both levers improve the ratio in parallel.',
  6, 28 );
