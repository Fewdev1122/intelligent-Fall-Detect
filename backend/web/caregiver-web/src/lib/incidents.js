import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COL_INCIDENTS } from "@/config/constants";

export function subscribeLatestIncident(setter) {
  // ✅ ใช้ createdAtMs ที่เป็น number (ไม่ null) จะนิ่งกว่า serverTimestamp
  const q = query(collection(db, COL_INCIDENTS), orderBy("createdAtMs", "desc"), limit(1));
  return onSnapshot(q, (snap) => {
    const d = snap.docs[0];
    setter(d ? { id: d.id, ...d.data() } : null);
  });
}

export function subscribeRecentIncidents(setter, n = 5) {
  const q = query(collection(db, COL_INCIDENTS), orderBy("createdAtMs", "desc"), limit(n));
  return onSnapshot(q, (snap) => {
    setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}