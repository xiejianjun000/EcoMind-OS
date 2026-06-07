#!/usr/bin/env python3
"""
EcoMind OS Logo Generator
Neural Bloom Philosophy — A Thinking Ecological Brain
"""

import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from PIL import ImageFont
import os

# Color System
ECO_GREEN = (0, 201, 167)      # #00C9A7
WISDOM_CYAN = (14, 116, 144)   # #0E7490
INK_GRAY = (11, 30, 40)         # #0B1E28
DEEP_CYAN = (17, 33, 46)        # #11212E
GLOW_LIME = (204, 255, 0)       # #CCFF00
WARM_WHITE = (240, 244, 248)   # #F0F4F8

# Canvas setup
CANVAS_SIZE = 1200
CENTER = CANVAS_SIZE // 2

def lerp_color(c1, c2, t):
    """Linear interpolation between two colors"""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_gradient_line(draw, p1, p2, color1, color2, width=3, steps=50):
    """Draw a gradient line from p1 to p2"""
    x1, y1 = p1
    x2, y2 = p2
    for i in range(steps):
        t = i / steps
        color = lerp_color(color1, color2, t)
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        draw.ellipse([x-width/2, y-width/2, x+width/2, y+width/2], fill=color)

def draw_neural_node(draw, pos, radius, color, glow=True):
    """Draw a neural network node with optional glow"""
    x, y = pos
    if glow:
        # Outer glow
        for r in range(radius*3, radius, -1):
            alpha = int(80 * (1 - (r - radius) / (radius*2)))
            glow_color = color + (alpha,)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=glow_color)
    # Core
    draw.ellipse([x-radius, y-radius, x+r, y+r], fill=color)

def draw_leaf_shape(draw, center, size, color, alpha=255):
    """Draw a stylized leaf shape using bezier-like curves"""
    cx, cy = center
    s = size
    
    # Leaf outline points (organic curve approximation)
    points = []
    for i in range(100):
        t = i / 99
        # Create leaf shape using parametric equations
        angle = math.pi * t - math.pi/2
        # Leaf width varies: narrow at top/bottom, wide in middle
        width_factor = math.sin(math.pi * t) * 0.4 + 0.3
        x = cx + math.cos(angle) * s * 0.3 * width_factor
        y = cy + t * s * 1.6 - s * 0.8
        points.append((x, y))
    
    # Close the leaf on the other side
    for i in range(100):
        t = i / 99
        angle = math.pi * t - math.pi/2
        width_factor = math.sin(math.pi * t) * 0.4 + 0.3
        x = cx - math.cos(angle) * s * 0.3 * width_factor
        y = cy + t * s * 1.6 - s * 0.8
        points.append((x, y))
    
    # Draw filled leaf
    draw.polygon(points, fill=color + (alpha,))

def draw_leaf_veins(draw, center, size, alpha=200):
    """Draw neural-network styled leaf veins as the main S-curve data flow"""
    cx, cy = center
    s = size
    
    # Main vein S-curve (the data flow backbone)
    main_vein_points = []
    for i in range(100):
        t = i / 99
        # S-curve with organic feel
        x = cx + math.sin(t * math.pi * 2) * s * 0.12
        y = cy + t * s * 1.4 - s * 0.7
        main_vein_points.append((x, y))
    
    # Draw main vein with gradient
    for i in range(len(main_vein_points) - 1):
        t = i / 99
        color = lerp_color(ECO_GREEN, WISDOM_CYAN, t)
        draw_gradient_line(draw, main_vein_points[i], main_vein_points[i+1], 
                          color, color, width=4, steps=10)
    
    # Secondary veins branching out (neural network topology)
    secondary_veins = []
    for i in range(8):
        t = 0.15 + i * 0.1
        idx = int(t * 99)
        if idx < len(main_vein_points):
            base_point = main_vein_points[idx]
            # Branch out left and right with neural node at end
            angle = math.sin(t * math.pi) * math.pi * 0.3
            for direction in [-1, 1]:
                length = s * (0.2 + 0.1 * math.sin(t * math.pi * 3))
                end_x = base_point[0] + direction * math.cos(angle + direction*0.5) * length
                end_y = base_point[1] + math.sin(angle) * length * 0.3
                secondary_veins.append((base_point, (end_x, end_y)))
    
    # Draw secondary veins
    for start, end in secondary_veins:
        # Create gradient from main vein color to cyan
        draw_gradient_line(draw, start, end, ECO_GREEN, WISDOM_CYAN, width=2, steps=20)
    
    return main_vein_points

def draw_neural_nodes(draw, main_vein_points, size):
    """Draw neural network nodes along the vein structure"""
    s = size
    
    # Key nodes along main vein
    node_positions = []
    for i in [15, 25, 40, 55, 70, 85]:
        idx = int(i * len(main_vein_points) / 100)
        if idx < len(main_vein_points):
            node_positions.append(main_vein_points[idx])
    
    # Draw nodes with glow effect
    for pos in node_positions:
        draw_neural_node(draw, pos, 8, ECO_GREEN, glow=True)
    
    # Branch nodes (smaller)
    branch_positions = []
    for i in range(8):
        t = 0.15 + i * 0.1
        idx = int(t * 99)
        if idx < len(main_vein_points):
            base = main_vein_points[idx]
            for direction in [-1, 1]:
                angle = math.sin(t * math.pi) * math.pi * 0.3
                length = s * (0.2 + 0.1 * math.sin(t * math.pi * 3))
                x = base[0] + direction * math.cos(angle + direction*0.5) * length
                y = base[1] + math.sin(angle) * length * 0.3
                branch_positions.append((x, y))
    
    for pos in branch_positions:
        draw_neural_node(draw, pos, 5, WISDOM_CYAN, glow=True)

def draw_grid_background(draw, canvas_size, spacing=40):
    """Draw subtle ecological data grid in background"""
    # Horizontal lines
    for y in range(0, canvas_size, spacing):
        alpha = int(15 + 10 * math.sin(y / canvas_size * math.pi))
        draw.line([(0, y), (canvas_size, y)], fill=INK_GRAY + (alpha,), width=1)
    
    # Vertical lines
    for x in range(0, canvas_size, spacing):
        alpha = int(15 + 10 * math.sin(x / canvas_size * math.pi))
        draw.line([(x, 0), (x, canvas_size)], fill=INK_GRAY + (alpha,), width=1)
    
    # Grid intersection nodes (subtle)
    for y in range(0, canvas_size, spacing):
        for x in range(0, canvas_size, spacing):
            alpha = int(20 + 15 * math.sin((x+y) / canvas_size * math.pi))
            draw.ellipse([x-1, y-1, x+1, y+1], fill=INK_GRAY + (alpha,))

def draw_hexagonal_pattern(draw, center, radius, alpha=30):
    """Draw hexagonal cell pattern (parametric growth unit)"""
    cx, cy = center
    points = []
    for i in range(6):
        angle = math.pi / 3 * i - math.pi / 6
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        points.append((x, y))
    
    draw.polygon(points, outline=WISDOM_CYAN + (alpha,), fill=None)

def create_logo():
    """Generate the EcoMind OS Logo"""
    # Create canvas with RGBA support
    img = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background - deep space ecological
    bg = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), INK_GRAY + (255,))
    img.paste(bg, (0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw subtle grid background
    draw_grid_background(draw, CANVAS_SIZE, spacing=50)
    
    # Draw hexagonal patterns (parametric growth units)
    hex_positions = [
        (CANVAS_SIZE * 0.2, CANVAS_SIZE * 0.3),
        (CANVAS_SIZE * 0.8, CANVAS_SIZE * 0.25),
        (CANVAS_SIZE * 0.15, CANVAS_SIZE * 0.7),
        (CANVAS_SIZE * 0.85, CANVAS_SIZE * 0.75),
    ]
    for pos in hex_positions:
        draw_hexagonal_pattern(draw, pos, 60, alpha=25)
    
    # Main leaf/neural structure centered
    leaf_center = (CENTER, CENTER + 20)
    leaf_size = 320
    
    # Create leaf shape with subtle gradient
    draw_leaf_shape(draw, leaf_center, leaf_size, INK_GRAY, alpha=180)
    
    # Draw main neural vein structure
    main_vein = draw_leaf_veins(draw, leaf_center, leaf_size, alpha=220)
    
    # Draw neural nodes
    draw_neural_nodes(draw, main_vein, leaf_size)
    
    # Add glow particles along the vein (data flow visualization)
    np.random.seed(42)  # Consistent random pattern
    for i in range(50):
        t = np.random.random()
        idx = int(t * (len(main_vein) - 1))
        if idx < len(main_vein):
            base = main_vein[idx]
            offset = np.random.normal(0, 15)
            x = base[0] + offset
            y = base[1] + np.random.normal(0, 10)
            
            # Glow lime for active data points
            if np.random.random() > 0.7:
                draw.ellipse([x-3, y-3, x+3, y+3], fill=GLOW_LIME + (180,))
            else:
                draw.ellipse([x-2, y-2, x+2, y+2], fill=ECO_GREEN + (120,))
    
    # Draw text elements
    try:
        # Try to load a clean sans-serif font
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        font_os = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
        font_os = ImageFont.load_default()
    
    # Text: "Eco" in green, "Mind" in white
    eco_text = "Eco"
    mind_text = "Mind"
    os_text = "OS"
    
    # Measure text widths for centering
    bbox_eco = draw.textbbox((0, 0), eco_text, font=font_large)
    bbox_mind = draw.textbbox((0, 0), mind_text, font=font_large)
    
    eco_width = bbox_eco[2] - bbox_eco[0]
    mind_width = bbox_mind[2] - bbox_mind[0]
    total_width = eco_width + mind_width + 10  # small gap
    
    start_x = CENTER - total_width // 2
    eco_y = CANVAS_SIZE - 180
    
    # Draw "Eco" in gradient green
    draw.text((start_x, eco_y), eco_text, font=font_large, fill=ECO_GREEN)
    
    # Draw "Mind" in warm white
    mind_x = start_x + eco_width + 10
    draw.text((mind_x, eco_y), mind_text, font=font_large, fill=WARM_WHITE)
    
    # Draw "OS" as superscript
    os_bbox = draw.textbbox((0, 0), os_text, font=font_os)
    os_width = os_bbox[2] - os_bbox[0]
    os_x = mind_x + mind_width + 5
    os_y = eco_y - 15
    draw.text((os_x, os_y), os_text, font=font_os, fill=WISDOM_CYAN + (200,))
    
    # Tagline
    tagline = "Intelligence that Nurtures the Planet"
    tagline_bbox = draw.textbbox((0, 0), tagline, font=font_small)
    tagline_width = tagline_bbox[2] - tagline_bbox[0]
    tagline_x = CENTER - tagline_width // 2
    tagline_y = eco_y + 90
    draw.text((tagline_x, tagline_y), tagline, font=font_small, fill=WARM_WHITE + (160,))
    
    # Add subtle circular glow behind leaf (consciousness flow)
    for r in range(200, 280, 20):
        alpha = int(8 * (1 - (r - 200) / 80))
        draw.ellipse([CENTER-r, CENTER+20-r, CENTER+r, CENTER+20+r], 
                    fill=None, outline=ECO_GREEN + (alpha,))
    
    return img

def create_logo_variation_simple():
    """Create a simpler, more icon-focused logo variation"""
    img = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle
    draw.ellipse([0, 0, 399, 399], fill=INK_GRAY + (255,))
    
    # Center leaf/neural structure
    cx, cy = 200, 200
    size = 140
    
    # Draw S-curve main vein
    points = []
    for i in range(100):
        t = i / 99
        x = cx + math.sin(t * math.pi * 2) * size * 0.25
        y = cy + t * size * 1.6 - size * 0.8
        points.append((x, y))
    
    # Draw main vein with glow
    for i in range(len(points) - 1):
        t = i / 99
        color = lerp_color(ECO_GREEN, WISDOM_CYAN, t)
        draw_gradient_line(draw, points[i], points[i+1], color, color, width=6, steps=10)
    
    # Neural nodes along the vein
    node_indices = [15, 30, 50, 70, 85]
    for idx in node_indices:
        if idx < len(points):
            draw_neural_node(draw, points[idx], 10, ECO_GREEN, glow=True)
    
    # Branch nodes
    for i, idx in enumerate(node_indices[:-1]):
        t = idx / 99
        base = points[idx]
        for direction in [-1, 1]:
            length = 50 + 20 * math.sin(t * math.pi * 2)
            angle = math.pi * 0.3 * direction
            x = base[0] + math.cos(angle) * length
            y = base[1] + length * 0.2
            draw_neural_node(draw, (x, y), 6, WISDOM_CYAN, glow=True)
    
    # Data particles
    np.random.seed(42)
    for _ in range(30):
        t = np.random.random()
        idx = int(t * 99)
        if idx < len(points):
            base = points[idx]
            x = base[0] + np.random.normal(0, 20)
            y = base[1] + np.random.normal(0, 15)
            if np.random.random() > 0.6:
                draw.ellipse([x-3, y-3, x+3, y+3], fill=GLOW_LIME + (200,))
            else:
                draw.ellipse([x-2, y-2, x+2, y+2], fill=ECO_GREEN + (150,))
    
    return img

if __name__ == "__main__":
    output_dir = "/workspace/VI"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating EcoMind OS Logo...")
    
    # Main logo (full version)
    logo = create_logo()
    logo.save(os.path.join(output_dir, "ecomind_os_logo_full.png"), "PNG", optimize=True)
    print(f"  - Saved: ecomind_os_logo_full.png")
    
    # Logo variation (icon version)
    logo_icon = create_logo_variation_simple()
    logo_icon.save(os.path.join(output_dir, "ecomind_os_logo_icon.png"), "PNG", optimize=True)
    print(f"  - Saved: ecomind_os_logo_icon.png")
    
    # Also create a PDF version
    logo_pdf = logo.convert('RGB')
    logo_pdf.save(os.path.join(output_dir, "ecomind_os_logo_full.pdf"), "PDF")
    print(f"  - Saved: ecomind_os_logo_full.pdf")
    
    logo_icon_pdf = logo_icon.convert('RGB')
    logo_icon_pdf.save(os.path.join(output_dir, "ecomind_os_logo_icon.pdf"), "PDF")
    print(f"  - Saved: ecomind_os_logo_icon.pdf")
    
    print("\nLogo generation complete!")
    print(f"Files saved to: {output_dir}")
