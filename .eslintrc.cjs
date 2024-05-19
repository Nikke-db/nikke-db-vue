/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    '@typescript-eslint/type-annotation-spacing': 'error',
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error', {
      'before': true, 'after': true
    }],
    'comma-spacing': ['error', {
      'before': false, 'after': true
    }],
    'block-spacing': ['error', 'always'],
    'default-case': 'error',
    'default-case-last': 'error',
    'default-param-last': 'error',
    'eqeqeq': 'error',
    'func-call-spacing': ['error', 'never'],
    'indent': [ 'error', 2, {
      'SwitchCase': 1
    } ],
    'keyword-spacing': ['error', {
      'after': true, 'before': true,
    }],
    // 'no-trailing-spaces': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-var': 'error',
    'object-curly-spacing': ['error', 'always'],
    'quotes': [ 'error', 'single' ],
    'semi': [ 'error', 'never' ],
    'space-infix-ops': 'error',
    'switch-colon-spacing': ['error', {
      'after': true, 'before': false
    }],
    'vue/multi-word-component-names': 'off',
    'yoda': 'error',
  }
}
