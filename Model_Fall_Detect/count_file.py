from pathlib import Path

check_dir = Path("/Users/phumiphat/Dev/Project_II/Fall Detect/dataset/non_fall")


if check_dir.exists():

    all_files = list(check_dir.glob("*.avi"))

    print(f"📂 กำลังตรวจสอบโฟลเดอร์: {check_dir}")
    print("-" * 50)
    print(f"✅ พบวิดีโอ Non-Fall ทั้งหมด: {len(all_files)} ไฟล์")
    print("-" * 50)


    if len(all_files) > 0:
        print("ตัวอย่างชื่อไฟล์ 5 อันแรก:")
        for f in all_files[:5]:
            print(f" - {f.name}")
    else:
        print("⚠️ ไม่พบไฟล์วิดีโอ .avi ในโฟลเดอร์นี้")
else:
    print(f"❌ ไม่พบโฟลเดอร์: {check_dir}")
    print("รบกวนตรวจสอบ Path หรือดูว่าได้สร้างโฟลเดอร์นี้หรือยังนะครับ")