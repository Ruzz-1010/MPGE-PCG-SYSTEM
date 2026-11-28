import {audit,tx} from './db.js';
// Use Philippine calendar dates, independent of the DB/session timezone.
export const todaySql="(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date";
export const currentDocs=` FROM vw.documents d JOIN vw.vessels v ON v.id=d.vessel_id
 JOIN vw.document_types dt ON dt.id=d.type_id
 JOIN LATERAL (SELECT * FROM vw.document_versions WHERE document_id=d.id ORDER BY version DESC LIMIT 1) dv ON true
 LEFT JOIN LATERAL (SELECT id,status,reason,reviewed_by,created_at FROM vw.document_reviews WHERE document_version_id=dv.id ORDER BY created_at DESC,id DESC LIMIT 1) dr ON true`;
export const validity=`CASE WHEN dv.expiry_kind='not_applicable' THEN 'not_applicable'
 WHEN dv.expiry_kind='unknown' OR dv.expiry_date IS NULL THEN 'unknown'
 WHEN dv.expiry_date < ${todaySql} THEN 'expired'
 WHEN dv.expiry_date = ${todaySql} THEN 'due_today'
 WHEN dv.expiry_date <= ${todaySql}+30 THEN 'expiring_soon' ELSE 'valid_by_date' END`;
export async function runExpirationCheck(){
 return tx(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(71829308)');
  const r=await c.query(`INSERT INTO vw.expiration_checks(check_date,document_count,expired_required,due_30,due_7,due_1,unknown_count)
   SELECT ${todaySql},count(*)::int,count(*) FILTER (WHERE d.required AND dv.expiry_kind='dated' AND dv.expiry_date<${todaySql})::int,
    count(*) FILTER (WHERE dv.expiry_date=${todaySql}+30)::int,count(*) FILTER (WHERE dv.expiry_date=${todaySql}+7)::int,
    count(*) FILTER (WHERE dv.expiry_date=${todaySql}+1)::int,count(*) FILTER (WHERE dv.expiry_kind='unknown' OR (dv.expiry_kind='dated' AND dv.expiry_date IS NULL))::int
   ${currentDocs} ON CONFLICT(check_date) DO NOTHING RETURNING check_date`);
  if(r.rowCount)await audit(c,null,'documents.expiry_check','expiration_check',String(r.rows[0].check_date.toISOString?.()??r.rows[0].check_date));
  return r.rowCount===1;
 });
}
