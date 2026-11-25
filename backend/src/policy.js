export const roles = ['regional','station','inspector','records','technical'];
export const isUuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const canReadVessels = u => ['regional','station','inspector','records'].includes(u.role);
export const canWriteVessels = u => ['station','records'].includes(u.role);
export const stationScope = (u, id) => u.role === 'regional' || (u.station_id !== null && u.station_id === id);
export const canManage = (u,target) => u.id !== target.id && (
 (u.role === 'regional' && ['regional','station','inspector','records'].includes(target.role)) ||
 (u.role === 'station' && u.station_id === target.station_id && ['inspector','records'].includes(target.role))
);
export const canReadAudit = u => u.role === 'regional';
