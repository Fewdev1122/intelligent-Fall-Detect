"use client";
import DashboardPage from "@/components/ems/pages/DashboardPage";

export default function Page() {
  console.log("projectId =", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  return <DashboardPage />;
}