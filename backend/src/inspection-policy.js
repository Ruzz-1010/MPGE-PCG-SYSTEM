// Candidate thesis policy only, not an approved agency procedure.
export const states=['draft','submitted','returned','reviewed'];
export const answers=['pass','fail','not_applicable','not_checked'];
export const demoTemplateName='VesselWatch fictional inspection checklist';
export const demoItems=[
 ['IDENTITY','Compare recorded vessel identity with the demonstration record.'],
 ['DOCUMENTS','Review availability of fictional document records.'],
 ['OBSERVATIONS','Record general inspection observations.'],
 ['ENVIRONMENT','Record environmental compliance observations for the fictional exercise.']
];
export const demoStatement='I acknowledge this fictional inspection submission. This is a simulated attestation, not a legal digital signature.';
export const canInspect=u=>['regional','station','inspector','records'].includes(u.role);
export const canReview=u=>u.role==='station';
export function transition(state,action,owner,reviewer){
 if(action==='save'&&owner&&['draft','returned'].includes(state))return 'draft';
 if(action==='submit'&&owner&&['draft','returned'].includes(state))return 'submitted';
 if(action==='return'&&reviewer&&state==='submitted')return 'returned';
 if(action==='review'&&reviewer&&state==='submitted')return 'reviewed';
 if(action==='reopen'&&reviewer&&state==='reviewed')return 'returned';
 return null;
}
