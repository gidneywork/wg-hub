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
export function getCategoryBySlug(categories, slug) { /* Commit 2 */ }

/**
 * Returns the top-level parent category for a given category row.
 * If the category has no parent, returns the category itself.
 * @param {Array<{ id: string, parent_id: string|null }>} categories
 * @param {{ id: string, parent_id: string|null }} category
 * @returns {{ id: string, slug: string, name: string }}
 */
export function getRootCategory(categories, category) { /* Commit 2 */ }
