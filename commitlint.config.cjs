module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // fix bug
        'docs',     // documentation change
        'style',    // code style change (not affect code running)
        'refactor', // code refactor (not new feature or fix bug)
        'perf',     // performance optimization
        'test',     // add tests
        'chore',    // build process or auxiliary tool change
        'revert',   // revert to previous commit
        'build',    // build system or external dependency change
        'ci',       // CI configuration file and script change
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};

