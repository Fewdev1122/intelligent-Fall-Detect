"use client";

function EmsSearchingOverlay() {
  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-white/85 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
          🚑
        </div>

        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          Contacting emergency services
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Please wait while we connect to the nearest available responder.
        </p>

        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Waiting for responder acceptance...
        </p>
      </div>
    </div>
  );
}

function CaseTracker({ status, emsInfo }) {
  const steps = ["Received", "On the way", "Arrived"];
  const currentIdx =
    status === "EMS_ARRIVED" ? 2 : status === "EMS_DISPATCHED" ? 1 : 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-xl">
          🏥
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {emsInfo?.hospitalName || "Emergency responder assigned"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current status: {String(status).replace("EMS_", "").replaceAll("_", " ")}
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex justify-between">
        <div className="absolute left-0 right-0 top-2 h-[2px] bg-slate-100" />

        {steps.map((label, i) => {
          const active = i <= currentIdx;
          return (
            <div key={label} className="relative z-10 flex flex-col items-center">
              <div
                className={`h-4 w-4 rounded-full border-2 ${
                  active
                    ? "border-blue-600 bg-blue-600"
                    : "border-slate-300 bg-white"
                }`}
              />
              <span
                className={`mt-2 text-[11px] font-medium ${
                  active ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VideoPanel({ clipUrl }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Incident video</p>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
          Replay
        </span>
      </div>

      {clipUrl ? (
        <video
          src={clipUrl}
          controls
          autoPlay
          className="aspect-video w-full rounded-2xl bg-slate-900 object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
          Video not available
        </div>
      )}
    </div>
  );
}

function NoticeBox({ status }) {
  const message =
    status === "EMS_TRANSFERRED"
      ? "The case is being transferred to a local emergency response team."
      : "Please review the video above. If the situation looks unsafe, contact emergency services immediately.";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm leading-6 text-amber-800">{message}</p>
    </div>
  );
}

export default function AlertCard({
  mode,
  latest,
  busy,
  createdAtText,
  clipUrl,
  onAction,
  emsRequesting,
  emsInfo,
}) {
  const status = latest?.status || "NORMAL";
  const incidentId = latest?.id || null;

  const isSearching =
    emsRequesting ||
    status === "EMS_REQUESTED" ||
    status === "EMS_CONTACTED" ||
    status === "EMS_TRANSFERRED";

  const isTracking =
    status === "EMS_DISPATCHED" || status === "EMS_ARRIVED";

  const shouldShowAssessment =
    mode === "assessment" || isSearching || isTracking;

  if (mode === "emergency" && !isSearching && !isTracking) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-rose-700 text-white">
        <div className="absolute inset-0 animate-pulse bg-rose-600/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_40%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-5xl shadow-2xl backdrop-blur">
              🚨
            </div>
          </div>

          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-50">
            Emergency alert
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight">
            FALL DETECTED
          </h1>

          <p className="mt-3 text-base text-rose-100">
            Immediate attention required
          </p>

          <p className="mt-2 text-sm text-rose-200">
            {createdAtText}
          </p>

          <div className="mt-8 w-full rounded-3xl bg-white p-5 text-slate-900 shadow-2xl">
            <p className="text-sm leading-6 text-slate-600">
              A fall may have occurred. Please review the incident and confirm
              whether emergency help is needed.
            </p>

            <button
              onClick={() => onAction("ACK")}
              disabled={busy}
              className="mt-5 w-full rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Processing..." : "Review incident"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (shouldShowAssessment) {
    return (
      <div className="fixed inset-0 z-[120] min-h-screen overflow-hidden bg-slate-50 text-slate-900">
        {isSearching && <EmsSearchingOverlay />}

        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Incident review
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {createdAtText}
              </p>
            </div>

            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-500">
              ID: {incidentId?.slice(-6) || "------"}
            </div>
          </header>

          <div className="space-y-4">
            <VideoPanel clipUrl={clipUrl} />

            {isTracking ? (
              <CaseTracker status={status} emsInfo={emsInfo} />
            ) : (
              <NoticeBox status={status} />
            )}
          </div>

          <div className="mt-auto pt-6">
            {!isTracking && !isSearching && (
              <div className="space-y-3">
                <button
                  onClick={() => onAction("EMS")}
                  disabled={busy}
                  className="w-full rounded-2xl bg-rose-600 py-4 text-sm font-semibold text-white shadow-lg shadow-rose-100 transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Processing..." : "Contact emergency services"}
                </button>

                <button
                  onClick={() => onAction("SAFE")}
                  disabled={busy}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-60"
                >
                  Mark as safe / false alert
                </button>
              </div>
            )}

            {(isSearching || isTracking) && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 py-4 text-center text-sm font-medium text-blue-700">
                {isSearching
                  ? "Requesting assistance..."
                  : "Emergency response in progress"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}