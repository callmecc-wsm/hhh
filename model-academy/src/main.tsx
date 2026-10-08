import '@/app/globals.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Academy from '@/components/academy/paced';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Academy /></React.StrictMode>,
);
