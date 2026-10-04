import React from 'react';
import { createRoot } from 'react-dom/client';
import Academy from '@/components/academy/academy';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Academy /></React.StrictMode>,
);
