export const MOCK_INCIDENTS = [
  {
    id: "lx3iYbddT8kA8b3fohAU",
    status: "NEW",
    severity: "HIGH",
    createdAtText: "2026-03-02 21:05",
    agoText: "2 min ago",
    confidence: 0.91,
    clipUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    caregiverNote: "ล้มข้างเตียง ลุกไม่ขึ้น 10 วินาที",
    patient: {
      name: "คุณสมชาย ใจดี",
      age: 78,
      sex: "ชาย",
      chronic: ["เบาหวาน", "ความดัน", "หัวใจ"],
      allergies: ["Penicillin"],
    },
    home: {
      address: "บ้านเลขที่ 12 หมู่ 3 ต.บ้านดู่ อ.เมือง จ.เชียงราย",
      lat: 19.9103,
      lng: 99.8406,
    },
  },
  {
    id: "INC-0002",
    status: "ACCEPTED",
    severity: "MED",
    createdAtText: "2026-03-02 20:52",
    agoText: "15 min ago",
    confidence: 0.72,
    clipUrl: null,
    caregiverNote: "สงสัยล้ม แต่ลุกได้เอง",
    patient: {
      name: "คุณศรีนวล",
      age: 82,
      sex: "หญิง",
      chronic: ["ข้อเข่าเสื่อม"],
      allergies: [],
    },
    home: {
      address: "หอผู้ป่วย 2A (เดโม่)",
      lat: 19.903,
      lng: 99.83,
    },
  },
];

export function getIncidentById(id) {
  return MOCK_INCIDENTS.find((x) => x.id === id) || null;
}

export function calcDashboardStats(items) {
  const stats = { NEW: 0, ACCEPTED: 0, DISPATCHED: 0, ARRIVED: 0, COMPLETED: 0, CANCELED: 0 };
  for (const it of items) stats[it.status] = (stats[it.status] || 0) + 1;
  return stats;
}