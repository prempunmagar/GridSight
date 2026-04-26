"""Query strings for Stage 3, structured by discovery source per docs/02_BUILD_PLAN.md Phase 3 task 1."""

ANOMALY_QUERIES = [
    # Insulator damage
    "damaged or broken insulator disk on transmission tower",
    "missing or shattered porcelain insulator",
    "insulator string with visible contamination or burn marks",
    "rust streaks on insulator hardware",
    # Vegetation encroachment
    "tree branches close to or touching power line conductors",
    "vegetation overgrown into transmission line right-of-way",
    "trees taller than power line clearance",
]

INVENTORY_QUERIES = [
    "transmission tower with insulator strings visible",
    "power line conductor crossing the right-of-way",
    "vegetation along the transmission line corridor",
]


def active_queries(include_inventory: bool = False) -> list[tuple[str, str]]:
    """Return [(discovery_source, query_string), ...] for the active query set."""
    out = [("anomaly_query", q) for q in ANOMALY_QUERIES]
    if include_inventory:
        out += [("inventory_query", q) for q in INVENTORY_QUERIES]
    return out
