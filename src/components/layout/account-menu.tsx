"use client";
import {useState} from 'react';
import {Menu} from '@base-ui/react/menu';
import {UserRound,ChevronDown,LogOut,Loader2} from 'lucide-react';
export function AccountMenu({username}:{username:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function logout(){setBusy(true);setError('');try{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw Error();window.location.replace('/login');}catch{setError('Unable to log out. Please retry.');setBusy(false);}}
 return <Menu.Root><Menu.Trigger className="account-chip account-menu-trigger" aria-label={'Account menu for '+username}><span className="account-avatar"><UserRound size={18}/></span><span className="account-name"><small>Signed in</small><strong>{username}</strong></span><ChevronDown size={13}/></Menu.Trigger><Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="account-menu-positioner"><Menu.Popup className="account-menu-popup account-popover"><Menu.Item className="account-logout-item" disabled={busy} closeOnClick={false} onClick={()=>void logout()}>{busy?<Loader2 size={16} className="animate-spin"/>:<LogOut size={16}/>}<span><strong>{busy?'Logging out...':'Log out'}</strong></span></Menu.Item>{error&&<p role="alert">{error}</p>}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>;
}
