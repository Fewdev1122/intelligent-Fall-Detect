import IncidentDetailPage from "@/components/ems/pages/IncidentDetailPage";

export default async function Page({ params }) {
  // Next 16: params อาจเป็น Promise
  const p = await params;
  return <IncidentDetailPage id={p.id} />;
}