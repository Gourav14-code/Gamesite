import shutil
import os

def sync_projects():
    dist_dir = r"d:\gamesite\dist"
    
    # 1. Sync to android-pistolfight
    dst_pistol = r"d:\gamesite\android-pistolfight\app\src\main\assets\public"
    os.makedirs(dst_pistol, exist_ok=True)
    for item in os.listdir(dist_dir):
        s = os.path.join(dist_dir, item)
        d = os.path.join(dst_pistol, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
            
    index_p = os.path.join(dst_pistol, "index.html")
    with open(index_p, "r", encoding="utf-8") as f:
        content_p = f.read()
    script_p = '<script>window.__APP_TARGET__ = "pistolfight";</script>'
    if script_p not in content_p:
        content_p = content_p.replace("<head>", f"<head>{script_p}")
    with open(index_p, "w", encoding="utf-8") as f:
        f.write(content_p)
    print("android-pistolfight assets updated successfully!")

    # 2. Sync to android-bikeracer
    dst_bike = r"d:\gamesite\android-bikeracer\app\src\main\assets\public"
    os.makedirs(dst_bike, exist_ok=True)
    for item in os.listdir(dist_dir):
        s = os.path.join(dist_dir, item)
        d = os.path.join(dst_bike, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
            
    index_b = os.path.join(dst_bike, "index.html")
    with open(index_b, "r", encoding="utf-8") as f:
        content_b = f.read()
    script_b = '<script>window.__APP_TARGET__ = "bikeracer";</script>'
    if script_b not in content_b:
        content_b = content_b.replace("<head>", f"<head>{script_b}")
    with open(index_b, "w", encoding="utf-8") as f:
        f.write(content_b)
    print("android-bikeracer assets updated successfully!")

if __name__ == "__main__":
    sync_projects()
