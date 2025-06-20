from ultralytics import YOLO

model = YOLO('yolov8s.pt')

model.train(
    data=r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\weapons.v1i.yolov8\data.yaml',
    epochs=50,
    imgsz=416,
    batch=8,
    patience=10,        # ⏳ Stop training if no improvement after 10 epochs
    close_mosaic=15     # 🚫 Disable mosaic after 15 epochs for fine-tuning
)



# from ultralytics import YOLO

# model = YOLO(r'H:\Code\Final Year Projectsss\CamWatch\code\runs\detect\train3\weights\best.pt')
# model.train(
#     data=r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\ARDS.v1i.yolov8\data.yaml',
#     epochs=10,
#     imgsz=416,
#     batch=4
# )

