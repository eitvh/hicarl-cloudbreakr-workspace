import {NextRequest,NextResponse} from 'next/server';
import {pipelineSource} from '@/lib/pipeline-source';
import {stagingPosts} from '@/lib/staging-page';
import {mongoFailure} from '@/lib/mongo-diagnostics';
export const maxDuration=60;
export async function GET(request:NextRequest){
 const source=pipelineSource(request.nextUrl.searchParams.get('source'));
 if(!source)return NextResponse.json({error:'Unknown pipeline source.'},{status:400});
 try{return NextResponse.json(await stagingPosts(request.nextUrl.searchParams,source),{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){
  if(error instanceof Error&&error.message.startsWith('Invalid '))return NextResponse.json({error:error.message},{status:400});
  const failure=mongoFailure(error);return NextResponse.json({error:failure.code+': '+failure.hint},{status:503});
 }
}
