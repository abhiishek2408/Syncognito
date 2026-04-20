import os
from PIL import Image, ImageDraw

def draw_logo(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Dark circle background
    margin = int(size * 0.1)
    circle_size = size - margin * 2
    d.ellipse((margin, margin, margin + circle_size, margin + circle_size), fill=(0, 0, 0, 255))
    
    # Draw the pulse line (heartbeat style, similar to the uploaded image)
    # The image is a green heartbeat line
    start_x = size * 0.3
    end_x = size * 0.7
    y = size * 0.5
    
    # Points for the pulse
    points = [
        (start_x, y),
        (size * 0.40, y), # flat before pulse
        (size * 0.45, y - size * 0.15), # up
        (size * 0.50, y + size * 0.10), # down
        (size * 0.55, y - size * 0.05), # up
        (size * 0.60, y), # back to center
        (end_x, y) # flat end
    ]
    
    # Draw thicker line depending on size
    line_width = max(int(size * 0.04), 2)
    green = (29, 185, 84, 255) # #1DB954
    d.line(points, fill=green, width=line_width, joint='curve')
    
    return img

dirs = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

base_dir = r"C:\Users\hp\Desktop\Real-Time-Music-Sync\MusicSyncApp\android\app\src\main\res"

for folder, size in dirs.items():
    folder_path = os.path.join(base_dir, folder)
    if os.path.exists(folder_path):
        img = draw_logo(size)
        img.save(os.path.join(folder_path, 'ic_launcher.png'))
        img.save(os.path.join(folder_path, 'ic_launcher_round.png'))
        print(f"Generated {size}x{size} icon in {folder}")

print("All Android Icons Generated!")
