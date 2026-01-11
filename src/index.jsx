import React from 'react';
import { createRoot } from 'react-dom/client'; // Use named import
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);