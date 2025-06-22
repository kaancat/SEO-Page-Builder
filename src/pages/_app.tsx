import type { AppProps } from 'next/app';
import '@/styles/globals.css';

/**
 * Next.js App Component
 * Loads global styles and configures the application
 */
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
} 