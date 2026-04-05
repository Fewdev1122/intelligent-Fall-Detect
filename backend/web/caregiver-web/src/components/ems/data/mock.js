// ================= MOCK INCIDENTS =================
export const MOCK_INCIDENTS = [
  {
    id: "lx3iYbddT8kA8b3fohAU",
    status: "NEW",
    severity: "HIGH",
    createdAt: Date.now() - 2 * 60 * 1000, // 2 นาทีที่แล้ว
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
    status: "DISPATCHED", // 🔥 เปลี่ยนจาก ACCEPTED → ให้ UI ใช้ได้
    severity: "MED",
    createdAt: Date.now() - 15 * 60 * 1000,
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

  // 🔥 เพิ่มให้ดูเป็น demo สมจริง
  {
    id: "INC-0003",
    status: "ARRIVED",
    severity: "HIGH",
    createdAt: Date.now() - 30 * 60 * 1000,
    agoText: "30 min ago",
    confidence: 0.88,
    caregiverNote: "หมดสติชั่วคราว",
    patient: {
      name: "นายประสิทธิ์",
      age: 75,
      sex: "ชาย",
      chronic: ["หัวใจ"],
      allergies: [],
    },
    home: {
      address: "ใกล้แม่น้ำโขง เชียงของ",
      lat: 20.265,
      lng: 100.404,
    },
  },

  {
    id: "INC-0004",
    status: "COMPLETED",
    severity: "LOW",
    createdAt: Date.now() - 60 * 60 * 1000,
    agoText: "1 hr ago",
    confidence: 0.65,
    caregiverNote: "สะดุดล้มเล็กน้อย",
    patient: {
      name: "นางมาลี",
      age: 70,
      sex: "หญิง",
      chronic: [],
      allergies: [],
    },
    home: {
      address: "ตลาดเชียงของ",
      lat: 20.267,
      lng: 100.401,
    },
  },

  {
    id: "INC-0005",
    status: "NEW",
    severity: "HIGH",
    createdAt: Date.now() - 5 * 60 * 1000,
    agoText: "5 min ago",
    confidence: 0.95,
    caregiverNote: "ล้มแรง ไม่ตอบสนอง",
    patient: {
      name: "นายวิชัย",
      age: 80,
      sex: "ชาย",
      chronic: ["เบาหวาน"],
      allergies: [],
    },
    home: {
      address: "โรงเรียนเชียงของ",
      lat: 20.270,
      lng: 100.398,
    },
  },
];

// ================= GET BY ID =================
export function getIncidentById(id) {
  return MOCK_INCIDENTS.find((x) => x.id === id) || null;
}

// ================= DASHBOARD STATS =================
export function calcDashboardStats(items = []) {
  const stats = {
    NEW: 0,
    DISPATCHED: 0,
    ARRIVED: 0,
    COMPLETED: 0,
  };

  for (const it of items) {
    const key = String(it.status || "").toUpperCase();
    if (stats[key] !== undefined) {
      stats[key]++;
    }
  }

  return stats;
}