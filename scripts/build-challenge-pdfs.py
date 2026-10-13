"""
Generate three branded PDF resources for the Infinity Hoop 45-Day Challenge.
Brand: hot pink primary (#E91E8F), bold display headings, warm + motivating.
Page size: US Letter, print-friendly.
"""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white

# ── Brand palette ─────────────────────────────────────────────────
PRIMARY = HexColor("#E91E8F")
PRIMARY_SOFT = HexColor("#FCE4F1")
INK = HexColor("#0A0A0A")
MUTED = HexColor("#6B7280")
LINE = HexColor("#D1D5DB")
GOLD = HexColor("#D4A24C")

PAGE_W, PAGE_H = letter
MARGIN = 36

# ── Helpers ───────────────────────────────────────────────────────
def header_band(c, title, subtitle=None, height=72):
    c.setFillColor(PRIMARY)
    c.rect(0, PAGE_H - height, PAGE_W, height, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN, PAGE_H - 38, title)
    if subtitle:
        c.setFont("Helvetica", 11)
        c.drawString(MARGIN, PAGE_H - 56, subtitle)
    return PAGE_H - height

def section_label(c, x, y, text):
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x, y, text.upper())
    return y - 14

def fill_lines(c, x_start, x_end, y_start, count=3, gap=18):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    y = y_start
    for _ in range(count):
        y -= gap
        c.line(x_start, y, x_end, y)
    return y

def footer_motto(c, text):
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W / 2, 24, text)


# ── PDF 1: 45-Day Tracker ─────────────────────────────────────────
def make_tracker():
    out = "/Users/ashleybintner/Claude Code/public/challenge-resources/45-day/45-day-tracker.pdf"
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle("Infinity Hoop 45-Day Challenge Tracker")

    y = header_band(c, "INFINITY HOOP", "45-Day Challenge Tracker")

    # My why
    y -= 18
    y = section_label(c, MARGIN, y, "My why")
    y = fill_lines(c, MARGIN, PAGE_W - MARGIN, y + 14, count=3, gap=18)

    # Dates
    y -= 22
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN, y, "START DATE:")
    c.setStrokeColor(LINE)
    c.line(MARGIN + 80, y - 2, MARGIN + 230, y - 2)
    c.drawString(MARGIN + 280, y, "TARGET END:")
    c.line(MARGIN + 360, y - 2, PAGE_W - MARGIN, y - 2)

    # 45-circle daily check-off (9 cols × 5 rows)
    y -= 26
    y = section_label(c, MARGIN, y, "Daily check-off — fill in a circle for each day you hoop")

    cols = 9
    rows = 5
    cell_w = (PAGE_W - 2 * MARGIN) / cols
    radius = 14
    row_gap = 8
    grid_top = y - 4

    for r in range(rows):
        for col in range(cols):
            day = r * cols + col + 1
            cx = MARGIN + col * cell_w + cell_w / 2
            cy = grid_top - r * (radius * 2 + row_gap) - radius
            c.setStrokeColor(PRIMARY)
            c.setLineWidth(1.4)
            c.setFillColor(white)
            c.circle(cx, cy, radius, stroke=1, fill=1)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(cx, cy - 3, str(day))
    grid_bottom = grid_top - rows * (radius * 2 + row_gap)

    # Weekly check-in table
    y = grid_bottom - 18
    y = section_label(c, MARGIN, y, "Weekly check-in")

    headers = ["Week", "Weight", "Waist", "Hips", "Energy 1-5", "Mood 1-5"]
    n = len(headers)
    col_w = (PAGE_W - 2 * MARGIN) / n
    header_h = 20
    row_h = 22

    # Header row
    c.setFillColor(PRIMARY_SOFT)
    c.rect(MARGIN, y - header_h, PAGE_W - 2 * MARGIN, header_h, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    for i, h in enumerate(headers):
        c.drawCentredString(MARGIN + i * col_w + col_w / 2, y - header_h + 6, h)

    table_top = y - header_h
    table_bottom = table_top - 6 * row_h

    # Week labels and row separators
    c.setFont("Helvetica", 10)
    c.setFillColor(INK)
    for r in range(6):
        ry = table_top - (r + 1) * row_h
        c.drawCentredString(MARGIN + col_w / 2, ry + 8, f"Week {r + 1}")
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN, ry, PAGE_W - MARGIN, ry)

    # Outer + vertical lines
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    c.line(MARGIN, table_bottom, PAGE_W - MARGIN, table_bottom)
    for i in range(n + 1):
        x = MARGIN + i * col_w
        c.line(x, y, x, table_bottom)

    footer_motto(c, "you've got this — every circle filled is proof you showed up.")
    c.save()
    print(f"✓ {out}")


# ── PDF 2: Hoop Form Cheat Sheet ──────────────────────────────────
def make_form_cheatsheet():
    out = "/Users/ashleybintner/Claude Code/public/challenge-resources/45-day/hoop-form-cheat-sheet.pdf"
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle("Infinity Hoop Form Cheat Sheet")

    y = header_band(c, "HOOP FORM", "Cheat Sheet — beginner essentials", height=70)

    def section_box(c, y, title, lines, accent=PRIMARY):
        # Pink bullet/title bar
        c.setFillColor(accent)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(MARGIN, y, title.upper())
        c.setStrokeColor(accent)
        c.setLineWidth(2)
        c.line(MARGIN, y - 4, MARGIN + 24, y - 4)
        y -= 16
        c.setFillColor(INK)
        c.setFont("Helvetica", 10.5)
        for line in lines:
            # Body bullet
            c.setFillColor(PRIMARY)
            c.circle(MARGIN + 4, y + 3, 2.2, stroke=0, fill=1)
            c.setFillColor(INK)
            from reportlab.lib.utils import simpleSplit
            wrapped = simpleSplit(line, "Helvetica", 10.5, PAGE_W - 2 * MARGIN - 16)
            for j, w in enumerate(wrapped):
                c.drawString(MARGIN + 14, y, w)
                y -= 13
            y -= 2
        return y - 4

    y -= 12
    y = section_box(c, y, "Stance", [
        "Feet shoulder-width apart, one slightly forward.",
        "Knees soft — never locked, never deeply bent.",
        "Weight evenly centered. Stand tall like a string is pulling the top of your head up.",
    ])

    y = section_box(c, y, "Hip Movement", [
        "Push your hips FORWARD and BACK — not side to side.",
        "Small, fast pulses. Speed beats size.",
        "Cue: think \"push the wall behind you\" with the small of your back.",
    ])

    y = section_box(c, y, "Common Mistakes", [
        "Going side to side — kills the rotation.",
        "Leaning forward or back — keeps your core engaged but stay tall.",
        "Bending knees too much — locks your hips.",
        "Holding your breath — exhale on the push, inhale on the recover.",
    ])

    y = section_box(c, y, "3-Minute Warm-Up", [
        "30s gentle hip circles (no hoop) — wake up your obliques.",
        "30s cat-cows — mobilize the spine.",
        "30s standing side bends — open the ribcage.",
        "30s march in place — get the heart rate up.",
        "60s slow practice with the hoop — find your rhythm before you push.",
    ])

    y -= 4
    # Final encouragement box (pink soft bg)
    box_h = 70
    c.setFillColor(PRIMARY_SOFT)
    c.rect(MARGIN, y - box_h, PAGE_W - 2 * MARGIN, box_h, stroke=0, fill=1)
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN + 14, y - 18, "WHEN THE HOOP DROPS")
    c.setFillColor(INK)
    c.setFont("Helvetica", 10.5)
    from reportlab.lib.utils import simpleSplit
    msg = ("It's normal. Most beginners drop the hoop 50+ times the first week — "
           "every catch is your core firing up. Pick it up, reset, and go again. "
           "Day 14 will feel different. Trust it.")
    wrapped = simpleSplit(msg, "Helvetica", 10.5, PAGE_W - 2 * MARGIN - 28)
    yy = y - 34
    for w in wrapped:
        c.drawString(MARGIN + 14, yy, w)
        yy -= 13

    footer_motto(c, "form first. speed second. consistency wins everything.")
    c.save()
    print(f"✓ {out}")


# ── PDF 3: Weekly Meal Prep + Workout Planner ─────────────────────
def make_weekly_planner():
    out = "/Users/ashleybintner/Claude Code/public/challenge-resources/45-day/weekly-meal-prep-planner.pdf"
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle("My Hoop Week — Weekly Planner")

    y = header_band(c, "MY HOOP WEEK", "Plan your workouts, meals, and hydration for one week", height=70)

    # Week number blank
    y -= 16
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, y, "WEEK #")
    c.setStrokeColor(LINE)
    c.line(MARGIN + 56, y - 2, MARGIN + 130, y - 2)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN + 160, y, "DATES:")
    c.line(MARGIN + 200, y - 2, PAGE_W - MARGIN, y - 2)

    # Workouts
    y -= 22
    y = section_label(c, MARGIN, y, "Workouts this week")

    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    table_w = PAGE_W - 2 * MARGIN
    col_widths = [50, 320, 60, 30]  # Day, Workout, Min, ✓
    sum_w = sum(col_widths)
    # Scale column widths to fit page
    scale = table_w / sum_w
    col_widths = [w * scale for w in col_widths]
    headers = ["Day", "Workout name", "Min", "✓"]
    header_h = 18
    row_h = 18

    # Header strip
    c.setFillColor(PRIMARY_SOFT)
    c.rect(MARGIN, y - header_h, table_w, header_h, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    x = MARGIN
    for i, h in enumerate(headers):
        c.drawString(x + 6, y - header_h + 5, h)
        x += col_widths[i]

    table_top = y - header_h
    n_rows = 7
    table_bottom = table_top - n_rows * row_h

    c.setFont("Helvetica", 10)
    for r, day in enumerate(days):
        ry = table_top - (r + 1) * row_h
        c.setFillColor(INK)
        c.drawString(MARGIN + 6, ry + 5, day)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN, ry, PAGE_W - MARGIN, ry)

    # Vertical lines + outer
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    x = MARGIN
    for i in range(len(col_widths) + 1):
        c.line(x, y, x, table_bottom)
        if i < len(col_widths):
            x += col_widths[i]

    y = table_bottom - 18

    # Meals — 7 rows × 4 columns
    y = section_label(c, MARGIN, y, "Meals")
    meal_headers = ["Day", "Breakfast", "Lunch", "Dinner", "Snack"]
    n = len(meal_headers)
    m_col_w = table_w / n
    m_header_h = 18
    m_row_h = 22

    c.setFillColor(PRIMARY_SOFT)
    c.rect(MARGIN, y - m_header_h, table_w, m_header_h, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    for i, h in enumerate(meal_headers):
        c.drawString(MARGIN + i * m_col_w + 6, y - m_header_h + 5, h)

    m_top = y - m_header_h
    m_bottom = m_top - 7 * m_row_h

    c.setFont("Helvetica", 9.5)
    for r, day in enumerate(days):
        ry = m_top - (r + 1) * m_row_h
        c.setFillColor(INK)
        c.drawString(MARGIN + 6, ry + 7, day)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(MARGIN, ry, PAGE_W - MARGIN, ry)

    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    for i in range(n + 1):
        x = MARGIN + i * m_col_w
        c.line(x, y, x, m_bottom)

    y = m_bottom - 16

    # Bottom row — hydration + reflection — split into two columns
    col_left_x = MARGIN
    col_right_x = MARGIN + table_w / 2 + 8
    col_w = table_w / 2 - 8

    # Hydration tracker (left)
    y_top = y
    y2 = section_label(c, col_left_x, y_top, "Hydration — fill a glass for each cup")
    glass_w = 12
    glass_h = 16
    glass_gap = 4
    row_gap = 4
    label_w = 36
    glasses = 8
    for r, day in enumerate(days):
        # First row's glass top is BELOW y2 so it doesn't collide with the section label.
        ry = y2 - 6 - glass_h - r * (glass_h + row_gap)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(col_left_x, ry + 4, day)
        for g in range(glasses):
            gx = col_left_x + label_w + g * (glass_w + glass_gap)
            c.setStrokeColor(PRIMARY)
            c.setLineWidth(1)
            c.setFillColor(white)
            c.roundRect(gx, ry, glass_w, glass_h, 2, stroke=1, fill=1)
    y_hydration_bottom = y2 - 6 - len(days) * (glass_h + row_gap)

    # Reflection prompts (right) — start at same top as hydration
    y3 = section_label(c, col_right_x, y_top, "Reflection")
    prompts = ["Win this week:", "Hardest moment:", "Next week I'll:"]
    yy = y3 - 4
    for prompt in prompts:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(col_right_x, yy, prompt)
        yy -= 14
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(col_right_x, yy, col_right_x + col_w, yy)
        yy -= 14
        c.line(col_right_x, yy, col_right_x + col_w, yy)
        yy -= 12

    # Grocery list — full width below the hydration/reflection columns
    y = min(y_hydration_bottom, yy) - 14
    y = section_label(c, MARGIN, y, "Grocery list")
    # Draw as many lines as fit between here and the footer
    line_gap = 14
    footer_y = 40
    available = y - footer_y
    line_count = max(0, int(available / line_gap))
    half_w = (PAGE_W - 2 * MARGIN - 24) / 2
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    for i in range(line_count):
        ly = y - (i + 1) * line_gap
        if ly < footer_y:
            break
        c.line(MARGIN, ly, MARGIN + half_w, ly)
        c.line(MARGIN + half_w + 24, ly, PAGE_W - MARGIN, ly)

    footer_motto(c, "small, repeated, on purpose. that's how you change a body.")
    c.save()
    print(f"✓ {out}")


if __name__ == "__main__":
    make_tracker()
    make_form_cheatsheet()
    make_weekly_planner()
