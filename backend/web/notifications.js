export function notificationWorkspace({out,api,user,dashboard,node,card,table,button,field,choice,stationName,handle,message,isCurrent}){
 let closed=false,epoch=0;
 const alive=e=>!closed&&isCurrent()&&(e===undefined||e===epoch);
 const dispose=()=>{closed=true;epoch++;};
 const report=e=>{if(alive())handle(e);};
 const heading=t=>{const c=card(t);c.append(node('p','THESIS SIMULATION ONLY — reminders are review prompts, not clearance or enforcement decisions. No SMS is transmitted.','inspectionNotice'));out.replaceChildren(c);return c;};
 const threshold=n=>n===-1?'Expired':n===0?'Due today':'Within '+n+' day(s)';
 const date=v=>v?new Date(v).toLocaleString():'—';
 const options=[['','All states'],['queued','Pending'],['acknowledged','Acknowledged'],['sent_demo','Sent (simulation)'],['failed','Failed (simulation)'],['cancelled','Superseded / cancelled']];
 async function list(page=1,channel='dashboard',state=''){
  const e=++epoch,c=heading('Notification center'),bar=node('div',undefined,'inspectionToolbar'),ch=choice('Channel','channel',[['dashboard','My dashboard alerts'],['sms_demo','Simulated SMS outbox']],channel),st=choice('Status','state',options,state);
  bar.append(ch.label,st.label,button('Apply filters',()=>list(1,ch.input.value,st.input.value).catch(report)));
  if(user.role==='regional')bar.append(button('Run expiry reminder check',async()=>{try{const r=await api('notifications/refresh',{method:'POST',data:{}});if(alive(e)){message(r.created+' new notices; '+r.cancelled+' superseded.');await list(1,channel,state);}}catch(err){report(err);}}));
  if(dashboard.capabilities.writeNotifications)bar.append(button('Manage fictional recipients',()=>contacts().catch(report)));
  c.append(bar);
  const data=await api('notifications?'+new URLSearchParams({channel,page:String(page),...(state?{state}:{})}));if(!alive(e))return;
  const wrap=table(['Vessel / owner','Station','Document','Reminder','State','Action'],data.rows.map(r=>[r.vessel_name+' · '+r.owner_operator,stationName(r.station_id),r.document_type+' · '+r.number,threshold(r.threshold_days),r.state,'']));
  [...wrap.querySelectorAll('tbody tr')].forEach((tr,i)=>{if(data.rows[i])tr.lastElementChild.append(button('Open',()=>detail(data.rows[i].id,channel,state).catch(report)));});c.append(wrap);
  const row=node('div',undefined,'actions pagination'),prev=button('Previous',()=>list(page-1,channel,state).catch(report)),next=button('Next',()=>list(page+1,channel,state).catch(report));prev.disabled=page===1;next.disabled=page*data.pageSize>=data.total;row.append(prev,node('span',data.total+' records · Page '+page),next);c.append(row);
 }
 async function detail(id,channel,state){
  const e=++epoch,c=heading('Notification details');c.append(button('Back to notifications',()=>list(1,channel,state).catch(report)));
  const r=await api('notifications/'+id);if(!alive(e))return;
  c.append(table(['Field','Value'],[['Vessel',r.vessel_name],['Owner/operator',r.owner_operator],['Station',stationName(r.station_id)],['Document',r.document_type+' · '+r.number],['Version',r.version],['Expiry',r.expiry_date],['Reminder',threshold(r.threshold_days)],['Recipient',r.recipient],['State',r.state],['Created',date(r.created_at)]]));
  if(r.threshold_days===-1&&r.required)c.append(node('p','Expired required document — review needed. No automatic Hold.','inspectionNotice'));
  const actions=r.channel==='dashboard'&&r.state==='queued'?[['acknowledge','Acknowledge']]:r.channel==='sms_demo'&&dashboard.capabilities.writeNotifications&&['queued','failed'].includes(r.state)&&r.history.filter(x=>['sent_demo','failed'].includes(x.outcome)).length<3?[['simulate_success','Simulate successful delivery'],['simulate_failure','Simulate failed delivery']]:[];
  if(actions.length){const note=field('Action note','note','',500),row=node('div',undefined,'actions');note.input.required=true;c.append(note.label,row);let busy=false;
   for(const [action,label] of actions)row.append(button(label,async()=>{if(busy||!note.input.reportValidity())return;busy=true;for(const b of row.children)b.disabled=true;try{await api('notifications/'+id+'/action',{method:'POST',data:{action,expectedState:r.state,expectedAttempts:r.history.length,note:note.input.value}});if(alive(e)){message('Action recorded.');await detail(id,channel,state);}}catch(err){report(err);}finally{busy=false;for(const b of row.children)b.disabled=false;}},false));
  }
  c.append(node('h3','Action and delivery history'),table(['Attempt','Outcome','Note','Actor','Time'],r.history.map(h=>[h.attempt_no,h.outcome,h.detail,h.actor_id??'System',date(h.created_at)])));
 }
 async function contacts(){
  const e=++epoch,c=heading('Fictional recipient management');c.append(button('Back to notifications',()=>list().catch(report)),node('p','Only reserved fictional demonstration numbers can be created. Never enter actual owner contact details.','pending'));
  const q=field('Find vessel','q'),row=node('div',undefined,'inspectionToolbar'),results=node('div');row.append(q.label,button('Search',()=>find(1).catch(report)));c.append(row,results);
  async function find(page){const d=await api('vessels?format=page&page='+page+'&q='+encodeURIComponent(q.input.value));if(!alive(e))return;results.replaceChildren();
   for(const v of d.rows){const item=node('div',undefined,'actions vesselChoice');item.append(node('span',v.name+' · '+v.official_registration),button('Manage',()=>recipient(v).catch(report)));results.append(item);}
   if(!d.rows.length)results.append(node('p','No authorized vessels found.'));
   const p=node('div',undefined,'actions pagination'),prev=button('Previous',()=>find(page-1).catch(report)),next=button('Next',()=>find(page+1).catch(report));prev.disabled=page===1;next.disabled=page*d.pageSize>=d.total;p.append(prev,node('span','Page '+page),next);results.append(p);
  }await find(1);
 }
 async function recipient(v){
  const e=++epoch,c=heading(v.name+' · fictional recipients');c.append(button('Back',()=>contacts().catch(report)));
  const records=await api('demo-contacts/'+v.id);if(!alive(e))return;
  const wrap=table(['Recipient','Demo authorization','Action'],records.map(r=>[r.label,r.sms_authorized?'Enabled':'Disabled','']));
  [...wrap.querySelectorAll('tbody tr')].forEach((tr,i)=>{const r=records[i];if(r?.sms_authorized)tr.lastElementChild.append(button('Disable',async()=>{try{await api('demo-contacts/'+v.id+'/'+r.id+'/disable',{method:'POST',data:{}});if(alive(e))await recipient(v);}catch(err){report(err);}}));});c.append(wrap);
  const f=node('form'),suffix=field('Two fictional digits (00–99)','suffix','',2),ack=node('input');suffix.input.pattern='[0-9]{2}';suffix.input.required=true;ack.type='checkbox';ack.required=true;const label=node('label',undefined,'check');label.append(ack,node('span','I confirm this is a fictional recipient, not a real owner contact.'));const save=node('button','Create demo recipient');
  f.append(suffix.label,label,save);c.append(f);f.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;try{await api('demo-contacts/'+v.id,{method:'POST',data:{suffix:suffix.input.value,acknowledgeDemo:ack.checked}});if(alive(e)){message('Fictional recipient created.');await recipient(v);}}catch(err){report(err);}finally{save.disabled=false;}});
 }
 return {start:()=>list(),dispose};
}
