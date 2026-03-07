export async function POST() {
  const url = process.env.NEXT_PUBLIC_CREATE_INCIDENT_URL;

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "caregiver-web-demo",
    }),
  });

  const data = await r.json().catch(() => ({}));
  return Response.json(data, { status: r.status });
}