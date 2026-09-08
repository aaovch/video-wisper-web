"""Copy canonical terminology for offline enrichment; never modify the HEMA repo."""
import argparse
import hashlib
import json
from pathlib import Path

import yaml

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()
raw = args.source.read_bytes()
source = yaml.safe_load(raw)
entries = []
for dimension, definition in source["dimensions"].items():
    for key, value in definition["values"].items():
        entries.append({"id": f"dimensions.{dimension}.values.{key}", "type": "value",
                        **{k: value[k] for k in ("label", "aliases", "asr_variants", "note") if k in value}})
for key, value in source["technique_presets"]["presets"].items():
    entries.append({"id": f"technique_presets.presets.{key}", "type": "preset",
                    **{k: value[k] for k in ("kind", "aliases", "asr_variants", "note", "expands_to") if k in value}})
data = {"version": 1, "source": "hema_fight_analysator/techniques.yaml",
        "sourceVersion": source["version"], "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "entries": entries}
target = Path(__file__).resolve().parents[2] / "src/lib/data/hema-search-dictionary.json"
if not args.dry_run:
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
runtime_target = target.with_name('hema-search-presets.json')
runtime = [{"id": e["id"], "aliases": e.get("aliases", []), "asr": e.get("asr_variants", [])}
           for e in entries if e["type"] == "preset"]
if not args.dry_run:
    runtime_target.write_text(json.dumps(runtime, ensure_ascii=False, separators=(',', ':')) + "\n", encoding="utf-8")
print(json.dumps({"ok": True, "dryRun": args.dry_run, "entries": len(entries),
                  "sourceSha256": data["sourceSha256"], "artifacts": [{"path": str(target)}, {"path": str(runtime_target)}]}))
