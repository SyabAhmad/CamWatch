from ultralytics import YOLO

model = YOLO('yolov8s.pt')
model.train(
    data=r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\weapons.v1i.yolov8\data.yaml',
    epochs=10,
    imgsz=416,
    batch=4
)
