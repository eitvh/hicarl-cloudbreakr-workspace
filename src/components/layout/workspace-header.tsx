"use client";
import Image from 'next/image';
import {WorkspaceMenuButton} from './workspace-shell';
import type {ReactNode} from 'react';
export function WorkspaceHeader({children}:{children:ReactNode}){return <div className="dash-header"><div className="workspace-identity"><span className="cloudbreakr-symbol" aria-hidden="true"><Image src="/brand/cloudbreakr-symbol.png" alt="" width={192} height={192} priority/></span><strong className="cloudbreakr-title">Cloudbreakr</strong></div><div className="workspace-header-actions"><WorkspaceMenuButton/>{children}</div></div>;}
