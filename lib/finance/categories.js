/**
 * All system category slugs.
 * Values match the slug column in finance_categories.
 * Used by the parser and rules engine to resolve category_id without a DB round-trip.
 */
export const CATEGORY_SLUGS = {
  income:          'income',
  salary:          'salary',
  freelance:       'freelance',
  housing:         'housing',
  rent_mortgage:   'rent_mortgage',
  council_tax:     'council_tax',
  utilities:       'utilities',
  gas_electricity: 'gas_electricity',
  water:           'water',
  broadband:       'broadband',
  mobile:          'mobile',
  food_drink:      'food_drink',
  groceries:       'groceries',
  eating_out:      'eating_out',
  transport:       'transport',
  fuel:            'fuel',
  public_transport:'public_transport',
  personal:        'personal',
  fitness_sport:   'fitness_sport',
  entertainment:   'entertainment',
  subscriptions:   'subscriptions',
  financial:       'financial',
  insurance:       'insurance',
  bank_fees:       'bank_fees',
  cash_withdrawal: 'cash_withdrawal',
  transfer:        'transfer',
}

/**
 * Finds a category row by its slug from a loaded categories array.
 * @param {Array<{ id: string, slug: string, name: string, kind: string, parent_id: string|null }>} categories
 * @param {string} slug
 * @returns {{ id: string, slug: string, name: string, kind: string, parent_id: string|null } | undefined}
 */
export function getCategoryBySlug(categories, slug) {
  return categories.find(c => c.slug === slug)
}

/**
 * Returns the top-level parent category for a given category row.
 * If the category has no parent, returns the category itself.
 * @param {Array<{ id: string, parent_id: string|null }>} categories
 * @param {{ id: string, parent_id: string|null }} category
 * @returns {{ id: string, slug: string, name: string }}
 */
export function getRootCategory(categories, category) {
  if (!category.parent_id) return category
  const parent = categories.find(c => c.id === category.parent_id)
  return parent ? getRootCategory(categories, parent) : category
}

export const MATCHER_FIELD_LABELS = {
  description:    'Description',
  merchant_clean: 'Merchant',
}

export const MATCH_TYPE_LABELS = {
  contains:    'Contains',
  starts_with: 'Starts with',
  exact:       'Exact match',
  regex:       'Regex pattern (advanced)',
}

/**
 * Validates a category rule form. Returns an error string or null if valid.
 * @param {{ match_value: string, match_field: string, match_type: string, category_id: string }} form
 * @returns {string|null}
 */
export function validateRuleForm(form) {
  if (!form.match_value?.trim()) return 'Pattern is required.'
  if (!form.match_field) return 'Field is required.'
  if (!form.match_type) return 'Match type is required.'
  if (!form.category_id) return 'Category is required.'
  if (form.match_type === 'regex') {
    try { new RegExp(form.match_value) } catch { return 'Invalid regex pattern.' }
  }
  return null
}
