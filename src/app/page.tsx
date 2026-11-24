import { DashboardView } from "@/components/dashboard-view";
export default function Page() { return <DashboardView username={process.env.DASHBOARD_USERNAME||"admin"}/>; }
