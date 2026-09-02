import { json } from '@/backend/http';

export const GET = () => json({ ok: true, service: 'codev', time: new Date().toISOString() });
