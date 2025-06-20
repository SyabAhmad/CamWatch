import os
import shutil
import yaml

def create_combined_dataset():
    """Combine the weapons dataset with ARDS pistol dataset"""
    
    # Base paths
    weapons_dataset = r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\weapons.v1i.yolov8'
    ards_dataset = r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\ARDS.v1i.yolov8'
    combined_dataset = r'H:\Code\Final Year Projectsss\CamWatch\code\backend\dataset\combined_weapons'
    
    # Create combined dataset structure
    os.makedirs(f"{combined_dataset}/train/images", exist_ok=True)
    os.makedirs(f"{combined_dataset}/train/labels", exist_ok=True)
    os.makedirs(f"{combined_dataset}/valid/images", exist_ok=True)
    os.makedirs(f"{combined_dataset}/valid/labels", exist_ok=True)
    
    # Copy weapons dataset
    print("Copying weapons dataset...")
    for split in ['train', 'valid']:
        # Copy images
        weapons_img_dir = f"{weapons_dataset}/{split}/images"
        if os.path.exists(weapons_img_dir):
            for img in os.listdir(weapons_img_dir):
                shutil.copy2(f"{weapons_img_dir}/{img}", f"{combined_dataset}/{split}/images/weapons_{img}")
        
        # Copy labels
        weapons_label_dir = f"{weapons_dataset}/{split}/labels"
        if os.path.exists(weapons_label_dir):
            for label in os.listdir(weapons_label_dir):
                shutil.copy2(f"{weapons_label_dir}/{label}", f"{combined_dataset}/{split}/labels/weapons_{label}")
    
    # Copy ARDS dataset (pistol class = 4 in weapons dataset)
    print("Copying ARDS pistol dataset...")
    for split in ['train', 'valid']:
        ards_img_dir = f"{ards_dataset}/{split}/images"
        ards_label_dir = f"{ards_dataset}/{split}/labels"
        
        if os.path.exists(ards_img_dir):
            for img in os.listdir(ards_img_dir):
                shutil.copy2(f"{ards_img_dir}/{img}", f"{combined_dataset}/{split}/images/pistol_{img}")
        
        if os.path.exists(ards_label_dir):
            for label in os.listdir(ards_label_dir):
                # Convert ARDS labels (class 0) to weapons labels (class 4 for pistol)
                convert_ards_labels(f"{ards_label_dir}/{label}", f"{combined_dataset}/{split}/labels/pistol_{label}")
    
    # Create combined data.yaml
    combined_yaml = {
        'train': 'train/images',
        'val': 'valid/images',
        'nc': 9,
        'names': ['automatic rifle', 'granade launcher', 'knife', 'machine gun', 'pistol', 'rocket launcher', 'shotgun', 'sniper', 'sword']
    }
    
    with open(f"{combined_dataset}/data.yaml", 'w') as f:
        yaml.dump(combined_yaml, f)
    
    print(f"Combined dataset created at: {combined_dataset}")
    return combined_dataset

def convert_ards_labels(input_path, output_path):
    """Convert ARDS labels (class 0) to weapons labels (class 4 for pistol)"""
    with open(input_path, 'r') as f:
        lines = f.readlines()
    
    converted_lines = []
    for line in lines:
        parts = line.strip().split()
        if parts:
            # Change class 0 (pistol in ARDS) to class 4 (pistol in weapons)
            parts[0] = '4'
            converted_lines.append(' '.join(parts) + '\n')
    
    with open(output_path, 'w') as f:
        f.writelines(converted_lines)

if __name__ == "__main__":
    create_combined_dataset()