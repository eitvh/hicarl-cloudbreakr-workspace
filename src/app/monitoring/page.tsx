import { DashboardView } from "@/features/monitoring/components/dashboard-view";
export default function Page() { return <DashboardView username={process.env.DASHBOARD_USERNAME||"admin"}/>; }

export const metadata = {title:"Monitoring"};
