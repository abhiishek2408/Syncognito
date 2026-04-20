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

high_res_logo = draw_logo(512)
assets_dir = r"C:\Users\hp\Desktop\Real-Time-Music-Sync\MusicSyncApp\src\assets"
if not os.path.exists(assets_dir):
    os.makedirs(assets_dir)
high_res_logo.save(os.path.join(assets_dir, 'logo.png'))
print("Saved 512x512 logo.png to assets folder")
