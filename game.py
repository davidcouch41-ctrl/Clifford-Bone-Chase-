import math
import random
import tkinter as tk


WINDOW_SIZE = 760
ARENA_SIZE = 720
PADDING = 20
FPS_MS = 16
BASE_SPEED = 3.2
TURN_RATE = 0.16
BASE_RADIUS = 22
WIDTH_GAIN = 3
SEGMENT_GAP = 18
SEGMENT_COUNT = 12
HISTORY_LIMIT = 2400
BACKGROUND = "#111922"
GRASS_TOP = "#7dcf6c"
GRASS_BOTTOM = "#539f46"
DOG_RED = "#d62323"
DOG_RED_DARK = "#bc1212"
DOG_EAR = "#9d0b0b"
DOG_SNOUT = "#f3d2c4"
TEXT = "#fff7f2"
FENCE = "#ffd27d"


class CliffordBoneChase:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Clifford Bone Chase")
        self.root.configure(bg=BACKGROUND)
        self.root.resizable(False, False)

        self.score_var = tk.StringVar(value="0")
        self.width_var = tk.StringVar(value="1")

        hud = tk.Frame(self.root, bg=BACKGROUND, padx=16, pady=12)
        hud.pack(fill="x")

        title = tk.Label(
            hud,
            text="Clifford Bone Chase",
            font=("Arial", 22, "bold"),
            fg=TEXT,
            bg=BACKGROUND,
        )
        title.grid(row=0, column=0, sticky="w")

        subtitle = tk.Label(
            hud,
            text="Arrow keys or WASD to move. Cross any edge to wrap around.",
            font=("Arial", 11),
            fg=TEXT,
            bg=BACKGROUND,
        )
        subtitle.grid(row=1, column=0, sticky="w")

        stats = tk.Frame(hud, bg=BACKGROUND)
        stats.grid(row=0, column=1, rowspan=2, sticky="e")
        hud.grid_columnconfigure(0, weight=1)

        tk.Label(stats, text="Bones:", font=("Arial", 12, "bold"), fg=TEXT, bg=BACKGROUND).grid(row=0, column=0, sticky="e")
        tk.Label(stats, textvariable=self.score_var, font=("Arial", 12), fg=TEXT, bg=BACKGROUND).grid(row=0, column=1, padx=(8, 0), sticky="w")
        tk.Label(stats, text="Width:", font=("Arial", 12, "bold"), fg=TEXT, bg=BACKGROUND).grid(row=1, column=0, sticky="e")
        tk.Label(stats, textvariable=self.width_var, font=("Arial", 12), fg=TEXT, bg=BACKGROUND).grid(row=1, column=1, padx=(8, 0), sticky="w")

        self.canvas = tk.Canvas(
            self.root,
            width=WINDOW_SIZE,
            height=WINDOW_SIZE,
            bg=BACKGROUND,
            highlightthickness=0,
        )
        self.canvas.pack(padx=12, pady=(0, 12))

        self.left_pressed = False
        self.right_pressed = False
        self.up_pressed = False
        self.down_pressed = False

        center = PADDING + ARENA_SIZE / 2
        self.dog = {
            "x": center,
            "y": center,
            "angle": 0.0,
            "radius": BASE_RADIUS,
            "width_level": 1,
            "score": 0,
            "history": [],
        }
        self.dog["history"] = [
            {"x": center, "y": center, "angle": 0.0} for _ in range(HISTORY_LIMIT)
        ]
        self.bone = self.spawn_bone()

        self.root.bind("<KeyPress>", self.on_key_press)
        self.root.bind("<KeyRelease>", self.on_key_release)

    def spawn_bone(self):
        margin = 50
        return {
            "x": PADDING + margin + random.random() * (ARENA_SIZE - margin * 2),
            "y": PADDING + margin + random.random() * (ARENA_SIZE - margin * 2),
        }

    def wrap(self, value):
        minimum = PADDING
        maximum = PADDING + ARENA_SIZE
        if value < minimum:
            return maximum
        if value > maximum:
            return minimum
        return value

    def on_key_press(self, event):
        key = event.keysym.lower()
        if key in ("left", "a"):
            self.left_pressed = True
        if key in ("right", "d"):
            self.right_pressed = True
        if key in ("up", "w"):
            self.up_pressed = True
        if key in ("down", "s"):
            self.down_pressed = True

    def on_key_release(self, event):
        key = event.keysym.lower()
        if key in ("left", "a"):
            self.left_pressed = False
        if key in ("right", "d"):
            self.right_pressed = False
        if key in ("up", "w"):
            self.up_pressed = False
        if key in ("down", "s"):
            self.down_pressed = False

    def update_dog(self):
        if self.left_pressed:
            self.dog["angle"] -= TURN_RATE
        if self.right_pressed:
            self.dog["angle"] += TURN_RATE

        move_speed = BASE_SPEED
        if self.down_pressed:
            move_speed *= 0.75
        if self.up_pressed:
            move_speed *= 1.2

        self.dog["x"] = self.wrap(self.dog["x"] + math.cos(self.dog["angle"]) * move_speed)
        self.dog["y"] = self.wrap(self.dog["y"] + math.sin(self.dog["angle"]) * move_speed)

        self.dog["history"].insert(0, {
            "x": self.dog["x"],
            "y": self.dog["y"],
            "angle": self.dog["angle"],
        })
        del self.dog["history"][HISTORY_LIMIT:]

        dx = self.dog["x"] - self.bone["x"]
        dy = self.dog["y"] - self.bone["y"]
        eat_distance = self.dog["radius"] + 18 + self.dog["width_level"]
        if math.hypot(dx, dy) <= eat_distance:
            self.dog["score"] += 1
            self.dog["width_level"] += 1
            self.dog["radius"] += WIDTH_GAIN
            self.score_var.set(str(self.dog["score"]))
            self.width_var.set(str(self.dog["width_level"]))
            self.bone = self.spawn_bone()

    def draw_background(self):
        self.canvas.delete("all")
        self.canvas.create_rectangle(0, 0, WINDOW_SIZE, WINDOW_SIZE, fill=BACKGROUND, outline=BACKGROUND)

        for y in range(0, ARENA_SIZE, 2):
            blend = y / ARENA_SIZE
            color = self.blend_color(GRASS_TOP, GRASS_BOTTOM, blend)
            self.canvas.create_line(
                PADDING,
                PADDING + y,
                PADDING + ARENA_SIZE,
                PADDING + y,
                fill=color,
            )

        self.canvas.create_rectangle(
            PADDING,
            PADDING,
            PADDING + ARENA_SIZE,
            PADDING + ARENA_SIZE,
            outline=FENCE,
            width=6,
        )

        for i in range(60, ARENA_SIZE, 60):
            x = PADDING + i
            y = PADDING + i
            self.canvas.create_line(x, PADDING, x, PADDING + ARENA_SIZE, fill="#8dc48a")
            self.canvas.create_line(PADDING, y, PADDING + ARENA_SIZE, y, fill="#8dc48a")

    def draw_bone(self):
        x = self.bone["x"]
        y = self.bone["y"]
        self.canvas.create_oval(x - 19, y - 17, x - 1, y + 1, fill="white", outline="white")
        self.canvas.create_oval(x - 19, y - 1, x - 1, y + 17, fill="white", outline="white")
        self.canvas.create_oval(x + 1, y - 17, x + 19, y + 1, fill="white", outline="white")
        self.canvas.create_oval(x + 1, y - 1, x + 19, y + 17, fill="white", outline="white")
        self.canvas.create_rectangle(x - 10, y - 12, x + 10, y + 12, fill="white", outline="white")

    def draw_dog(self):
        widest = self.dog["radius"]
        history = self.dog["history"]

        for i in range(SEGMENT_COUNT - 1, -1, -1):
            index = min(i * SEGMENT_GAP, len(history) - 1)
            point = history[index]
            t = i / SEGMENT_COUNT
            segment_radius = max(12, widest * (0.35 + (1 - t) * 0.65))
            color = DOG_RED_DARK if i == 0 else DOG_RED
            self.canvas.create_oval(
                point["x"] - segment_radius,
                point["y"] - segment_radius,
                point["x"] + segment_radius,
                point["y"] + segment_radius,
                fill=color,
                outline=color,
            )

        head = history[0]
        angle = head["angle"]
        snout_x = head["x"] + math.cos(angle) * self.dog["radius"] * 0.95
        snout_y = head["y"] + math.sin(angle) * self.dog["radius"] * 0.95
        ear_offset = self.dog["radius"] * 0.7
        ear_radius = self.dog["radius"] * 0.33

        for ear_angle in (angle - 1.1, angle + 1.1):
            ear_x = head["x"] + math.cos(ear_angle) * ear_offset
            ear_y = head["y"] + math.sin(ear_angle) * ear_offset
            self.canvas.create_oval(
                ear_x - ear_radius,
                ear_y - ear_radius,
                ear_x + ear_radius,
                ear_y + ear_radius,
                fill=DOG_EAR,
                outline=DOG_EAR,
            )

        self.canvas.create_oval(
            snout_x - self.dog["radius"] * 0.48,
            snout_y - self.dog["radius"] * 0.34,
            snout_x + self.dog["radius"] * 0.48,
            snout_y + self.dog["radius"] * 0.34,
            fill=DOG_SNOUT,
            outline=DOG_SNOUT,
        )

        for eye_angle in (angle - 0.65, angle + 0.65):
            eye_x = head["x"] + math.cos(eye_angle) * self.dog["radius"] * 0.35
            eye_y = head["y"] + math.sin(eye_angle) * self.dog["radius"] * 0.35
            eye_radius = self.dog["radius"] * 0.12
            self.canvas.create_oval(
                eye_x - eye_radius,
                eye_y - eye_radius,
                eye_x + eye_radius,
                eye_y + eye_radius,
                fill="white",
                outline="white",
            )

        nose_x = snout_x + math.cos(angle) * self.dog["radius"] * 0.2
        nose_y = snout_y + math.sin(angle) * self.dog["radius"] * 0.04
        nose_radius = self.dog["radius"] * 0.1
        self.canvas.create_oval(
            nose_x - nose_radius,
            nose_y - nose_radius,
            nose_x + nose_radius,
            nose_y + nose_radius,
            fill="#1f1515",
            outline="#1f1515",
        )

    def blend_color(self, start, end, ratio):
        start_rgb = [int(start[i:i + 2], 16) for i in (1, 3, 5)]
        end_rgb = [int(end[i:i + 2], 16) for i in (1, 3, 5)]
        mixed = []
        for s, e in zip(start_rgb, end_rgb):
            mixed.append(round(s + (e - s) * ratio))
        return "#" + "".join(f"{value:02x}" for value in mixed)

    def tick(self):
        self.update_dog()
        self.draw_background()
        self.draw_bone()
        self.draw_dog()
        self.root.after(FPS_MS, self.tick)

    def run(self):
        self.tick()
        self.root.mainloop()


if __name__ == "__main__":
    CliffordBoneChase().run()
