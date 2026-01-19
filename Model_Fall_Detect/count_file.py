from pathlib import Path

check_dir = Path("/Users/phumiphat/Dev/Project_II/Fall_Detect/Model_Fall_Detect/dataset/non_fall")

if check_dir.exists():
    video_exts = ["*.avi", "*.mp4", "*.mov"]

    all_files = []
    for ext in video_exts:
        all_files.extend(check_dir.glob(ext))

    print(f"กำลังตรวจสอบโฟลเดอร์: {check_dir}")
    print("-" * 50)
    print(f"พบวิดีโอ Fall ทั้งหมด: {len(all_files)} ไฟล์")
    print("-" * 50)

    if all_files:
        print("ตัวอย่างชื่อไฟล์ 5 อันแรก:")
        for f in all_files[:5]:
            print(f" - {f.name}")
    else:
        print("❌ ไม่พบไฟล์วิดีโอในโฟลเดอร์นี้")

else:
    print(f"❌ ไม่พบโฟลเดอร์: {check_dir}")
