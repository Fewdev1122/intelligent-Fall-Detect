import shutil
from pathlib import Path

# --- 1. ตั้งค่า Path ---
# โฟลเดอร์ต้นทาง (Dataset รวม)
dataset_root = Path("/Users/phumiphat/Dev/Dataset_2")

# โฟลเดอร์ปลายทาง (ที่คุณระบุมา)
output_dir = Path("/Users/phumiphat/Dev/Project_II/Fall Detect/dataset/non_fall")

# สร้างโฟลเดอร์ปลายทางเตรียมไว้ (ถ้ายังไม่มี มันจะสร้างให้เองรวมถึงโฟลเดอร์ dataset ด้วย)
output_dir.mkdir(parents=True, exist_ok=True)
print(f"Target Directory: {output_dir}")

# --- 2. เริ่มการก๊อปปี้ ---
count = 0
print("\nStarting to copy ADL videos...")

# วนลูปหาโฟลเดอร์ Subject ทั้งหมด
for subject_dir in dataset_root.glob("Subject *"):
    subject_name = subject_dir.name  # เช่น "Subject 1"
    adl_dir = subject_dir / "ADL"
    
    # เช็คว่ามีโฟลเดอร์ ADL ไหม
    if adl_dir.exists():
        for video_file in adl_dir.glob("*.mp4"):
            # --- สำคัญ: การตั้งชื่อไฟล์ใหม่ ---
            # เปลี่ยนชื่อเพื่อไม่ให้ไฟล์ทับกัน (เพราะทุก Subject มีไฟล์ชื่อ 01.mp4 เหมือนกัน)
            # ชื่อใหม่จะเป็น: Subject_1_ADL_01.mp4
            clean_subject_name = subject_name.replace(" ", "_") 
            new_filename = f"{clean_subject_name}_ADL_{video_file.name}"
            
            destination = output_dir / new_filename
            
            # สั่งก๊อปปี้
            shutil.copy2(video_file, destination)
            
            # แสดงสถานะ (เอา comment ออกถ้าอยากเห็นชื่อไฟล์ทุกไฟล์)
            # print(f"Copied: {new_filename}")
            count += 1

print("-" * 50)
print(f"Done! Successfully copied {count} videos.")
print(f"Check your folder at: {output_dir}")
print("-" * 50)