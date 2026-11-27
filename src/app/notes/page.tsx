import {WorkspaceHeader} from '@/components/layout/workspace-header';
import {NotesEditor} from './notes-editor';
import {NotebookPen} from 'lucide-react';
export const metadata={title:'Notes'};
export default function Notes(){return <main className="workspace-docs notes-page"><header className="pipeline-header"><WorkspaceHeader>{null}</WorkspaceHeader></header><section className="notes-workspace"><header className="notes-page-heading"><span className="notes-app-icon"><NotebookPen size={25}/></span><div><h1>Notes</h1><p>Ideas, reminders, and things to follow up.</p></div></header><NotesEditor username={process.env.DASHBOARD_USERNAME||'admin'}/></section></main>}
