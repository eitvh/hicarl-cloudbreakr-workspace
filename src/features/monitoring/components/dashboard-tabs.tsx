"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
export function DashboardTabs({value}:{value:string}) {
  const router = useRouter();
  const params = useSearchParams();
  return <Tabs className="my-6" value={value} onValueChange={tab=>{
    const next = new URLSearchParams(params.toString());
    next.set("tab",String(tab)); next.set("page","1");
    router.push("?"+next.toString());
  }}><TabsList aria-label="Dashboard sections">
    <TabsTrigger value="overview">Job progress</TabsTrigger>
    <TabsTrigger value="staging">Staging posts</TabsTrigger>
    <TabsTrigger value="usage">Usage & cost</TabsTrigger>
  </TabsList></Tabs>;
}
