-- FC-036: Biomarkers — schema, seed content, and storage bucket
--
-- MANUAL STEP: Create the 'biomarker-documents' storage bucket in the Supabase
-- dashboard → Storage → New bucket. Set to private (not public).
-- Bucket-level RLS policies must be configured separately in the dashboard;
-- the table-level policies below govern definitions, documents, and results only.

-- ─── biomarker_definitions ─────────────────────────────────────────────────────

CREATE TABLE biomarker_definitions (
  key                       TEXT        PRIMARY KEY,
  name                      TEXT        NOT NULL,
  section                   TEXT        NOT NULL  CHECK (section IN ('quarterly', 'annual', 'one_time')),
  sub_group                 TEXT        NULL,
  target_direction          TEXT        NOT NULL  CHECK (target_direction IN ('above', 'below', 'between', 'qualitative')),
  target_min                NUMERIC     NULL,
  target_max                NUMERIC     NULL,
  unit                      TEXT        NULL,
  explanation               TEXT        NOT NULL,
  protocol_notes            TEXT        NULL,
  default_cadence_months    INTEGER     NULL,
  personal_target_min       NUMERIC     NULL,
  personal_target_max       NUMERIC     NULL,
  personal_target_direction TEXT        NULL  CHECK (personal_target_direction IS NULL OR personal_target_direction IN ('above', 'below', 'between', 'qualitative')),
  display_order             INTEGER     NOT NULL,
  CONSTRAINT biomarker_definitions_target_check CHECK (
    (target_direction = 'qualitative' AND target_min IS NULL AND target_max IS NULL) OR
    (target_direction = 'between'     AND target_min IS NOT NULL AND target_max IS NOT NULL) OR
    (target_direction IN ('above', 'below'))
  )
);

ALTER TABLE biomarker_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biomarker_definitions_select"
  ON biomarker_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "biomarker_definitions_insert"
  ON biomarker_definitions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "biomarker_definitions_update"
  ON biomarker_definitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "biomarker_definitions_delete"
  ON biomarker_definitions FOR DELETE TO authenticated USING (true);

-- ─── biomarker_documents ───────────────────────────────────────────────────────

CREATE TABLE biomarker_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  measured_date       DATE        NOT NULL,
  provider            TEXT        NOT NULL  CHECK (provider IN ('thriva', 'medichecks', 'randox', 'nhs', 'other')),
  provider_other_text TEXT        NULL,
  file_url            TEXT        NOT NULL,
  file_name           TEXT        NOT NULL,
  notes               TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE biomarker_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biomarker_documents_select"
  ON biomarker_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "biomarker_documents_insert"
  ON biomarker_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "biomarker_documents_update"
  ON biomarker_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "biomarker_documents_delete"
  ON biomarker_documents FOR DELETE TO authenticated USING (true);

-- ─── biomarker_results ─────────────────────────────────────────────────────────
-- sub_marker_key identifies which sub-marker within a compound panel
-- (e.g. 'testosterone_total', 'hdl'). Null for single-value markers.

CREATE TABLE biomarker_results (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  biomarker_key           TEXT        NOT NULL REFERENCES biomarker_definitions(key),
  sub_marker_key          TEXT        NULL,
  measured_date           DATE        NOT NULL,
  value                   NUMERIC     NULL,
  value_text              TEXT        NULL,
  notes                   TEXT        NULL,
  source_document_id      UUID        NULL REFERENCES biomarker_documents(id) ON DELETE SET NULL,
  cadence_override_months INTEGER     NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX biomarker_results_key_date_idx
  ON biomarker_results (biomarker_key, measured_date DESC);

ALTER TABLE biomarker_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biomarker_results_select"
  ON biomarker_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "biomarker_results_insert"
  ON biomarker_results FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "biomarker_results_update"
  ON biomarker_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "biomarker_results_delete"
  ON biomarker_results FOR DELETE TO authenticated USING (true);

-- ─── Seed: biomarker_definitions ──────────────────────────────────────────────

INSERT INTO biomarker_definitions
  (key, name, section, sub_group, target_direction, target_min, target_max, unit,
   explanation, protocol_notes, default_cadence_months, display_order)
VALUES

-- Quarterly / diet ─────────────────────────────────────────────────────────────

( 'fasting_glucose',
  'Fasting glucose',
  'quarterly', 'diet', 'below', NULL, 5.0, 'mmol/L',
  'How well the body clears sugar after meals. Persistently elevated readings damage arteries, kidneys, and eyes over years before symptoms appear. Target: below 5.0 mmol/L.',
  'Match carb intake to activity level (higher on training days, lower on rest days); eat protein and vegetables before carbs; biggest carb meal after training.',
  3, 1 ),

( 'hs_crp',
  'HS-CRP',
  'quarterly', 'diet', 'below', NULL, 1, 'mg/L',
  'A measure of systemic inflammation. Largest drivers: processed seed oils and refined carbohydrates. Total food volume matters too.',
  'Shift toward wild-caught fish, grass-fed meat, pasture-raised eggs, extra virgin olive oil; supplement options to consider — 500 mg curcumin with black pepper daily, 3 g omega-3 daily.',
  3, 2 ),

( 'apob',
  'ApoB',
  'quarterly', 'diet', 'below', NULL, 0.80, 'g/L',
  'Counts the actual particles that lodge in artery walls. More direct cardiovascular risk predictor than standard LDL. Target: below 0.80 g/L.',
  'Shift fats toward olive oil and avocado over butter and coconut oil; add soluble fibres (oats, beans, lentils); supplement option — 500 mg berberine before the heaviest meal of the day.',
  3, 3 ),

-- Quarterly / body ─────────────────────────────────────────────────────────────

( 'triglycerides',
  'Triglycerides',
  'quarterly', 'body', 'below', NULL, 1.1, 'mmol/L',
  'When carb intake exceeds what the body uses, the liver converts the surplus to fat and releases it into the bloodstream. The carb-timing approach for fasting glucose usually pulls this down too.',
  NULL,
  3, 4 ),

( 'testosterone',
  'Testosterone',
  'quarterly', 'body', 'qualitative', NULL, NULL, NULL,
  'Drives energy, recovery, muscle mass, motivation. Multiple independent levers: dietary fat below 60 g/day suppresses production; zinc, boron, and vitamin D deficiency each suppress it.',
  'Keep dietary fat above 60 g daily (3 pasture-raised eggs + half avocado covers it); options to consider — 50 mg zinc picolinate, 3 mg boron, 300 mg ashwagandha cycled monthly, 2000 IU vitamin D3 with K2.',
  3, 5 ),

( 'vitamin_d',
  'Vitamin D',
  'quarterly', 'body', 'between', 75, 150, 'nmol/L',
  'Below 75 nmol/L, hormone production suffers across the board. Endogenous synthesis is unreliable in the UK Nov–March. Target: 75–150 nmol/L.',
  '2000 IU vitamin D3 daily with K2, alongside the fattiest meal of the day. Retest after 12 weeks of consistent supplementation.',
  3, 6 ),

( 'iron_panel',
  'Iron panel',
  'quarterly', 'body', 'qualitative', NULL, NULL, NULL,
  'Endurance athletes routinely run low — foot-strike haemolysis destroys red blood cells, and increased plasma volume dilutes stores. Ferritin is the early-warning marker; haemoglobin drops later.',
  'Liver regularly (cap at 200 g/week due to vitamin A), or supplement iron with vitamin C; take separately from coffee, tea, or calcium-containing meals.',
  3, 7 ),

( 'b12_b9',
  'Vitamin B12 + B9',
  'quarterly', 'body', 'qualitative', NULL, NULL, NULL,
  'Deficiency presents as fatigue and reduced exercise tolerance; plant-based and restricted-diet athletes most at risk.',
  'If carrying MTHFR variants, use methylfolate and methylcobalamin rather than synthetic folic acid and cyanocobalamin.',
  3, 8 ),

( 'omega3_index',
  'Omega-3 index',
  'quarterly', 'body', 'above', 8, NULL, '%',
  'A long-term measure — reflects intake over 3–4 months. Below 4% associated with elevated cardiovascular risk; 8%+ is cardioprotective.',
  '3 g combined EPA + DHA daily; third-party tested for heavy metals and oxidation. Retest after 16 weeks.',
  3, 9 ),

( 'standard_lipid_panel',
  'Standard lipid panel',
  'quarterly', 'body', 'qualitative', NULL, NULL, NULL,
  'The full lipid picture alongside ApoB. ApoB is the more direct cardiovascular predictor, but the standard panel provides supporting context.',
  'Same levers as ApoB. Total cholesterol in isolation is weak signal; interpret in the context of ApoB and HDL together.',
  3, 10 ),

-- Annual ───────────────────────────────────────────────────────────────────────

( 'dexa_scan',
  'DEXA scan',
  'annual', NULL, 'qualitative', NULL, NULL, NULL,
  'The standard for body composition — separates fat, lean mass, and bone density with location precision (visceral vs subcutaneous, leg vs trunk). Daily scale weight cannot do this.',
  'For runners, particular attention to bone density — long-duration aerobic work can compete with bone-building. Resistance training and adequate vitamin D and calcium are the primary levers.',
  12, 11 ),

( 'vo2_max_lab',
  'VO2 Max — lab test',
  'annual', NULL, 'above', NULL, NULL, 'ml/kg/min',
  'The gold standard for cardiovascular fitness, distinct from Whoop / Garmin estimates. Lab tests use direct gas exchange.',
  'Responds to a mix of zone 2 base volume and zone 4–5 interval intensity. Direction of training depends on current ceiling.',
  12, 12 ),

-- One time ─────────────────────────────────────────────────────────────────────

( 'genetic_test',
  'Genetic test',
  'one_time', NULL, 'qualitative', NULL, NULL, NULL,
  'One-off test shaping lifestyle prescription. Tells you caffeine metabolism speed (informs cutoff time), lactase persistence, carb-vs-fat preference, and B-vitamin form requirement. UK options: MyHeritage Health, 23andMe with third-party analysis. These don''t change — never needs to be redone.',
  NULL,
  NULL, 13 ),

( 'gut_microbiome',
  'Gut microbiome test',
  'one_time', NULL, 'qualitative', NULL, NULL, NULL,
  'Stool sample analysis. Identifies dominant strains and diversity score — useful baseline before sustained dietary or supplement intervention targeted at gut health. UK option: Atlas Biomed. Most useful as a baseline; repeating frequently has diminishing utility.',
  NULL,
  NULL, 14 ),

( 'food_intolerance',
  'Food intolerance / sensitivity',
  'one_time', NULL, 'qualitative', NULL, NULL, NULL,
  'Measures IgG antibody reactions to common foods. Identifies low-grade inflammatory response even without acute symptoms. Common reactors: gluten, dairy, eggs, soy, corn. UK option: YorkTest. If multiple foods within one family show reactive, consider removing the whole family. Re-introduce after 6–12 weeks of avoidance and watch for original symptoms.',
  NULL,
  NULL, 15 ),

( 'toxin_panel',
  'Toxin / heavy metal panel',
  'one_time', NULL, 'qualitative', NULL, NULL, NULL,
  'Hair or urine analysis for heavy metal accumulation. Relevant if regular tuna / large-fish consumption, older dental amalgam fillings. UK option: Hair Mineral Analysis (Trace Elements UK). Elevated heavy metals are slow to clear — supplementation protocols best undertaken with practitioner oversight.',
  NULL,
  NULL, 16 );
