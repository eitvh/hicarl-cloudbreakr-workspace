import {NextResponse} from 'next/server';
import mysql, {type Pool,type RowDataPacket} from 'mysql2/promise';

const globalDb=globalThis as typeof globalThis & {monitorMysql?:Pool};
export async function GET(){
 try{
 const database=process.env.IG_SUMMARY_DATABASE;const table=process.env.IG_SUMMARY_TABLE;
 if(!database||!table||![database,table].every(v=>/^[a-zA-Z0-9_]+$/.test(v)))return NextResponse.json({error:'Configure IG_SUMMARY_DATABASE and IG_SUMMARY_TABLE.'},{status:503});
 const pool=globalDb.monitorMysql??=mysql.createPool({host:process.env.CRAWL_DB_HOST,port:Number(process.env.CRAWL_DB_PORT||3306),user:process.env.CRAWL_DB_USERNAME,password:process.env.CRAWL_DB_PASSWORD,database,connectionLimit:3,connectTimeout:10000,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,multipleStatements:false});
 const [rows]=await pool.query<RowDataPacket[]>({sql:'SELECT * FROM '+mysql.escapeId(database)+'.'+mysql.escapeId(table)+' ORDER BY started_at DESC, attempt_no DESC LIMIT 1000',timeout:15000});
 return NextResponse.json({rows,updatedAt:new Date().toISOString(),limited:rows.length===1000},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Unable to read MySQL run summaries. Check database settings, network access and SELECT permission.'},{status:503});}
}
