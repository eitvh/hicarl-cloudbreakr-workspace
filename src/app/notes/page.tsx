import {WorkspaceHeader} from '@/components/layout/workspace-header';
import {NotesEditor} from './notes-editor';
export const metadata={title:'Notes'};
export default function Notes(){return <main className="workspace-docs"><header className="pipeline-header"><WorkspaceHeader>{null}</WorkspaceHeader></header><article><span>YOUR SCRATCHPAD</span><h1>Notes</h1><p>Keep reminders and ideas here. Saved only in this browser, for this account.</p><NotesEditor username={process.env.DASHBOARD_USERNAME||'admin'}/></article></main>}
