# US Tornado & Earthquake Casualties, 1900–2025

A rich, graph-ready dataset of **US tornado and earthquake deaths and injuries**
spanning **126 years (1900–2025)**. Built so you can plot long-run trends, compare
the two hazards, and drill into individual catastrophic events.

Open **[`visualize.html`](visualize.html)** in any browser for an interactive,
fully offline view (hover bars for per-year event details, toggle series, switch
to log scale). Everything is regenerated from a single source file, `build.py`.

## What's here

| File | Description |
|------|-------------|
| `build.py` | Single source of truth. Curated data + provenance; regenerates everything. |
| `us_disasters.json` | Full bundle: annual series, event lists, sources, caveats. |
| `visualize.html` | Self-contained interactive viewer (no network / no CDN). |
| `charts/*.png` | Static chart previews. |
| `csv/tornadoes_annual.csv` | `year, deaths` — annual US tornado deaths, 1900–2025. |
| `csv/earthquakes_events.csv` | `date, name, state, magnitude, deaths, injuries, tsunami, notes` |
| `csv/earthquakes_annual.csv` | `year, deaths, injuries, events` — earthquakes aggregated by year. |
| `csv/notable_tornadoes.csv` | `date, name, rating, states, deaths, injuries, notes` |
| `csv/combined_annual.csv` | `year, tornado_deaths, earthquake_deaths` — side by side. |

## Rebuild

```bash
pip install matplotlib        # only dependency, only needed for the PNG charts
python3 build.py
```

To edit the data, change the tables at the top of `build.py` and re-run — the
CSVs, JSON, charts, and HTML all regenerate from it.

## Why this shape?

The two hazards behave very differently statistically, so they're modeled differently:

- **Tornadoes** kill in most years, so deaths are a **continuous annual series**
  — the headline metric historians track. 1900 (101 deaths) → 1925 Tri-State year
  (794, the worst on record) → the long mid-century decline as warning systems
  improved → the 2011 spike (553, the deadliest modern year).
- **Earthquakes** kill in bursts, so they're stored as an **event list** and then
  aggregated to a yearly series. ~80% of all US earthquake deaths since 1900 come
  from a single event: the 1906 San Francisco earthquake.

## Data quality & caveats

- **Tornado deaths**: 1875–1949 from Thomas Grazulis' *Significant Tornadoes*;
  1950+ from the National Weather Service / Storm Prediction Center.
- **Tornado injuries**: not provided as an annual series — a clean continuous
  series isn't freely published (it requires the SPC SVRGIS/WCM database).
  Injuries are instead given **at the event level** for major tornadoes, where
  they're well documented (see `notable_tornadoes.csv`).
- **Earthquake casualties** are best-available estimates; per-event ranges and
  caveats are in each event's `notes`. The **1906 San Francisco** death toll uses
  the modern ~3,000 estimate rather than the historical official figure of ~700.
- **Territories included**: e.g. the **1918 Puerto Rico (San Fermín)** earthquake
  and tsunami, and distant-quake tsunamis that killed on US soil (e.g. the **1946
  Aleutian** tsunami that struck Hilo, Hawaii).

## Sources

- [US Annual Tornado Death Tolls, 1875–present (NOAA/NSSL)](https://inside.nssl.noaa.gov/nsslnews/2009/03/us-annual-tornado-death-tolls-1875-present/)
- [Annual Fatal Tornado Summary (NOAA/NWS Storm Prediction Center)](https://www.spc.noaa.gov/climo/torn/fatalmap.php)
- [List of earthquakes in the United States (Wikipedia)](https://en.wikipedia.org/wiki/List_of_earthquakes_in_the_United_States)
- [List of deadly earthquakes since 1900 (Wikipedia)](https://en.wikipedia.org/wiki/List_of_deadly_earthquakes_since_1900)
- [USGS Earthquake Hazards — Lists, Maps, and Statistics](https://www.usgs.gov/programs/earthquake-hazards/lists-maps-and-statistics)
