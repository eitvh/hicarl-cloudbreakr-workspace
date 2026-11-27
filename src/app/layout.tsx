import {Suspense} from "react";
import {SessionWorkspace} from "@/components/layout/session-workspace";
import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import {WorkspaceShell} from "@/components/layout/workspace-shell";
import "./dashboard.css";
import "./surface-motion.css";

export const metadata: Metadata = {
  title: {default:"Cloudbreakr Workspace",template:"%s | Cloudbreakr Workspace"},
  description: "Work tools for pipeline monitoring, influencer discovery, and post search.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="dark h-full antialiased"
    >
      <head><script dangerouslySetInnerHTML={{__html: "(function(){try{var dark=localStorage.getItem('monitor-theme')!=='light';document.documentElement.classList.toggle('dark',dark);}catch{}})();"}}/></head>
      <body className="min-h-full flex flex-col"><Suspense fallback={<WorkspaceShell username="">{children}</WorkspaceShell>}><SessionWorkspace>{children}</SessionWorkspace></Suspense></body>
    </html>
  );
}
