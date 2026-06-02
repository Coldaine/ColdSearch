#!/usr/bin/env python3
"""
Build script for the US Disaster dataset (tornadoes + earthquakes, 1900-2025).

This file is the single source of truth. All curated data lives here with inline
source provenance. Running it regenerates every output artifact:

    csv/tornadoes_annual.csv      annual US tornado deaths, 1900-2025
    csv/earthquakes_events.csv    event-level US/territory earthquakes w/ deaths+injuries
    csv/earthquakes_annual.csv    earthquake deaths aggregated by year (derived)
    csv/notable_tornadoes.csv     event-level major tornadoes w/ deaths+injuries
    csv/combined_annual.csv       tornado deaths + earthquake deaths, side by side (derived)
    us_disasters.json             everything bundled, with metadata + sources
    charts/*.png                  static chart previews
    visualize.html                self-contained interactive viewer (no network needed)

Usage:
    python3 build.py

Run from any directory; outputs are written next to this file.

----------------------------------------------------------------------------
DATA QUALITY NOTE
----------------------------------------------------------------------------
* Tornado DEATHS are an authoritative, continuous annual series (the headline
  metric historians track). 1875-1949 figures come from Thomas Grazulis'
  "Significant Tornadoes" compilation; 1950+ from the National Weather Service /
  Storm Prediction Center. See SOURCES below.
* Annual tornado INJURY totals are NOT included as a series: a clean,
  authoritative continuous series is not freely published (it requires the SPC
  SVRGIS/WCM tornado database). Instead, injuries are given at the EVENT level
  for major tornadoes, where they are well documented.
* Earthquake casualties are inherently EVENT-driven (deaths cluster on a handful
  of events), so earthquakes are stored as an event list and then aggregated to
  an annual series. Deaths are best-available estimates; ranges and caveats are
  in each event's `notes`.
"""

import csv
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(HERE, "csv")
CHART_DIR = os.path.join(HERE, "charts")

# ===========================================================================
# SOURCES
# ===========================================================================
SOURCES = [
    {
        "id": "nssl_tornado_deaths",
        "title": "US Annual Tornado Death Tolls, 1875-present (NOAA/NSSL)",
        "url": "https://inside.nssl.noaa.gov/nsslnews/2009/03/us-annual-tornado-death-tolls-1875-present/",
        "covers": "Tornado deaths 1875-2012 (1875-1949 from Grazulis; 1950+ from NWS).",
    },
    {
        "id": "spc_fatal",
        "title": "Annual Fatal Tornado Summary (NOAA/NWS Storm Prediction Center)",
        "url": "https://www.spc.noaa.gov/climo/torn/fatalmap.php",
        "covers": "Authoritative annual US tornado fatalities, modern era.",
    },
    {
        "id": "tornado_deaths_recent",
        "title": "Tornado Fatalities by Year (compiled from NWS/SPC reporting)",
        "url": "https://www.consumershield.com/articles/tornado-fatalities-by-year",
        "covers": "Annual tornado deaths 2013-2025.",
    },
    {
        "id": "wiki_eq_us",
        "title": "List of earthquakes in the United States (Wikipedia)",
        "url": "https://en.wikipedia.org/wiki/List_of_earthquakes_in_the_United_States",
        "covers": "US earthquake events, magnitudes, deaths.",
    },
    {
        "id": "wiki_eq_1900",
        "title": "List of deadly earthquakes since 1900 (Wikipedia)",
        "url": "https://en.wikipedia.org/wiki/List_of_deadly_earthquakes_since_1900",
        "covers": "Global deadly earthquakes incl. US, with deaths.",
    },
    {
        "id": "usgs_eq",
        "title": "USGS Earthquake Hazards Program — Lists, Maps, and Statistics",
        "url": "https://www.usgs.gov/programs/earthquake-hazards/lists-maps-and-statistics",
        "covers": "Earthquake magnitudes, casualties, significant-event details.",
    },
]

# ===========================================================================
# TORNADO DEATHS, ANNUAL (US), 1900-2025
# 1900-2012: NOAA/NSSL table (source: nssl_tornado_deaths).
# 2013-2025: NWS/SPC reporting (source: tornado_deaths_recent / spc_fatal).
# ===========================================================================
TORNADO_DEATHS = {
    1900: 101, 1901: 52, 1902: 157, 1903: 216, 1904: 87, 1905: 184,
    1906: 70, 1907: 80, 1908: 477, 1909: 404, 1910: 12, 1911: 55,
    1912: 175, 1913: 346, 1914: 41, 1915: 84, 1916: 150, 1917: 551,
    1918: 136, 1919: 206, 1920: 499, 1921: 202, 1922: 135, 1923: 110,
    1924: 376, 1925: 794, 1926: 144, 1927: 540, 1928: 95, 1929: 274,
    1930: 179, 1931: 36, 1932: 394, 1933: 362, 1934: 47, 1935: 71,
    1936: 552, 1937: 29, 1938: 183, 1939: 91, 1940: 65, 1941: 53,
    1942: 384, 1943: 58, 1944: 275, 1945: 210, 1946: 78, 1947: 313,
    1948: 139, 1949: 211, 1950: 70, 1951: 34, 1952: 230, 1953: 519,
    1954: 36, 1955: 129, 1956: 83, 1957: 193, 1958: 67, 1959: 58,
    1960: 46, 1961: 52, 1962: 30, 1963: 31, 1964: 73, 1965: 301,
    1966: 98, 1967: 114, 1968: 131, 1969: 66, 1970: 73, 1971: 159,
    1972: 27, 1973: 89, 1974: 366, 1975: 60, 1976: 44, 1977: 43,
    1978: 53, 1979: 84, 1980: 28, 1981: 24, 1982: 64, 1983: 34,
    1984: 122, 1985: 94, 1986: 15, 1987: 59, 1988: 32, 1989: 50,
    1990: 53, 1991: 39, 1992: 39, 1993: 33, 1994: 69, 1995: 30,
    1996: 25, 1997: 67, 1998: 130, 1999: 94, 2000: 41, 2001: 40,
    2002: 55, 2003: 54, 2004: 35, 2005: 39, 2006: 67, 2007: 81,
    2008: 126, 2009: 21, 2010: 45, 2011: 553, 2012: 70,
    # 2013-2025: NWS/SPC reporting
    2013: 55, 2014: 47, 2015: 36, 2016: 18, 2017: 35, 2018: 10,
    2019: 41, 2020: 76, 2021: 101, 2022: 25, 2023: 83, 2024: 54,
    2025: 67,
}

# ===========================================================================
# EARTHQUAKE EVENTS (US states + territories, incl. distant-quake tsunamis
# that killed in US soil), 1900-2025, with deaths + injuries where known.
# deaths/injuries are best-available estimates; see `notes` for ranges.
# magnitude is moment magnitude (Mw) unless noted.
# ===========================================================================
# fields: date, name, state, magnitude, deaths, injuries, tsunami, notes
EARTHQUAKE_EVENTS = [
    ("1906-04-18", "Great San Francisco earthquake", "CA", 7.9, 3000, None, False,
     "Deaths long cited as ~700 but USGS/modern research estimates ~3,000. Fire caused most loss."),
    ("1915-06-22", "Imperial Valley earthquake", "CA", 6.3, 6, None, False, ""),
    ("1918-04-21", "San Jacinto earthquake", "CA", 6.8, 1, None, False, ""),
    ("1918-10-11", "San Fermin earthquake & tsunami", "PR", 7.1, 116, None, True,
     "Puerto Rico (US territory). ~40 of the deaths from the tsunami. Reported tolls range 76-144."),
    ("1925-06-29", "Santa Barbara earthquake", "CA", 6.8, 13, None, False, ""),
    ("1933-03-10", "Long Beach earthquake", "CA", 6.4, 120, None, False,
     "Death toll usually cited 115-120; spurred the Field Act (school seismic standards)."),
    ("1940-05-18", "El Centro (Imperial Valley) earthquake", "CA", 6.9, 9, 20, False, ""),
    ("1946-04-01", "Aleutian Islands earthquake & Pacific tsunami", "AK", 8.6, 165, 163, True,
     "Tsunami killed ~159 in Hilo, Hawaii + lighthouse crew at Scotch Cap, AK. Prompted Pacific Tsunami Warning System."),
    ("1949-04-13", "Olympia (Puget Sound) earthquake", "WA", 6.7, 8, 64, False, ""),
    ("1952-07-21", "Kern County earthquake", "CA", 7.3, 12, 35, False, "Largest CA quake 1906-2019."),
    ("1958-07-09", "Lituya Bay earthquake & megatsunami", "AK", 7.8, 5, None, True,
     "Triggered the tallest tsunami ever recorded (~524 m runup)."),
    ("1959-08-17", "Hebgen Lake earthquake", "MT", 7.3, 28, None, False,
     "Landslide buried Rock Creek campground; created Quake Lake."),
    ("1964-03-27", "Great Alaska (Good Friday) earthquake", "AK", 9.2, 131, None, True,
     "2nd-largest quake ever recorded. ~124 deaths from tsunamis (AK, OR, CA)."),
    ("1965-04-29", "Puget Sound earthquake", "WA", 6.7, 7, None, False, ""),
    ("1971-02-09", "San Fernando (Sylmar) earthquake", "CA", 6.6, 65, 2000, False,
     "Hospital collapses drove major seismic building-code reform."),
    ("1975-11-29", "Kalapana earthquake & tsunami", "HI", 7.7, 2, 28, True, ""),
    ("1980-11-08", "Eureka (offshore N. California) earthquake", "CA", 7.3, 0, 6, False, ""),
    ("1983-05-02", "Coalinga earthquake", "CA", 6.2, 0, 94, False, "Destroyed downtown Coalinga."),
    ("1983-10-28", "Borah Peak earthquake", "ID", 6.9, 2, None, False, "Largest in Idaho's history."),
    ("1987-10-01", "Whittier Narrows earthquake", "CA", 5.9, 8, 200, False, ""),
    ("1989-10-17", "Loma Prieta earthquake", "CA", 6.9, 63, 3757, False,
     "Struck during the World Series; Cypress Structure & Bay Bridge collapses."),
    ("1992-06-28", "Landers earthquake", "CA", 7.3, 1, 400, False, ""),
    ("1994-01-17", "Northridge earthquake", "CA", 6.7, 57, 8700, False,
     "Deaths cited 57-72. One of the costliest US disasters (~$20B+)."),
    ("2001-02-28", "Nisqually earthquake", "WA", 6.8, 1, 400, False, "Single death attributed to a heart attack."),
    ("2003-12-22", "San Simeon earthquake", "CA", 6.6, 2, 40, False, ""),
    ("2011-08-23", "Mineral (Virginia) earthquake", "VA", 5.8, 0, None, False,
     "Felt by more people than any US quake in history; damaged Washington Monument."),
    ("2014-08-24", "South Napa earthquake", "CA", 6.0, 1, 200, False, ""),
    ("2018-11-30", "Anchorage earthquake", "AK", 7.1, 0, None, False, "Major infrastructure damage, no deaths."),
    ("2019-07-06", "Ridgecrest earthquake sequence", "CA", 7.1, 1, None, False,
     "Largest in Southern CA in 20 years; ~1 indirect death reported."),
    ("2020-01-07", "Puerto Rico earthquake sequence", "PR", 6.4, 1, 9, False,
     "Some sources cite up to 4 deaths incl. indirect. Damaged Guanica/Indios region."),
    ("2020-03-18", "Magna (Utah) earthquake", "UT", 5.7, 0, None, False, ""),
    ("2022-12-20", "Ferndale (Humboldt County) earthquake", "CA", 6.4, 2, 12, False, ""),
]

# ===========================================================================
# NOTABLE TORNADOES (event-level), with deaths + injuries.
# fields: date, name, rating, states, deaths, injuries, notes
# ratings: F-scale (pre-2007) / EF-scale (2007+)
# ===========================================================================
NOTABLE_TORNADOES = [
    ("1925-03-18", "Tri-State Tornado", "F5", "MO/IL/IN", 695, 2027,
     "Deadliest single tornado in US history; ~219 mile path."),
    ("1936-04-05", "Tupelo-Gainesville outbreak", "F5", "MS/GA", 454, 1800,
     "Tupelo ~216 dead, Gainesville ~203 dead the next day."),
    ("1947-04-09", "Glazier-Higgins-Woodward Tornado", "F5", "TX/OK/KS", 181, 970, ""),
    ("1953-05-11", "Waco Tornado", "F5", "TX", 114, 597, "Ended the myth that Waco was tornado-safe."),
    ("1953-06-08", "Flint-Beecher Tornado", "F5", "MI", 116, 844, "Last single US tornado to kill 100+ until Joplin 2011."),
    ("1953-06-09", "Worcester Tornado", "F4", "MA", 94, 1228, ""),
    ("1965-04-11", "Palm Sunday outbreak", "F4", "Midwest", 271, 1500,
     "47 tornadoes across 6 states; spurred improved warning coordination."),
    ("1974-04-03", "1974 Super Outbreak", "F5", "13 states", 315, 5484,
     "148 tornadoes in ~18 hours; US deaths 315 (335 incl. Canada)."),
    ("1979-04-10", "Wichita Falls ('Terrible Tuesday')", "F4", "TX", 42, 1740, ""),
    ("1999-05-03", "Bridge Creek-Moore Tornado", "F5", "OK", 36, 583,
     "Recorded the highest wind speed ever measured (~302 mph)."),
    ("2011-04-27", "Hackleburg-Phil Campbell Tornado", "EF5", "AL", 72, None,
     "Deadliest single tornado of the 2011 Super Outbreak."),
    ("2011-04-25", "2011 Super Outbreak", "EF5", "Southeast US", 324, 3000,
     "Largest tornado outbreak ever recorded (~360 tornadoes); drove the deadliest US tornado year since 1936."),
    ("2011-05-22", "Joplin Tornado", "EF5", "MO", 158, 1150,
     "Deadliest single US tornado since modern records began in 1950."),
    ("2013-05-20", "Moore Tornado", "EF5", "OK", 24, 212, ""),
    ("2013-05-31", "El Reno Tornado", "EF3", "OK", 8, 151,
     "Widest tornado ever recorded (~2.6 miles); killed veteran storm chasers."),
    ("2021-12-10", "Western Kentucky / Quad-State outbreak", "EF4", "KY+3", 89, 600,
     "Long-track December tornado outbreak; devastated Mayfield, KY."),
]


def write_csv(path, header, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def na(v):
    return "" if v is None else v


def build():
    os.makedirs(CSV_DIR, exist_ok=True)
    os.makedirs(CHART_DIR, exist_ok=True)

    years = sorted(TORNADO_DEATHS)

    # --- tornadoes_annual.csv ---
    write_csv(
        os.path.join(CSV_DIR, "tornadoes_annual.csv"),
        ["year", "deaths"],
        [[y, TORNADO_DEATHS[y]] for y in years],
    )

    # --- earthquakes_events.csv ---
    eq_rows = [
        [d, name, st, mag, na(deaths), na(inj), "yes" if tsu else "no", notes]
        for (d, name, st, mag, deaths, inj, tsu, notes) in EARTHQUAKE_EVENTS
    ]
    write_csv(
        os.path.join(CSV_DIR, "earthquakes_events.csv"),
        ["date", "name", "state", "magnitude", "deaths", "injuries", "tsunami", "notes"],
        eq_rows,
    )

    # --- earthquakes_annual.csv (derived) ---
    eq_deaths_by_year = defaultdict(int)
    eq_inj_by_year = defaultdict(int)
    eq_count_by_year = defaultdict(int)
    for (d, name, st, mag, deaths, inj, tsu, notes) in EARTHQUAKE_EVENTS:
        y = int(d[:4])
        eq_deaths_by_year[y] += deaths or 0
        eq_inj_by_year[y] += inj or 0
        eq_count_by_year[y] += 1
    write_csv(
        os.path.join(CSV_DIR, "earthquakes_annual.csv"),
        ["year", "deaths", "injuries", "events"],
        [[y, eq_deaths_by_year[y], eq_inj_by_year[y], eq_count_by_year[y]]
         for y in sorted(eq_count_by_year)],
    )

    # --- notable_tornadoes.csv ---
    write_csv(
        os.path.join(CSV_DIR, "notable_tornadoes.csv"),
        ["date", "name", "rating", "states", "deaths", "injuries", "notes"],
        [[d, name, rate, states, na(deaths), na(inj), notes]
         for (d, name, rate, states, deaths, inj, notes) in NOTABLE_TORNADOES],
    )

    # --- combined_annual.csv (derived) ---
    write_csv(
        os.path.join(CSV_DIR, "combined_annual.csv"),
        ["year", "tornado_deaths", "earthquake_deaths"],
        [[y, TORNADO_DEATHS[y], eq_deaths_by_year.get(y, 0)] for y in years],
    )

    # --- us_disasters.json (bundle) ---
    bundle = {
        "title": "US Tornado & Earthquake Casualties, 1900-2025",
        "description": "Annual US tornado deaths (1900-2025), event-level US/territory "
                       "earthquakes with deaths and injuries, and notable tornado events "
                       "with deaths and injuries. Built for graphing long-run trends.",
        "coverage": {"start_year": years[0], "end_year": years[-1],
                     "region": "United States (incl. territories such as Puerto Rico)"},
        "generated_by": "data/us-disasters-1900-2025/build.py",
        "sources": SOURCES,
        "tornadoes_annual": [{"year": y, "deaths": TORNADO_DEATHS[y]} for y in years],
        "earthquakes_events": [
            {"date": d, "name": name, "state": st, "magnitude": mag,
             "deaths": deaths, "injuries": inj, "tsunami": tsu, "notes": notes}
            for (d, name, st, mag, deaths, inj, tsu, notes) in EARTHQUAKE_EVENTS
        ],
        "earthquakes_annual": [
            {"year": y, "deaths": eq_deaths_by_year[y], "injuries": eq_inj_by_year[y],
             "events": eq_count_by_year[y]}
            for y in sorted(eq_count_by_year)
        ],
        "notable_tornadoes": [
            {"date": d, "name": name, "rating": rate, "states": states,
             "deaths": deaths, "injuries": inj, "notes": notes}
            for (d, name, rate, states, deaths, inj, notes) in NOTABLE_TORNADOES
        ],
        "caveats": [
            "Tornado deaths 1875-1949 from Grazulis; 1950+ from NWS/SPC.",
            "Annual tornado injury series not included (not freely published as a clean series); "
            "injuries given at event level for major tornadoes instead.",
            "Earthquake casualties are event-driven; deaths are best-available estimates "
            "with ranges noted per event.",
            "1906 San Francisco deaths use the modern ~3,000 estimate, not the historical ~700.",
        ],
    }
    with open(os.path.join(HERE, "us_disasters.json"), "w") as f:
        json.dump(bundle, f, indent=2)

    make_charts(years, eq_deaths_by_year)
    make_html(bundle)
    print("Build complete. Outputs written under", HERE)


def make_charts(years, eq_deaths_by_year):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    td = [TORNADO_DEATHS[y] for y in years]

    # 1) Tornado deaths by year
    fig, ax = plt.subplots(figsize=(13, 5))
    ax.bar(years, td, color="#c1440e", width=0.85)
    ax.set_title("US Tornado Deaths by Year, 1900-2025")
    ax.set_xlabel("Year"); ax.set_ylabel("Deaths")
    ax.grid(axis="y", alpha=0.3)
    for y, label in [(1925, "Tri-State (1925): 794"), (2011, "2011: 553")]:
        ax.annotate(label, xy=(y, TORNADO_DEATHS[y]),
                    xytext=(y, TORNADO_DEATHS[y] + 60), ha="center", fontsize=8,
                    arrowprops=dict(arrowstyle="->", color="#444"))
    fig.tight_layout()
    fig.savefig(os.path.join(CHART_DIR, "tornado_deaths_by_year.png"), dpi=120)
    plt.close(fig)

    # 2) Earthquake deaths by year (event years only)
    eq_years = sorted(eq_deaths_by_year)
    eq_vals = [eq_deaths_by_year[y] for y in eq_years]
    fig, ax = plt.subplots(figsize=(13, 5))
    ax.bar(eq_years, eq_vals, color="#1d4e89", width=0.85)
    ax.set_title("US Earthquake Deaths by Year (event years), 1900-2025")
    ax.set_xlabel("Year"); ax.set_ylabel("Deaths")
    ax.set_xlim(1898, 2027)
    ax.grid(axis="y", alpha=0.3)
    ax.annotate("San Francisco (1906): ~3,000", xy=(1906, eq_deaths_by_year[1906]),
                xytext=(1925, 2600), fontsize=8,
                arrowprops=dict(arrowstyle="->", color="#444"))
    fig.tight_layout()
    fig.savefig(os.path.join(CHART_DIR, "earthquake_deaths_by_year.png"), dpi=120)
    plt.close(fig)

    # 3) Combined overview (log scale)
    fig, ax = plt.subplots(figsize=(13, 5.5))
    ax.bar([y - 0.2 for y in years], [max(v, 0.5) for v in td],
           width=0.4, color="#c1440e", label="Tornado deaths")
    ax.bar([y + 0.2 for y in years],
           [max(eq_deaths_by_year.get(y, 0), 0.5) for y in years],
           width=0.4, color="#1d4e89", label="Earthquake deaths")
    ax.set_yscale("log")
    ax.set_title("US Tornado vs Earthquake Deaths by Year, 1900-2025 (log scale)")
    ax.set_xlabel("Year"); ax.set_ylabel("Deaths (log)")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(CHART_DIR, "combined_overview.png"), dpi=120)
    plt.close(fig)


def make_html(bundle):
    data_json = json.dumps(bundle)
    html = HTML_TEMPLATE.replace("/*__DATA__*/", data_json)
    with open(os.path.join(HERE, "visualize.html"), "w") as f:
        f.write(html)


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>US Tornado & Earthquake Casualties, 1900-2025</title>
<style>
  :root { --torn:#c1440e; --eq:#1d4e89; --bg:#fafafa; --ink:#1c1c1c; --muted:#666; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         color:var(--ink); background:var(--bg); }
  header { padding:22px 24px; background:#fff; border-bottom:1px solid #e5e5e5; }
  h1 { margin:0 0 4px; font-size:21px; }
  .sub { color:var(--muted); font-size:13px; }
  main { max-width:1100px; margin:0 auto; padding:20px 24px 60px; }
  .controls { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin:18px 0; }
  .controls label { font-size:13px; display:flex; gap:6px; align-items:center; }
  button { font:inherit; padding:6px 12px; border:1px solid #ccc; background:#fff; border-radius:6px; cursor:pointer; }
  button.active { background:var(--ink); color:#fff; border-color:var(--ink); }
  .card { background:#fff; border:1px solid #e5e5e5; border-radius:10px; padding:16px; margin:18px 0; }
  canvas { width:100%; height:auto; display:block; }
  .legend { display:flex; gap:18px; font-size:13px; margin-top:8px; }
  .swatch { display:inline-block; width:12px; height:12px; border-radius:2px; margin-right:6px; vertical-align:middle; }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; }
  th { position:sticky; top:0; background:#fff; cursor:pointer; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .tip { position:fixed; pointer-events:none; background:#1c1c1c; color:#fff; padding:6px 9px;
         border-radius:6px; font-size:12px; opacity:0; transition:opacity .1s; max-width:260px; z-index:10; }
  .scroll { max-height:420px; overflow:auto; }
  footer { color:var(--muted); font-size:12px; margin-top:24px; }
  a { color:var(--eq); }
  h2 { font-size:16px; margin:26px 0 6px; }
</style>
</head>
<body>
<header>
  <h1>US Tornado &amp; Earthquake Casualties, 1900&ndash;2025</h1>
  <div class="sub">Annual tornado deaths &middot; event-level earthquakes &middot; notable tornado events. Self-contained &mdash; no network needed.</div>
</header>
<main>
  <div class="controls">
    <strong>Series:</strong>
    <button id="b-torn" class="active">Tornado deaths</button>
    <button id="b-eq" class="active">Earthquake deaths</button>
    <label><input type="checkbox" id="logscale"> log scale</label>
    <span class="sub" id="hint">Hover bars for details.</span>
  </div>

  <div class="card">
    <canvas id="chart" width="1040" height="420"></canvas>
    <div class="legend">
      <span><span class="swatch" style="background:var(--torn)"></span>Tornado deaths / year</span>
      <span><span class="swatch" style="background:var(--eq)"></span>Earthquake deaths / year</span>
    </div>
  </div>

  <h2>Notable tornadoes</h2>
  <div class="card scroll"><table>
    <thead><tr><th>Date</th><th>Event</th><th>Rating</th><th>States</th>
      <th class="num">Deaths</th><th class="num">Injuries</th><th>Notes</th></tr></thead>
    <tbody id="t-torn"></tbody>
  </table></div>

  <h2>Earthquake events</h2>
  <div class="card scroll"><table>
    <thead><tr><th>Date</th><th>Event</th><th>State</th><th class="num">Mag</th>
      <th class="num">Deaths</th><th class="num">Injuries</th><th>Notes</th></tr></thead>
    <tbody id="t-eq"></tbody>
  </table></div>

  <footer id="foot"></footer>
</main>
<div class="tip" id="tip"></div>
<script>
const DATA = /*__DATA__*/;
const tip = document.getElementById('tip');
const cv = document.getElementById('chart');
const ctx = cv.getContext('2d');
const state = { torn:true, eq:true, log:false, bars:[] };

const tornByYear = {}; DATA.tornadoes_annual.forEach(d => tornByYear[d.year]=d.deaths);
const eqByYear = {}; DATA.earthquakes_annual.forEach(d => eqByYear[d.year]=d.deaths);
const years = DATA.tornadoes_annual.map(d => d.year);
const notableByYear = {}; DATA.notable_tornadoes.forEach(t => {
  const y=+t.date.slice(0,4); (notableByYear[y]=notableByYear[y]||[]).push(t); });
const eqEventsByYear = {}; DATA.earthquakes_events.forEach(e => {
  const y=+e.date.slice(0,4); (eqEventsByYear[y]=eqEventsByYear[y]||[]).push(e); });

function draw() {
  const W=cv.width, H=cv.height, padL=46, padR=12, padT=14, padB=28;
  ctx.clearRect(0,0,W,H);
  const plotW=W-padL-padR, plotH=H-padT-padB;
  let maxV=1;
  years.forEach(y=>{ if(state.torn) maxV=Math.max(maxV,tornByYear[y]||0);
                     if(state.eq) maxV=Math.max(maxV,eqByYear[y]||0); });
  const yToPix = v => {
    if(state.log){ const lv=Math.log10(Math.max(v,0.5)), lm=Math.log10(Math.max(maxV,1));
      return padT+plotH-(lv-Math.log10(0.5))/(lm-Math.log10(0.5))*plotH; }
    return padT+plotH-(v/maxV)*plotH;
  };
  // axes
  ctx.strokeStyle='#ddd'; ctx.fillStyle='#888'; ctx.font='10px sans-serif';
  const ticks = state.log ? [1,10,100,1000] : [0, Math.round(maxV/4), Math.round(maxV/2), Math.round(3*maxV/4), maxV];
  ticks.forEach(t=>{ if(state.log && t>maxV) return; const py=yToPix(t);
    ctx.beginPath(); ctx.moveTo(padL,py); ctx.lineTo(W-padR,py); ctx.stroke();
    ctx.fillText(t, 6, py+3); });
  // bars
  const n=years.length, slot=plotW/n;
  state.bars=[];
  years.forEach((y,i)=>{
    const x0=padL+i*slot;
    const series=[];
    if(state.torn) series.push(['torn', tornByYear[y]||0, '#c1440e']);
    if(state.eq) series.push(['eq', eqByYear[y]||0, '#1d4e89']);
    const bw=Math.max(1,(slot-1)/Math.max(series.length,1));
    series.forEach((s,si)=>{
      const v=s[1]; if(v<=0 && !(state.log)) {}
      const py=yToPix(v), x=x0+si*bw;
      const h=padT+plotH-py;
      if(v>0){ ctx.fillStyle=s[2]; ctx.fillRect(x, py, Math.max(bw-0.5,0.8), h); }
      state.bars.push({x, y:py, w:Math.max(bw,2), h:Math.max(h,2), year:y, kind:s[0], val:v});
    });
  });
  // x labels every 10 yrs
  ctx.fillStyle='#888';
  years.forEach((y,i)=>{ if(y%10===0){ const x=padL+i*slot;
    ctx.fillText(y, x-8, H-8); }});
}

function showTip(b, mx, my){
  let html = '<b>'+b.year+'</b> &mdash; '+(b.kind==='torn'?'Tornado':'Earthquake')+' deaths: '+b.val;
  if(b.kind==='torn' && notableByYear[b.year]) html += '<br>'+notableByYear[b.year].map(t=>'&bull; '+t.name+' ('+t.rating+'): '+t.deaths+' dead').join('<br>');
  if(b.kind==='eq' && eqEventsByYear[b.year]) html += '<br>'+eqEventsByYear[b.year].map(e=>'&bull; '+e.name+' (M'+e.magnitude+'): '+e.deaths+' dead').join('<br>');
  tip.innerHTML=html; tip.style.opacity=1;
  tip.style.left=Math.min(mx+12, innerWidth-tip.offsetWidth-10)+'px';
  tip.style.top=(my+12)+'px';
}
cv.addEventListener('mousemove', e=>{
  const r=cv.getBoundingClientRect(), sx=cv.width/r.width, sy=cv.height/r.height;
  const mx=(e.clientX-r.left)*sx, my=(e.clientY-r.top)*sy;
  const hit=state.bars.find(b=> mx>=b.x-1 && mx<=b.x+b.w+1 && my>=b.y-2 && my<=b.y+b.h+2);
  if(hit){ cv.style.cursor='pointer'; showTip(hit, e.clientX, e.clientY); }
  else { cv.style.cursor='default'; tip.style.opacity=0; }
});
cv.addEventListener('mouseleave', ()=> tip.style.opacity=0);

function toggle(btn, key){ btn.onclick=()=>{ state[key]=!state[key]; btn.classList.toggle('active', state[key]); draw(); }; }
toggle(document.getElementById('b-torn'),'torn');
toggle(document.getElementById('b-eq'),'eq');
document.getElementById('logscale').onchange=e=>{ state.log=e.target.checked; draw(); };

function fillBody(el, rows, cols){
  el.innerHTML=rows.map(r=>'<tr>'+cols.map(c=>'<td class="'+(c.num?'num':'')+'">'+(r[c.key]??'')+'</td>').join('')+'</tr>').join('');
}
fillBody(document.getElementById('t-torn'), DATA.notable_tornadoes, [
  {key:'date'},{key:'name'},{key:'rating'},{key:'states'},
  {key:'deaths',num:1},{key:'injuries',num:1},{key:'notes'}]);
fillBody(document.getElementById('t-eq'), DATA.earthquakes_events, [
  {key:'date'},{key:'name'},{key:'state'},{key:'magnitude',num:1},
  {key:'deaths',num:1},{key:'injuries',num:1},{key:'notes'}]);

document.getElementById('foot').innerHTML='Sources: '+DATA.sources.map(s=>'<a href="'+s.url+'" target="_blank">'+s.title+'</a>').join(' &middot; ')
  +'<br>'+DATA.caveats.map(c=>'&bull; '+c).join('<br>');

draw();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    build()
