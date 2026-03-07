export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_INCIDENT_ACTION_URL;
  const body = await req.json();

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  return Response.json(data, { status: r.status });
}