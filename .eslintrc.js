module.exports = {
    extends: ['eslint-config-airbnb-base', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    ignorePatterns: ['tests/**', '*.js'],
    rules: {
        'import/extensions': 'off',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': ['error', { ignoreTypeReferences: true }],
        'no-prototype-builtins': 'off',
        'import/prefer-default-export': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-param-reassign': 'off',
        'no-underscore-dangle': 'off',
        'no-restricted-syntax': 'off',
        'no-continue': 'off',
        'no-use-before-define': 'off',
        'no-shadow': 'off',
        'no-useless-constructor': 'off',
        'camelcase': 'off',
        'no-await-in-loop': 'off'
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.ts'],
                moduleDirectory: ['node_modules', './src'],
            },
        },
    },
    parserOptions: {
        project: './tsconfig.json',
    },
}