Assets folder for MusicSyncApp

- images/: app images and logos
- icons/: small icons used in the UI
- fonts/: custom font files

Place your image files (png, jpg, svg) under `assets/images` and reference them from JS like:

```js
// example
import logo from '../assets/images/logo.png';
// or
const logo = require('../assets/images/logo.png');
```

React Native bundler will pick up static assets placed under this folder.
