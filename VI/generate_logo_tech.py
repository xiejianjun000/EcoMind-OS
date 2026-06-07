#!/usr/bin/env python3
"""
EcoMind OS Logo Generator v2
Tech-Style Logo — Hard-edged, Geometric, Bold
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Color System - Tech Palette
ECO_GREEN = (0, 201, 167)      # #00C9A7
WISDOM_CYAN = (14, 116, 144)   # #0E7490
DARK_GRAY = (18, 18, 22)       # #121216
DARKER_GRAY = (12, 12, 16)     # #0C0C10
TECH_WHITE = (255, 255, 255)   # Pure white
ACCENT_CYAN = (0, 195, 255)    # #00C3FF

# Canvas setup
CANVAS_SIZE = 1200
CENTER = CANVAS_SIZE // 2

def draw_tech_background(draw, size):
    """Draw tech-style background with grid and subtle patterns"""
    # Main background
    draw.rectangle([0, 0, size, size], fill=DARKER_GRAY)
    
    # Tech grid lines
    for i in range(0, size, 80):
        # Horizontal grid
        alpha = 30 if i % 320 == 0 else 15
        draw.line([(0, i), (size, i)], fill=DARK_GRAY + (alpha,), width=1)
        # Vertical grid
        draw.line([(i, 0), (i, size)], fill=DARK_GRAY + (alpha,), width=1)
    
    # Corner accent lines
    line_color = ECO_GREEN + (40,)
    # Top left
    draw.line([(100, 100), (200, 100)], fill=line_color, width=3)
    draw.line([(100, 100), (100, 200)], fill=line_color, width=3)
    # Top right
    draw.line([(size-200, 100), (size-100, 100)], fill=line_color, width=3)
    draw.line([(size-100, 100), (size-100, 200)], fill=line_color, width=3)
    # Bottom left
    draw.line([(100, size-200), (100, size-100)], fill=line_color, width=3)
    draw.line([(100, size-100), (200, size-100)], fill=line_color, width=3)
    # Bottom right
    draw.line([(size-200, size-100), (size-100, size-100)], fill=line_color, width=3)
    draw.line([(size-100, size-200), (size-100, size-100)], fill=line_color, width=3)

def draw_logo_mark(draw, x, y, size):
    """Draw tech-style geometric logo mark (square + circuit pattern)"""
    s = size
    
    # Outer square (rounded corners for modern tech feel)
    radius = s * 0.08
    draw_rounded_rect(draw, x - s/2, y - s/2, x + s/2, y + s/2, radius, 
                     fill=DARK_GRAY, outline=ECO_GREEN, width=4)
    
    # Inner circuit pattern (hard-edged geometric)
    # Vertical center line
    draw.rectangle([x - s*0.03, y - s*0.35, x + s*0.03, y + s*0.35], 
                  fill=ECO_GREEN)
    
    # Horizontal lines (circuit connections)
    line_y_positions = [-s*0.25, -s*0.1, s*0.1, s*0.25]
    for ly in line_y_positions:
        # Left branch
        draw.rectangle([x - s*0.3, y + ly - s*0.03, x - s*0.1, y + ly + s*0.03],
                      fill=WISDOM_CYAN)
        # Connecting node
        draw.rectangle([x - s*0.1 - s*0.04, y + ly - s*0.04, 
                       x - s*0.1 + s*0.04, y + ly + s*0.04],
                      fill=ECO_GREEN)
        
        # Right branch
        draw.rectangle([x + s*0.1, y + ly - s*0.03, x + s*0.3, y + ly + s*0.03],
                      fill=WISDOM_CYAN)
        # Connecting node
        draw.rectangle([x + s*0.1 - s*0.04, y + ly - s*0.04, 
                       x + s*0.1 + s*0.04, y + ly + s*0.04],
                      fill=ECO_GREEN)
    
    # Top/bottom nodes
    draw.rectangle([x - s*0.05, y - s*0.35 - s*0.05, 
                   x + s*0.05, y - s*0.35 + s*0.05],
                  fill=ACCENT_CYAN)
    draw.rectangle([x - s*0.05, y + s*0.35 - s*0.05, 
                   x + s*0.05, y + s*0.35 + s*0.05],
                  fill=ACCENT_CYAN)

def draw_rounded_rect(draw, x1, y1, x2, y2, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle"""
    # Draw four corners and connect
    # Top left
    draw.ellipse([x1, y1, x1 + radius*2, y1 + radius*2], fill=fill)
    # Top right
    draw.ellipse([x2 - radius*2, y1, x2, y1 + radius*2], fill=fill)
    # Bottom left
    draw.ellipse([x1, y2 - radius*2, x1 + radius*2, y2], fill=fill)
    # Bottom right
    draw.ellipse([x2 - radius*2, y2 - radius*2, x2, y2], fill=fill)
    # Center rectangles
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    
    # Outline if specified
    if outline and width > 0:
        draw.line([x1 + radius, y1, x2 - radius, y1], fill=outline, width=width)
        draw.line([x1 + radius, y2, x2 - radius, y2], fill=outline, width=width)
        draw.line([x1, y1 + radius, x1, y2 - radius], fill=outline, width=width)
        draw.line([x2, y1 + radius, x2, y2 - radius], fill=outline, width=width)

def create_tech_logo():
    """Create tech-style logo with strong geometric feel"""
    img = Image.new('RGB', (CANVAS_SIZE, CANVAS_SIZE), DARKER_GRAY)
    draw = ImageDraw.Draw(img)
    
    # Background
    draw_tech_background(draw, CANVAS_SIZE)
    
    # Logo mark (geometric icon)
    mark_size = 220
    mark_x = CENTER - 280
    mark_y = CENTER - 80
    draw_logo_mark(draw, mark_x, mark_y, mark_size)
    
    # Text: EcoMind OS
    try:
        # Try modern bold sans-serif fonts with Chinese support
        font_eco = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
        font_mind = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
        font_os = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_tag_en = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
        font_tag_zh = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 36)
    except:
        font_eco = font_mind = font_os = font_tag_en = font_tag_zh = ImageFont.load_default()
    
    # Text positioning
    text_start_x = mark_x + mark_size/2 + 60
    text_y = CENTER - 120
    
    # Draw "Eco" in green
    draw.text((text_start_x, text_y), "Eco", font=font_eco, fill=ECO_GREEN)
    
    # Measure Eco width
    bbox_eco = draw.textbbox((0, 0), "Eco", font=font_eco)
    eco_width = bbox_eco[2] - bbox_eco[0]
    
    # Draw "Mind" in white
    mind_x = text_start_x + eco_width + 10
    draw.text((mind_x, text_y), "Mind", font=font_mind, fill=TECH_WHITE)
    
    # Draw "OS"
    bbox_mind = draw.textbbox((0, 0), "Mind", font=font_mind)
    mind_width = bbox_mind[2] - bbox_mind[0]
    os_x = mind_x + mind_width + 25
    os_y = text_y - 10
    draw.text((os_x, os_y), "OS", font=font_os, fill=ACCENT_CYAN)
    
    # Calculate center of the text block for alignment
    total_text_width = eco_width + 10 + mind_width + 25 + (bbox_mind[2] - bbox_mind[0])
    text_center_x = text_start_x + total_text_width // 2
    
    # --- Line 2: English tagline (centered under main text) ---
    tagline_en = "Intelligence that Nurtures the Planet"
    bbox_en = draw.textbbox((0, 0), tagline_en, font=font_tag_en)
    tag_en_width = bbox_en[2] - bbox_en[0]
    tag_en_x = text_center_x - tag_en_width // 2
    tag_en_y = text_y + 160
    draw.text((tag_en_x, tag_en_y), tagline_en, font=font_tag_en, fill=(180, 180, 190))
    
    # --- Line 3: Chinese brand idea (centered under English) ---
    tagline_zh = "会思考的生态大脑"
    bbox_zh = draw.textbbox((0, 0), tagline_zh, font=font_tag_zh)
    tag_zh_width = bbox_zh[2] - bbox_zh[0]
    tag_zh_x = text_center_x - tag_zh_width // 2
    tag_zh_y = tag_en_y + 60
    draw.text((tag_zh_x, tag_zh_y), tagline_zh, font=font_tag_zh, fill=ECO_GREEN)
    
    # Accent line - centered under main text
    line_width = tag_en_width * 0.35
    line_x = text_center_x - line_width // 2
    draw.rectangle([line_x, text_y + 135, line_x + line_width, text_y + 140], fill=ECO_GREEN)
    
    return img

def create_simple_text_logo():
    """Create pure text logo (tech-style)"""
    img = Image.new('RGB', (1000, 500), DARKER_GRAY)
    draw = ImageDraw.Draw(img)
    
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 100)
        font_tag_en = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
        font_tag_zh = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 36)
    except:
        font_main = font_tag_en = font_tag_zh = ImageFont.load_default()
    
    center_x = 500
    base_y = 150
    
    # --- Line 1: EcoMind OS (centered) ---
    text_eco = "Eco"
    text_mind = "Mind"
    text_os = "OS"
    
    # Measure widths
    bbox_eco = draw.textbbox((0, 0), text_eco, font=font_main)
    eco_w = bbox_eco[2] - bbox_eco[0]
    
    bbox_mind = draw.textbbox((0, 0), text_mind, font=font_main)
    mind_w = bbox_mind[2] - bbox_mind[0]
    
    bbox_os = draw.textbbox((0, 0), text_os, font=font_main)
    os_w = bbox_os[2] - bbox_os[0]
    
    total_width = eco_w + 10 + mind_w + 20 + os_w
    start_x = center_x - total_width // 2
    
    # Draw Eco
    draw.text((start_x, base_y - 60), text_eco, font=font_main, fill=ECO_GREEN)
    # Draw Mind
    draw.text((start_x + eco_w + 10, base_y - 60), text_mind, font=font_main, fill=TECH_WHITE)
    # Draw OS
    draw.text((start_x + eco_w + 10 + mind_w + 20, base_y - 40), text_os, font=font_main, fill=ACCENT_CYAN)
    
    # --- Line 2: English tagline (centered) ---
    tagline_en = "Intelligence that Nurtures the Planet"
    bbox_en = draw.textbbox((0, 0), tagline_en, font=font_tag_en)
    tag_en_w = bbox_en[2] - bbox_en[0]
    tag_en_x = center_x - tag_en_w // 2
    draw.text((tag_en_x, base_y + 80), tagline_en, font=font_tag_en, fill=(180, 180, 190))
    
    # --- Line 3: Chinese brand idea (centered) ---
    tagline_zh = "会思考的生态大脑"
    bbox_zh = draw.textbbox((0, 0), tagline_zh, font=font_tag_zh)
    tag_zh_w = bbox_zh[2] - bbox_zh[0]
    tag_zh_x = center_x - tag_zh_w // 2
    draw.text((tag_zh_x, base_y + 140), tagline_zh, font=font_tag_zh, fill=ECO_GREEN)
    
    # Accent line - centered under main text
    line_width = tag_en_w * 0.35
    line_x = center_x - line_width // 2
    draw.rectangle([line_x, base_y + 55, line_x + line_width, base_y + 60], fill=ECO_GREEN)
    
    return img

if __name__ == "__main__":
    output_dir = "/workspace/VI"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating Tech-Style EcoMind OS Logos...")
    
    # Full tech logo with mark
    logo_tech = create_tech_logo()
    logo_tech.save(os.path.join(output_dir, "ecomind_os_logo_tech_full.png"), "PNG", optimize=True)
    logo_tech.save(os.path.join(output_dir, "ecomind_os_logo_tech_full.pdf"), "PDF")
    print(f"  - Saved: ecomind_os_logo_tech_full.png / .pdf")
    
    # Simple text-only logo
    logo_text = create_simple_text_logo()
    logo_text.save(os.path.join(output_dir, "ecomind_os_logo_text_only.png"), "PNG", optimize=True)
    logo_text.save(os.path.join(output_dir, "ecomind_os_logo_text_only.pdf"), "PDF")
    print(f"  - Saved: ecomind_os_logo_text_only.png / .pdf")
    
    print("\nTech-style logo generation complete!")
