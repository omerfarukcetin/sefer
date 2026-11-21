"""namazvakti.com yıllık XML'lerini indirip uygulamanın okuyacağı JSON dosyalarına çevirir.

Sütunlar (Türkiye Takvimi sırası): İmsak, Sabah, Güneş, İşrak, Kerahet, Öğle, İkindi,
Asr-ı sani, İsfirar, Akşam, İştibak, Yatsı, İşa-i sani, Kıble saati.
"""
import json, re, sys, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "vakit"
NAMES = ["imsak","sabah","gunes","israk","kerahet","ogle","ikindi","asrisani","isfirar","aksam","istibak","yatsi","isaisani","kible"]

def fetch(city_id):
    req = urllib.request.Request(f"https://namazvakti.com/XML.php?cityID={city_id}", headers={"User-Agent": "Mozilla/5.0 (SEFER vakit)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")

def parse(xml_text):
    m = re.search(r"<!--\s*(\d{4})\s*-->", xml_text)
    year = int(m.group(1)) if m else None
    root = ET.fromstring(xml_text[xml_text.index("<cityinfo"):])
    days = {}
    for p in root.iter("prayertimes"):
        doy, d, mo = int(p.get("dayofyear")), int(p.get("day")), int(p.get("month"))
        y = year - 1 if doy == 0 else (year + 1 if (mo == 1 and doy > 300) else year)
        vals = (p.text or "").split()
        times = [v.zfill(5) if re.fullmatch(r"\d{1,2}:\d{2}", v) else "" for v in vals[:14]]
        days[f"{y:04d}-{mo:02d}-{d:02d}"] = times
    return {"name": (root.get("cityNameTR") or "").strip(), "year": year, "cols": NAMES, "days": days}

def main():
    index = []
    for line in (ROOT / "sehirler.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cid, _, name = line.partition(" ")
        try:
            data = parse(fetch(cid))
        except Exception as e:  # bir şehir başarısız olursa diğerlerine devam et
            print(f"{cid}: {e}", file=sys.stderr)
            if (ROOT / f"{cid}.json").exists():
                index.append({"id": cid, "name": name.strip() or cid})
            continue
        data["id"] = cid
        old = ROOT / f"{cid}.json"
        if old.exists():  # yıl değişince geçen yılın günleri kaybolmasın
            try:
                prev = json.loads(old.read_text(encoding="utf-8")).get("days", {})
                data["days"] = {**prev, **data["days"]}
            except Exception:
                pass
        keep = sorted(data["days"])[-800:]
        data["days"] = {k: data["days"][k] for k in keep}
        (ROOT / f"{cid}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append({"id": cid, "name": name.strip() or data["name"]})
        print(f"{cid} {data['name']}: {len(data['days'])} gün")
    (ROOT / "sehirler.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
