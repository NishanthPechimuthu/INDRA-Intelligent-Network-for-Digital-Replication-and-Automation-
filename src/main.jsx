import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PlatformApp from './platform/PlatformApp.jsx';
import { isStudioPath } from './platform/lib/router.js';
import './style.css';
import './platform/platform.css';

const root = createRoot(document.getElementById('root'));
const studio = isStudioPath(window.location.pathname);

if (studio) {
  document.body.classList.remove('platform-body');
  root.render(<App />);
} else {
  document.body.classList.add('platform-body');
  root.render(<PlatformApp />);
}
