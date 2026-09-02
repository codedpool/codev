'use client';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// swagger-ui-react touches the DOM directly and isn't SSR-safe.
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <SwaggerUI url="/openapi.json" />
    </div>
  );
}
