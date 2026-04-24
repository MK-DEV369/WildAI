import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Ellipse, Polygon


# ---------- Shape helpers ----------
def add_round_box(ax, center, w, h, text, fc="#a7f3d0", ec="#1f2937", fs=10):
    x, y = center[0] - w / 2, center[1] - h / 2
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.01,rounding_size=0.02",
        linewidth=1.5, edgecolor=ec, facecolor=fc
    )
    ax.add_patch(patch)
    ax.text(center[0], center[1], text, ha="center", va="center", fontsize=fs, color="#111827")
    return patch


def add_oval(ax, center, w, h, text, fc="#e5e7b2", ec="#1f2937", fs=10):
    patch = Ellipse(center, w, h, linewidth=1.5, edgecolor=ec, facecolor=fc)
    ax.add_patch(patch)
    ax.text(center[0], center[1], text, ha="center", va="center", fontsize=fs, color="#111827")
    return patch


def add_diamond(ax, center, w, h, text, fc="#e5e7b2", ec="#1f2937", fs=10):
    cx, cy = center
    pts = [(cx, cy + h / 2), (cx + w / 2, cy), (cx, cy - h / 2), (cx - w / 2, cy)]
    patch = Polygon(pts, closed=True, linewidth=1.5, edgecolor=ec, facecolor=fc)
    ax.add_patch(patch)
    ax.text(cx, cy, text, ha="center", va="center", fontsize=fs, color="#111827")
    return patch


def arrow(ax, p1, p2, text=None, color="#111827"):
    arr = FancyArrowPatch(
        p1, p2,
        arrowstyle="-|>",
        mutation_scale=17,
        linewidth=1.6,
        color=color
    )
    ax.add_patch(arr)
    if text:
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        ax.text(mx, my + 0.015, text, fontsize=9, color="#374151", ha="center")


def elbow_arrow(ax, points, text=None, color="#111827", lw=1.4):
    """Draw an orthogonal connector with an arrow on the final segment."""
    if len(points) < 2:
        return

    for p1, p2 in zip(points[:-2], points[1:-1], strict=False):
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=color, linewidth=lw)

    arr = FancyArrowPatch(
        points[-2], points[-1],
        arrowstyle="-|>",
        mutation_scale=17,
        linewidth=lw,
        color=color
    )
    ax.add_patch(arr)

    if text:
        label_point = points[0]
        ax.text(label_point[0], label_point[1] + 0.015, text, fontsize=9, color="#374151", ha="center")


def main():
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # Title
    ax.text(
        0.5, 0.965,
        "WILDAI Methodology Flowchart",
        ha="center", va="center",
        fontsize=17, fontweight="bold", color="#111827"
    )

    # Main vertical flow centers
    x = 0.42
    y0, gap = 0.89, 0.135

    oval_h = 0.065
    oval_end_h = 0.07
    box_h = 0.07
    diamond_h = 0.10

    y_problem = y0
    y_a = y0 - gap
    y_b = y0 - 2 * gap
    y_decision = y0 - 3 * gap
    y_c = y0 - 4 * gap
    y_d = y0 - 5 * gap
    y_result = y0 - 6 * gap

    # Nodes (small number of clustered steps)
    add_oval(ax, (x, y_problem), 0.34, oval_h, "Problem Statement")
    add_round_box(
        ax, (x, y_a), 0.54, box_h,
        "Cluster A:\nData Collection + Structuring"
    )
    add_round_box(
        ax, (x, y_b), 0.60, box_h,
        "Cluster B:\nCleaning + Chunking + Embedding + FAISS Index"
    )
    add_diamond(ax, (x, y_decision), 0.34, diamond_h, "Index\nReady?")
    add_round_box(
        ax, (x, y_c), 0.54, box_h,
        "Cluster C:\nQuery + Filter + Semantic Retrieval"
    )
    add_round_box(
        ax, (x, y_d), 0.54, box_h,
        "Cluster D:\nRe-ranking + Answer Synthesis"
    )
    add_oval(ax, (x, y_result), 0.44, oval_end_h, "Results with Sources")

    # Side branch for "No"
    add_round_box(
        ax, (0.84, y_decision), 0.24, box_h,
        "Rebuild / Update\nCorpus",
        fc="#fde68a"
    )

    # Connect main flow
    arrow(ax, (x, y_problem - oval_h / 2), (x, y_a + box_h / 2))
    arrow(ax, (x, y_a - box_h / 2), (x, y_b + box_h / 2))
    arrow(ax, (x, y_b - box_h / 2), (x, y_decision + diamond_h / 2))
    arrow(ax, (x, y_decision - diamond_h / 2), (x, y_c + box_h / 2), text="Yes")
    arrow(ax, (x, y_c - box_h / 2), (x, y_d + box_h / 2))
    arrow(ax, (x, y_d - box_h / 2), (x, y_result + oval_end_h / 2))

    # "No" branch to rebuild/update, then loop back to Cluster B
    arrow(ax, (x + 0.17, y_decision), (0.72, y_decision), text="No")
    elbow_arrow(
        ax,
        points=[
            (0.84, y_decision + box_h / 2),
            (0.84, y_b + 0.055),
            (x + 0.30, y_b + 0.055),
            (x + 0.30, y_b + box_h / 2),
        ],
    )

    # Footer
    ax.text(
        0.5, 0.055,
        "Compact methodology view for PPT (clustered, decision-based)",
        ha="center", va="center",
        fontsize=10, color="#4b5563"
    )

    plt.tight_layout()
    # Save high-quality image for PPT
    plt.savefig("wildai_methodology_flowchart.png", dpi=300, bbox_inches="tight")
    plt.show()


if __name__ == "__main__":
    main()