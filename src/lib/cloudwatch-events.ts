export interface LogEvent {timestamp:number;message:string}
// RFC-style quoted CSV cells, including multiline messages and escaped quotes.
export function parseCloudWatchCsv(source:string):LogEvent[]{
 const records:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));records.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell.replace(/\r$/,''));records.push(row);}
 return records.filter(r=>/^\d{13}$/.test(r[0])&&r.length>=2).map(r=>({timestamp:Number(r[0]),message:r[1]}));
}
export function invocationEvents(events:LogEvent[],requestId:string):LogEvent[]{
 const result:LogEvent[]=[];const active=new Set<string>();
 for(const event of events){const start=event.message.match(/START RequestId:\s*([\w-]+)/),end=event.message.match(/(?:END|REPORT) RequestId:\s*([\w-]+)/);if(start)active.add(start[1]);
 const explicit=start?.[1]||end?.[1];if(explicit===requestId||(!explicit&&active.size===1&&active.has(requestId)))result.push(event);
 if(end)active.delete(end[1]);
 }return result;
}
