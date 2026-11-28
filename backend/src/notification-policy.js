// Calendar-day catch-up: one most urgent current threshold, not a burst of missed reminders.
export function threshold(days){if(!Number.isInteger(days)||days>30)return null;if(days<0)return -1;if(days===0)return 0;if(days===1)return 1;if(days<=7)return 7;return 30;}
export const admin=u=>['regional','station','records'].includes(u.role);
export const writer=u=>['station','records'].includes(u.role);
export const demoPhone=s=>typeof s==='string'&&/^\+120255501\d{2}$/.test(s);
export const maxAttempts=3;
