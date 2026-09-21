#!/usr/bin/env python3
"""Derive the conference wing's gazetteer from GeoNames (CC BY 4.0).

    python3 build/geo/make-geo.py            (from conferences/)

Downloads two GeoNames dumps into build/geo/.cache/ (git-ignored) and writes
two small, committed tables that the payload builder — and, in WordPress,
inc/conference-geo.php — resolve places from:

  cities.tsv     name · country ISO · lat · lon · population · capital flag
                 every place GeoNames lists with 15,000+ inhabitants (~34k)
  countries.tsv  ISO · name · capital lat · lon (largest city where no capital is marked)

With these, a new conference in "Cape Town, South Africa" or "Los Angeles, USA"
and speakers from any country place themselves on the globe with no
configuration. Attribution: GeoNames, https://www.geonames.org/ (CC BY 4.0).
"""
import io
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
BASE = "https://download.geonames.org/export/dump/"


def fetch(name):
    CACHE.mkdir(exist_ok=True)
    p = CACHE / name
    if not p.exists():
        print(f"downloading {name}")
        p.write_bytes(urllib.request.urlopen(BASE + name, timeout=60).read())
    return p


def main():
    raw = fetch("cities15000.zip").read_bytes()
    cities_txt = zipfile.ZipFile(io.BytesIO(raw)).read("cities15000.txt").decode("utf8")
    info = fetch("countryInfo.txt").read_text(encoding="utf8")

    cities, capital, biggest = [], {}, {}
    for line in cities_txt.splitlines():
        f = line.split("\t")
        name, lat, lon, fcode, cc, pop = f[1], float(f[4]), float(f[5]), f[7], f[8], int(f[14] or 0)
        is_cap = fcode == "PPLC"
        cities.append((name, cc, round(lat, 2), round(lon, 2), pop, 1 if is_cap else 0))
        if is_cap and (cc not in capital or pop > capital[cc][2]):
            capital[cc] = (round(lat, 2), round(lon, 2), pop)
        if cc not in biggest or pop > biggest[cc][2]:
            biggest[cc] = (round(lat, 2), round(lon, 2), pop)
    cities.sort(key=lambda c: -c[4])
    (HERE / "cities.tsv").write_text(
        "# GeoNames cities15000 (CC BY 4.0) — name\tiso\tlat\tlon\tpop\tcapital\n"
        + "\n".join("\t".join(map(str, c)) for c in cities) + "\n", encoding="utf8")

    rows = []
    for line in info.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        f = line.split("\t")
        iso, name = f[0], f[4]
        # the capital; where GeoNames marks none (a disputed one, e.g. PS),
        # the country's most populous place stands in for it
        cap = capital.get(iso) or biggest.get(iso)
        if cap:
            rows.append((iso, name, cap[0], cap[1]))
    (HERE / "countries.tsv").write_text(
        "# GeoNames countryInfo + capitals (CC BY 4.0) — iso\tname\tlat\tlon\n"
        + "\n".join("\t".join(map(str, r)) for r in rows) + "\n", encoding="utf8")
    print(f"cities.tsv {len(cities)} · countries.tsv {len(rows)}")


if __name__ == "__main__":
    main()
