#!/usr/bin/env python3
"""
EcoMind OS Professional Logo Generator
Based on OpenAI, Google, Microsoft brand design guidelines
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Color System - Professional Tech Palette (RGB tuples for PIL)
ECO_GREEN = (0, 201, 167)     # Primary brand color (eco/innovation)
TECH_WHITE = (255, 255, 255)  # Light mode text
DARK_GRAY = (18, 18, 20)      # Dark mode background
MID_GRAY = (45, 45, 50)       # Card background
ACCENT_CYAN = (14, 116, 144)  # Secondary tech color

def draw_hexagon_mark(draw, cx, cy, radius, color):
    """
    Draw a professional hexagon mark like OpenAI's design
    - Hexagon = nature + tech (honeycomb + molecular structure)
    """
    import math
    points = []
    for i in range(6):
        angle = math.pi / 3 * i - math.pi / 2
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        points.append((x, y))
    
    draw.polygon(points, outline=color, width=4)
    
    # Inner circuit lines (like OpenAI's intertwined pattern)
    # Simpler, cleaner version for EcoMind
    draw.line([(cx - radius*0.5, cy), (cx + radius*0.5, cy)], fill=color, width=3)
    draw.line([(cx, cy - radius*0.4), (cx, cy + radius*0.4)], fill=color, width=3)

def create_wordmark_only():
    """
    Pure wordmark logo (primary brand mark)
    Similar to OpenAI's main wordmark
    """
    w, h = 1000, 400
    img = Image.new('RGB', (w, h), DARK_GRAY)
    draw = ImageDraw.Draw(img)
    
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        font_brand = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 32)
    except:
        font_main = font_brand = ImageFont.load_default()
    
    # Calculate positioning for centered layout
    # Eco (green) + Mind (white) + OS (cyan, smaller)
    eco_text = "Eco"
    mind_text = "Mind"
    os_text = "OS"
    
    # Measure text widths
    eco_bbox = draw.textbbox((0,0), eco_text, font=font_main)
    eco_w = eco_bbox[2] - eco_bbox[0]
    
    mind_bbox = draw.textbbox((0,0), mind_text, font=font_main)
    mind_w = mind_bbox[2] - mind_bbox[0]
    
    os_bbox = draw.textbbox((0,0), os_text, font=font_main)
    os_w = os_bbox[2] - os_bbox[0]
    
    # Center everything
    total_w = eco_w + 10 + mind_w + 20 + os_w*0.7
    start_x = (w - total_w) / 2
    y = h * 0.4
    
    # Draw text parts
    draw.text((start_x, y), eco_text, font=font_main, fill=ECO_GREEN)
    draw.text((start_x + eco_w + 10, y), mind_text, font=font_main, fill=TECH_WHITE)
    
    # Smaller OS, slightly raised
    os_y = y - 15
    os_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 55)
    draw.text((start_x + eco_w + 10 + mind_w + 20, os_y), os_text, font=os_font, fill=ACCENT_CYAN)
    
    return img

def create_with_hexagon_mark():
    """
    Logo with hexagon mark + wordmark (lockup)
    Similar to OpenAI's lockup style
    """
    w, h = 1400, 500
    img = Image.new('RGB', (w, h), DARK_GRAY)
    draw = ImageDraw.Draw(img)
    
    # Left side: hexagon mark
    mark_cx = 250
    mark_cy = h / 2
    draw_hexagon_mark(draw, mark_cx, mark_cy, 90, ECO_GREEN)
    
    # Right side: wordmark
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 85)
    except:
        font_main = ImageFont.load_default()
    
    text_start_x = 420
    y = h / 2 - 50
    
    eco_text = "Eco"
    mind_text = "Mind"
    os_text = "OS"
    
    eco_bbox = draw.textbbox((0,0), eco_text, font=font_main)
    eco_w = eco_bbox[2] - eco_bbox[0]
    
    mind_bbox = draw.textbbox((0,0), mind_text, font=font_main)
    mind_w = mind_bbox[2] - mind_bbox[0]
    
    draw.text((text_start_x, y), eco_text, font=font_main, fill=ECO_GREEN)
    draw.text((text_start_x + eco_w + 10, y), mind_text, font=font_main, fill=TECH_WHITE)
    
    os_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
    draw.text((text_start_x + eco_w + 10 + mind_w + 25, y - 15), os_text, font=os_font, fill=ACCENT_CYAN)
    
    return img

def create_icon_only():
    """
    Standalone icon (app icon, favicon)
    Hexagon with internal circuit pattern
    """
    size = 512
    img = Image.new('RGB', (size, size), DARK_GRAY)
    draw = ImageDraw.Draw(img)
    
    draw_hexagon_mark(draw, size/2, size/2, 160, ECO_GREEN)
    
    return img

def create_tagline_version():
    """
    Logo with Chinese brand concept tagline
    Centered, clean layout
    """
    w, h = 1200, 600
    img = Image.new('RGB', (w, h), DARK_GRAY)
    draw = ImageDraw.Draw(img)
    
    # Hexagon mark at top
    draw_hexagon_mark(draw, w/2, 140, 70, ECO_GREEN)
    
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        font_brand = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 34)
    except:
        font_main = font_brand = ImageFont.load_default()
    
    y_text = 260
    
    eco_text = "Eco"
    mind_text = "Mind"
    os_text = "OS"
    
    eco_bbox = draw.textbbox((0,0), eco_text, font=font_main)
    eco_w = eco_bbox[2] - eco_bbox[0]
    
    mind_bbox = draw.textbbox((0,0), mind_text, font=font_main)
    mind_w = mind_bbox[2] - mind_bbox[0]
    
    total_w = eco_w + 10 + mind_w + 20 + 50
    start_x = (w - total_w) / 2
    
    draw.text((start_x, y_text), eco_text, font=font_main, fill=ECO_GREEN)
    draw.text((start_x + eco_w + 10, y_text), mind_text, font=font_main, fill=TECH_WHITE)
    
    os_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
    draw.text((start_x + eco_w + 10 + mind_w + 25, y_text - 12), os_text, font=os_font, fill=ACCENT_CYAN)
    
    # Tagline - Chinese brand concept
    tagline = "会思考的生态大脑"
    tag_bbox = draw.textbbox((0,0), tagline, font=font_brand)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.text(((w - tag_w) / 2, y_text + 150), tagline, font=font_brand, fill=ECO_GREEN)
    
    return img

if __name__ == "__main__":
    output_dir = "/workspace/VI/professional"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating Professional EcoMind OS Logos...")
    
    # 1. Primary wordmark (no icon)
    logo_wordmark = create_wordmark_only()
    logo_wordmark.save(os.path.join(output_dir, "ecomind_wordmark_dark.png"))
    
    # 2. Lockup with hexagon mark
    logo_lockup = create_with_hexagon_mark()
    logo_lockup.save(os.path.join(output_dir, "ecomind_lockup_dark.png"))
    
    # 3. Icon only (app icon)
    logo_icon = create_icon_only()
    logo_icon.save(os.path.join(output_dir, "ecomind_icon.png"))
    
    # 4. Full version with tagline
    logo_tagline = create_tagline_version()
    logo_tagline.save(os.path.join(output_dir, "ecomind_full_with_tagline.png"))
    
    print(f"All logos saved to {output_dir}")
    print("\nVariants created:")
    print("- Wordmark only (primary brand mark)")
    print("- Lockup with hexagon mark")
    print("- Standalone icon (app icon)")
    print("- Full version with Chinese tagline")
