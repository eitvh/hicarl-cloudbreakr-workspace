import {connection} from 'next/server';
import {cookies} from 'next/headers';
import {SESSION_COOKIE,validSession} from '@/lib/auth';
import {WorkspaceShell} from './workspace-shell';
export async function SessionWorkspace({children}:{children:React.ReactNode}){
 await connection();
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 const authenticated=token ? validSession(token) : false;
 return <WorkspaceShell authenticated={authenticated} username={authenticated?(process.env.DASHBOARD_USERNAME||'admin'):''}>{children}</WorkspaceShell>;
}
