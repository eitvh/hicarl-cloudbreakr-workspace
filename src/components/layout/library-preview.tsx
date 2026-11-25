import {Bookmark, BookOpen, NotebookPen, PencilLine} from 'lucide-react';
const items = [
 {title:'Notes', label:'A little room to think.', description:'Keep ideas, reminders and working notes close to your work.', footer:'Saved in this browser', Icon:NotebookPen},
 {title:'Saved items', label:'Worth coming back to.', description:'A home for bookmarked comparisons and useful references.', footer:'Coming soon', Icon:Bookmark},
 {title:'Documentation', label:'Find your bearings.', description:'Guides and reference for the tools in your workspace.', footer:'Explore the documentation', Icon:BookOpen},
];
export function LibraryPreview({active}:{active:number}) {
 const item=items[active];const Icon=item.Icon;
 return <aside className="library-preview" data-library={active} aria-hidden="true"><div key={active} className="library-preview-inner"><div className="library-preview-top"><span>LIBRARY</span><Icon size={18}/></div><div className="library-editorial"><span className="library-index">0{active+1}</span><h2>{item.title}</h2><p>{item.label}</p></div><div className="library-illustration">{active===0?<div className="library-notepaper"><PencilLine size={20}/><span>A thought to keep.</span><i/><i/><i/><div className="note-underline"/></div>:active===1?<div className="library-bookmark-stack"><div/><div/><div><Bookmark size={36} strokeWidth={1.2}/><span>Keep the useful things.</span><i/><i/></div></div>:<div className="library-book"><div className="library-book-spine"/><div><BookOpen size={30} strokeWidth={1.3}/><span>CLOUDBREAKR</span><strong>Workspace<br/>handbook</strong><i/></div></div>}</div><div className="library-preview-bottom"><p>{item.description}</p><span>{item.footer}</span></div></div></aside>;
}
