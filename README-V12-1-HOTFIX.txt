RIVANI AI V12.1 hotfix

Fixes:
- V12 had a JavaScript scope bug: `neuralStrength` was declared inside the
  RNNoise block but referenced later when rendering the result label.
- That caused a ReferenceError AFTER the audio processing had largely finished,
  which triggered the generic "Audio repair could not finish" browser alert.
- V12.1 declares neuralStrength at repair-function scope.
- The result label now handles RNNoise bypass correctly.
- Error alerts now include a short actual JS error message for easier diagnosis.
- Cache version bumped to 12.1.

Deploy:
Replace the website files with this package and hard-refresh after Cloudflare deploy.
