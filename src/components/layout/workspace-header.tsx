"use client";
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {Menu} from '@base-ui/react/menu';
import {Activity,ChevronDown,Search,Users,Check} from 'lucide-react';
import type {ReactNode} from 'react';
export function WorkspaceHeader({children}:{children:ReactNode}){
 const router=useRouter();
 return <div className="dash-header"><div className="workspace-identity"><span className="cloudbreakr-symbol" aria-hidden="true"><Image src="/brand/cloudbreakr-symbol.png" alt="" width={192} height={192} priority/></span><strong className="cloudbreakr-title">Cloudbreakr</strong><Menu.Root><Menu.Trigger className="workspace-module-trigger" aria-label="Workspace modules"><Activity size={14}/><span>Monitoring</span><ChevronDown size={13}/></Menu.Trigger><Menu.Portal><Menu.Positioner sideOffset={8} className="account-menu-positioner"><Menu.Popup className="account-menu-popup workspace-module-menu"><div className="account-menu-heading"><small>Cloudbreakr Workspace</small><strong>Your work tools</strong></div><Menu.Item className="workspace-module-item" onClick={()=>{router.push('/monitoring');}}><Activity size={16}/><span>Monitoring</span><Check size={14}/></Menu.Item><Menu.Item className="workspace-module-item" disabled><Users size={16}/><span>Influencer search</span><small>Coming soon</small></Menu.Item><Menu.Item className="workspace-module-item" disabled><Search size={16}/><span>Post search</span><small>Coming soon</small></Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></div><div className="workspace-header-actions">{children}</div></div>;
}
