"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// เดโม่แบบไม่ต้องทำ index: ดึงล่าสุดมาแล้วค่อย filter ฝั่ง UI
export function subscribeIncidentsLatest(cb, onError, take = 50) {
  const q = query(
    collection(db, "incidents"),
    orderBy("createdAt", "desc")
    // ถ้าจะ limit ใส่เพิ่มได้ แต่คุณยังไม่ได้ import limit ก็ปล่อยก่อน
  );

  return onSnapshot(
    q,
    (snap) => cb(snap.docs.slice(0, take).map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}