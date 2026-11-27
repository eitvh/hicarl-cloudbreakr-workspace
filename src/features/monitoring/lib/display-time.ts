export const displayZones=[{value:'Asia/Kuala_Lumpur',label:'Malaysia & Hong Kong',offset:'UTC+8'},{value:'UTC',label:'UTC',offset:'UTC+0'}];
// Pipeline DATETIME values are UTC. Date-only source windows are calendar dates.
export function displayTime(value:unknown,zone='Asia/Kuala_Lumpur'){
 if(!value)return 'Not recorded';const s=String(value);const onlyDate=/^\d{4}-\d{2}-\d{2}$/.test(s);let iso=s.replace(' ','T').replace(/(\.\d{3})\d+/,'$1');if(onlyDate)iso+='T00:00:00Z';else if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso))iso+='Z';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return 'Not recorded';return new Intl.DateTimeFormat('en-GB',{timeZone:onlyDate?'UTC':zone,day:'2-digit',month:'short',year:'numeric',...(onlyDate?{}:{hour:'2-digit',minute:'2-digit',hour12:false})}).format(d);
}

export function startedDay(value:unknown,zone='Asia/Kuala_Lumpur'){
 if(!value)return '';let iso=String(value).replace(' ','T').replace(/(\.\d{3})\d+/,'$1');if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso))iso+='Z';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
}
